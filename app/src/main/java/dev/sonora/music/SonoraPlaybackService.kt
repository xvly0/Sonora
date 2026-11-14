package dev.sonora.music

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Base64
import androidx.annotation.OptIn
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.Tracks
import androidx.media3.common.util.BitmapLoader
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.CacheWriter
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.CacheBitmapLoader
import androidx.media3.session.CommandButton
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.SettableFuture
import com.metrolist.innertube.YouTube
import com.metrolist.innertube.models.YouTubeClient
import java.io.File
import java.io.IOException
import java.net.URLDecoder
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import okhttp3.ConnectionPool
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.localization.ContentCountry
import org.schabi.newpipe.extractor.localization.Localization
import org.schabi.newpipe.extractor.stream.StreamInfo

data class StreamEntry(
    val timestamp: Long,
    val url: String,
    val codec: String = "AAC",
    val bitrateKbps: Int = 128,
    val sampleRateHz: Int = 44100,
    val loudnessDb: Float = 0f
) {
    fun formatLabel(): String {
        return if (sampleRateHz > 48000) "Hi-Res Lossless" else "Lossless"
    }
}

object StreamCache {
    private const val TTL_MS = 2 * 60 * 60 * 1000L // 2 hours
    private val cache = ConcurrentHashMap<String, StreamEntry>()

    fun get(videoId: String): String? = getMeta(videoId)?.url

    fun getMeta(videoId: String): StreamEntry? {
        val entry = cache[videoId] ?: return null
        if (System.currentTimeMillis() - entry.timestamp < TTL_MS) {
            return entry
        }
        cache.remove(videoId)
        return null
    }

    fun put(
        videoId: String,
        url: String,
        codec: String = "AAC",
        bitrateKbps: Int = 128,
        sampleRateHz: Int = 44100,
        loudnessDb: Float = 0f
    ) {
        cache[videoId] = StreamEntry(System.currentTimeMillis(), url, codec, bitrateKbps, sampleRateHz, loudnessDb)
        if (cache.size > 128) {
            val oldest = cache.entries.minByOrNull { it.value.timestamp }
            oldest?.let { cache.remove(it.key) }
        }
    }

    fun updateLoudnessDb(videoId: String, loudnessDb: Float) {
        if (loudnessDb.isNaN() || loudnessDb == 0f) return
        cache[videoId]?.let { existing ->
            if (existing.loudnessDb != loudnessDb) {
                cache[videoId] = existing.copy(loudnessDb = loudnessDb)
            }
        }
    }

    fun forget(videoId: String) {
        cache.remove(videoId)
    }

    fun clear() {
        cache.clear()
    }
}

object SonoraAudioResolver {
    private val lock = Any()
    private val inFlight = ConcurrentHashMap<String, CompletableFuture<String?>>()
    private val loudnessCache = ConcurrentHashMap<String, Float>()

    @Volatile
    private var initialized = false

    fun isInFlight(videoId: String): Boolean = inFlight.containsKey(videoId)

    fun getLoudnessDb(videoId: String): Float {
        val cleanId = videoId.removePrefix("yt:").trim()
        if (cleanId.isEmpty()) return 0f
        StreamCache.getMeta(cleanId)?.loudnessDb?.takeIf { !it.isNaN() && it != 0f }?.let { return it }
        return loudnessCache[cleanId] ?: 0f
    }

    fun hasLoudnessDb(videoId: String): Boolean {
        val cleanId = videoId.removePrefix("yt:").trim()
        if (cleanId.isEmpty()) return false
        if (loudnessCache.containsKey(cleanId)) return true
        val metaDb = StreamCache.getMeta(cleanId)?.loudnessDb ?: 0f
        return !metaDb.isNaN() && metaDb != 0f
    }

    private fun rememberLoudnessDb(videoId: String, loudnessDb: Float) {
        if (loudnessDb.isNaN()) return
        val cleanId = videoId.removePrefix("yt:").trim()
        if (cleanId.isEmpty()) return
        if (loudnessCache.size > 512) {
            loudnessCache.keys.firstOrNull()?.let { loudnessCache.remove(it) }
        }
        loudnessCache[cleanId] = loudnessDb
        StreamCache.updateLoudnessDb(cleanId, loudnessDb)
    }

    private fun extractLoudnessDb(
        playerRes: com.metrolist.innertube.models.response.PlayerResponse?,
        audio: com.metrolist.innertube.models.response.PlayerResponse.StreamingData.Format? = null
    ): Float? {
        val audioCfg = playerRes?.playerConfig?.audioConfig
        val raw = audioCfg?.loudnessDb
            ?: audioCfg?.perceptualLoudnessDb
            ?: audio?.loudnessDb
            ?: playerRes?.streamingData?.adaptiveFormats?.firstOrNull { it.isAudio }?.loudnessDb
        return raw?.toFloat()?.takeIf { !it.isNaN() }
    }

    suspend fun fetchLoudnessDb(videoId: String): Float {
        val cleanId = videoId.removePrefix("yt:").trim()
        if (cleanId.isEmpty() || cleanId.startsWith("local_")) return 0f
        if (hasLoudnessDb(cleanId)) return getLoudnessDb(cleanId)
        return withContext(Dispatchers.IO) {
            val resolved = runCatching {
                withTimeoutOrNull(2500L) {
                    val playerRes = YouTube.player(cleanId, client = YouTubeClient.ANDROID_VR_1_65_10).getOrNull()
                    extractLoudnessDb(playerRes)
                }
            }.getOrNull()
            if (resolved != null) {
                rememberLoudnessDb(cleanId, resolved)
                resolved
            } else {
                0f
            }
        }
    }

    fun ensureNewPipe() {
        if (!initialized) {
            synchronized(lock) {
                if (!initialized) {
                    try {
                        NewPipe.init(
                            NewPipeDownloader.create(),
                            SonoraLocaleManager.newPipeLocalization(),
                            SonoraLocaleManager.newPipeContentCountry()
                        )
                    } catch (_: Exception) {
                        try {
                            NewPipe.init(NewPipeDownloader.create())
                        } catch (_: Exception) {}
                    }
                    initialized = true
                }
            }
        }
    }

    fun updateNewPipeLocale(lang: String, country: String) {
        if (!initialized) return
        runCatching {
            NewPipe.setupLocalization(
                Localization(lang, country),
                ContentCountry(country)
            )
        }
    }

    /**
     * Resolves the given YouTube videoId to a playable audio stream URL.
     * Deduplicates concurrent resolutions for the same videoId.
     * Uses NewPipe Extractor as PRIMARY: verified immune to YouTube PO token 403 blocks past 1MB.
     * Falls back to InnerTube parallel API resolution if needed.
     */
    fun resolve(videoId: String): String? {
        if (videoId.isBlank()) return null
        StreamCache.get(videoId)?.let { return it }

        val created = CompletableFuture<String?>()
        val existing = inFlight.putIfAbsent(videoId, created)
        if (existing != null) {
            return try {
                existing.get(15, TimeUnit.SECONDS)
            } catch (_: Exception) {
                null
            }
        }

        return try {
            val url = resolveUncached(videoId)
            created.complete(url)
            url
        } catch (t: Throwable) {
            created.completeExceptionally(t)
            null
        } finally {
            inFlight.remove(videoId, created)
        }
    }

    private fun resolveUncached(videoId: String): String? {
        StreamCache.get(videoId)?.let { return it }

        // 1. Primary: NewPipe Extractor (reliable, full length, no PO token 403 block past 1MB)
        try {
            ensureNewPipe()
            val watchUrl = "https://www.youtube.com/watch?v=$videoId"
            val info = StreamInfo.getInfo(ServiceList.YouTube, watchUrl)
            val audioStream = info.audioStreams
                .filter { !it.content.isNullOrEmpty() }
                .sortedWith(
                    compareByDescending<org.schabi.newpipe.extractor.stream.AudioStream> {
                        it.format == org.schabi.newpipe.extractor.MediaFormat.M4A
                    }.thenByDescending { it.averageBitrate }
                ).firstOrNull() ?: info.audioStreams.maxByOrNull { it.averageBitrate }

            val url = audioStream?.content
            if (!url.isNullOrEmpty()) {
                val fmtName = audioStream.format?.name ?: ""
                val codecName = when {
                    fmtName.contains("OPUS", ignoreCase = true) -> "Opus"
                    audioStream.codec?.contains("opus", ignoreCase = true) == true -> "Opus"
                    audioStream.codec?.contains("mp4a", ignoreCase = true) == true || fmtName.contains("M4A", ignoreCase = true) -> "AAC"
                    !audioStream.codec.isNullOrBlank() -> audioStream.codec!!.substringBefore('.').uppercase()
                    else -> "AAC"
                }
                val br = audioStream.averageBitrate.takeIf { it > 0 } ?: 128
                val sr = if (codecName == "Opus") 48000 else 44100
                val cachedDb = loudnessCache[videoId.removePrefix("yt:").trim()] ?: 0f
                StreamCache.put(videoId, url, codecName, br, sr, loudnessDb = cachedDb)
                return url
            }
        } catch (e: Exception) {
            android.util.Log.w("SonoraAudioResolver", "NewPipe extraction failed for $videoId: ${e.message}")
        }

        // 2. Secondary Fallback: InnerTube multi-client parallel API resolution
        try {
            val clients = listOf(
                YouTubeClient.ANDROID_VR_1_65_10,
                YouTubeClient.ANDROID_VR_1_61_48,
                YouTubeClient.VISIONOS,
                YouTubeClient.IOS
            )
            val resolvedPair = runBlocking {
                val deferred = CompletableDeferred<Pair<com.metrolist.innertube.models.response.PlayerResponse.StreamingData.Format, Float?>>()
                val jobs = clients.map { client ->
                    launch(Dispatchers.IO) {
                        try {
                            val playerRes = YouTube.player(videoId, client = client).getOrNull()
                            val formats = playerRes?.streamingData?.adaptiveFormats
                            val audio = formats?.filter { it.isAudio && !it.url.isNullOrEmpty() }
                                ?.sortedWith(
                                    compareByDescending<com.metrolist.innertube.models.response.PlayerResponse.StreamingData.Format> {
                                        it.mimeType.startsWith("audio/mp4")
                                    }.thenByDescending { it.bitrate }
                                )?.firstOrNull()
                            if (audio != null && !audio.url.isNullOrEmpty()) {
                                val db = extractLoudnessDb(playerRes, audio)
                                deferred.complete(audio to db)
                            }
                        } catch (_: Exception) {}
                    }
                }
                val result = withTimeoutOrNull(4000) { deferred.await() }
                jobs.forEach { it.cancel() }
                result
            }

            val resolvedFormat = resolvedPair?.first
            val directUrl = resolvedFormat?.url
            if (!directUrl.isNullOrEmpty()) {
                val mime = resolvedFormat.mimeType.lowercase()
                val codecName = when {
                    mime.contains("opus") -> "Opus"
                    mime.contains("mp4") || mime.contains("aac") -> "AAC"
                    else -> mime.substringAfter("audio/").substringBefore(';').uppercase().ifEmpty { "Audio" }
                }
                val brKbps = (resolvedFormat.bitrate / 1000).coerceAtLeast(64)
                val srHz = resolvedFormat.audioSampleRate ?: if (codecName == "Opus") 48000 else 44100
                val resolvedLoudness = resolvedPair.second
                if (resolvedLoudness != null) {
                    rememberLoudnessDb(videoId, resolvedLoudness)
                }
                StreamCache.put(videoId, directUrl, codecName, brKbps, srHz, loudnessDb = resolvedLoudness ?: 0f)
                return directUrl
            }
        } catch (e: Exception) {
            android.util.Log.w("SonoraAudioResolver", "InnerTube resolution failed for $videoId: ${e.message}")
        }

        return null
    }
}

@UnstableApi
private class SonoraStreamResolver : ResolvingDataSource.Resolver {
    override fun resolveDataSpec(dataSpec: DataSpec): DataSpec {
        val uri = dataSpec.uri.toString()
        val videoId = when {
            uri.startsWith("youtube:track:") -> uri.removePrefix("youtube:track:")
            uri.startsWith("youtube:") -> uri.removePrefix("youtube:")
            uri.startsWith("https://www.youtube.com/watch?v=") -> uri.removePrefix("https://www.youtube.com/watch?v=")
            !uri.startsWith("http://") && !uri.startsWith("https://") && !uri.startsWith("file://") && !uri.startsWith("content://") -> uri
            else -> return dataSpec
        }.substringBefore('&').substringBefore('#')

        val resolvedUrl = SonoraAudioResolver.resolve(videoId)
            ?: throw IOException("Unable to resolve audio stream for videoId: $videoId")

        return dataSpec.withUri(Uri.parse(resolvedUrl))
    }
}

@OptIn(UnstableApi::class)
class SonoraPlaybackService : MediaSessionService() {

    private val mixer = PcmMixer()
    private val mainSlot = MixerSlot()
    private val tailSlot = MixerSlot(follows = mainSlot, initialFade = 0f).apply { held = true }
    private lateinit var player: ExoPlayer
    private var tailPlayer: ExoPlayer? = null
    private var tailPreparedId: String? = null
    private var nextTrackId: String = ""
    private var transitionGen: Int = 0
    private lateinit var mediaDataSourceFactory: DataSource.Factory
    private lateinit var resolvingDataSourceFactory: ResolvingDataSource.Factory
    @Volatile
    private var lazyCacheDataSourceFactory: CacheDataSource.Factory? = null
    private val cacheFactoryLock = Any()
    private val prewarmedBytesIds = ConcurrentHashMap.newKeySet<String>()
    private val prewarmLock = Any()
    @Volatile
    private var prewarmBytesJob: Job? = null
    @Volatile
    private var prewarmBytesTrackId: String? = null
    private val favTrackIds = ConcurrentHashMap.newKeySet<String>()
    @Volatile
    private var currentIsFav: Boolean = false
    @Volatile
    private var currentRepeatMode: Int = 0
    private lateinit var musicAudioAttributes: AudioAttributes
    private var mediaSession: MediaSession? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var progressJob: Job? = null
    private var fadeJob: Job? = null
    private var tailReleaseJob: Job? = null
    private var sleepJob: Job? = null
    private var heldForeground = false
    private lateinit var pooledOkHttp: OkHttpClient
    private val artworkExecutor: ExecutorService = Executors.newFixedThreadPool(2)
    private var audioManager: AudioManager? = null
    private var audioDeviceCallback: AudioDeviceCallback? = null
    private var preferredDeviceId: Int? = null
    @Volatile
    private var cachedAudioOutputsJson: String? = null
    private var lastEmittedQuality: Pair<String, String>? = null

    @Volatile
    var currentTitle: String = "Sonora"
    @Volatile
    var currentArtist: String = ""
    @Volatile
    var currentTrackId: String = ""
    @Volatile
    var currentThumb: String = ""
    @Volatile
    private var nextThumb: String = ""
    @Volatile
    private var snapIsPlaying: Boolean = false
    @Volatile
    private var snapIsBuffering: Boolean = false
    @Volatile
    private var snapPositionMs: Long = 0L
    @Volatile
    private var snapDurationMs: Long = 0L
    @Volatile
    private var snapUpdatedAtElapsedMs: Long = 0L
    @Volatile
    private var snapQualityLabel: String = ""

    @Volatile
    private var baseVolume: Float = 0.62f
    @Volatile
    private var fadeEnvelope: Float = 1.0f
    @Volatile
    private var sleepFadeEnvelope: Float = 1.0f
    @Volatile
    private var crossfadeSec: Int = 0
    @Volatile
    private var skipFadeEnabled: Boolean = true
    @Volatile
    private var autoCrossfadeTriggeredForId: String? = null

    private var sleepEndsAtElapsedMs: Long? = null
    private var sleepMinutes: Int? = null
    private var sleepAtTrackEnd: Boolean = false

    private var recovering: Triple<String, Long, Int>? = null

    companion object {
        const val NOTIFICATION_CHANNEL_ID = "sonora_playback_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_TOGGLE_FAV = "dev.sonora.music.COMMAND_TOGGLE_FAV"
        const val ACTION_CYCLE_REPEAT = "dev.sonora.music.COMMAND_CYCLE_REPEAT"

        private const val RETRIES = 3
        private const val RETRY_DELAY_MS = 1_000L
        private const val RETRY_WINDOW_MS = 60_000L

        private val ARTIST_SPLIT_REGEX = Regex("""\s*,\s*|\s*&\s*""")
        private val ARTIST_STATS_REGEX = Regex("""(?i).*\d[\d.,]*\s*(?:k|m|b|mln|mila|milioni|mrd)?\s*(?:riproduzioni?|visualizzazioni?|ascolti?|iscritti?|views?|plays?|subscribers?).*""")
        private val ARTIST_NOISE_WORDS = setOf("brano", "canzone", "singolo", "album", "video", "song", "single", "track")

        var instance: SonoraPlaybackService? = null
            private set

        var playbackListener: PlaybackListener? = null

        @Volatile
        private var mediaCache: SimpleCache? = null
        private val mediaCacheLock = Any()

        private val downloadOkHttp: OkHttpClient by lazy {
            OkHttpClient.Builder()
                .connectionPool(ConnectionPool(8, 5, TimeUnit.MINUTES))
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(20, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .followRedirects(true)
                .followSslRedirects(true)
                .build()
        }

        suspend fun cacheTrackAudio(context: Context, videoId: String): Boolean = withContext(Dispatchers.IO) {
            val cleanId = videoId.trim()
            if (cleanId.isEmpty()) return@withContext false
            runCatching {
                val appCtx = context.applicationContext
                val cache = getMediaCache(appCtx)
                val httpFactory = OkHttpDataSource.Factory(downloadOkHttp)
                    .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
                val defaultFactory = DefaultDataSource.Factory(appCtx, httpFactory)
                val chunkedFactory = ChunkedDataSource.Factory(defaultFactory)
                val resolvingFactory = ResolvingDataSource.Factory(chunkedFactory, SonoraStreamResolver())
                val cacheFactory = CacheDataSource.Factory()
                    .setCache(cache)
                    .setUpstreamDataSourceFactory(resolvingFactory)
                    .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
                val dataSource = cacheFactory.createDataSourceForDownloading()
                val spec = DataSpec(Uri.parse("youtube:track:$cleanId"))
                CacheWriter(dataSource, spec, null, null).cache()
                true
            }.getOrElse { e ->
                android.util.Log.w("SonoraDownload", "Failed caching audio for $cleanId: ${e.message}")
                false
            }
        }

        fun removeCachedTrackAudio(context: Context, videoId: String) {
            val cleanId = videoId.trim()
            if (cleanId.isEmpty()) return
            instance?.prewarmedBytesIds?.remove(cleanId.removePrefix("yt:").trim())
            runCatching {
                val cache = getMediaCache(context.applicationContext)
                cache.removeResource("youtube:track:$cleanId")
            }
        }

        fun getMediaCache(context: Context): SimpleCache {
            mediaCache?.let { return it }
            synchronized(mediaCacheLock) {
                mediaCache?.let { return it }
                val dir = File(context.cacheDir, "sonora_media_cache")
                val evictor = LeastRecentlyUsedCacheEvictor(600L * 1024L * 1024L) // 600 MB LRU disk cache
                val databaseProvider = StandaloneDatabaseProvider(context.applicationContext)
                return SimpleCache(dir, evictor, databaseProvider).also { mediaCache = it }
            }
        }

        fun getMediaCacheSizeBytes(context: Context): Long {
            mediaCache?.let { cache ->
                return runCatching { cache.cacheSpace }.getOrDefault(0L)
            }
            val dir = File(context.cacheDir, "sonora_media_cache")
            if (!dir.exists()) return 0L
            var sum = 0L
            dir.walkTopDown().forEach { if (it.isFile) sum += it.length() }
            return sum
        }

        fun clearAudioDiskCache(context: Context) {
            StreamCache.clear()
            instance?.prewarmedBytesIds?.clear()
            val cache = mediaCache ?: run {
                val dir = File(context.cacheDir, "sonora_media_cache")
                if (dir.exists()) dir.walkBottomUp().forEach { if (it.isFile) runCatching { it.delete() } }
                return
            }
            val activeUri = instance?.currentTrackId?.takeIf { it.isNotEmpty() }?.let { "youtube:track:$it" }
            runCatching {
                cache.keys.toList().forEach { key ->
                    if (activeUri == null || !key.contains(activeUri)) {
                        runCatching { cache.removeResource(key) }
                    }
                }
            }
        }

        interface PlaybackListener {
            fun onPlaybackState(isPlaying: Boolean, positionMs: Long, durationMs: Long, isBuffering: Boolean, trackId: String = "")
            fun onTrackEnded()
            fun onNextClicked()
            fun onPrevClicked()
            fun onPlaybackError(trackId: String, errorMsg: String)
            fun onStreamQuality(trackId: String, label: String) {}
            fun onGaplessTransition(trackId: String) {}
            fun onAutoCrossfade(fromTrackId: String) {}
            fun onSleepTimerState(active: Boolean, mode: String, remainingSec: Long) {}
            fun onAudioOutputsChanged() {}
            fun onToggleFavorite(trackId: String, isFav: Boolean) {}
            fun onCycleRepeat(repeatMode: Int) {}
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        SonoraLocaleManager.attach(this)
        if (currentArtist.isEmpty()) {
            currentArtist = SonoraLocaleManager.getString(this, R.string.playback_default_artist)
        }

        createNotificationChannel()

        setMediaNotificationProvider(
            DefaultMediaNotificationProvider.Builder(this)
                .build()
                .apply {
                    setSmallIcon(R.drawable.ic_notification)
                }
        )

        val audioAttributes = AudioAttributes.Builder()
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .setUsage(C.USAGE_MEDIA)
            .build()

        pooledOkHttp = OkHttpClient.Builder()
            .connectionPool(ConnectionPool(32, 5, TimeUnit.MINUTES))
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()

        val httpDataSourceFactory = OkHttpDataSource.Factory(pooledOkHttp)
            .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

        val defaultDataSourceFactory = DefaultDataSource.Factory(this, httpDataSourceFactory)
        val chunkedDataSourceFactory = ChunkedDataSource.Factory(defaultDataSourceFactory)
        resolvingDataSourceFactory = ResolvingDataSource.Factory(chunkedDataSourceFactory, SonoraStreamResolver())

        mediaDataSourceFactory = DataSource.Factory {
            getOrCreateCacheDataSourceFactory().createDataSource()
        }

        // Warm SimpleCache SQLite index and NewPipe extractor off the Main thread
        scope.launch(Dispatchers.IO) {
            runCatching { getMediaCache(this@SonoraPlaybackService) }
            runCatching { SonoraAudioResolver.ensureNewPipe() }
        }

        musicAudioAttributes = audioAttributes

        mixer.skipFadeMs = { if (skipFadeEnabled) 520 else 0 }
        player = buildExoPlayer(handleAudioFocus = true, slot = mainSlot)
        applyEffectiveVolume()

        val mgr = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        audioManager = mgr
        if (mgr != null) {
            val cb = object : AudioDeviceCallback() {
                override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>) {
                    cachedAudioOutputsJson = null
                    playbackListener?.onAudioOutputsChanged()
                }
                override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>) {
                    cachedAudioOutputsJson = null
                    val activePreferred = preferredDeviceId
                    if (activePreferred != null && removedDevices.any { it.id == activePreferred }) {
                        preferredDeviceId = null
                        applyPreferredOutputDevice(null)
                    }
                    playbackListener?.onAudioOutputsChanged()
                }
            }
            audioDeviceCallback = cb
            mgr.registerAudioDeviceCallback(cb, Handler(Looper.getMainLooper()))
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val forwardingPlayer = object : ForwardingPlayer(player) {
            override fun seekToNext() {
                playbackListener?.onNextClicked()
            }
            override fun seekToNextMediaItem() {
                playbackListener?.onNextClicked()
            }
            override fun seekToPrevious() {
                playbackListener?.onPrevClicked()
            }
            override fun seekToPreviousMediaItem() {
                playbackListener?.onPrevClicked()
            }
            override fun getAvailableCommands(): Player.Commands {
                return super.getAvailableCommands().buildUpon()
                    .add(Player.COMMAND_SEEK_TO_NEXT)
                    .add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
                    .add(Player.COMMAND_SEEK_TO_PREVIOUS)
                    .add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
                    .add(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM)
                    .build()
            }
            override fun isCommandAvailable(command: Int): Boolean {
                return when (command) {
                    Player.COMMAND_SEEK_TO_NEXT,
                    Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
                    Player.COMMAND_SEEK_TO_PREVIOUS,
                    Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
                    Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM -> true
                    else -> super.isCommandAvailable(command)
                }
            }
        }

        val favSessionCommand = SessionCommand(ACTION_TOGGLE_FAV, Bundle.EMPTY)
        val repeatSessionCommand = SessionCommand(ACTION_CYCLE_REPEAT, Bundle.EMPTY)
        mediaSession = MediaSession.Builder(this, forwardingPlayer)
            .setSessionActivity(pendingIntent)
            .setBitmapLoader(CacheBitmapLoader(SonoraBitmapLoader()))
            .setCallback(object : MediaSession.Callback {
                override fun onConnect(
                    session: MediaSession,
                    controller: MediaSession.ControllerInfo
                ): MediaSession.ConnectionResult {
                    val base = super.onConnect(session, controller)
                    val availableCommands = base.availableSessionCommands
                        .buildUpon()
                        .add(repeatSessionCommand)
                        .add(favSessionCommand)
                        .build()
                    val layout = listOf(
                        buildRepeatCommandButton(currentRepeatMode),
                        buildFavCommandButton(currentIsFav)
                    )
                    return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                        .setAvailableSessionCommands(availableCommands)
                        .setAvailablePlayerCommands(base.availablePlayerCommands)
                        .setCustomLayout(layout)
                        .setMediaButtonPreferences(layout)
                        .build()
                }

                override fun onCustomCommand(
                    session: MediaSession,
                    controller: MediaSession.ControllerInfo,
                    customCommand: SessionCommand,
                    args: Bundle
                ): ListenableFuture<SessionResult> {
                    if (customCommand.customAction == ACTION_TOGGLE_FAV) {
                        val tid = currentTrackId.ifEmpty { player.currentMediaItem?.mediaId.orEmpty() }
                        if (tid.isNotEmpty()) {
                            val nextFav = !isTrackFav(tid)
                            setTrackFavorite(tid, nextFav)
                            playbackListener?.onToggleFavorite(tid, nextFav)
                        }
                        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
                    }
                    if (customCommand.customAction == ACTION_CYCLE_REPEAT) {
                        val nextMode = (currentRepeatMode + 1) % 3
                        setRepeatModeState(nextMode)
                        playbackListener?.onCycleRepeat(nextMode)
                        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
                    }
                    return super.onCustomCommand(session, controller, customCommand, args)
                }
            })
            .build()
        addSession(mediaSession!!)
        currentIsFav = isTrackFav(currentTrackId)
        updateMediaSessionCustomLayout()

        player.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                syncTailPlayback()
                notifyState()
                if (isPlaying) {
                    startProgressLoop()
                } else {
                    stopProgressLoop(notify = false)
                }
            }

            override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
                syncTailPlayback()
            }

            override fun onPlaybackSuppressionReasonChanged(playbackSuppressionReason: Int) {
                syncTailPlayback()
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                    if (sleepAtTrackEnd) {
                        notifyState()
                        clearSleepTimerInternal(pausePlayer = true)
                        return
                    }
                    if (currentRepeatMode == 2 && fadeJob?.isActive != true && player.currentMediaItem?.mediaId == currentTrackId) {
                        autoCrossfadeTriggeredForId = null
                        player.seekTo(0L)
                        player.play()
                        notifyState()
                        playbackListener?.onTrackEnded()
                        return
                    }
                    notifyState()
                    if (fadeJob?.isActive != true && player.currentMediaItem?.mediaId == currentTrackId) {
                        playbackListener?.onTrackEnded()
                    }
                    return
                }
                notifyState()
                if (playbackState == Player.STATE_READY) {
                    emitQualityForCurrent()
                }
            }

            override fun onTracksChanged(tracks: Tracks) {
                emitQualityForCurrent()
            }

            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                if (mediaItem != null && reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO) {
                    if (sleepAtTrackEnd) {
                        player.pause()
                        clearSleepTimerInternal(pausePlayer = false)
                        return
                    }
                    val newId = mediaItem.mediaId
                    if (newId.isNotEmpty() && newId != currentTrackId) {
                        trimPlayedMediaItemsOnMain()
                        currentTrackId = newId
                        currentTitle = mediaItem.mediaMetadata.title?.toString() ?: currentTitle
                        currentArtist = mediaItem.mediaMetadata.artist?.toString() ?: currentArtist
                        currentThumb = nextThumb.ifEmpty { mediaItem.mediaMetadata.artworkUri?.toString() ?: currentThumb }
                        currentIsFav = isTrackFav(newId)
                        updateMediaSessionCustomLayout()
                        applyTrackLoudnessFor(newId, mainSlot, resetDynamic = true)
                        nextThumb = ""
                        snapQualityLabel = ""
                        autoCrossfadeTriggeredForId = null
                        emitQualityForCurrent()
                        playbackListener?.onGaplessTransition(newId)
                        notifyState()
                    }
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                android.util.Log.e("SonoraPlayback", "Playback error: ${error.message}", error)
                recover(player, error)
                notifyState()
            }
        })
    }

    private fun buildExoPlayer(handleAudioFocus: Boolean, slot: MixerSlot = mainSlot): ExoPlayer {
        val renderersFactory = object : DefaultRenderersFactory(this) {
            override fun buildAudioSink(
                context: Context,
                enableFloatOutput: Boolean,
                enableAudioTrackPlaybackParams: Boolean
            ): AudioSink {
                return MixerAudioSink(context, mixer, slot)
            }
        }
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(30_000, 60_000, 150, 300)
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()
        return ExoPlayer.Builder(this, renderersFactory)
            .setMediaSourceFactory(DefaultMediaSourceFactory(mediaDataSourceFactory))
            .setLoadControl(loadControl)
            .setAudioAttributes(musicAudioAttributes, handleAudioFocus)
            .setHandleAudioBecomingNoisy(handleAudioFocus)
            .build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

    override fun onUpdateNotification(session: MediaSession, startInForegroundRequired: Boolean) {
        if (startInForegroundRequired) heldForeground = true
        super.onUpdateNotification(
            session,
            startInForegroundRequired || (heldForeground && player.mediaItemCount > 0),
        )
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        if (!player.isPlaying) {
            stopSelf()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        instance = this
        return START_STICKY
    }

    private fun cleanArtistString(artist: String): String {
        if (artist.isBlank()) return ""
        val parts = artist.split(ARTIST_SPLIT_REGEX)
            .map { it.trim() }
            .filter { part ->
                val lower = part.lowercase().replace('\u00a0', ' ')
                !(lower.isBlank() ||
                  lower in ARTIST_NOISE_WORDS ||
                  lower.contains("riproduzion") || lower.contains("visualizzazion") || lower.contains("ascolt") ||
                  lower.contains("iscritt") || lower.contains("views") || lower.contains("plays") ||
                  lower.contains("subscribers") || lower.contains("listeners") || lower.contains("monthly") ||
                  ARTIST_STATS_REGEX.matches(lower))
            }
        return if (parts.isNotEmpty()) parts.joinToString(", ") else artist
    }

    private fun resolveArtworkUri(rawUrl: String?, fallbackTrackId: String = ""): Uri? {
        val trimmed = rawUrl?.trim().orEmpty()
        if (trimmed.isEmpty()) {
            val cleanId = fallbackTrackId.trim()
            if (cleanId.matches(Regex("^[A-Za-z0-9_-]{11}$"))) {
                return Uri.parse("https://i.ytimg.com/vi/$cleanId/hqdefault.jpg")
            }
            return null
        }
        val apiIdx = trimmed.indexOf("/api/cover?")
        val clean = if (apiIdx >= 0) {
            try {
                val query = trimmed.substring(apiIdx + "/api/cover?".length)
                var unwrapped = ""
                for (pair in query.split('&')) {
                    val eq = pair.indexOf('=')
                    if (eq <= 0) continue
                    if (pair.substring(0, eq) == "u") {
                        unwrapped = URLDecoder.decode(pair.substring(eq + 1), "UTF-8")
                        break
                    }
                }
                when {
                    unwrapped.startsWith("//") -> "https:$unwrapped"
                    unwrapped.isNotBlank() -> unwrapped
                    else -> trimmed
                }
            } catch (_: Exception) {
                trimmed
            }
        } else if (trimmed.startsWith("//")) {
            "https:$trimmed"
        } else {
            trimmed
        }
        return try {
            Uri.parse(clean)
        } catch (_: Exception) {
            null
        }
    }

    private fun decodeScaledBitmap(bytes: ByteArray, maxDim: Int = 512): Bitmap? {
        if (bytes.isEmpty()) return null
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        var sample = 1
        while (bounds.outWidth > 0 && bounds.outHeight > 0 &&
            (bounds.outWidth / sample > maxDim * 2 || bounds.outHeight / sample > maxDim * 2)
        ) {
            sample *= 2
        }
        val opts = BitmapFactory.Options().apply {
            inSampleSize = sample
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
    }

    private inner class SonoraBitmapLoader : BitmapLoader {
        override fun supportsMimeType(mimeType: String): Boolean {
            return mimeType.startsWith("image/", ignoreCase = true)
        }

        override fun decodeBitmap(data: ByteArray): ListenableFuture<Bitmap> {
            val future = SettableFuture.create<Bitmap>()
            artworkExecutor.execute {
                try {
                    val bmp = decodeScaledBitmap(data)
                    if (bmp != null) {
                        future.set(bmp)
                    } else {
                        future.setException(IOException("Failed to decode artwork bytes"))
                    }
                } catch (t: Throwable) {
                    future.setException(t)
                }
            }
            return future
        }

        override fun loadBitmap(uri: Uri): ListenableFuture<Bitmap> {
            val future = SettableFuture.create<Bitmap>()
            artworkExecutor.execute {
                try {
                    val bytes = when (uri.scheme?.lowercase()) {
                        "data" -> {
                            val raw = uri.toString()
                            val comma = raw.indexOf(',')
                            if (comma > 0 && raw.substring(0, comma).contains(";base64", ignoreCase = true)) {
                                Base64.decode(raw.substring(comma + 1), Base64.DEFAULT)
                            } else {
                                null
                            }
                        }
                        "content", "file" -> {
                            contentResolver.openInputStream(uri)?.use { it.readBytes() }
                        }
                        else -> {
                            val urlStr = uri.toString()
                            SonoraApiInterceptor.fetchCoverBytes(urlStr, sizeParam = 544)
                                ?: run {
                                    val req = Request.Builder()
                                        .url(urlStr)
                                        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
                                        .build()
                                    pooledOkHttp.newCall(req).execute().use { resp ->
                                        if (resp.isSuccessful) resp.body.bytes() else null
                                    }
                                }
                        }
                    }
                    val bmp = bytes?.let { decodeScaledBitmap(it) }
                    if (bmp != null) {
                        future.set(bmp)
                    } else {
                        future.setException(IOException("Unable to load artwork: $uri"))
                    }
                } catch (t: Throwable) {
                    future.setException(t)
                }
            }
            return future
        }
    }

    private fun buildMediaItem(
        trackId: String,
        title: String,
        artist: String,
        thumbUrl: String?,
        artistAlreadyClean: Boolean = false
    ): MediaItem {
        val cleanArtist = if (artistAlreadyClean) artist else cleanArtistString(artist).ifEmpty { artist }
        val artUri = resolveArtworkUri(thumbUrl, trackId)
        val metadata = MediaMetadata.Builder()
            .setTitle(title)
            .setArtist(cleanArtist)
            .setArtworkUri(artUri)
            .build()
        return MediaItem.Builder()
            .setMediaId(trackId)
            .setUri(Uri.parse("youtube:track:$trackId"))
            .setMediaMetadata(metadata)
            .build()
    }

    fun playTrack(
        trackId: String,
        title: String,
        artist: String,
        thumbUrl: String?,
        durationSec: Long,
        isAuto: Boolean = false
    ) {
        val cleanArtist = cleanArtistString(artist).ifEmpty { artist }
        currentTitle = title
        currentArtist = cleanArtist
        currentTrackId = trackId
        currentThumb = thumbUrl ?: ""
        currentIsFav = isTrackFav(trackId)
        updateMediaSessionCustomLayout()
        snapQualityLabel = ""
        autoCrossfadeTriggeredForId = null

        val mediaItem = buildMediaItem(trackId, title, cleanArtist, thumbUrl, artistAlreadyClean = true)

        scope.launch(Dispatchers.Main) {
            val outgoingItem = player.currentMediaItem
            val outgoingId = outgoingItem?.mediaId ?: ""
            val outgoingPos = player.currentPosition.coerceAtLeast(0L)
            val wasPlaying = player.isPlaying || (player.playWhenReady && player.playbackState == Player.STATE_BUFFERING)
            val autoFadeMs = if (crossfadeSec > 0 && !sleepAtTrackEnd) crossfadeSec * 1000L else 0L
            val fadeMs = when {
                !wasPlaying || outgoingItem == null || outgoingId == trackId -> 0L
                isAuto && autoFadeMs > 0L -> autoFadeMs
                !isAuto && skipFadeEnabled -> 520L
                else -> 0L
            }

            if (fadeMs > 0L && mainSlot.mixed) {
                if (isAuto || tailPreparedId == outgoingId) {
                    startHandoverTransition(mediaItem, outgoingItem!!, outgoingId, outgoingPos, fadeMs)
                } else {
                    startDetachSkipFade(mediaItem, fadeMs)
                }
            } else {
                if (fadeMs > 0L) {
                    startCrossfadeOverlap(outgoingItem!!, outgoingPos, fadeMs)
                } else {
                    stopCrossfadeOverlap()
                }
                applyTrackLoudnessFor(trackId, mainSlot, resetDynamic = true)
                player.setMediaItem(mediaItem)
                player.prepare()
                player.play()
                emitQualityForCurrent()
                notifyState()
            }
        }
    }

    private fun trimPlayedMediaItemsOnMain() {
        if (!::player.isInitialized) return
        val curIdx = player.currentMediaItemIndex
        if (curIdx > 0 && curIdx < player.mediaItemCount) {
            player.removeMediaItems(0, curIdx)
        }
    }

    private fun syncNextMediaItemOnMain(nextItem: MediaItem?) {
        if (!::player.isInitialized || player.mediaItemCount == 0) return
        trimPlayedMediaItemsOnMain()
        val curIdx = player.currentMediaItemIndex.coerceAtLeast(0)
        val nextIdx = curIdx + 1
        if (nextItem == null) {
            if (player.mediaItemCount > nextIdx) {
                player.removeMediaItems(nextIdx, player.mediaItemCount)
            }
            return
        }
        if (player.mediaItemCount == nextIdx) {
            player.addMediaItem(nextItem)
        } else if (player.mediaItemCount > nextIdx) {
            if (player.getMediaItemAt(nextIdx).mediaId != nextItem.mediaId) {
                player.replaceMediaItem(nextIdx, nextItem)
            }
            if (player.mediaItemCount > nextIdx + 1) {
                player.removeMediaItems(nextIdx + 1, player.mediaItemCount)
            }
        }
    }

    fun setNextTrack(trackId: String, title: String, artist: String, thumbUrl: String?) {
        scope.launch(Dispatchers.Main) {
            val isRepeatOne = currentRepeatMode == 2
            nextTrackId = if (!isRepeatOne && trackId.isNotBlank() && trackId != currentTrackId) trackId else ""
            if (isRepeatOne || trackId.isBlank() || trackId == currentTrackId || crossfadeSec > 0) {
                nextThumb = ""
                syncNextMediaItemOnMain(null)
                if (nextTrackId.isNotEmpty()) {
                    prefetch(nextTrackId)
                    prewarmNextAudioBytes(nextTrackId)
                } else {
                    cancelPrewarmBytesJob()
                }
                return@launch
            }
            nextThumb = thumbUrl ?: ""
            prefetch(trackId)
            val nextItem = buildMediaItem(trackId, title, artist, thumbUrl)
            syncNextMediaItemOnMain(nextItem)
            prewarmNextAudioBytes(trackId)
        }
    }

    fun setVolumeNorm(enabled: Boolean) {
        mixer.volumeNormEnabled = enabled
    }

    private fun normalizeFavId(id: String): String = id.removePrefix("yt:").trim()

    private fun isTrackFav(id: String): Boolean {
        val clean = normalizeFavId(id)
        return clean.isNotEmpty() && favTrackIds.contains(clean)
    }

    fun setTrackFavorite(trackId: String, isFav: Boolean) {
        val clean = normalizeFavId(trackId)
        if (clean.isEmpty()) return
        if (isFav) favTrackIds.add(clean) else favTrackIds.remove(clean)
        if (clean == normalizeFavId(currentTrackId)) {
            currentIsFav = isFav
            updateMediaSessionCustomLayout()
        }
    }

    fun setRepeatModeState(mode: Int) {
        val normalized = mode.coerceIn(0, 2)
        if (Looper.myLooper() == Looper.getMainLooper()) {
            applyRepeatModeStateOnMain(normalized)
        } else {
            scope.launch(Dispatchers.Main) {
                applyRepeatModeStateOnMain(normalized)
            }
        }
    }

    private fun applyRepeatModeStateOnMain(normalized: Int) {
        if (currentRepeatMode == normalized) return
        currentRepeatMode = normalized
        if (normalized == 2) {
            nextTrackId = ""
            nextThumb = ""
            cancelPrewarmBytesJob()
            syncNextMediaItemOnMain(null)
        }
        updateMediaSessionCustomLayout()
    }

    private fun buildRepeatCommandButton(repeatMode: Int): CommandButton {
        val iconRes = when (repeatMode) {
            1 -> R.drawable.ic_notif_repeat_all
            2 -> R.drawable.ic_notif_repeat_one
            else -> R.drawable.ic_notif_repeat_off
        }
        val iconConst = when (repeatMode) {
            1 -> CommandButton.ICON_REPEAT_ALL
            2 -> CommandButton.ICON_REPEAT_ONE
            else -> CommandButton.ICON_REPEAT_OFF
        }
        val label = when (repeatMode) {
            1 -> SonoraLocaleManager.getString(this, R.string.repeat_all)
            2 -> SonoraLocaleManager.getString(this, R.string.repeat_one)
            else -> SonoraLocaleManager.getString(this, R.string.repeat_off)
        }
        return CommandButton.Builder(iconConst)
            .setCustomIconResId(iconRes)
            .setDisplayName(label)
            .setSessionCommand(SessionCommand(ACTION_CYCLE_REPEAT, Bundle.EMPTY))
            .setEnabled(true)
            .setSlots(CommandButton.SLOT_BACK_SECONDARY, CommandButton.SLOT_OVERFLOW)
            .build()
    }

    private fun buildFavCommandButton(isFav: Boolean): CommandButton {
        val iconRes = if (isFav) R.drawable.ic_notif_star_filled else R.drawable.ic_notif_star_outline
        val iconConst = if (isFav) CommandButton.ICON_STAR_FILLED else CommandButton.ICON_STAR_UNFILLED
        val label = SonoraLocaleManager.getString(
            this,
            if (isFav) R.string.remove_from_favorites else R.string.add_to_favorites
        )
        return CommandButton.Builder(iconConst)
            .setCustomIconResId(iconRes)
            .setDisplayName(label)
            .setSessionCommand(SessionCommand(ACTION_TOGGLE_FAV, Bundle.EMPTY))
            .setEnabled(true)
            .setSlots(CommandButton.SLOT_FORWARD_SECONDARY, CommandButton.SLOT_OVERFLOW)
            .build()
    }

    private fun updateMediaSessionCustomLayout() {
        val session = mediaSession ?: return
        val applyLayout = {
            val layout = listOf(
                buildRepeatCommandButton(currentRepeatMode),
                buildFavCommandButton(currentIsFav)
            )
            session.setCustomLayout(layout)
            session.setMediaButtonPreferences(layout)
        }
        if (Looper.myLooper() == Looper.getMainLooper()) {
            applyLayout()
        } else {
            scope.launch(Dispatchers.Main) {
                if (mediaSession === session) {
                    applyLayout()
                }
            }
        }
    }

    private fun applyTrackLoudnessFor(videoId: String, slot: MixerSlot = mainSlot, resetDynamic: Boolean = false) {
        val cleanId = videoId.removePrefix("yt:").trim()
        if (resetDynamic) {
            slot.resetDynamicNorm()
        }
        if (cleanId.isEmpty() || cleanId.startsWith("local_")) {
            slot.setTrackLoudnessDb(0f)
            return
        }
        slot.setTrackLoudnessDb(SonoraAudioResolver.getLoudnessDb(cleanId))
        if (SonoraAudioResolver.hasLoudnessDb(cleanId)) return
        scope.launch(Dispatchers.IO) {
            val resolvedDb = runCatching { SonoraAudioResolver.fetchLoudnessDb(cleanId) }.getOrNull() ?: return@launch
            if (resolvedDb != 0f) {
                val stillTargeted = when (slot) {
                    mainSlot -> currentTrackId.removePrefix("yt:").trim() == cleanId
                    tailSlot -> tailPreparedId?.removePrefix("yt:")?.trim() == cleanId
                    else -> false
                }
                if (stillTargeted) {
                    slot.setTrackLoudnessDb(resolvedDb)
                }
            }
        }
    }

    private fun getOrCreateCacheDataSourceFactory(): CacheDataSource.Factory {
        return lazyCacheDataSourceFactory ?: synchronized(cacheFactoryLock) {
            lazyCacheDataSourceFactory ?: CacheDataSource.Factory()
                .setCache(getMediaCache(this@SonoraPlaybackService))
                .setUpstreamDataSourceFactory(resolvingDataSourceFactory)
                .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
                .also { lazyCacheDataSourceFactory = it }
        }
    }

    private fun cancelPrewarmBytesJob() {
        synchronized(prewarmLock) {
            prewarmBytesJob?.cancel()
            prewarmBytesJob = null
            prewarmBytesTrackId = null
        }
    }

    private fun prewarmNextAudioBytes(videoId: String) {
        val cleanId = videoId.removePrefix("yt:").trim()
        if (cleanId.isEmpty() || cleanId.startsWith("local_")) return
        if (!::resolvingDataSourceFactory.isInitialized) return
        if (prewarmedBytesIds.contains(cleanId)) return
        val cacheKey = "youtube:track:$cleanId"
        val mediaCache = runCatching { getMediaCache(this@SonoraPlaybackService) }.getOrNull() ?: return
        if (runCatching { mediaCache.isCached(cacheKey, 0L, 128L * 1024L) }.getOrDefault(false)) {
            prewarmedBytesIds.add(cleanId)
            return
        }
        synchronized(prewarmLock) {
            if (prewarmBytesJob?.isActive == true && prewarmBytesTrackId == cleanId) {
                return
            }
            prewarmBytesJob?.cancel()
            prewarmBytesTrackId = cleanId
            prewarmBytesJob = scope.launch(Dispatchers.IO) {
                try {
                    if (snapIsBuffering) {
                        delay(120)
                        if (snapIsBuffering || !isActive) return@launch
                    }
                    val url = SonoraAudioResolver.resolve(cleanId)
                    if (url.isNullOrEmpty() || !isActive) return@launch
                    if (!SonoraAudioResolver.hasLoudnessDb(cleanId)) {
                        runCatching { SonoraAudioResolver.fetchLoudnessDb(cleanId) }
                    }
                    if (!isActive || snapIsBuffering) return@launch
                    if (mediaCache.isCached(cacheKey, 0L, 128L * 1024L)) {
                        prewarmedBytesIds.add(cleanId)
                        return@launch
                    }
                    val spec = DataSpec.Builder()
                        .setUri(Uri.parse(cacheKey))
                        .setKey(cacheKey)
                        .setPosition(0L)
                        .setLength(384L * 1024L)
                        .build()
                    val cacheDataSource = getOrCreateCacheDataSourceFactory().createDataSourceForDownloading()
                    val writerRef = java.util.concurrent.atomic.AtomicReference<CacheWriter?>(null)
                    val reg = coroutineContext[Job]?.invokeOnCompletion { cause ->
                        if (cause != null) writerRef.get()?.cancel()
                    }
                    try {
                        val writer = CacheWriter(
                            cacheDataSource,
                            spec,
                            null,
                            CacheWriter.ProgressListener { _, _, _ ->
                                if (!isActive || snapIsBuffering) {
                                    writerRef.get()?.cancel()
                                }
                            }
                        )
                        writerRef.set(writer)
                        if (!isActive || snapIsBuffering) {
                            writer.cancel()
                            return@launch
                        }
                        writer.cache()
                        if (isActive && !snapIsBuffering) {
                            prewarmedBytesIds.add(cleanId)
                        }
                    } finally {
                        reg?.dispose()
                        runCatching { cacheDataSource.close() }
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    android.util.Log.w("SonoraPlayback", "Prewarm bytes failed for $cleanId: ${e.message}")
                } finally {
                    synchronized(prewarmLock) {
                        if (prewarmBytesTrackId == cleanId && prewarmBytesJob === coroutineContext[Job]) {
                            prewarmBytesJob = null
                            prewarmBytesTrackId = null
                        }
                    }
                }
            }
        }
    }

    fun setVolume(vol: Float) {
        baseVolume = vol.coerceIn(0f, 1f)
        scope.launch(Dispatchers.Main) {
            applyEffectiveVolume()
        }
    }

    fun setEqGains(gains: FloatArray) {
        SonoraEqualizer.update(gains)
    }

    fun setFadeConfig(crossfadeSeconds: Int, skipFade: Boolean) {
        crossfadeSec = crossfadeSeconds.coerceIn(0, 12)
        skipFadeEnabled = skipFade
        mixer.skipFadeMs = { if (skipFadeEnabled) 520 else 0 }
        scope.launch(Dispatchers.Main) {
            if (crossfadeSec > 0) {
                syncNextMediaItemOnMain(null)
            }
            if (crossfadeSec <= 0 && fadeJob?.isActive != true) {
                retireTail()
            }
        }
    }

    private fun applyEffectiveVolume() {
        val base = (baseVolume * sleepFadeEnvelope).coerceIn(0f, 1f)
        mainSlot.fade = fadeEnvelope
        player.volume = if (mainSlot.mixed) base else (base * fadeEnvelope).coerceIn(0f, 1f)
        tailPlayer?.let { tail ->
            tail.volume = if (tailSlot.mixed) 1f else (base * tailSlot.fade).coerceIn(0f, 1f)
        }
    }

    private fun ensureTailPlayer(): ExoPlayer {
        return tailPlayer ?: buildExoPlayer(handleAudioFocus = false, slot = tailSlot).also { tail ->
            tail.repeatMode = Player.REPEAT_MODE_OFF
            preferredDeviceId?.let { id ->
                audioManager?.getDevices(AudioManager.GET_DEVICES_OUTPUTS)?.firstOrNull { d -> d.id == id }
                    ?.let { dev -> tail.setPreferredAudioDevice(dev) }
            }
            tail.addListener(object : Player.Listener {
                override fun onPlayerError(error: PlaybackException) {
                    android.util.Log.w("SonoraPlayback", "Tail stream unavailable: ${error.message}")
                    retireTail()
                }
            })
            tailPlayer = tail
        }
    }

    private fun syncTailPlayback() {
        val tail = tailPlayer ?: return
        if (fadeJob?.isActive == true && !tailSlot.held) {
            tail.playWhenReady = player.playWhenReady && player.playbackSuppressionReason == 0
        }
    }

    private fun prepareOutgoing(trackId: String) {
        val item = player.currentMediaItem ?: return
        if (tailPreparedId == trackId) return
        tailReleaseJob?.cancel()
        tailReleaseJob = null
        val tail = ensureTailPlayer()
        tailSlot.fade = 0f
        tailSlot.held = true
        tail.pause()
        tail.playbackParameters = player.playbackParameters
        applyTrackLoudnessFor(trackId, tailSlot, resetDynamic = false)
        tail.setMediaItem(item, (player.currentPosition - 500L).coerceAtLeast(0L))
        tail.prepare()
        tailPreparedId = trackId
        if (nextTrackId.isNotEmpty()) {
            prefetch(nextTrackId)
        }
    }

    private fun retireTail() {
        tailSlot.fade = 0f
        tailSlot.held = true
        tailPreparedId = null
        tailPlayer?.pause()
    }

    private fun scheduleTailRelease() {
        tailReleaseJob?.cancel()
        if (tailPlayer == null) return
        tailReleaseJob = scope.launch(Dispatchers.Main) {
            delay(20_000L)
            if (fadeJob?.isActive != true && tailPreparedId == null) {
                tailPlayer?.clearMediaItems()
                tailPlayer?.release()
                tailPlayer = null
            }
        }
    }

    private suspend fun rise(fadeMs: Long) {
        var elapsed = 0L
        var previous = player.currentPosition.coerceAtLeast(0L)
        val deadline = SystemClock.elapsedRealtime() + 20_000L
        while (elapsed < fadeMs && SystemClock.elapsedRealtime() < deadline) {
            delay(16)
            val pos = player.currentPosition.coerceAtLeast(0L)
            if (player.isPlaying) {
                elapsed += (pos - previous).coerceIn(0L, 100L)
            }
            previous = pos
            val x = (elapsed.toFloat() / fadeMs.toFloat()).coerceIn(0f, 1f)
            fadeEnvelope = sin(x * PI / 2.0).toFloat()
            applyEffectiveVolume()
        }
        fadeEnvelope = 1.0f
        applyEffectiveVolume()
    }

    private fun startDetachSkipFade(mediaItem: MediaItem, fadeMs: Long) {
        fadeJob?.cancel()
        mixer.cancelHandOver()
        tailReleaseJob?.cancel()
        tailReleaseJob = null
        retireTail()
        val gen = ++transitionGen
        val detached = mixer.detach(mainSlot, fadeMs.toInt())
        fadeEnvelope = if (detached) 0f else 1f
        applyEffectiveVolume()
        applyTrackLoudnessFor(mediaItem.mediaId, mainSlot, resetDynamic = true)
        player.setMediaItem(mediaItem)
        player.prepare()
        player.play()
        emitQualityForCurrent()
        notifyState()
        if (!detached) {
            scheduleTailRelease()
            return
        }
        fadeJob = scope.launch(Dispatchers.Main) {
            try {
                rise(fadeMs)
            } finally {
                if (gen == transitionGen) {
                    fadeJob = null
                    fadeEnvelope = 1.0f
                    applyEffectiveVolume()
                    scheduleTailRelease()
                }
            }
        }
    }

    private fun startHandoverTransition(
        mediaItem: MediaItem,
        outgoingItem: MediaItem,
        outgoingId: String,
        outgoingPos: Long,
        fadeMs: Long
    ) {
        fadeJob?.cancel()
        mixer.cancelHandOver()
        tailReleaseJob?.cancel()
        tailReleaseJob = null
        val gen = ++transitionGen
        val tail = ensureTailPlayer()
        fadeJob = scope.launch(Dispatchers.Main) {
            try {
                tailSlot.fade = 0f
                tailSlot.held = true
                tail.playbackParameters = player.playbackParameters
                if (tailPreparedId != outgoingId) {
                    tail.pause()
                    tailPreparedId = outgoingId
                    applyTrackLoudnessFor(outgoingId, tailSlot, resetDynamic = false)
                    tail.setMediaItem(outgoingItem, (outgoingPos - 500L).coerceAtLeast(0L))
                    tail.prepare()
                }
                val readyDeadline = SystemClock.elapsedRealtime() + 1_200L
                while (tail.playbackState == Player.STATE_BUFFERING && SystemClock.elapsedRealtime() < readyDeadline) {
                    delay(20)
                }
                val leadPos = (player.currentPosition.coerceAtLeast(outgoingPos) + 150L)
                tail.seekTo(leadPos)
                tail.play()

                val handed = withTimeoutOrNull(1_500L) {
                    suspendCancellableCoroutine { cont ->
                        cont.invokeOnCancellation { mixer.cancelHandOver() }
                        mixer.handOver(mainSlot, tailSlot) { ok ->
                            scope.launch(Dispatchers.Main) {
                                if (cont.isActive) cont.resume(ok)
                            }
                        }
                    }
                } ?: false

                if (!handed) {
                    android.util.Log.w("SonoraPlayback", "handOver timed out, falling back to detached ring skip-fade")
                    retireTail()
                    val shortMs = fadeMs.coerceAtMost(520L)
                    val detached = mixer.detach(mainSlot, shortMs.toInt())
                    fadeEnvelope = if (detached) 0f else 1f
                    applyEffectiveVolume()
                    applyTrackLoudnessFor(mediaItem.mediaId, mainSlot, resetDynamic = true)
                    player.setMediaItem(mediaItem)
                    player.prepare()
                    player.play()
                    emitQualityForCurrent()
                    notifyState()
                    if (detached) rise(shortMs)
                    return@launch
                }

                // Mixer silenced mainSlot and opened tailSlot at the exact sample.
                fadeEnvelope = 0f
                tailSlot.fade = 1f
                applyEffectiveVolume()
                applyTrackLoudnessFor(mediaItem.mediaId, mainSlot, resetDynamic = true)
                player.setMediaItem(mediaItem)
                player.prepare()
                player.play()
                emitQualityForCurrent()
                notifyState()

                var elapsed = 0L
                var previous = player.currentPosition.coerceAtLeast(0L)
                val deadline = SystemClock.elapsedRealtime() + fadeMs + 20_000L
                while (elapsed < fadeMs && SystemClock.elapsedRealtime() < deadline) {
                    delay(16)
                    if (!player.playWhenReady || player.playbackSuppressionReason != 0) {
                        tail.pause()
                        previous = player.currentPosition.coerceAtLeast(0L)
                        continue
                    }
                    tail.play()
                    val pos = player.currentPosition.coerceAtLeast(0L)
                    if (player.isPlaying) {
                        elapsed += (pos - previous).coerceIn(0L, 100L)
                    }
                    previous = pos
                    val x = (elapsed.toFloat() / fadeMs.toFloat()).coerceIn(0f, 1f)
                    fadeEnvelope = sin(x * PI / 2.0).toFloat()
                    tailSlot.fade = cos(x * PI / 2.0).toFloat()
                    applyEffectiveVolume()
                }
            } finally {
                if (gen == transitionGen) {
                    fadeJob = null
                    retireTail()
                    fadeEnvelope = 1.0f
                    applyEffectiveVolume()
                    scheduleTailRelease()
                }
            }
        }
    }

    private fun startCrossfadeOverlap(outgoingItem: MediaItem, outgoingPos: Long, fadeMs: Long) {
        fadeJob?.cancel()
        mixer.cancelHandOver()
        tailReleaseJob?.cancel()
        tailReleaseJob = null
        val gen = ++transitionGen
        val tail = ensureTailPlayer()
        tailSlot.held = false
        tailSlot.fade = 1f
        applyTrackLoudnessFor(outgoingItem.mediaId, tailSlot, resetDynamic = false)
        tail.setMediaItem(outgoingItem, outgoingPos)
        tail.prepare()
        tail.play()
        fadeEnvelope = 0.02f
        applyEffectiveVolume()

        fadeJob = scope.launch(Dispatchers.Main) {
            try {
                val startMs = SystemClock.elapsedRealtime()
                while (isActive) {
                    val elapsed = SystemClock.elapsedRealtime() - startMs
                    val t = (elapsed.toFloat() / fadeMs.toFloat()).coerceIn(0f, 1f)
                    tailSlot.fade = cos(t * PI / 2.0).toFloat()
                    fadeEnvelope = sin(t * PI / 2.0).toFloat()
                    applyEffectiveVolume()
                    if (t >= 1f) break
                    delay(20)
                }
            } finally {
                if (gen == transitionGen) {
                    fadeJob = null
                    fadeEnvelope = 1.0f
                    applyEffectiveVolume()
                    retireTail()
                    scheduleTailRelease()
                }
            }
        }
    }

    private fun stopCrossfadeOverlap() {
        transitionGen++
        fadeJob?.cancel()
        fadeJob = null
        mixer.cancelHandOver()
        fadeEnvelope = 1.0f
        retireTail()
        applyEffectiveVolume()
        scheduleTailRelease()
    }

    fun setSleepTimer(mode: String, minutes: Int) {
        scope.launch(Dispatchers.Main) {
            when (mode) {
                "off" -> clearSleepTimerInternal(pausePlayer = false)
                "end" -> {
                    sleepJob?.cancel()
                    sleepJob = null
                    sleepEndsAtElapsedMs = null
                    sleepMinutes = null
                    sleepAtTrackEnd = true
                    sleepFadeEnvelope = 1.0f
                    applyEffectiveVolume()
                    playbackListener?.onSleepTimerState(true, "end", 0L)
                }
                else -> {
                    val mins = minutes.coerceIn(1, 360)
                    sleepAtTrackEnd = false
                    sleepMinutes = mins
                    sleepEndsAtElapsedMs = SystemClock.elapsedRealtime() + mins * 60_000L
                    sleepFadeEnvelope = 1.0f
                    applyEffectiveVolume()
                    startSleepTimerLoop()
                    playbackListener?.onSleepTimerState(true, "minutes", mins * 60L)
                }
            }
        }
    }

    fun getSleepTimerJson(): String {
        val obj = JSONObject()
        val endMs = sleepEndsAtElapsedMs
        return when {
            sleepAtTrackEnd -> {
                obj.put("active", true)
                obj.put("mode", "end")
                obj.put("remainingSec", 0)
                obj.toString()
            }
            endMs != null -> {
                val remSec = ((endMs - SystemClock.elapsedRealtime()).coerceAtLeast(0L) + 999L) / 1000L
                obj.put("active", true)
                obj.put("mode", "minutes")
                obj.put("minutes", sleepMinutes ?: 0)
                obj.put("remainingSec", remSec)
                obj.toString()
            }
            else -> {
                obj.put("active", false)
                obj.put("mode", "off")
                obj.put("remainingSec", 0)
                obj.toString()
            }
        }
    }

    private fun startSleepTimerLoop() {
        sleepJob?.cancel()
        sleepJob = scope.launch(Dispatchers.Main) {
            while (isActive) {
                val endAt = sleepEndsAtElapsedMs ?: break
                val remMs = endAt - SystemClock.elapsedRealtime()
                if (remMs <= 0L) {
                    clearSleepTimerInternal(pausePlayer = true)
                    break
                }
                if (remMs <= 6_000L) {
                    sleepFadeEnvelope = (remMs.toFloat() / 6_000f).coerceIn(0.02f, 1f)
                    applyEffectiveVolume()
                } else {
                    sleepFadeEnvelope = 1.0f
                }
                val remSec = (remMs + 999L) / 1000L
                playbackListener?.onSleepTimerState(true, "minutes", remSec)
                delay(500)
            }
        }
    }

    private fun clearSleepTimerInternal(pausePlayer: Boolean) {
        sleepJob?.cancel()
        sleepJob = null
        sleepEndsAtElapsedMs = null
        sleepMinutes = null
        sleepAtTrackEnd = false
        sleepFadeEnvelope = 1.0f
        if (pausePlayer && player.isPlaying) {
            player.pause()
        }
        applyEffectiveVolume()
        playbackListener?.onSleepTimerState(false, "off", 0L)
        notifyState()
    }

    fun getAudioOutputsJson(): String {
        cachedAudioOutputsJson?.let { return it }
        val mgr = audioManager ?: (getSystemService(Context.AUDIO_SERVICE) as? AudioManager).also { audioManager = it }
            ?: return "{\"outputs\":[]}"
        val raw = runCatching { mgr.getDevices(AudioManager.GET_DEVICES_OUTPUTS).toList() }.getOrDefault(emptyList())

        val activeDevice: AudioDeviceInfo? = run {
            preferredDeviceId?.let { pid -> raw.firstOrNull { it.id == pid } }?.let { return@run it }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                runCatching { mgr.getAudioDevicesForAttributes(
                    android.media.AudioAttributes.Builder()
                        .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                ).firstOrNull() }.getOrNull()?.let { target ->
                    return@run raw.firstOrNull { it.type == target.type && it.address == target.address }
                        ?: raw.firstOrNull { it.type == target.type }
                }
            }
            raw.filter { classifyOutputKind(it.type) != "other" || it.type == AudioDeviceInfo.TYPE_HDMI }
                .maxByOrNull { outputPriority(it.type) }
        }

        val seenKeys = HashSet<String>()
        val filtered = ArrayList<AudioDeviceInfo>()
        // Prioritize highest quality profile per physical device (e.g. A2DP over SCO)
        for (dev in raw.sortedByDescending { outputPriority(it.type) }) {
            val kind = classifyOutputKind(dev.type)
            if (kind == "other" && dev.type != AudioDeviceInfo.TYPE_HDMI) continue
            if (dev.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE || dev.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER_SAFE) continue
            if (dev.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO && filtered.any { classifyOutputKind(it.type) == "bluetooth" }) continue
            val name = outputDisplayName(dev, kind)
            val dedupeKey = "$kind:$name"
            if (seenKeys.add(dedupeKey)) {
                filtered.add(dev)
            }
        }

        val arr = JSONArray()
        for (dev in filtered) {
            val kind = classifyOutputKind(dev.type)
            val isSel = activeDevice != null && (
                dev.id == activeDevice.id ||
                    (preferredDeviceId == null && dev.type == activeDevice.type && dev.productName == activeDevice.productName)
                )
            arr.put(JSONObject().apply {
                put("id", dev.id)
                put("kind", kind)
                put("type", dev.type)
                put("name", outputDisplayName(dev, kind))
                put("selected", isSel)
            })
        }
        val json = JSONObject().apply {
            put("auto", preferredDeviceId == null)
            put("outputs", arr)
        }.toString()
        cachedAudioOutputsJson = json
        return json
    }

    fun setAudioOutput(deviceId: Int): Boolean {
        if (deviceId < 0) {
            preferredDeviceId = null
            cachedAudioOutputsJson = null
            scope.launch(Dispatchers.Main) {
                applyPreferredOutputDevice(null)
                playbackListener?.onAudioOutputsChanged()
            }
            return true
        }
        val mgr = audioManager ?: return false
        val target = mgr.getDevices(AudioManager.GET_DEVICES_OUTPUTS).firstOrNull { it.id == deviceId } ?: return false
        preferredDeviceId = target.id
        cachedAudioOutputsJson = null
        scope.launch(Dispatchers.Main) {
            applyPreferredOutputDevice(target)
            playbackListener?.onAudioOutputsChanged()
        }
        return true
    }

    private fun applyPreferredOutputDevice(device: AudioDeviceInfo?) {
        mixer.setPreferredDevice(device)
        player.setPreferredAudioDevice(device)
        tailPlayer?.setPreferredAudioDevice(device)
    }

    private fun classifyOutputKind(type: Int): String = when (type) {
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "speaker"
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_LINE_ANALOG,
        AudioDeviceInfo.TYPE_AUX_LINE -> "wired"
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
        AudioDeviceInfo.TYPE_BLE_HEADSET,
        AudioDeviceInfo.TYPE_BLE_SPEAKER,
        AudioDeviceInfo.TYPE_BLE_BROADCAST,
        AudioDeviceInfo.TYPE_HEARING_AID -> "bluetooth"
        AudioDeviceInfo.TYPE_USB_HEADSET,
        AudioDeviceInfo.TYPE_USB_DEVICE,
        AudioDeviceInfo.TYPE_USB_ACCESSORY,
        AudioDeviceInfo.TYPE_DOCK -> "usb"
        else -> "other"
    }

    private fun outputPriority(type: Int): Int = when (classifyOutputKind(type)) {
        "bluetooth" -> if (type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO) 1 else 5
        "usb" -> 4
        "wired" -> 3
        "other" -> 2
        else -> 1
    }

    private fun outputDisplayName(device: AudioDeviceInfo, kind: String): String {
        val raw = device.productName?.toString()?.trim().orEmpty()
        return when (kind) {
            "speaker" -> SonoraLocaleManager.getString(this, R.string.audio_output_speaker)
            "wired" -> if (raw.isNotEmpty() && !raw.equals(Build.MODEL, ignoreCase = true)) {
                raw
            } else {
                SonoraLocaleManager.getString(this, R.string.audio_output_wired)
            }
            "bluetooth" -> raw.ifEmpty { SonoraLocaleManager.getString(this, R.string.audio_output_bluetooth) }
            "usb" -> raw.ifEmpty { SonoraLocaleManager.getString(this, R.string.audio_output_usb) }
            else -> raw.ifEmpty { SonoraLocaleManager.getString(this, R.string.audio_output_default) }
        }
    }

    private fun emitQualityForCurrent() {
        val id = currentTrackId.ifEmpty { player.currentMediaItem?.mediaId.orEmpty() }
        if (id.isEmpty()) return
        val fmt = player.audioFormat
        val cached = StreamCache.getMeta(id)
        if (cached != null && cached.loudnessDb != 0f) {
            mainSlot.setTrackLoudnessDb(cached.loudnessDb)
        }
        val mimeCodec = fmt?.sampleMimeType?.let { m ->
            when {
                m.contains("opus", ignoreCase = true) -> "Opus"
                m.contains("mp4a", ignoreCase = true) || m.contains("aac", ignoreCase = true) -> "AAC"
                m.contains("flac", ignoreCase = true) -> "FLAC"
                else -> null
            }
        }
        val codec = mimeCodec ?: cached?.codec ?: "AAC"
        val br = fmt?.bitrate?.takeIf { it > 0 }?.div(1000) ?: cached?.bitrateKbps ?: 128
        val sr = fmt?.sampleRate?.takeIf { it > 0 } ?: cached?.sampleRateHz ?: 44100
        val label = StreamEntry(0L, "", codec, br, sr).formatLabel()
        snapQualityLabel = label
        val key = id to label
        if (lastEmittedQuality == key) return
        lastEmittedQuality = key
        playbackListener?.onStreamQuality(id, label)
    }

    /**
     * Recovers from playback errors by forgetting the cached stream URL and retrying.
     * Adapted from Square (dev.lelonio.square.backend.youtube.YouTubePlayerFactory.recover).
     */
    private fun recover(exo: ExoPlayer, error: PlaybackException) {
        val item = exo.currentMediaItem ?: return
        val id = currentTrackId.ifEmpty { item.mediaId }
        if (!exo.playWhenReady) return

        val now = SystemClock.elapsedRealtime()
        val last = recovering?.takeIf { it.first == id && now - it.second < RETRY_WINDOW_MS }
        val attempt = (last?.third ?: 0) + 1
        recovering = Triple(id, now, attempt)
        StreamCache.forget(id)

        val at = exo.currentPosition
        val index = exo.currentMediaItemIndex
        android.util.Log.w("SonoraPlayback", "Playback failed (${error.errorCodeName}), retry attempt $attempt at ${at}ms")

        scope.launch(Dispatchers.Main) {
            delay(RETRY_DELAY_MS * attempt)
            if (exo.currentMediaItem?.mediaId != item.mediaId || exo.playerError == null) return@launch
            if (attempt > RETRIES) {
                val msg = error.message ?: SonoraLocaleManager.getString(this@SonoraPlaybackService, R.string.playback_error_generic)
                playbackListener?.onPlaybackError(id, msg)
                if (exo.hasNextMediaItem()) {
                    exo.seekToNextMediaItem()
                    exo.prepare()
                    exo.play()
                }
            } else {
                exo.seekTo(index, at)
                exo.prepare()
                exo.play()
            }
        }
    }

    fun prefetch(videoId: String) {
        val cleanId = videoId.removePrefix("yt:").trim()
        if (cleanId.isEmpty()) return
        val isNext = cleanId == nextTrackId.removePrefix("yt:").trim()
        if (StreamCache.get(videoId) != null || SonoraAudioResolver.isInFlight(videoId)) {
            if (isNext) prewarmNextAudioBytes(cleanId)
            return
        }
        scope.launch(Dispatchers.IO) {
            try {
                val url = SonoraAudioResolver.resolve(videoId)
                if (!url.isNullOrEmpty() && !SonoraAudioResolver.hasLoudnessDb(cleanId)) {
                    runCatching { SonoraAudioResolver.fetchLoudnessDb(cleanId) }
                }
                if (isNext) {
                    prewarmNextAudioBytes(cleanId)
                }
            } catch (e: Exception) {
                android.util.Log.w("SonoraPlayback", "Prefetch failed for $videoId: ${e.message}")
            }
        }
    }

    suspend fun extractAudioUrl(videoId: String): String? = withContext(Dispatchers.IO) {
        SonoraAudioResolver.resolve(videoId)
    }

    fun togglePlay() {
        scope.launch(Dispatchers.Main) {
            if (player.playWhenReady) {
                player.pause()
            } else {
                player.play()
            }
            notifyState()
        }
    }

    fun stopPlaybackAndClear() {
        currentTrackId = ""
        currentTitle = "Sonora"
        currentArtist = ""
        currentThumb = ""
        nextTrackId = ""
        nextThumb = ""
        currentIsFav = false
        snapIsPlaying = false
        snapIsBuffering = false
        snapPositionMs = 0L
        snapDurationMs = 0L
        snapUpdatedAtElapsedMs = 0L
        snapQualityLabel = ""
        autoCrossfadeTriggeredForId = null
        tailPreparedId = null
        lastEmittedQuality = null

        scope.launch(Dispatchers.Main) {
            stopCrossfadeOverlap()
            stopProgressLoop(notify = false)
            cancelPrewarmBytesJob()
            clearSleepTimerInternal(pausePlayer = false)
            tailReleaseJob?.cancel()
            tailReleaseJob = null
            tailPlayer?.let {
                it.stop()
                it.clearMediaItems()
            }
            heldForeground = false
            player.playWhenReady = false
            player.stop()
            player.clearMediaItems()
            updateMediaSessionCustomLayout()
            notifyState()
            runCatching {
                ServiceCompat.stopForeground(this@SonoraPlaybackService, ServiceCompat.STOP_FOREGROUND_REMOVE)
            }
            stopSelf()
        }
    }

    fun seekTo(positionMs: Long) {
        scope.launch(Dispatchers.Main) {
            if (fadeJob?.isActive == true) {
                stopCrossfadeOverlap()
            }
            autoCrossfadeTriggeredForId = null
            tailPreparedId = null
            player.seekTo(positionMs)
            notifyState()
        }
    }

    fun syncPlaybackState() {
        scope.launch(Dispatchers.Main) {
            if (currentTrackId.isNotEmpty() || player.mediaItemCount > 0) {
                notifyState()
                lastEmittedQuality = null
                emitQualityForCurrent()
            }
        }
    }

    fun isPlaying(): Boolean = player.isPlaying
    fun currentPosition(): Long = player.currentPosition
    fun duration(): Long = player.duration.coerceAtLeast(0L)

    private fun startProgressLoop() {
        progressJob?.cancel()
        progressJob = scope.launch {
            while (isActive && player.isPlaying) {
                val dur = player.duration.coerceAtLeast(0L)
                val pos = player.currentPosition.coerceAtLeast(0L)
                val cf = crossfadeSec
                val activeItemId = player.currentMediaItem?.mediaId.orEmpty()
                var tickMs = 250L
                if (cf > 0 && !sleepAtTrackEnd && currentRepeatMode != 2 && fadeJob?.isActive != true &&
                    dur > (cf * 1000L + 2000L) && activeItemId.isNotEmpty() && activeItemId == currentTrackId
                ) {
                    val fadeMs = cf * 1000L
                    val rem = dur - pos
                    if (rem <= fadeMs + 5_500L) {
                        tickMs = 80L
                    }
                    if (rem in 150L..(fadeMs + 5_000L)) {
                        prepareOutgoing(activeItemId)
                    }
                    if (autoCrossfadeTriggeredForId != activeItemId && rem in 150L..fadeMs) {
                        autoCrossfadeTriggeredForId = activeItemId
                        playbackListener?.onAutoCrossfade(activeItemId)
                    }
                }
                notifyState()
                delay(tickMs)
            }
        }
    }

    private fun stopProgressLoop(notify: Boolean = true) {
        progressJob?.cancel()
        progressJob = null
        if (notify) notifyState()
    }

    fun getPlaybackSnapshotJson(): String {
        val tid = currentTrackId
        if (tid.isEmpty()) {
            return JSONObject().apply { put("active", false) }.toString()
        }
        val playing = snapIsPlaying
        val buffering = snapIsBuffering
        val durMs = snapDurationMs
        val basePos = snapPositionMs
        val updatedAt = snapUpdatedAtElapsedMs
        val posMs = if (playing && !buffering && updatedAt > 0L) {
            val est = basePos + (SystemClock.elapsedRealtime() - updatedAt).coerceAtLeast(0L)
            if (durMs > 0L) est.coerceIn(0L, durMs) else est
        } else {
            basePos
        }
        return JSONObject().apply {
            put("active", true)
            put("trackId", tid)
            put("title", currentTitle)
            put("artist", currentArtist)
            put("thumb", currentThumb)
            put("isPlaying", playing)
            put("isBuffering", buffering)
            put("posSec", posMs / 1000.0)
            put("durSec", durMs / 1000.0)
            put("qualityLabel", snapQualityLabel)
        }.toString()
    }

    private fun notifyState() {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            scope.launch(Dispatchers.Main) { notifyState() }
            return
        }
        val isPlaying = player.isPlaying
        val isBuffering = player.playbackState == Player.STATE_BUFFERING || (player.playWhenReady && !player.isPlaying && player.playbackState != Player.STATE_ENDED)
        val pos = player.currentPosition
        val dur = player.duration.coerceAtLeast(0L)
        val playerItemId = player.currentMediaItem?.mediaId.orEmpty()
        val currentTrack = if (playerItemId.isNotEmpty() && playerItemId != currentTrackId) {
            playerItemId
        } else {
            currentTrackId.ifEmpty { playerItemId }
        }
        snapIsPlaying = isPlaying
        snapIsBuffering = isBuffering
        snapPositionMs = pos.coerceAtLeast(0L)
        snapDurationMs = dur
        snapUpdatedAtElapsedMs = SystemClock.elapsedRealtime()
        playbackListener?.onPlaybackState(isPlaying, pos, dur, isBuffering, currentTrack)
    }

    fun onLocaleUpdated() {
        cachedAudioOutputsJson = null
        scope.launch(Dispatchers.Main) {
            if (currentTrackId.isEmpty()) {
                currentArtist = SonoraLocaleManager.getString(this@SonoraPlaybackService, R.string.playback_default_artist)
            }
            createNotificationChannel()
            updateMediaSessionCustomLayout()
            playbackListener?.onAudioOutputsChanged()
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = SonoraLocaleManager.getString(this, R.string.notification_channel_name)
            val descriptionText = SonoraLocaleManager.getString(this, R.string.notification_channel_description)
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(NOTIFICATION_CHANNEL_ID, name, importance).apply {
                description = descriptionText
                setShowBadge(false)
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        instance = null
        lastEmittedQuality = null
        stopProgressLoop(notify = false)
        stopCrossfadeOverlap()
        cancelPrewarmBytesJob()
        tailReleaseJob?.cancel()
        tailReleaseJob = null
        sleepJob?.cancel()
        audioDeviceCallback?.let { cb ->
            runCatching { audioManager?.unregisterAudioDeviceCallback(cb) }
        }
        tailPlayer?.release()
        tailPlayer = null
        mediaSession?.run {
            removeSession(this)
            player.release()
            release()
            mediaSession = null
        }
        mixer.release()
        artworkExecutor.shutdownNow()
        scope.cancel()
        super.onDestroy()
    }
}
