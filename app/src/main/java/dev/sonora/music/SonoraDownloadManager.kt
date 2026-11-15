package dev.sonora.music

import android.content.Context
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.HttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.CacheWriter
import androidx.media3.datasource.cache.ContentMetadata
import androidx.media3.datasource.cache.NoOpCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.datasource.okhttp.OkHttpDataSource
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject

data class DownloadEntry(
    val trackId: String,
    val status: String,
    val bytesDownloaded: Long = 0L,
    val contentLength: Long = -1L,
    val mimeType: String = "",
    val updatedAtMs: Long = System.currentTimeMillis(),
    val error: String? = null
) {
    fun progressFraction(): Double {
        return when {
            status == SonoraDownloadManager.STATUS_COMPLETED -> 1.0
            contentLength > 0L && bytesDownloaded >= 0L -> (bytesDownloaded.toDouble() / contentLength.toDouble()).coerceIn(0.0, 1.0)
            else -> 0.0
        }
    }

    fun toJson(): JSONObject = JSONObject().apply {
        put("id", trackId)
        put("trackId", trackId)
        put("status", status)
        put("bytesDownloaded", bytesDownloaded)
        put("contentLength", contentLength)
        put("mimeType", mimeType)
        put("updatedAtMs", updatedAtMs)
        put("progress", progressFraction())
        if (!error.isNullOrBlank()) {
            put("error", error)
        }
    }
}

@OptIn(UnstableApi::class)
object SonoraDownloadManager {
    const val STATUS_QUEUED = "queued"
    const val STATUS_DOWNLOADING = "downloading"
    const val STATUS_COMPLETED = "completed"
    const val STATUS_FAILED = "failed"

    private const val TAG = "SonoraDownloadMgr"
    private const val DOWNLOADS_DIR_NAME = "sonora_downloads"
    private const val STATE_FILE_NAME = "sonora_downloads_state.json"
    private const val MAX_CONCURRENT_DOWNLOADS = 2
    private const val PROGRESS_PERSIST_INTERVAL_MS = 1_500L
    private const val DEFAULT_USER_AGENT =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val downloadSemaphore = Semaphore(MAX_CONCURRENT_DOWNLOADS)

    @Volatile
    private var appContext: Context? = null

    @Volatile
    private var downloadCache: SimpleCache? = null
    private val cacheLock = Any()

    private val stateLock = Any()
    private val entries = LinkedHashMap<String, DownloadEntry>()

    @Volatile
    private var stateLoaded = false

    private data class ActiveDownload(
        val job: Job,
        val deferred: CompletableDeferred<Boolean>,
        val writerRef: AtomicReference<CacheWriter?>
    )

    private val activeDownloads = ConcurrentHashMap<String, ActiveDownload>()

    fun attach(context: Context) {
        val ctx = context.applicationContext ?: context
        if (appContext == null) {
            appContext = ctx
            scope.launch {
                runCatching { ensureInitialized(ctx) }
            }
        }
    }

    fun ensureInitialized(context: Context) {
        val ctx = context.applicationContext ?: context
        appContext = ctx
        getDownloadCache(ctx)
        ensureStateLoaded(ctx)
    }

    fun normalizeTrackId(rawId: String): String =
        rawId.trim()
            .removePrefix("youtube:track:")
            .removePrefix("yt:")
            .trim()

    fun cacheKeyFor(trackId: String): String = "youtube:track:${normalizeTrackId(trackId)}"

    fun getDownloadCache(context: Context): SimpleCache {
        downloadCache?.let { return it }
        val ctx = context.applicationContext ?: context
        appContext = ctx
        synchronized(cacheLock) {
            downloadCache?.let { return it }
            val dir = File(ctx.filesDir, DOWNLOADS_DIR_NAME).apply {
                if (!exists()) mkdirs()
            }
            val databaseProvider = SonoraPlaybackService.getDatabaseProvider(ctx)
            return SimpleCache(dir, NoOpCacheEvictor(), databaseProvider).also {
                downloadCache = it
            }
        }
    }

    private fun ensureStateLoaded(context: Context) {
        if (stateLoaded) return
        val ctx = context.applicationContext ?: context
        val cache = getDownloadCache(ctx)
        synchronized(stateLock) {
            if (stateLoaded) return
            val stateFile = File(ctx.filesDir, STATE_FILE_NAME)
            var dirty = false
            if (stateFile.exists()) {
                runCatching {
                    val raw = stateFile.readText(Charsets.UTF_8)
                    if (raw.isNotBlank()) {
                        val root = JSONObject(raw)
                        val arr = root.optJSONArray("downloads") ?: JSONArray()
                        for (i in 0 until arr.length()) {
                            val obj = arr.optJSONObject(i) ?: continue
                            val id = normalizeTrackId(obj.optString("trackId").ifBlank { obj.optString("id") })
                            if (id.isEmpty()) continue
                            val rawStatus = obj.optString("status", STATUS_FAILED)
                            val bytes = obj.optLong("bytesDownloaded", 0L).coerceAtLeast(0L)
                            val len = obj.optLong("contentLength", -1L)
                            val mime = obj.optString("mimeType", "")
                            val updated = obj.optLong("updatedAtMs", System.currentTimeMillis())
                            val err = obj.optString("error").takeIf { it.isNotBlank() }

                            val cacheKey = cacheKeyFor(id)
                            val completeOnDisk = isCacheResourceComplete(cache, cacheKey, len)
                            val reconciled = when {
                                completeOnDisk -> {
                                    val diskLen = resolveCachedContentLength(cache, cacheKey, len)
                                    val diskBytes = resolveCachedSpanBytes(cache, cacheKey)
                                    if (rawStatus != STATUS_COMPLETED) dirty = true
                                    DownloadEntry(
                                        trackId = id,
                                        status = STATUS_COMPLETED,
                                        bytesDownloaded = diskBytes,
                                        contentLength = if (diskLen > 0L) diskLen else diskBytes,
                                        mimeType = mime,
                                        updatedAtMs = updated,
                                        error = null
                                    )
                                }
                                rawStatus == STATUS_QUEUED || rawStatus == STATUS_DOWNLOADING -> {
                                    dirty = true
                                    runCatching { cache.removeResource(cacheKey) }
                                    DownloadEntry(
                                        trackId = id,
                                        status = STATUS_FAILED,
                                        bytesDownloaded = 0L,
                                        contentLength = len,
                                        mimeType = mime,
                                        updatedAtMs = System.currentTimeMillis(),
                                        error = "Interrupted"
                                    )
                                }
                                rawStatus == STATUS_COMPLETED -> {
                                    // Entry claimed completed, but cache files are missing or incomplete
                                    dirty = true
                                    runCatching { cache.removeResource(cacheKey) }
                                    DownloadEntry(
                                        trackId = id,
                                        status = STATUS_FAILED,
                                        bytesDownloaded = 0L,
                                        contentLength = -1L,
                                        mimeType = mime,
                                        updatedAtMs = System.currentTimeMillis(),
                                        error = "Missing cached content"
                                    )
                                }
                                else -> {
                                    DownloadEntry(
                                        trackId = id,
                                        status = STATUS_FAILED,
                                        bytesDownloaded = bytes,
                                        contentLength = len,
                                        mimeType = mime,
                                        updatedAtMs = updated,
                                        error = err
                                    )
                                }
                            }
                            entries[id] = reconciled
                        }
                    }
                }.onFailure { e ->
                    android.util.Log.w(TAG, "Failed loading download state: ${e.message}")
                }
            }

            // Recover any complete entries present in downloadCache that weren't in the JSON index
            runCatching {
                cache.keys.forEach { key ->
                    if (key.startsWith("youtube:track:")) {
                        val id = normalizeTrackId(key)
                        if (id.isNotEmpty() && !entries.containsKey(id) && isCacheResourceComplete(cache, key, -1L)) {
                            val diskLen = resolveCachedContentLength(cache, key, -1L)
                            val diskBytes = resolveCachedSpanBytes(cache, key)
                            entries[id] = DownloadEntry(
                                trackId = id,
                                status = STATUS_COMPLETED,
                                bytesDownloaded = diskBytes,
                                contentLength = if (diskLen > 0L) diskLen else diskBytes,
                                mimeType = "",
                                updatedAtMs = System.currentTimeMillis(),
                                error = null
                            )
                            dirty = true
                        }
                    }
                }
            }

            stateLoaded = true
            if (dirty) {
                persistStateLocked(ctx)
            }
        }
    }

    private fun persistStateLocked(context: Context) {
        runCatching {
            val arr = JSONArray()
            entries.values.forEach { arr.put(it.toJson()) }
            val root = JSONObject().apply {
                put("version", 1)
                put("updatedAtMs", System.currentTimeMillis())
                put("downloads", arr)
            }
            val target = File(context.filesDir, STATE_FILE_NAME)
            val tmp = File(context.filesDir, "$STATE_FILE_NAME.tmp")
            tmp.writeText(root.toString(), Charsets.UTF_8)
            try {
                Files.move(
                    tmp.toPath(),
                    target.toPath(),
                    StandardCopyOption.REPLACE_EXISTING,
                    StandardCopyOption.ATOMIC_MOVE
                )
            } catch (_: Exception) {
                if (!tmp.renameTo(target)) {
                    target.writeText(root.toString(), Charsets.UTF_8)
                    tmp.delete()
                }
            }
        }.onFailure { e ->
            android.util.Log.w(TAG, "Failed persisting download state: ${e.message}")
        }
    }

    private fun resolveCachedContentLength(cache: SimpleCache, cacheKey: String, knownLength: Long): Long {
        val metaLen = runCatching { ContentMetadata.getContentLength(cache.getContentMetadata(cacheKey)) }.getOrDefault(C.LENGTH_UNSET.toLong())
        return when {
            metaLen > 0L -> metaLen
            knownLength > 0L -> knownLength
            else -> -1L
        }
    }

    private fun resolveCachedSpanBytes(cache: SimpleCache, cacheKey: String): Long {
        return runCatching { cache.getCachedSpans(cacheKey).sumOf { it.length } }.getOrDefault(0L)
    }

    private fun isCacheResourceComplete(cache: SimpleCache, cacheKey: String, knownLength: Long): Boolean {
        val metaLen = runCatching { ContentMetadata.getContentLength(cache.getContentMetadata(cacheKey)) }.getOrDefault(C.LENGTH_UNSET.toLong())
        val effectiveLen = when {
            metaLen > 0L -> metaLen
            knownLength > 0L -> knownLength
            else -> -1L
        }
        if (effectiveLen > 0L) {
            return runCatching { cache.isCached(cacheKey, 0L, effectiveLen) }.getOrDefault(false)
        }
        return false
    }

    fun isTrackDownloaded(context: Context, rawId: String): Boolean {
        val ctx = context.applicationContext ?: context
        val cleanId = normalizeTrackId(rawId)
        if (cleanId.isEmpty() || cleanId.startsWith("local_")) return false
        ensureStateLoaded(ctx)
        val entry = synchronized(stateLock) { entries[cleanId] } ?: return false
        if (entry.status != STATUS_COMPLETED) return false

        val cache = getDownloadCache(ctx)
        val cacheKey = cacheKeyFor(cleanId)
        val metaLen = runCatching { ContentMetadata.getContentLength(cache.getContentMetadata(cacheKey)) }.getOrDefault(C.LENGTH_UNSET.toLong())
        val effectiveLen = if (metaLen > 0L) metaLen else entry.contentLength
        val present = if (effectiveLen > 0L) {
            runCatching { cache.isCached(cacheKey, 0L, effectiveLen) }.getOrDefault(false)
        } else {
            resolveCachedSpanBytes(cache, cacheKey) > 0L
        }
        if (!present) {
            synchronized(stateLock) {
                if (entries[cleanId]?.status == STATUS_COMPLETED) {
                    entries.remove(cleanId)
                    persistStateLocked(ctx)
                }
            }
        }
        return present
    }

    fun enqueue(context: Context, rawId: String): CompletableDeferred<Boolean> {
        val ctx = context.applicationContext ?: context
        attach(ctx)
        val cleanId = normalizeTrackId(rawId)
        if (cleanId.isEmpty() || cleanId.startsWith("local_")) {
            return CompletableDeferred(false)
        }
        ensureStateLoaded(ctx)
        if (isTrackDownloaded(ctx, cleanId)) {
            return CompletableDeferred(true)
        }

        activeDownloads[cleanId]?.let { existing ->
            if (!existing.deferred.isCompleted && existing.job.isActive) {
                return existing.deferred
            }
        }

        val deferred = CompletableDeferred<Boolean>()
        val writerRef = AtomicReference<CacheWriter?>(null)
        lateinit var activeRecord: ActiveDownload

        val job = scope.launch(start = CoroutineStart.LAZY) {
            var succeeded = false
            var failureReason: String? = null
            try {
                downloadSemaphore.withPermit {
                    if (!isActive || activeDownloads[cleanId] !== activeRecord) return@withPermit

                    // Re-check inside permit in case another job completed it just before
                    if (isTrackDownloaded(ctx, cleanId)) {
                        succeeded = true
                        return@withPermit
                    }

                    updateEntry(ctx, cleanId, persist = true) { prev ->
                        DownloadEntry(
                            trackId = cleanId,
                            status = STATUS_DOWNLOADING,
                            bytesDownloaded = 0L,
                            contentLength = prev?.contentLength ?: -1L,
                            mimeType = prev?.mimeType.orEmpty(),
                            updatedAtMs = System.currentTimeMillis(),
                            error = null
                        )
                    }

                    val result = performDownloadWithRetry(ctx, cleanId, writerRef) { bytes, totalLen, mime ->
                        if (activeDownloads[cleanId] === activeRecord) {
                            updateProgressThrottled(ctx, cleanId, bytes, totalLen, mime)
                        }
                    }
                    succeeded = result.first
                    failureReason = result.second
                }
            } catch (ce: CancellationException) {
                failureReason = "Cancelled"
                throw ce
            } catch (t: Throwable) {
                failureReason = t.message ?: "Download failed"
                android.util.Log.w(TAG, "Download error for $cleanId: $failureReason")
            } finally {
                val cancelledOrRemoved = !isActive || activeDownloads[cleanId] !== activeRecord
                if (!succeeded && !cancelledOrRemoved) {
                    runCatching { getDownloadCache(ctx).removeResource(cacheKeyFor(cleanId)) }
                    updateEntry(ctx, cleanId, persist = true) { prev ->
                        DownloadEntry(
                            trackId = cleanId,
                            status = STATUS_FAILED,
                            bytesDownloaded = 0L,
                            contentLength = prev?.contentLength ?: -1L,
                            mimeType = prev?.mimeType.orEmpty(),
                            updatedAtMs = System.currentTimeMillis(),
                            error = failureReason ?: "Download failed"
                        )
                    }
                }
                activeDownloads.remove(cleanId, activeRecord)
                if (!deferred.isCompleted) {
                    deferred.complete(succeeded)
                }
            }
        }

        activeRecord = ActiveDownload(job, deferred, writerRef)
        val prev = activeDownloads.putIfAbsent(cleanId, activeRecord)
        if (prev != null && !prev.deferred.isCompleted && prev.job.isActive) {
            job.cancel()
            return prev.deferred
        }
        activeDownloads[cleanId] = activeRecord

        updateEntry(ctx, cleanId, persist = true) { existing ->
            if (existing?.status == STATUS_DOWNLOADING || existing?.status == STATUS_COMPLETED) {
                existing
            } else {
                DownloadEntry(
                    trackId = cleanId,
                    status = STATUS_QUEUED,
                    bytesDownloaded = 0L,
                    contentLength = existing?.contentLength ?: -1L,
                    mimeType = existing?.mimeType.orEmpty(),
                    updatedAtMs = System.currentTimeMillis(),
                    error = null
                )
            }
        }

        job.start()
        return deferred
    }

    suspend fun downloadAndAwait(context: Context, rawId: String, timeoutMs: Long = 90_000L): Boolean {
        val deferred = enqueue(context, rawId)
        return withTimeoutOrNull(timeoutMs) { deferred.await() } ?: false
    }

    private suspend fun performDownloadWithRetry(
        context: Context,
        cleanId: String,
        writerRef: AtomicReference<CacheWriter?>,
        onProgress: (bytes: Long, totalLen: Long, mime: String) -> Unit
    ): Pair<Boolean, String?> {
        val cache = getDownloadCache(context)
        val cacheKey = cacheKeyFor(cleanId)
        var lastError: String? = null

        for (attempt in 1..2) {
            if (!currentCoroutineContext().isActive) return false to "Cancelled"
            if (attempt > 1) {
                StreamCache.forget(cleanId)
                runCatching { cache.removeResource(cacheKey) }
            }
            val attemptRes = performSingleAttempt(context, cleanId, cache, cacheKey, writerRef, onProgress)
            if (attemptRes.first) {
                return true to null
            }
            lastError = attemptRes.second
            if (!currentCoroutineContext().isActive) return false to "Cancelled"
        }
        return false to lastError
    }

    private suspend fun performSingleAttempt(
        context: Context,
        cleanId: String,
        cache: SimpleCache,
        cacheKey: String,
        writerRef: AtomicReference<CacheWriter?>,
        onProgress: (bytes: Long, totalLen: Long, mime: String) -> Unit
    ): Pair<Boolean, String?> {
        SonoraAudioResolver.ensureNewPipe()
        val resolvedUrl = SonoraAudioResolver.resolve(cleanId)
        if (resolvedUrl.isNullOrBlank()) {
            return false to "Unable to resolve stream URL"
        }

        val initialMime = mimeTypeForCodec(StreamCache.getMeta(cleanId)?.codec)
        if (!SonoraAudioResolver.hasLoudnessDb(cleanId)) {
            runCatching { SonoraAudioResolver.fetchLoudnessDb(cleanId) }
        }

        val httpFactory = OkHttpDataSource.Factory(SonoraPlaybackService.downloadOkHttp)
            .setUserAgent(DEFAULT_USER_AGENT)
        val defaultFactory = DefaultDataSource.Factory(context, httpFactory)
        val chunkedFactory = ChunkedDataSource.Factory(defaultFactory)
        val resolvingFactory = ResolvingDataSource.Factory(chunkedFactory, SonoraStreamResolver())
        val cacheFactory = CacheDataSource.Factory()
            .setCache(cache)
            .setUpstreamDataSourceFactory(resolvingFactory)
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

        val dataSource = cacheFactory.createDataSourceForDownloading()
        val spec = DataSpec.Builder()
            .setUri(Uri.parse(cacheKey))
            .setKey(cacheKey)
            .build()
        val job = currentCoroutineContext()[Job]
        val cancelHook = job?.invokeOnCompletion { cause ->
            if (cause != null) writerRef.get()?.cancel()
        }

        return try {
            val writer = CacheWriter(
                dataSource,
                spec,
                null,
                CacheWriter.ProgressListener { requestLength, bytesCached, _ ->
                    if (job != null && !job.isActive) {
                        writerRef.get()?.cancel()
                        return@ProgressListener
                    }
                    onProgress(bytesCached, requestLength, initialMime)
                }
            )
            writerRef.set(writer)
            if (job != null && !job.isActive) {
                writer.cancel()
                return false to "Cancelled"
            }
            writer.cache()

            val headerMime = dataSource.responseHeaders.entries
                .firstOrNull { it.key.equals("content-type", ignoreCase = true) }
                ?.value?.firstOrNull()
                ?.substringBefore(';')
                ?.trim()
                ?.takeIf { it.startsWith("audio/", ignoreCase = true) }
            val finalMime = headerMime ?: initialMime

            val metaLen = runCatching { ContentMetadata.getContentLength(cache.getContentMetadata(cacheKey)) }
                .getOrDefault(C.LENGTH_UNSET.toLong())
            val spanBytes = resolveCachedSpanBytes(cache, cacheKey)
            val totalLen = if (metaLen > 0L) metaLen else spanBytes

            if (spanBytes <= 0L || (metaLen > 0L && !cache.isCached(cacheKey, 0L, metaLen))) {
                return false to "Incomplete cache write"
            }

            updateEntry(context, cleanId, persist = true) {
                DownloadEntry(
                    trackId = cleanId,
                    status = STATUS_COMPLETED,
                    bytesDownloaded = spanBytes,
                    contentLength = totalLen,
                    mimeType = finalMime,
                    updatedAtMs = System.currentTimeMillis(),
                    error = null
                )
            }
            true to null
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: HttpDataSource.InvalidResponseCodeException) {
            android.util.Log.w(TAG, "HTTP ${e.responseCode} downloading $cleanId: ${e.message}")
            false to "HTTP ${e.responseCode}"
        } catch (t: Throwable) {
            android.util.Log.w(TAG, "Failed downloading $cleanId: ${t.message}")
            false to (t.message ?: "Download failed")
        } finally {
            cancelHook?.dispose()
            writerRef.set(null)
            runCatching { dataSource.close() }
        }
    }

    private fun mimeTypeForCodec(codec: String?): String = when (codec?.uppercase()) {
        "OPUS" -> "audio/webm"
        "AAC" -> "audio/mp4"
        "FLAC" -> "audio/flac"
        else -> "audio/mp4"
    }

    private val lastProgressPersistMs = ConcurrentHashMap<String, Long>()

    private fun updateProgressThrottled(
        context: Context,
        cleanId: String,
        bytes: Long,
        totalLen: Long,
        mime: String
    ) {
        val now = System.currentTimeMillis()
        val prevPersist = lastProgressPersistMs[cleanId] ?: 0L
        val shouldPersist = (now - prevPersist) >= PROGRESS_PERSIST_INTERVAL_MS
        if (shouldPersist) {
            lastProgressPersistMs[cleanId] = now
        }
        updateEntry(context, cleanId, persist = shouldPersist) { prev ->
            if (prev?.status == STATUS_COMPLETED) {
                prev
            } else {
                DownloadEntry(
                    trackId = cleanId,
                    status = STATUS_DOWNLOADING,
                    bytesDownloaded = bytes.coerceAtLeast(0L),
                    contentLength = if (totalLen > 0L) totalLen else (prev?.contentLength ?: -1L),
                    mimeType = mime.ifBlank { prev?.mimeType.orEmpty() },
                    updatedAtMs = now,
                    error = null
                )
            }
        }
    }

    private inline fun updateEntry(
        context: Context,
        cleanId: String,
        persist: Boolean,
        transform: (DownloadEntry?) -> DownloadEntry
    ) {
        synchronized(stateLock) {
            val updated = transform(entries[cleanId])
            entries[cleanId] = updated
            if (persist) {
                persistStateLocked(context)
            }
        }
    }

    fun deleteDownloadedTrack(context: Context, rawId: String): Boolean {
        val ctx = context.applicationContext ?: context
        val cleanId = normalizeTrackId(rawId)
        if (cleanId.isEmpty()) return false
        ensureStateLoaded(ctx)

        activeDownloads.remove(cleanId)?.let { active ->
            active.writerRef.get()?.cancel()
            active.job.cancel()
            if (!active.deferred.isCompleted) {
                active.deferred.complete(false)
            }
        }
        lastProgressPersistMs.remove(cleanId)

        runCatching {
            getDownloadCache(ctx).removeResource(cacheKeyFor(cleanId))
        }

        val removed = synchronized(stateLock) {
            val prev = entries.remove(cleanId)
            persistStateLocked(ctx)
            prev != null
        }
        return removed
    }

    fun getDownloadEntry(context: Context, rawId: String): DownloadEntry? {
        val ctx = context.applicationContext ?: context
        val cleanId = normalizeTrackId(rawId)
        if (cleanId.isEmpty()) return null
        ensureStateLoaded(ctx)
        return synchronized(stateLock) { entries[cleanId] }
    }

    fun getAllDownloads(context: Context): List<DownloadEntry> {
        val ctx = context.applicationContext ?: context
        ensureStateLoaded(ctx)
        return synchronized(stateLock) { entries.values.toList() }
    }

    fun getDownloadsSizeBytes(context: Context): Long {
        val ctx = context.applicationContext ?: context
        downloadCache?.let { cache ->
            return runCatching { cache.cacheSpace }.getOrDefault(0L)
        }
        val dir = File(ctx.filesDir, DOWNLOADS_DIR_NAME)
        if (!dir.exists()) return 0L
        var sum = 0L
        dir.walkTopDown().forEach { if (it.isFile) sum += it.length() }
        return sum
    }

    fun getCompletedDownloadCount(context: Context): Int {
        val ctx = context.applicationContext ?: context
        ensureStateLoaded(ctx)
        return synchronized(stateLock) {
            entries.values.count { it.status == STATUS_COMPLETED }
        }
    }

    fun getDownloadsStatusJson(context: Context): String {
        val ctx = context.applicationContext ?: context
        ensureStateLoaded(ctx)
        val snapshot = synchronized(stateLock) { entries.values.toList() }
        val arr = JSONArray()
        var completedCount = 0
        var activeCount = 0
        snapshot.forEach { entry ->
            if (entry.status == STATUS_COMPLETED) completedCount++
            else if (entry.status == STATUS_QUEUED || entry.status == STATUS_DOWNLOADING) activeCount++
            arr.put(entry.toJson())
        }
        return JSONObject().apply {
            put("ok", true)
            put("totalBytes", getDownloadsSizeBytes(ctx))
            put("completedCount", completedCount)
            put("activeCount", activeCount)
            put("downloads", arr)
        }.toString()
    }

    fun getTrackStatusJson(context: Context, rawId: String): String {
        val ctx = context.applicationContext ?: context
        val cleanId = normalizeTrackId(rawId)
        ensureStateLoaded(ctx)
        val entry = synchronized(stateLock) { entries[cleanId] }
        val downloaded = isTrackDownloaded(ctx, cleanId)
        return JSONObject().apply {
            put("ok", true)
            put("id", cleanId)
            put("trackId", cleanId)
            put("downloaded", downloaded)
            put("status", entry?.status ?: if (downloaded) STATUS_COMPLETED else "none")
            put("bytesDownloaded", entry?.bytesDownloaded ?: 0L)
            put("contentLength", entry?.contentLength ?: -1L)
            put("mimeType", entry?.mimeType.orEmpty())
            put("progress", entry?.progressFraction() ?: if (downloaded) 1.0 else 0.0)
            if (entry != null) {
                put("updatedAtMs", entry.updatedAtMs)
                if (!entry.error.isNullOrBlank()) {
                    put("error", entry.error)
                }
            }
        }.toString()
    }
}
