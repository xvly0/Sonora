package dev.sonora.music

import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.log10
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * 5-band parametric peaking EQ (60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz) running in
 * Media3's PCM pipeline so every ExoPlayer stream (plus crossfade tail) gets
 * consistent, lock-free equalisation with automatic headroom attenuation.
 */
object SonoraEqualizer {

    val FREQUENCIES = intArrayOf(60, 230, 910, 3600, 14000)

    class Tuning(val gains: FloatArray) {
        val inputGain: Double = 10.0.pow(-headroom(gains) / 20.0)
    }

    @Volatile
    var tuning: Tuning? = null
        private set

    fun update(gains: FloatArray) {
        val normalized = FloatArray(FREQUENCIES.size) { i ->
            (gains.getOrNull(i) ?: 0f).coerceIn(-9f, 9f)
        }
        val isFlat = normalized.all { kotlin.math.abs(it) < 0.05f }
        val current = tuning
        if (isFlat) {
            if (current != null) tuning = null
            return
        }
        if (current != null && current.gains.contentEquals(normalized)) {
            return
        }
        tuning = Tuning(normalized)
    }

    fun headroom(gains: FloatArray): Float {
        var peak = 0.0
        var f = 30.0
        while (f <= 20000.0) {
            peak = maxOf(peak, responseDb(gains, f, REFERENCE_RATE))
            f *= 1.08
        }
        return peak.toFloat().coerceAtLeast(0f)
    }

    private fun responseDb(gains: FloatArray, frequency: Double, sampleRate: Int): Double {
        val w = 2.0 * PI * frequency / sampleRate
        val cosW = cos(w)
        val cos2W = cos(2 * w)
        val sinW = sin(w)
        val sin2W = sin(2 * w)
        var total = 0.0
        for (band in FREQUENCIES.indices) {
            val c = Biquad.peaking(FREQUENCIES[band].toDouble(), gains[band].toDouble(), sampleRate) ?: continue
            val numRe = c.b0 + c.b1 * cosW + c.b2 * cos2W
            val numIm = -(c.b1 * sinW + c.b2 * sin2W)
            val denRe = 1.0 + c.a1 * cosW + c.a2 * cos2W
            val denIm = -(c.a1 * sinW + c.a2 * sin2W)
            val magnitude = sqrt((numRe * numRe + numIm * numIm) / (denRe * denRe + denIm * denIm))
            total += 20.0 * log10(magnitude)
        }
        return total
    }

    private const val REFERENCE_RATE = 48000
}

private class Biquad(val b0: Double, val b1: Double, val b2: Double, val a1: Double, val a2: Double) {
    companion object {
        private const val Q = 1.1

        fun peaking(frequency: Double, gainDb: Double, sampleRate: Int): Biquad? {
            if (gainDb == 0.0 || frequency >= sampleRate * 0.45) return null
            val a = 10.0.pow(gainDb / 40.0)
            val w0 = 2.0 * PI * frequency / sampleRate
            val alpha = sin(w0) / (2.0 * Q)
            val cosW0 = cos(w0)
            val a0 = 1.0 + alpha / a
            return Biquad(
                b0 = (1.0 + alpha * a) / a0,
                b1 = -2.0 * cosW0 / a0,
                b2 = (1.0 - alpha * a) / a0,
                a1 = -2.0 * cosW0 / a0,
                a2 = (1.0 - alpha / a) / a0,
            )
        }
    }
}

@OptIn(UnstableApi::class)
class SonoraEqAudioProcessor : BaseAudioProcessor() {

    private var appliedTuning: SonoraEqualizer.Tuning? = null
    private var configuredRate = 0
    private var configuredChannels = 0
    private val bands = arrayOfNulls<Biquad>(SonoraEqualizer.FREQUENCIES.size)
    private var activeBandCount = 0
    private var state = DoubleArray(0)

    override fun onConfigure(
        inputAudioFormat: AudioProcessor.AudioFormat,
    ): AudioProcessor.AudioFormat {
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) {
            throw AudioProcessor.UnhandledAudioFormatException(inputAudioFormat)
        }
        return inputAudioFormat
    }

    override fun onFlush() {
        state.fill(0.0)
    }

    override fun onReset() {
        appliedTuning = null
        configuredRate = 0
        configuredChannels = 0
        bands.fill(null)
        activeBandCount = 0
        state = DoubleArray(0)
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        val size = inputBuffer.remaining()
        if (size == 0) return

        // Keep BaseAudioProcessor.isActive() true across flat/active transitions so mid-song EQ
        // toggles take effect immediately; replaceOutputBuffer reuses a single direct ByteBuffer.
        val out = replaceOutputBuffer(size)
        val wanted = SonoraEqualizer.tuning
        if (wanted == null) {
            out.put(inputBuffer)
            out.flip()
            if (appliedTuning != null || activeBandCount != 0) {
                appliedTuning = null
                activeBandCount = 0
                bands.fill(null)
                state.fill(0.0)
            }
            return
        }

        val channels = inputAudioFormat.channelCount
        val rate = inputAudioFormat.sampleRate
        if (channels <= 0 || rate <= 0) {
            out.put(inputBuffer)
            out.flip()
            return
        }

        if (wanted !== appliedTuning || rate != configuredRate || channels != configuredChannels) {
            configure(wanted, rate, channels)
        }

        val count = activeBandCount
        if (count == 0 || (size and 1) != 0) {
            if (count == 0) state.fill(0.0)
            out.put(inputBuffer)
            out.flip()
            return
        }

        val samples = size ushr 1
        val prevOrder = inputBuffer.order()
        inputBuffer.order(ByteOrder.LITTLE_ENDIAN)
        out.order(ByteOrder.LITTLE_ENDIAN)
        try {
            val gain = wanted.inputGain
            val z = state
            val bandArr = bands
            var i = 0
            while (i + channels <= samples) {
                for (c in 0 until channels) {
                    var x = inputBuffer.getShort() * gain
                    var s = c * 2
                    for (b in 0 until count) {
                        val f = bandArr[b]!!
                        val y = f.b0 * x + z[s]
                        z[s] = f.b1 * x - f.a1 * y + z[s + 1]
                        z[s + 1] = f.b2 * x - f.a2 * y
                        x = y
                        s += channels * 2
                    }
                    val clamped = when {
                        x > Short.MAX_VALUE -> Short.MAX_VALUE.toInt()
                        x < Short.MIN_VALUE -> Short.MIN_VALUE.toInt()
                        else -> x.roundToInt()
                    }
                    out.putShort(clamped.toShort())
                }
                i += channels
            }
            while (i < samples) {
                out.putShort(inputBuffer.getShort())
                i++
            }
        } finally {
            inputBuffer.order(prevOrder)
        }
        out.flip()
    }

    private fun configure(wanted: SonoraEqualizer.Tuning, sampleRate: Int, channels: Int) {
        var count = 0
        for (band in SonoraEqualizer.FREQUENCIES.indices) {
            val biquad = Biquad.peaking(
                SonoraEqualizer.FREQUENCIES[band].toDouble(),
                wanted.gains[band].toDouble(),
                sampleRate,
            )
            if (biquad != null) {
                bands[count++] = biquad
            }
        }
        for (k in count until bands.size) bands[k] = null
        val sameShape = sampleRate == configuredRate && channels == configuredChannels && count == activeBandCount
        val neededState = count * channels * 2
        if (count == 0) {
            state.fill(0.0)
        } else if (state.size < neededState) {
            state = DoubleArray(neededState)
        } else if (!sameShape) {
            state.fill(0.0, 0, neededState)
        }
        activeBandCount = count
        appliedTuning = wanted
        configuredRate = sampleRate
        configuredChannels = channels
    }
}
