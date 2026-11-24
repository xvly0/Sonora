package dev.sonora.music

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioTimestamp
import android.media.AudioTrack
import android.os.Process
import androidx.media3.common.AudioAttributes
import androidx.media3.common.AuxEffectInfo
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MimeTypes
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.SonicAudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import androidx.media3.exoplayer.audio.ForwardingAudioSink
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.Executors
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt
import kotlin.math.tanh

/**
 * Shared PCM mixer for dual ExoPlayer crossfade & instant skip-fade.
 * Ported from Square (dev.lelonio.square.backend.youtube.PcmMixer) and adapted
 * for Sonora's Media3 1.5.0 AudioSink pipeline.
 */
@UnstableApi
class PcmMixer {

    private val lock = Object()
    private val channels = mutableListOf<MixerChannel>()
    private val track: AudioTrack
    private val thread: Thread
    @Volatile private var running = true

    @Volatile private var framesWritten = 0L

    private val clockLock = Object()
    private var headFrames = 0L
    private var headNanos = 0L
    private var headAdvancing = false
    private var lastRawHead = 0L
    private var headWraps = 0L
    private var lastPlayed = 0L
    private val timestamp = AudioTimestamp()

    private var pending: Handover? = null
    private val worker = Executors.newSingleThreadExecutor { r ->
        Thread(r, "SonoraMixerAlign").apply { isDaemon = true }
    }

    init {
        val minBuffer = AudioTrack.getMinBufferSize(
            RATE, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_FLOAT,
        )
        track = AudioTrack.Builder()
            .setAudioAttributes(
                android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build(),
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                    .setSampleRate(RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                    .build(),
            )
            .setTransferMode(AudioTrack.MODE_STREAM)
            .setBufferSizeInBytes(max(minBuffer, TRACK_BUFFER_FRAMES * 2 * 4))
            .build()
        thread = Thread(::loop, "SonoraMixer").apply {
            isDaemon = true
            start()
        }
    }

    val audioSessionId: Int get() = track.audioSessionId

    @Volatile
    var skipFadeMs: () -> Int = { 0 }

    @Volatile
    var volumeNormEnabled: Boolean = true

    internal fun liveFrames(): Int {
        val fade = skipFadeMs()
        val wanted = if (fade > 0) (fade + LIVE_MARGIN_MS) * RATE / 1000 else RATE / 4
        return wanted.coerceIn(RATE / 4, RATE * 2)
    }

    internal fun setPreferredDevice(device: AudioDeviceInfo?) {
        runCatching { track.preferredDevice = device }
    }

    internal fun attachAuxEffect(effectId: Int) {
        runCatching { track.attachAuxEffect(effectId) }
            .onFailure { android.util.Log.w(TAG, "reverb not attached: ${it.message}") }
    }

    internal fun setAuxEffectSendLevel(level: Float) {
        runCatching { track.setAuxEffectSendLevel(level) }
    }

    internal fun add(channel: MixerChannel) = synchronized(lock) {
        channels += channel
        lock.notifyAll()
    }

    internal fun remove(channel: MixerChannel) = synchronized(lock) {
        channels -= channel
        lock.notifyAll()
    }

    internal fun wake() = synchronized(lock) { lock.notifyAll() }

    internal fun playedFrames(): Long = synchronized(clockLock) {
        val estimate = if (!headAdvancing) {
            headFrames
        } else {
            val since = (System.nanoTime() - headNanos).coerceIn(0, MAX_EXTRAPOLATION_NS)
            min(headFrames + since * RATE / 1_000_000_000L, framesWritten)
        }
        lastPlayed = max(lastPlayed, estimate)
        lastPlayed
    }

    fun handOver(from: MixerSlot, to: MixerSlot, done: (Boolean) -> Unit) {
        synchronized(lock) {
            pending?.done?.invoke(false)
            pending = Handover(from, to, done, System.nanoTime())
            lock.notifyAll()
        }
    }

    fun detach(slot: MixerSlot, fadeMs: Int): Boolean = synchronized(lock) {
        val channel = slot.channel ?: return false
        if (!channel.playing || channel.queuedFrames() == 0) return false
        channel.orphan(slot.gain(), max(1, fadeMs * RATE / 1000))
        slot.channel = null
        lock.notifyAll()
        true
    }

    fun cancelHandOver() = synchronized(lock) {
        pending?.done?.invoke(false)
        pending = null
    }

    fun release() {
        running = false
        wake()
        runCatching { thread.join(500) }
        worker.shutdownNow()
        runCatching { track.stop() }
        runCatching { track.release() }
    }

    private fun loop() {
        Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
        val block = FloatArray(BLOCK_FRAMES * 2)
        val active = ArrayList<MixerChannel>(4)
        while (running) {
            active.clear()
            synchronized(lock) {
                var i = channels.size - 1
                while (i >= 0) {
                    if (channels[i].finished) channels.removeAt(i)
                    i--
                }
                while (running) {
                    var anyPlaying = false
                    for (j in 0 until channels.size) {
                        if (channels[j].playing) {
                            anyPlaying = true
                            break
                        }
                    }
                    if (anyPlaying) break
                    if (track.playState == AudioTrack.PLAYSTATE_PLAYING) {
                        track.pause()
                        readHead(advancing = false)
                    }
                    lock.wait(250)
                }
                for (j in 0 until channels.size) {
                    val ch = channels[j]
                    if (ch.playing) active.add(ch)
                }
            }
            if (!running) break
            if (track.playState != AudioTrack.PLAYSTATE_PLAYING) track.play()
            block.fill(0f)
            runHandover()
            for (j in 0 until active.size) {
                val channel = active[j]
                if (channel.slot.held && !channel.orphaned) continue
                channel.mixInto(block, BLOCK_FRAMES, framesWritten)
            }
            active.clear()
            softLimitBlock(block)
            var offset = 0
            while (offset < block.size && running) {
                val wrote = track.write(block, offset, block.size - offset, AudioTrack.WRITE_BLOCKING)
                if (wrote < 0) break
                offset += wrote
            }
            framesWritten += BLOCK_FRAMES
            readHead(advancing = true)
        }
    }

    private fun softLimitBlock(block: FloatArray) {
        for (i in block.indices) {
            val raw = block[i]
            if (abs(raw) > 0.95f) {
                block[i] = softLimitSample(raw)
            }
        }
    }

    private fun readHead(advancing: Boolean) {
        val now = System.nanoTime()
        val stamped = track.getTimestamp(timestamp) && now - timestamp.nanoTime in 0..STALE_TIMESTAMP_NS
        val raw = track.playbackHeadPosition.toLong() and 0xFFFF_FFFFL
        synchronized(clockLock) {
            if (raw < lastRawHead) headWraps++
            val moved = raw != lastRawHead
            lastRawHead = raw
            if (stamped && advancing) {
                headFrames = timestamp.framePosition
                headNanos = timestamp.nanoTime
            } else if (moved || !advancing || !headAdvancing) {
                headFrames = (headWraps shl 32) + raw
                headNanos = now
            }
            headAdvancing = advancing
        }
    }

    private fun runHandover() {
        val request = synchronized(lock) { pending } ?: return
        fun finish(ok: Boolean) {
            synchronized(lock) { if (pending === request) pending = null }
            request.done(ok)
        }
        val source = request.from.channel
        val target = request.to.channel
        if (source == null || target == null || System.nanoTime() - request.startedNanos > HANDOVER_TIMEOUT_NS) {
            android.util.Log.w(TAG, "handover gave up: source=${source != null} target=${target != null}")
            finish(false)
            return
        }
        val result = request.result
        if (request.computing && result == null) return
        if (result != null && (result.source !== source || result.target !== target)) {
            request.result = null
            request.computing = false
            return
        }
        if (result == null) {
            if (source.historyFrames() < REF_FRAMES || target.queuedFrames() < MIN_PILE_FRAMES) return
            val consumed = source.consumedFrames()
            val heardUs = source.mediaTimeAt(consumed)
            val firstTargetUs = target.firstStampUs()
            val refDurationUs = REF_FRAMES * 1_000_000L / RATE
            // Wait until source's last REF_FRAMES window actually overlaps target's buffered stamps
            if (heardUs != null && firstTargetUs != null && heardUs - refDurationUs < firstTargetUs) {
                return
            }
            val reference = source.history(REF_FRAMES)
            val pileLen = target.pileMonoInto()
            val pile = target.pileScratchBuffer
            val expected = heardUs?.let { target.frameAt(it) }?.let { (it - target.consumedFrames()).toInt() }
            request.computing = true
            worker.execute {
                val (offset, score) = locate(reference, pile, expected?.minus(REF_FRAMES), pileLen)
                request.result = Match(source, target, consumed, offset, score)
                request.computing = false
            }
            return
        }
        request.result = null
        val skip = result.offset + REF_FRAMES + (source.consumedFrames() - result.consumed)
        if (result.score < MIN_SCORE || skip < 0) {
            if (++request.attempts >= MAX_ATTEMPTS) finish(false)
            return
        }
        if (skip + BLOCK_FRAMES > target.queuedFrames()) {
            if (target.queuedFrames() >= target.capacity - BLOCK_FRAMES || ++request.attempts >= MAX_ATTEMPTS) {
                finish(false)
            }
            return
        }
        target.skip(skip.toInt())
        request.from.fade = 0f
        request.to.fade = 1f
        request.to.held = false
        finish(true)
    }

    private class Handover(
        val from: MixerSlot,
        val to: MixerSlot,
        val done: (Boolean) -> Unit,
        val startedNanos: Long,
    ) {
        @Volatile var computing = false
        @Volatile var result: Match? = null
        var attempts = 0
    }

    private class Match(
        val source: MixerChannel,
        val target: MixerChannel,
        val consumed: Long,
        val offset: Int,
        val score: Float,
    )

    companion object {
        const val RATE = 48_000

        private const val LIVE_MARGIN_MS = 150
        private const val BLOCK_FRAMES = 480
        private const val TRACK_BUFFER_FRAMES = 3_840
        private const val MAX_EXTRAPOLATION_NS = 100_000_000L
        private const val STALE_TIMESTAMP_NS = 500_000_000L
        internal const val REF_FRAMES = 4_096
        private const val MIN_PILE_FRAMES = RATE / 2
        private const val MIN_SCORE = 0.6f
        private const val MAX_ATTEMPTS = 8
        private const val HANDOVER_TIMEOUT_NS = 3_000_000_000L
        private const val DECIMATION = 4
        private const val SEARCH_RADIUS = RATE / 10
        internal const val TAG = "SonoraMixer"

        internal fun computeTrackNormGain(loudnessDb: Float): Float {
            if (loudnessDb.isNaN() || loudnessDb == 0f) return 1.0f
            val targetDb = (-loudnessDb * 0.28f).coerceIn(-1.8f, 1.5f)
            return 10f.pow(targetDb / 20f).coerceIn(0.81f, 1.19f)
        }

        internal fun softLimitSample(raw: Float): Float {
            val mag = abs(raw)
            if (mag <= 0.95f) return raw
            val limited = 0.95f + 0.05f * tanh((mag - 0.95f) / 0.05f)
            return if (raw < 0f) -limited else limited
        }

        /**
         * Where [reference] starts inside [pile], by normalised cross-correlation:
         * coarsely on both decimated, then sample by sample around the best.
         */
        internal fun locate(
            reference: FloatArray,
            pile: FloatArray,
            around: Int?,
            pileLen: Int = pile.size,
        ): Pair<Int, Float> {
            if (pileLen < reference.size) return -1 to 0f
            val ref = decimate(reference, reference.size)
            val hay = decimate(pile, pileLen)
            val refEnergy = ref.sumOf { (it * it).toDouble() }
            if (refEnergy < 1e-6) return -1 to 0f
            val prefix = DoubleArray(hay.size + 1)
            for (i in hay.indices) prefix[i + 1] = prefix[i] + hay[i] * hay[i]
            var best = 0
            var bestScore = -1.0
            val first = around?.let { max(0, (it - SEARCH_RADIUS) / DECIMATION) } ?: 0
            val last = around?.let { min(hay.size - ref.size, (it + SEARCH_RADIUS) / DECIMATION) } ?: (hay.size - ref.size)
            if (first > last) return -1 to 0f
            for (k in first..last) {
                var dot = 0.0
                for (i in ref.indices) dot += ref[i] * hay[k + i]
                val energy = prefix[k + ref.size] - prefix[k]
                if (energy <= 0) continue
                val score = dot / sqrt(refEnergy * energy)
                if (score > bestScore) {
                    bestScore = score
                    best = k
                }
            }
            val fullEnergy = reference.sumOf { (it * it).toDouble() }
            var fine = best * DECIMATION
            var fineScore = -1.0
            val from = max(0, best * DECIMATION - 2 * DECIMATION)
            val to = min(pileLen - reference.size, best * DECIMATION + 2 * DECIMATION)
            for (k in from..to) {
                var dot = 0.0
                var energy = 0.0
                for (i in reference.indices) {
                    val v = pile[k + i]
                    dot += reference[i] * v
                    energy += v * v
                }
                if (energy <= 0) continue
                val score = dot / sqrt(fullEnergy * energy)
                if (score > fineScore) {
                    fineScore = score
                    fine = k
                }
            }
            return fine to fineScore.toFloat()
        }

        private fun decimate(samples: FloatArray, len: Int = samples.size): FloatArray {
            val out = FloatArray(len / DECIMATION)
            for (i in out.indices) {
                var sum = 0f
                for (j in 0 until DECIMATION) sum += samples[i * DECIMATION + j]
                out[i] = sum / DECIMATION
            }
            return out
        }
    }
}

class MixerSlot(
    private val follows: MixerSlot? = null,
    initialFade: Float = 1f,
) {
    @Volatile var fade = initialFade
    @Volatile var held = false
    @Volatile internal var volume = 1f
    @Volatile internal var loudnessDb = 0f
    @Volatile internal var channel: MixerChannel? = null
    @Volatile var mixed = false
        internal set

    fun setTrackLoudnessDb(loudnessDb: Float) {
        val clean = if (loudnessDb.isNaN()) 0f else loudnessDb
        this.loudnessDb = clean
        channel?.setTrackLoudnessDb(clean)
    }

    internal fun resetDynamicNorm() {
        channel?.resetDynamicNorm()
    }

    internal fun gain(): Float = fade * (follows ?: this).volume
}

@UnstableApi
class MixerChannel internal constructor(
    private val mixer: PcmMixer,
    internal val slot: MixerSlot,
    private val inputChannels: Int,
    private val floatInput: Boolean,
) {
    internal val capacity = PcmMixer.RATE * 2
    private val ring = FloatArray(capacity * 2)
    private var readIndex = 0
    private var queued = 0
    private var consumed = 0L

    private val stampFrame = LongArray(MAX_STAMPS)
    private val stampTimeUs = LongArray(MAX_STAMPS)
    private var stampHead = 0
    private var stampCount = 0
    private var lastStampUs = Long.MIN_VALUE
    private var lastGain = -1f

    private val history = FloatArray(PcmMixer.REF_FRAMES)
    private val historyScratch = FloatArray(PcmMixer.REF_FRAMES)
    internal val pileScratchBuffer = FloatArray(capacity)
    private var historyIndex = 0
    private var historyCount = 0

    private val blockTrackFrame = LongArray(MAX_BLOCKS)
    private val blockConsumed = LongArray(MAX_BLOCKS)
    private val blockCountFrames = LongArray(MAX_BLOCKS)
    private var blockHead = 0
    private var blockCount = 0
    private var playedBase = 0L

    @Volatile internal var playing = false
    private var released = false

    @Volatile internal var orphaned = false
        private set
    private var orphanFrom = 0f
    private var orphanTotal = 1
    private var orphanDone = 0

    @Volatile internal var finished = false
        private set

    @Volatile var trackNormGain: Float = 1.0f
    private var rmsEnv: Float = 0.18f
    private var dynamicTrim: Float = 1.0f
    private var lastNormGain: Float = -1f
    @Volatile private var pendingNormReset = false

    init {
        trackNormGain = PcmMixer.computeTrackNormGain(slot.loudnessDb)
        slot.channel = this
        mixer.add(this)
    }

    fun setTrackLoudnessDb(loudnessDb: Float) {
        trackNormGain = PcmMixer.computeTrackNormGain(loudnessDb)
    }

    internal fun resetDynamicNorm() {
        pendingNormReset = true
    }

    internal fun play() {
        playing = true
        mixer.wake()
    }

    internal fun pause() {
        if (!orphaned) playing = false
    }

    internal fun orphan(gain: Float, frames: Int) = synchronized(this) {
        orphanFrom = gain
        orphanTotal = frames
        orphanDone = 0
        orphaned = true
        playing = true
    }

    internal fun write(buffer: ByteBuffer, presentationTimeUs: Long): Boolean {
        val bytesPerSample = if (floatInput) 4 else 2
        val frameBytes = bytesPerSample * inputChannels
        synchronized(this) {
            if (released) return true
            val available = buffer.remaining() / frameBytes
            if (presentationTimeUs >= 0 && presentationTimeUs != lastStampUs) {
                if (stampCount == MAX_STAMPS) {
                    stampHead = (stampHead + 1) % MAX_STAMPS
                    stampCount--
                }
                val tail = (stampHead + stampCount) % MAX_STAMPS
                stampFrame[tail] = consumed + queued
                stampTimeUs[tail] = presentationTimeUs
                stampCount++
                lastStampUs = presentationTimeUs
            }
            val room = (if (slot.held) capacity else mixer.liveFrames()) - queued
            val frames = min(available, max(0, room))
            if (frames > 0) {
                val prevOrder = buffer.order()
                buffer.order(ByteOrder.nativeOrder())
                try {
                    var write = (readIndex + queued) % capacity
                    val extraChannels = max(0, inputChannels - 2)
                    for (f in 0 until frames) {
                        val left: Float
                        val right: Float
                        if (floatInput) {
                            left = buffer.getFloat()
                            right = if (inputChannels > 1) buffer.getFloat() else left
                            if (extraChannels > 0) buffer.position(buffer.position() + extraChannels * 4)
                        } else {
                            left = buffer.getShort() / 32768f
                            right = if (inputChannels > 1) buffer.getShort() / 32768f else left
                            if (extraChannels > 0) buffer.position(buffer.position() + extraChannels * 2)
                        }
                        ring[write * 2] = left
                        ring[write * 2 + 1] = right
                        write++
                        if (write == capacity) write = 0
                    }
                } finally {
                    buffer.order(prevOrder)
                }
                queued += frames
            }
            return frames == available
        }
    }

    internal fun mixInto(block: FloatArray, frames: Int, trackFrame: Long) = synchronized(this) {
        val target = slot.gain()
        val start = if (lastGain < 0) target else lastGain
        lastGain = target
        val n = min(frames, queued)
        if (orphaned && (n == 0 || orphanDone >= orphanTotal)) {
            finished = true
            return@synchronized
        }
        if (n == 0) return@synchronized
        if (pendingNormReset) {
            pendingNormReset = false
            rmsEnv = 0.18f
            dynamicTrim = 1.0f
        }
        val normTarget = if (mixer.volumeNormEnabled) {
            var sumSq = 0.0
            for (i in 0 until n) {
                val at = (readIndex + i) % capacity
                val l = ring[at * 2]
                val r = ring[at * 2 + 1]
                sumSq += (l * l + r * r) * 0.5
            }
            val chunkRms = sqrt(sumSq / n).toFloat()
            rmsEnv += (chunkRms - rmsEnv) * 0.015f
            val desiredTrim = if (rmsEnv > 0.02f) (0.18f / rmsEnv).pow(0.18f).coerceIn(0.88f, 1.12f) else 1.0f
            dynamicTrim += (desiredTrim - dynamicTrim) * 0.04f
            (trackNormGain * dynamicTrim).coerceIn(0.80f, 1.22f)
        } else {
            1.0f
        }
        val normStart = if (lastNormGain < 0f) normTarget else lastNormGain
        lastNormGain = normTarget
        for (i in 0 until n) {
            val baseGain = if (orphaned) {
                val x = min(1f, (orphanDone + i).toFloat() / orphanTotal)
                orphanFrom * cos(x * PI.toFloat() / 2)
            } else {
                start + (target - start) * (i + 1) / frames
            }
            val normGain = normStart + (normTarget - normStart) * (i + 1) / n
            val gain = baseGain * normGain
            val left = ring[readIndex * 2]
            val right = ring[readIndex * 2 + 1]
            block[i * 2] += left * gain
            block[i * 2 + 1] += right * gain
            history[historyIndex] = (left + right) * 0.5f
            historyIndex = (historyIndex + 1) % history.size
            if (historyCount < history.size) historyCount++
            readIndex = (readIndex + 1) % capacity
        }
        queued -= n
        if (orphaned) orphanDone += n
        if (blockCount == MAX_BLOCKS) {
            playedBase = blockConsumed[blockHead] + blockCountFrames[blockHead]
            blockHead = (blockHead + 1) % MAX_BLOCKS
            blockCount--
        }
        val bTail = (blockHead + blockCount) % MAX_BLOCKS
        blockTrackFrame[bTail] = trackFrame
        blockConsumed[bTail] = consumed
        blockCountFrames[bTail] = n.toLong()
        blockCount++
        consumed += n
    }

    internal fun skip(frames: Int) = synchronized(this) {
        val n = min(frames, queued)
        readIndex = (readIndex + n) % capacity
        queued -= n
        consumed += n
        lastGain = 0f
    }

    internal fun queuedFrames(): Int = synchronized(this) { queued }
    internal fun consumedFrames(): Long = synchronized(this) { consumed }
    internal fun historyFrames(): Int = synchronized(this) { historyCount }
    internal fun firstStampUs(): Long? = synchronized(this) {
        if (stampCount == 0) null else stampTimeUs[stampHead]
    }

    internal fun history(frames: Int): FloatArray = synchronized(this) {
        val target = if (frames == historyScratch.size) historyScratch else FloatArray(frames)
        for (i in 0 until frames) {
            target[i] = history[(historyIndex - frames + i + history.size * 2) % history.size]
        }
        target
    }

    internal fun mediaTimeAt(frame: Long): Long? = synchronized(this) {
        var beforeIdx = -1
        var afterIdx = -1
        for (i in 0 until stampCount) {
            val idx = (stampHead + i) % MAX_STAMPS
            val sf = stampFrame[idx]
            if (sf <= frame) {
                beforeIdx = idx
            } else {
                afterIdx = idx
                break
            }
        }
        if (beforeIdx < 0) return null
        val bf = stampFrame[beforeIdx]
        val bt = stampTimeUs[beforeIdx]
        if (afterIdx < 0 || stampFrame[afterIdx] == bf) {
            return bt + (frame - bf) * 1_000_000L / PcmMixer.RATE
        }
        bt + (stampTimeUs[afterIdx] - bt) * (frame - bf) / (stampFrame[afterIdx] - bf)
    }

    internal fun frameAt(timeUs: Long): Long? = synchronized(this) {
        var beforeIdx = -1
        var afterIdx = -1
        for (i in 0 until stampCount) {
            val idx = (stampHead + i) % MAX_STAMPS
            val st = stampTimeUs[idx]
            if (st <= timeUs) {
                beforeIdx = idx
            } else {
                afterIdx = idx
                break
            }
        }
        if (beforeIdx < 0) return null
        val bf = stampFrame[beforeIdx]
        val bt = stampTimeUs[beforeIdx]
        if (afterIdx < 0 || stampTimeUs[afterIdx] == bt) {
            return bf + (timeUs - bt) * PcmMixer.RATE / 1_000_000L
        }
        bf + (stampFrame[afterIdx] - bf) * (timeUs - bt) / (stampTimeUs[afterIdx] - bt)
    }

    internal fun pileMonoInto(): Int = synchronized(this) {
        val n = min(queued, pileScratchBuffer.size)
        for (i in 0 until n) {
            val at = (readIndex + i) % capacity
            pileScratchBuffer[i] = (ring[at * 2] + ring[at * 2 + 1]) * 0.5f
        }
        n
    }

    internal fun playedFrames(): Long = synchronized(this) {
        val heard = mixer.playedFrames()
        while (blockCount > 0) {
            val tf = blockTrackFrame[blockHead]
            val cf = blockCountFrames[blockHead]
            if (heard >= tf + cf) {
                playedBase = max(playedBase, blockConsumed[blockHead] + cf)
                blockHead = (blockHead + 1) % MAX_BLOCKS
                blockCount--
            } else {
                break
            }
        }
        if (blockCount == 0) return playedBase
        val firstTf = blockTrackFrame[blockHead]
        if (heard <= firstTf) return playedBase
        blockConsumed[blockHead] + (heard - firstTf)
    }

    internal fun getPositionUs(): Long = playedFrames() * 1_000_000L / PcmMixer.RATE

    internal fun flush() = synchronized(this) {
        if (orphaned) return@synchronized
        readIndex = 0
        queued = 0
        consumed = 0
        playedBase = 0
        blockHead = 0
        blockCount = 0
        stampHead = 0
        stampCount = 0
        lastStampUs = Long.MIN_VALUE
        historyCount = 0
        rmsEnv = 0.18f
        dynamicTrim = 1.0f
        lastNormGain = -1f
        pendingNormReset = false
    }

    internal fun release() {
        synchronized(this) {
            if (released) return
            released = true
            if (!orphaned) playing = false
        }
        if (slot.channel === this) slot.channel = null
        if (!orphaned) mixer.remove(this)
    }

    private companion object {
        const val MAX_BLOCKS = 200
        const val MAX_STAMPS = 2_000
    }
}

/**
 * Resamples every 16-bit PCM stream to [PcmMixer.RATE] and preserves that target
 * rate across SonicAudioProcessor resets.
 */
@UnstableApi
class MixerRateProcessor : AudioProcessor {

    private val sonic = SonicAudioProcessor().apply { setOutputSampleRateHz(PcmMixer.RATE) }

    override fun configure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
        sonic.setOutputSampleRateHz(PcmMixer.RATE)
        return sonic.configure(inputAudioFormat)
    }

    override fun isActive() = sonic.isActive
    override fun queueInput(inputBuffer: ByteBuffer) = sonic.queueInput(inputBuffer)
    override fun queueEndOfStream() = sonic.queueEndOfStream()
    override fun getOutput(): ByteBuffer = sonic.output
    override fun isEnded() = sonic.isEnded
    override fun getDurationAfterProcessorApplied(durationUs: Long) = sonic.getDurationAfterProcessorApplied(durationUs)

    override fun flush() = sonic.flush()

    override fun reset() {
        sonic.reset()
        sonic.setOutputSampleRateHz(PcmMixer.RATE)
    }
}

/**
 * Media3 1.5.0 AudioSink adapter that routes mixable PCM through [SonoraEqAudioProcessor],
 * [MixerRateProcessor] (48 kHz), and [PcmMixer], falling back to [DefaultAudioSink] otherwise.
 */
@UnstableApi
class MixerAudioSink(
    context: Context,
    private val mixer: PcmMixer,
    private val slot: MixerSlot,
) : ForwardingAudioSink(
    DefaultAudioSink.Builder(context)
        .setAudioProcessors(arrayOf(SonoraEqAudioProcessor()))
        .build()
) {
    private val eqProcessor = SonoraEqAudioProcessor()
    private val rateProcessor = MixerRateProcessor()

    private var channel: MixerChannel? = null
    private var listener: AudioSink.Listener? = null
    private var outChannels = 0
    private var outFloat = false
    private var useProcessors = false
    private var playing = false
    private var startMediaTimeUs = C.TIME_UNSET
    private var discontinuityPending = false
    private var ended = false
    private var pendingOut: ByteBuffer = AudioProcessor.EMPTY_BUFFER
    private var pendingStampUs: Long = C.TIME_UNSET

    private fun isMixable(format: Format): Boolean =
        format.sampleMimeType == MimeTypes.AUDIO_RAW &&
            (format.pcmEncoding == C.ENCODING_PCM_16BIT || format.pcmEncoding == C.ENCODING_PCM_FLOAT) &&
            format.channelCount in 1..8 &&
            format.sampleRate > 0

    override fun setListener(listener: AudioSink.Listener) {
        this.listener = listener
        super.setListener(listener)
    }

    override fun supportsFormat(format: Format): Boolean =
        if (isMixable(format)) true else super.supportsFormat(format)

    override fun getFormatSupport(format: Format): Int =
        if (isMixable(format)) AudioSink.SINK_FORMAT_SUPPORTED_DIRECTLY else super.getFormatSupport(format)

    override fun configure(inputFormat: Format, specifiedBufferSize: Int, outputChannels: IntArray?) {
        val canMix = isMixable(inputFormat) &&
            (inputFormat.pcmEncoding == C.ENCODING_PCM_16BIT || inputFormat.sampleRate == PcmMixer.RATE)
        if (!canMix) {
            releaseActiveChannel()
            slot.mixed = false
            useProcessors = false
            pendingOut = AudioProcessor.EMPTY_BUFFER
            super.configure(inputFormat, specifiedBufferSize, outputChannels)
            return
        }

        if (inputFormat.pcmEncoding == C.ENCODING_PCM_16BIT) {
            val inFmt = AudioProcessor.AudioFormat(inputFormat.sampleRate, inputFormat.channelCount, C.ENCODING_PCM_16BIT)
            val eqOutFmt = eqProcessor.configure(inFmt)
            val effectiveEqFmt = if (eqOutFmt != AudioProcessor.AudioFormat.NOT_SET) eqOutFmt else inFmt
            eqProcessor.flush()
            rateProcessor.configure(effectiveEqFmt)
            rateProcessor.flush()
            outChannels = effectiveEqFmt.channelCount
            outFloat = false
            useProcessors = true
        } else {
            eqProcessor.reset()
            rateProcessor.reset()
            outChannels = inputFormat.channelCount
            outFloat = true
            useProcessors = false
        }

        releaseActiveChannel()
        slot.mixed = true
        val ch = MixerChannel(mixer, slot, outChannels, outFloat)
        if (playing) ch.play()
        channel = ch
        pendingOut = AudioProcessor.EMPTY_BUFFER
        startMediaTimeUs = C.TIME_UNSET
        ended = false
    }

    private fun releaseActiveChannel() {
        val cur = channel
        if (cur != null) {
            if (!cur.orphaned) cur.release()
            channel = null
        }
    }

    private fun ensureChannel(): MixerChannel? {
        if (!slot.mixed) return null
        val cur = channel
        if (cur != null && slot.channel === cur && !cur.orphaned) return cur
        if (cur != null && !cur.orphaned) cur.release()
        if (outChannels <= 0) return null
        val created = MixerChannel(mixer, slot, outChannels, outFloat)
        if (playing) created.play()
        channel = created
        return created
    }

    override fun play() {
        playing = true
        if (slot.mixed) {
            channel?.play()
        } else {
            super.play()
        }
    }

    override fun pause() {
        playing = false
        if (slot.mixed) {
            channel?.pause()
        } else {
            super.pause()
        }
    }

    override fun handleDiscontinuity() {
        if (slot.mixed) {
            discontinuityPending = true
        } else {
            super.handleDiscontinuity()
        }
    }

    override fun handleBuffer(buffer: ByteBuffer, presentationTimeUs: Long, encodedAccessUnitCount: Int): Boolean {
        if (!slot.mixed) return super.handleBuffer(buffer, presentationTimeUs, encodedAccessUnitCount)
        val ch = ensureChannel() ?: return true
        if (startMediaTimeUs == C.TIME_UNSET && presentationTimeUs >= 0L) {
            startMediaTimeUs = presentationTimeUs
        }
        if (discontinuityPending) {
            discontinuityPending = false
            listener?.onPositionDiscontinuity()
        }
        if (pendingOut.hasRemaining()) {
            val drained = ch.write(pendingOut, pendingStampUs)
            if (!drained || pendingOut.hasRemaining()) return false
            pendingOut = AudioProcessor.EMPTY_BUFFER
        }
        if (!buffer.hasRemaining()) return true
        val room = (if (slot.held) ch.capacity else mixer.liveFrames()) - ch.queuedFrames()
        if (room <= 0) return false
        pendingStampUs = presentationTimeUs
        return if (useProcessors) {
            eqProcessor.queueInput(buffer)
            val eqOut = eqProcessor.output
            val processed = if (rateProcessor.isActive) {
                if (eqOut.hasRemaining()) rateProcessor.queueInput(eqOut)
                rateProcessor.output
            } else {
                eqOut
            }
            if (processed.hasRemaining()) {
                val allWritten = ch.write(processed, presentationTimeUs)
                pendingOut = if (!allWritten || processed.hasRemaining()) processed else AudioProcessor.EMPTY_BUFFER
            }
            !buffer.hasRemaining()
        } else {
            ch.write(buffer, presentationTimeUs)
        }
    }

    override fun playToEndOfStream() {
        if (!slot.mixed) {
            super.playToEndOfStream()
            return
        }
        ended = true
        val ch = ensureChannel() ?: return
        if (pendingOut.hasRemaining()) {
            ch.write(pendingOut, pendingStampUs)
            if (!pendingOut.hasRemaining()) pendingOut = AudioProcessor.EMPTY_BUFFER
        }
        if (useProcessors) {
            eqProcessor.queueEndOfStream()
            val eqOut = eqProcessor.output
            val tail = if (rateProcessor.isActive) {
                if (eqOut.hasRemaining()) rateProcessor.queueInput(eqOut)
                rateProcessor.queueEndOfStream()
                rateProcessor.output
            } else {
                eqOut
            }
            if (tail.hasRemaining()) {
                val written = ch.write(tail, pendingStampUs)
                if (!written || tail.hasRemaining()) pendingOut = tail
            }
        }
    }

    override fun isEnded(): Boolean =
        if (slot.mixed) ended && !pendingOut.hasRemaining() && (channel?.queuedFrames() ?: 0) == 0 else super.isEnded()

    override fun hasPendingData(): Boolean =
        if (slot.mixed) pendingOut.hasRemaining() || (channel?.queuedFrames() ?: 0) > 0 else super.hasPendingData()

    override fun getCurrentPositionUs(sourceEnded: Boolean): Long {
        if (!slot.mixed) return super.getCurrentPositionUs(sourceEnded)
        val ch = channel ?: return AudioSink.CURRENT_POSITION_NOT_SET
        if (startMediaTimeUs == C.TIME_UNSET) return AudioSink.CURRENT_POSITION_NOT_SET
        return startMediaTimeUs + ch.getPositionUs()
    }

    override fun setVolume(volume: Float) {
        slot.volume = volume
        super.setVolume(volume)
    }

    override fun setPreferredDevice(audioDeviceInfo: AudioDeviceInfo?) {
        mixer.setPreferredDevice(audioDeviceInfo)
        super.setPreferredDevice(audioDeviceInfo)
    }

    override fun setAuxEffectInfo(auxEffectInfo: AuxEffectInfo) {
        if (auxEffectInfo.effectId != AuxEffectInfo.NO_AUX_EFFECT_ID) {
            mixer.attachAuxEffect(auxEffectInfo.effectId)
            mixer.setAuxEffectSendLevel(auxEffectInfo.sendLevel)
        }
        super.setAuxEffectInfo(auxEffectInfo)
    }

    override fun flush() {
        if (slot.mixed) {
            if (useProcessors) {
                eqProcessor.flush()
                rateProcessor.flush()
            }
            pendingOut = AudioProcessor.EMPTY_BUFFER
            pendingStampUs = C.TIME_UNSET
            startMediaTimeUs = C.TIME_UNSET
            ended = false
            discontinuityPending = false
            channel?.flush()
        } else {
            super.flush()
        }
    }

    override fun reset() {
        releaseActiveChannel()
        eqProcessor.reset()
        rateProcessor.reset()
        pendingOut = AudioProcessor.EMPTY_BUFFER
        pendingStampUs = C.TIME_UNSET
        startMediaTimeUs = C.TIME_UNSET
        ended = false
        discontinuityPending = false
        useProcessors = false
        slot.mixed = false
        super.reset()
    }

    override fun release() {
        releaseActiveChannel()
        eqProcessor.reset()
        rateProcessor.reset()
        super.release()
    }
}
