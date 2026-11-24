package dev.sonora.music.lyrics

import android.content.Context
import android.util.LruCache
import dev.sonora.music.LyricLine
import dev.sonora.music.Lyrics
import dev.sonora.music.LyricsCredit
import dev.sonora.music.SonoraHttpPool
import java.io.File
import java.io.IOException
import java.net.URLEncoder
import java.security.MessageDigest
import java.text.Normalizer
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject

enum class LyricsSource(val label: String, val idName: String, val group: String = "main") {
    APPLE_MUSIC("Apple Music", "apple", "main"),
    BETTER_LYRICS("Better Lyrics", "better", "main"),
    LRCLIB("LRCLIB", "lrclib", "main"),
    NETEASE("NetEase", "netease", "main"),
    KUGOU("KuGou", "kugou", "other"),
    LYRICS_OVH("Lyrics.ovh", "ovh", "other"),
}

data class LyricsQuery(val uri: String, val title: String, val artist: String, val durationMs: Long)

data class SourceResult(
    val source: LyricsSource,
    val state: String, // "ok", "none", "error"
    val kind: String?, // "word", "line", "plain"
    val lyrics: Lyrics?
)

data class LyricSearchHit(
    val title: String,
    val artist: String,
    val snippet: String,
    val album: String = "",
    val videoId: String = "",
)

object LyricsLibrary {

    private const val DISK_CACHE_VERSION = "v5"
    private const val DISK_CACHE_TTL_MS = 7L * 24L * 3600L * 1000L
    private const val SOURCE_TIMEOUT_MS = 12_000L
    private const val LYRIC_SEARCH_SCAN_LIMIT = 150
    private const val LYRIC_SEARCH_TIMEOUT_MS = 1_400L
    private val TOP_TIER_SOURCES = setOf("apple", "better")

    private val COMBINING_MARKS_REGEX = Regex("""\p{InCombiningDiacriticalMarks}+""")
    private val QUOTE_CHARS = charArrayOf('"', '\'', '«', '»', '“', '”', '‘', '’', '„')
    private val WHITESPACE_REGEX = Regex("""\s+""")
    private val PUNCT_TO_SPACE_REGEX = Regex("""[^\p{L}\p{N}\s]+""")
    private val LRC_TIMESTAMPS_REGEX = Regex("""\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]\s*|<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>\s*""")
    private val LRC_META_LINE_REGEX = Regex("""^\[[a-zA-Z]+:.*\]$""")

    private val HEX_CHARS = "0123456789abcdef".toCharArray()
    private val sha1Digest = object : ThreadLocal<MessageDigest>() {
        override fun initialValue(): MessageDigest = MessageDigest.getInstance("SHA-1")
    }

    private val searchHttpClient: OkHttpClient by lazy {
        SonoraHttpPool.baseClient.newBuilder()
            .connectTimeout(1200, TimeUnit.MILLISECONDS)
            .readTimeout(1200, TimeUnit.MILLISECONDS)
            .callTimeout(1350, TimeUnit.MILLISECONDS)
            .build()
    }

    private class Survey(
        val jobs: Map<LyricsSource, Deferred<SourceResult>>,
        val completed: ConcurrentHashMap<LyricsSource, SourceResult>,
        val progress: MutableStateFlow<Int>,
        val createdAtMs: Long = System.currentTimeMillis(),
    )

    private data class CachedSearchDoc(
        val lastModified: Long,
        val title: String,
        val artist: String,
        val album: String,
        val videoId: String,
        val lines: List<String>,
    )

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val surveys = LruCache<String, Survey>(32)
    private val searchDocCache = LruCache<String, CachedSearchDoc>(LYRIC_SEARCH_SCAN_LIMIT)
    private val recheckedKeys = ConcurrentHashMap.newKeySet<String>()
    private val diskFileSizes = ConcurrentHashMap<String, Long>()
    @Volatile
    private var diskIndexReady = false

    @Volatile
    private var diskCacheDir: File? = null

    val allSources: List<LyricsSource> = listOf(
        LyricsSource.APPLE_MUSIC,
        LyricsSource.BETTER_LYRICS,
        LyricsSource.LRCLIB,
        LyricsSource.NETEASE,
        LyricsSource.KUGOU,
        LyricsSource.LYRICS_OVH,
    )

    fun attach(context: Context) {
        val dir = File(context.applicationContext.cacheDir, "sonora_lyrics_cache")
        diskCacheDir = dir
        scope.launch {
            runCatching {
                if (!dir.exists()) dir.mkdirs()
                val files = dir.listFiles()
                if (files != null) {
                    for (f in files) {
                        if (f.isFile && f.name.endsWith(".json")) {
                            diskFileSizes[f.name] = f.length()
                        }
                    }
                }
                diskIndexReady = true
            }
        }
    }

    private fun sha1Hex(input: String): String {
        val md = sha1Digest.get()!!
        md.reset()
        val bytes = md.digest(input.toByteArray(Charsets.UTF_8))
        val out = CharArray(bytes.size * 2)
        for (i in bytes.indices) {
            val v = bytes[i].toInt() and 0xFF
            out[i * 2] = HEX_CHARS[v ushr 4]
            out[i * 2 + 1] = HEX_CHARS[v and 0x0F]
        }
        return String(out)
    }

    private fun shallowCopyJson(src: JSONObject): JSONObject {
        val copy = JSONObject()
        val keys = src.keys()
        while (keys.hasNext()) {
            val k = keys.next()
            copy.put(k, src.get(k))
        }
        return copy
    }

    private fun isTopTierWord(obj: JSONObject): Boolean =
        obj.optString("kind") == "word" && obj.optString("source") in TOP_TIER_SOURCES

    private fun kindRank(kind: String?): Int = when (kind) {
        "word" -> 2
        "line" -> 1
        else -> 0
    }

    private fun sourcePriority(src: String?): Int {
        if (src.isNullOrEmpty()) return Int.MAX_VALUE
        val idx = allSources.indexOfFirst { it.idName == src }
        return if (idx >= 0) idx else Int.MAX_VALUE
    }

    private fun isBetterResult(candidate: JSONObject, baseline: JSONObject): Boolean {
        if (!candidate.optBoolean("available", false)) return false
        if ((candidate.optJSONArray("lines")?.length() ?: 0) <= 0) return false
        if (!baseline.optBoolean("available", false)) return true
        val candRank = kindRank(candidate.optString("kind"))
        val baseRank = kindRank(baseline.optString("kind"))
        if (candRank != baseRank) return candRank > baseRank
        return sourcePriority(candidate.optString("source")) < sourcePriority(baseline.optString("source"))
    }

    private fun isSettledForDiskCache(obj: JSONObject): Boolean {
        val topWord = obj.optBoolean("auto", false) && isTopTierWord(obj)
        val sources = obj.optJSONArray("sources")
        if (sources != null && !topWord) {
            for (i in 0 until sources.length()) {
                val s = sources.optJSONObject(i) ?: continue
                if (s.optString("id") in TOP_TIER_SOURCES && s.optString("state") == "error") {
                    return false
                }
            }
        }
        val pend = obj.optJSONArray("pending")
        val hasPending = (pend?.length() ?: 0) > 0
        if (!hasPending) return true
        if (!topWord) return false
        val myIdx = sourcePriority(obj.optString("source"))
        for (i in 0 until (pend?.length() ?: 0)) {
            if (sourcePriority(pend!!.optString(i)) < myIdx) return false
        }
        return true
    }

    private fun diskCacheFile(dir: File, key: String): File =
        File(dir, "${DISK_CACHE_VERSION}_${sha1Hex(key)}.json")

    private fun readDiskCache(key: String): JSONObject? {
        val dir = diskCacheDir ?: return null
        val file = diskCacheFile(dir, key)
        if (diskIndexReady && !diskFileSizes.containsKey(file.name)) return null
        if (!file.exists()) {
            diskFileSizes.remove(file.name)
            return null
        }
        if (System.currentTimeMillis() - file.lastModified() > DISK_CACHE_TTL_MS) {
            runCatching { file.delete() }
            diskFileSizes.remove(file.name)
            synchronized(searchDocCache) { searchDocCache.remove(file.name) }
            return null
        }
        return runCatching {
            val obj = JSONObject(file.readText(Charsets.UTF_8))
            val valid = obj.optBoolean("available", false) &&
                (obj.optJSONArray("lines")?.length() ?: 0) > 0 &&
                isSettledForDiskCache(obj)
            if (valid) obj else null
        }.getOrNull()
    }

    private fun writeDiskCache(
        key: String,
        root: JSONObject,
        title: String = "",
        artist: String = "",
        videoId: String = "",
        album: String = "",
    ) {
        val dir = diskCacheDir ?: return
        if (!root.optBoolean("available", false)) return
        val linesLen = root.optJSONArray("lines")?.length() ?: 0
        if (linesLen == 0) return
        if (!isSettledForDiskCache(root)) return
        val diskObj = shallowCopyJson(root)
        val cleanTitle = title.trim()
        val cleanArtist = artist.trim()
        val cleanVid = videoId.trim()
        val cleanAlbum = album.trim()
        if (cleanTitle.isNotBlank()) diskObj.put("title", cleanTitle)
        if (cleanArtist.isNotBlank()) diskObj.put("artist", cleanArtist)
        if (cleanVid.isNotBlank()) diskObj.put("videoId", cleanVid)
        if (cleanAlbum.isNotBlank()) diskObj.put("album", cleanAlbum)
        val payload = diskObj.toString()
        scope.launch {
            runCatching {
                if (!dir.exists()) dir.mkdirs()
                val file = diskCacheFile(dir, key)
                val bytes = payload.toByteArray(Charsets.UTF_8)
                file.writeBytes(bytes)
                diskFileSizes[file.name] = bytes.size.toLong()
                synchronized(searchDocCache) { searchDocCache.remove(file.name) }
            }
        }
    }

    fun getDiskCacheSizeBytes(): Long {
        if (diskIndexReady) {
            var sum = 0L
            for (v in diskFileSizes.values) sum += v
            return sum
        }
        val dir = diskCacheDir ?: return 0L
        if (!dir.exists()) return 0L
        return dir.listFiles()?.sumOf { if (it.isFile) it.length() else 0L } ?: 0L
    }

    fun getCachedEntryCount(): Int {
        if (diskIndexReady) return diskFileSizes.size
        val dir = diskCacheDir ?: return 0
        return dir.listFiles()?.count { it.isFile && it.name.endsWith(".json") } ?: 0
    }

    fun clearCache() {
        recheckedKeys.clear()
        diskFileSizes.clear()
        synchronized(surveys) {
            surveys.evictAll()
        }
        synchronized(searchDocCache) {
            searchDocCache.evictAll()
        }
        val dir = diskCacheDir
        if (dir != null) {
            scope.launch {
                runCatching {
                    dir.listFiles()?.forEach { it.delete() }
                }
            }
        }
    }

    suspend fun fetchOne(source: LyricsSource, query: LyricsQuery): SourceResult = runCatching {
        val (_, title, artist, duration) = query
        val lyrics = when (source) {
            LyricsSource.APPLE_MUSIC -> Lossless.lyrics(title, artist, duration)
            LyricsSource.BETTER_LYRICS -> BetterLyrics.lyrics(title, artist, duration)
            LyricsSource.LRCLIB -> LrcLib.lyrics(title, artist, duration)
            LyricsSource.NETEASE -> NetEase.lyrics(title, artist, duration)
            LyricsSource.KUGOU -> KuGou.lyrics(title, artist, duration)
            LyricsSource.LYRICS_OVH -> LyricsOvh.lyrics(title, artist, duration)
        }?.takeIf { it.lines.isNotEmpty() }?.copy(source = source.idName)

        if (lyrics != null) {
            val hasWord = lyrics.lines.any { it.words.isNotEmpty() }
            val kind = if (hasWord) "word" else if (lyrics.synced) "line" else "plain"
            SourceResult(source, "ok", kind, lyrics)
        } else {
            SourceResult(source, "none", null, null)
        }
    }.getOrElse {
        if (it is kotlin.coroutines.cancellation.CancellationException) throw it
        SourceResult(source, "error", null, null)
    }

    private fun rank(lyrics: Lyrics): Int = when {
        lyrics.lines.any { it.words.isNotEmpty() } -> 2
        lyrics.synced -> 1
        else -> 0
    }

    private fun hasErroredTopTierWithoutWinner(survey: Survey): Boolean {
        if (survey.jobs.values.any { it.isActive }) return false
        val snap = survey.completed
        if (hasSettledWordWinner(snap)) return false
        val apple = snap[LyricsSource.APPLE_MUSIC]
        val better = snap[LyricsSource.BETTER_LYRICS]
        val topWord = (apple?.state == "ok" && apple.kind == "word") || (better?.state == "ok" && better.kind == "word")
        if (topWord) return false
        return apple?.state == "error" || better?.state == "error"
    }

    private fun getOrStartSurvey(
        cacheKey: String,
        query: LyricsQuery,
        allowRetryErrored: Boolean = false
    ): Survey = synchronized(surveys) {
        surveys.get(cacheKey)?.let { existing ->
            if (!allowRetryErrored || !hasErroredTopTierWithoutWinner(existing)) {
                return@synchronized existing
            }
            surveys.remove(cacheKey)
        }
        val completed = ConcurrentHashMap<LyricsSource, SourceResult>()
        val progress = MutableStateFlow(0)
        val jobs = allSources.associateWith { src ->
            scope.async {
                val res = withTimeoutOrNull(SOURCE_TIMEOUT_MS) {
                    fetchOne(src, query)
                } ?: SourceResult(src, "error", null, null)
                completed[src] = res
                progress.value = completed.size
                res
            }
        }
        Survey(jobs, completed, progress).also { surveys.put(cacheKey, it) }
    }

    private fun hasSettledWordWinner(snap: Map<LyricsSource, SourceResult>): Boolean {
        for (src in allSources) {
            val res = snap[src] ?: return false
            if (res.state == "ok" && res.kind == "word") return true
        }
        return false
    }

    private fun hasTopTierSettled(snap: Map<LyricsSource, SourceResult>): Boolean =
        snap.containsKey(LyricsSource.APPLE_MUSIC) && snap.containsKey(LyricsSource.BETTER_LYRICS)

    suspend fun collect(
        query: LyricsQuery,
        requestedSrc: String = "auto",
        mode: String = "fast"
    ): JSONObject = withContext(Dispatchers.IO) {
        val durSec = (query.durationMs / 1000L).coerceAtLeast(0L)
        val cacheKey = "${query.title.trim().lowercase()}||${query.artist.trim().lowercase()}||$durSec"
        val diskKey = "$DISK_CACHE_VERSION||$cacheKey||$requestedSrc"
        val videoId = query.uri.removePrefix("youtube:").trim()
        if (mode != "all") {
            readDiskCache(diskKey)?.let { cachedObj ->
                if (requestedSrc != "auto" || isTopTierWord(cachedObj)) {
                    return@withContext cachedObj
                }
                val firstCheck = recheckedKeys.add(cacheKey)
                val survey = getOrStartSurvey(cacheKey, query, allowRetryErrored = firstCheck)
                val waitMs = (survey.createdAtMs + 2_000L) - System.currentTimeMillis()
                if (waitMs > 0L) {
                    withTimeoutOrNull(waitMs) {
                        survey.progress.first {
                            val snap = survey.completed
                            snap.size >= allSources.size || hasSettledWordWinner(snap) || hasTopTierSettled(snap)
                        }
                    }
                }
                val liveRoot = buildJsonResponse(survey.completed, requestedSrc)
                if (isBetterResult(liveRoot, cachedObj)) {
                    if (liveRoot.optBoolean("available", false) && isSettledForDiskCache(liveRoot)) {
                        writeDiskCache(diskKey, liveRoot, query.title, query.artist, videoId = videoId)
                    }
                    return@withContext liveRoot
                }
                val pendingTop = listOf(LyricsSource.APPLE_MUSIC, LyricsSource.BETTER_LYRICS)
                    .filter { !survey.completed.containsKey(it) }
                    .map { it.idName }
                if (pendingTop.isNotEmpty()) {
                    scope.launch {
                        runCatching {
                            survey.jobs.values.awaitAll()
                            val upgradedRoot = buildJsonResponse(survey.completed, requestedSrc)
                            if (isBetterResult(upgradedRoot, cachedObj) && isSettledForDiskCache(upgradedRoot)) {
                                writeDiskCache(diskKey, upgradedRoot, query.title, query.artist, videoId = videoId)
                            }
                        }
                    }
                    val patched = shallowCopyJson(cachedObj)
                    patched.put("pending", JSONArray(pendingTop))
                    return@withContext patched
                }
                return@withContext cachedObj
            }
        }

        val survey = getOrStartSurvey(cacheKey, query, allowRetryErrored = mode == "all")
        if (mode == "all") {
            survey.jobs.values.awaitAll()
        } else {
            val callStart = System.currentTimeMillis()
            val targetSrc = if (requestedSrc != "auto") allSources.firstOrNull { it.idName == requestedSrc } else null
            val initialWait = if (targetSrc != null) 2500L else 2200L
            val maxFallbackWait = if (targetSrc != null) 2500L else 4200L

            if (targetSrc != null) {
                withTimeoutOrNull(initialWait) {
                    survey.progress.first {
                        val snap = survey.completed
                        snap.size >= allSources.size || snap.containsKey(targetSrc)
                    }
                }
            } else {
                while (true) {
                    val now = System.currentTimeMillis()
                    val surveyElapsed = now - survey.createdAtMs
                    val callElapsed = now - callStart
                    val snap = survey.completed
                    val seenCount = survey.progress.value
                    if (snap.size >= allSources.size) break
                    val hasAnyOk = snap.values.any { it.state == "ok" }
                    if (hasSettledWordWinner(snap)) break
                    if (hasTopTierSettled(snap) && hasAnyOk) break
                    if (surveyElapsed >= initialWait && hasAnyOk && callElapsed >= 250L) break
                    if (surveyElapsed >= maxFallbackWait && callElapsed >= 400L) break

                    val nextGateMs = if (hasAnyOk) {
                        maxOf(initialWait - surveyElapsed, 250L - callElapsed)
                    } else {
                        maxOf(maxFallbackWait - surveyElapsed, 400L - callElapsed)
                    }.coerceAtLeast(1L)
                    withTimeoutOrNull(nextGateMs) {
                        survey.progress.first { it > seenCount }
                    }
                }
            }
        }
        val root = buildJsonResponse(survey.completed, requestedSrc)
        if (root.optBoolean("available", false) && isSettledForDiskCache(root)) {
            writeDiskCache(diskKey, root, query.title, query.artist, videoId = videoId)
        }
        root
    }

    private fun buildJsonResponse(
        resultsMap: Map<LyricsSource, SourceResult>,
        requestedSrc: String
    ): JSONObject {
        val sourcesArr = JSONArray()
        val pendingArr = JSONArray()
        var bestResult: SourceResult? = null

        // Priority order for auto selection: Apple Music -> Better Lyrics -> LRCLIB -> NetEase -> KuGou -> Lyrics.ovh
        for (src in allSources) {
            val res = resultsMap[src] ?: SourceResult(src, "pending", null, null)
            if (res.state == "pending") {
                pendingArr.put(src.idName)
            }
            val srcObj = JSONObject().apply {
                put("id", src.idName)
                put("name", src.label)
                put("group", src.group)
                put("state", res.state)
                put("kind", res.kind ?: JSONObject.NULL)
            }
            sourcesArr.put(srcObj)

            if (res.lyrics != null) {
                if (bestResult == null) {
                    bestResult = res
                } else {
                    val currentRank = rank(bestResult.lyrics!!)
                    val newRank = rank(res.lyrics)
                    if (newRank > currentRank) {
                        bestResult = res
                    }
                }
            }
        }

        val selectedSrcResult = if (requestedSrc != "auto") {
            val match = allSources.firstOrNull { it.idName == requestedSrc }
            match?.let { resultsMap[it] }
        } else {
            bestResult
        }

        val chosenLyrics = selectedSrcResult?.lyrics
        val chosenSrcName = selectedSrcResult?.source?.idName ?: (if (requestedSrc != "auto") requestedSrc else "auto")

        val root = JSONObject().apply {
            put("sources", sourcesArr)
            put("pending", pendingArr)
            put("selected", chosenSrcName)
            put("best", bestResult?.source?.idName ?: JSONObject.NULL)
            put("auto", requestedSrc == "auto")
        }

        if (chosenLyrics == null || chosenLyrics.lines.isEmpty()) {
            root.put("available", false)
            root.put("synced", false)
            root.put("wordSync", false)
            root.put("kind", JSONObject.NULL)
            root.put("source", JSONObject.NULL)
            root.put("lines", JSONArray())
        } else {
            val hasWord = chosenLyrics.lines.any { it.words.isNotEmpty() }
            val kind = if (hasWord) "word" else if (chosenLyrics.synced) "line" else "plain"
            root.put("available", true)
            root.put("kind", kind)
            root.put("synced", chosenLyrics.synced)
            root.put("wordSync", hasWord)
            root.put("source", chosenSrcName)

            val linesArr = JSONArray()
            for (line in chosenLyrics.lines) {
                val lineObj = JSONObject()
                val startSec = (line.startTimeMs ?: 0L) / 1000.0
                lineObj.put("start", startSec)
                lineObj.put("time", startSec)
                lineObj.put("text", line.text)
                if (!line.translation.isNullOrBlank()) {
                    lineObj.put("translation", line.translation)
                }
                if (line.words.isNotEmpty()) {
                    val wArr = JSONArray()
                    val wordsArr = JSONArray()
                    val hasAnySpace = line.words.any { it.text.endsWith(" ") }
                    for (i in line.words.indices) {
                        val w = line.words[i]
                        val startW = w.startMs / 1000.0
                        val endW = w.endMs / 1000.0

                        val wordText = if (!hasAnySpace && i < line.words.size - 1 && !w.text.endsWith(" ")) {
                            w.text + " "
                        } else {
                            w.text
                        }

                        val item = JSONArray()
                        item.put(wordText)
                        item.put(startW)
                        item.put(endW)
                        wArr.put(item)

                        val wObj = JSONObject()
                        wObj.put("start", startW)
                        wObj.put("end", endW)
                        wObj.put("text", wordText)
                        wordsArr.put(wObj)
                    }
                    lineObj.put("w", wArr)
                    lineObj.put("words", wordsArr)
                    lineObj.put("end", line.words.last().endMs / 1000.0)
                }
                linesArr.put(lineObj)
            }
            root.put("lines", linesArr)
        }

        return root
    }

    private fun stripQuotesAndCollapse(raw: String): String =
        raw.trim()
            .trim(*QUOTE_CHARS)
            .replace(WHITESPACE_REGEX, " ")
            .trim()

    private fun normalizeForLyricsMatch(raw: String): String {
        val folded = Normalizer.normalize(raw, Normalizer.Form.NFD)
            .replace(COMBINING_MARKS_REGEX, "")
            .lowercase()
        return folded
            .replace(PUNCT_TO_SPACE_REGEX, " ")
            .replace(WHITESPACE_REGEX, " ")
            .trim()
    }

    private fun stripLrcTimestamps(line: String): String =
        line.replace(LRC_TIMESTAMPS_REGEX, "").trim()

    private fun extractCleanLines(rawText: String): List<String> {
        if (rawText.isBlank()) return emptyList()
        return rawText.lines().mapNotNull { rawLine ->
            val cleaned = stripLrcTimestamps(rawLine)
            if (cleaned.isBlank() || LRC_META_LINE_REGEX.matches(cleaned)) null else cleaned
        }
    }

    private fun JSONObject.optNonNullString(key: String): String =
        if (isNull(key)) "" else optString(key, "").trim()

    private fun formatLyricSnippet(line: String): String =
        "♪ «${line.trim().take(68)}»"

    private fun isMeaningfulLyricLine(line: String): Boolean {
        val clean = line.trim()
        if (clean.length < 4) return false
        if (clean.startsWith("(") && clean.endsWith(")")) return false
        if (clean.startsWith("[") && clean.endsWith("]")) return false
        val low = clean.lowercase()
        if (low == "instrumental" || low == "strumentale" || low == "intro" || low == "outro") return false
        return clean.any { it.isLetterOrDigit() }
    }

    /**
     * Scores a candidate lyric line against a normalized query:
     * 2 = exact substring match, 1 = all query words present, 0 = no match.
     */
    private fun lineMatchScore(rawLine: String, normQuery: String, queryWords: List<String>): Int {
        val cleanLine = normalizeForLyricsMatch(rawLine)
        if (cleanLine.isEmpty()) return 0
        if (normQuery in cleanLine) return 2
        if (queryWords.isNotEmpty()) {
            val lineWords = cleanLine.split(' ').filterTo(HashSet()) { it.isNotEmpty() }
            if (queryWords.all { it in lineWords }) return 1
        }
        return 0
    }

    private fun findBestMatchingLine(
        lines: List<String>,
        normQuery: String,
        queryWords: List<String>,
    ): Pair<String, Int>? {
        var bestLine: String? = null
        var bestScore = 0
        for (line in lines) {
            val s = lineMatchScore(line, normQuery, queryWords)
            if (s > bestScore) {
                bestScore = s
                bestLine = line
                if (bestScore == 2) break
            }
        }
        if (bestScore == 0 && lines.size >= 2) {
            for (i in 0 until lines.size - 1) {
                val combined = "${lines[i]} ${lines[i + 1]}"
                val s = lineMatchScore(combined, normQuery, queryWords)
                if (s > bestScore) {
                    bestScore = s
                    bestLine = combined
                    if (bestScore == 2) break
                }
            }
        }
        return bestLine?.let { it to bestScore }
    }

    private data class ScoredLyricHit(
        val hit: LyricSearchHit,
        val score: Int,
        val order: Int,
    )

    fun searchCachedLyrics(rawQuery: String, maxResults: Int = 4): List<LyricSearchHit> {
        if (maxResults <= 0) return emptyList()
        val cleanQuery = stripQuotesAndCollapse(rawQuery)
        val normQuery = normalizeForLyricsMatch(cleanQuery)
        if (normQuery.length < 4) return emptyList()

        val dir = diskCacheDir ?: return emptyList()
        if (!dir.exists()) return emptyList()

        val files = dir.listFiles { f -> f.isFile && f.name.endsWith(".json") } ?: return emptyList()
        if (files.isEmpty()) return emptyList()

        val queryWords = normQuery.split(' ').filter { it.isNotEmpty() }
        val now = System.currentTimeMillis()
        val recentFiles = files
            .sortedByDescending { it.lastModified() }
            .take(LYRIC_SEARCH_SCAN_LIMIT)

        val candidates = ArrayList<ScoredLyricHit>(maxResults * 2)
        val seenKeys = HashSet<String>()
        var exactCount = 0

        for ((idx, file) in recentFiles.withIndex()) {
            val lastMod = file.lastModified()
            if (now - lastMod > DISK_CACHE_TTL_MS) continue
            runCatching {
                val doc = synchronized(searchDocCache) { searchDocCache.get(file.name) }
                    ?.takeIf { it.lastModified == lastMod }
                    ?: run {
                        val obj = JSONObject(file.readText(Charsets.UTF_8))
                        if (obj.has("available") && !obj.optBoolean("available", false)) return@runCatching
                        val title = obj.optNonNullString("title")
                        if (title.isBlank()) return@runCatching
                        val artist = obj.optNonNullString("artist")
                        val candidateLines = ArrayList<String>()
                        val linesArr = obj.optJSONArray("lines")
                        if (linesArr != null) {
                            for (i in 0 until linesArr.length()) {
                                val lineObj = linesArr.optJSONObject(i)
                                val text = lineObj?.optNonNullString("text")
                                    ?: linesArr.optString(i, "").takeIf { !linesArr.isNull(i) }?.trim()
                                    ?: ""
                                val cleaned = stripLrcTimestamps(text)
                                if (cleaned.isNotBlank() && !LRC_META_LINE_REGEX.matches(cleaned)) {
                                    candidateLines.add(cleaned)
                                }
                            }
                        }
                        val plain = obj.optNonNullString("plain").ifBlank { obj.optNonNullString("plainLyrics") }
                        if (plain.isNotBlank()) {
                            candidateLines.addAll(extractCleanLines(plain))
                        }
                        val created = CachedSearchDoc(
                            lastModified = lastMod,
                            title = title,
                            artist = artist,
                            album = obj.optNonNullString("album"),
                            videoId = obj.optNonNullString("videoId"),
                            lines = candidateLines,
                        )
                        synchronized(searchDocCache) { searchDocCache.put(file.name, created) }
                        created
                    }

                if (doc.lines.isEmpty()) return@runCatching
                val dedupKey = "${doc.title.lowercase()}|${doc.artist.lowercase()}"
                if (dedupKey in seenKeys) return@runCatching

                val matched = findBestMatchingLine(doc.lines, normQuery, queryWords) ?: return@runCatching
                if (seenKeys.add(dedupKey)) {
                    candidates.add(
                        ScoredLyricHit(
                            hit = LyricSearchHit(
                                title = doc.title,
                                artist = doc.artist,
                                snippet = formatLyricSnippet(matched.first),
                                album = doc.album,
                                videoId = doc.videoId,
                            ),
                            score = matched.second,
                            order = idx,
                        )
                    )
                    if (matched.second == 2) exactCount++
                }
            }
            if (exactCount >= maxResults) break
        }

        return candidates
            .sortedWith(compareByDescending<ScoredLyricHit> { it.score }.thenBy { it.order })
            .take(maxResults)
            .map { it.hit }
    }

    private suspend fun fetchLrcLibJson(url: String): String? =
        suspendCancellableCoroutine { cont ->
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "Sonora/1.0")
                .build()
            val call = searchHttpClient.newCall(request)
            cont.invokeOnCancellation {
                runCatching { call.cancel() }
            }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    if (cont.isActive) cont.resume(null)
                }

                override fun onResponse(call: Call, response: Response) {
                    val bodyStr = runCatching {
                        response.use { res ->
                            if (!res.isSuccessful) null else res.body.string()
                        }
                    }.getOrNull()
                    if (cont.isActive) cont.resume(bodyStr)
                }
            })
        }

    private suspend fun fetchLrcLibSearchJson(query: String): String? {
        val encoded = URLEncoder.encode(query, "UTF-8")
        return fetchLrcLibJson("https://lrclib.net/api/search?q=$encoded")
    }

    private fun parseLrcLibHits(
        rawJson: String,
        normQuery: String,
        queryWords: List<String>,
        maxResults: Int,
    ): List<ScoredLyricHit> {
        val arr = runCatching { JSONArray(rawJson) }.getOrNull() ?: return emptyList()
        if (arr.length() == 0) return emptyList()

        val hits = ArrayList<ScoredLyricHit>()
        val seenKeys = HashSet<String>()
        val scanCount = arr.length().coerceAtMost(maxOf(20, maxResults * 5))

        for (i in 0 until scanCount) {
            val obj = arr.optJSONObject(i) ?: continue
            if (obj.optBoolean("instrumental", false)) continue
            val title = obj.optNonNullString("trackName")
            if (title.isBlank()) continue
            val artist = obj.optNonNullString("artistName")
            val dedupKey = "${title.lowercase()}|${artist.lowercase()}"
            if (dedupKey in seenKeys) continue

            val plain = obj.optNonNullString("plainLyrics")
            val synced = obj.optNonNullString("syncedLyrics")
            val plainLines = extractCleanLines(plain)
            val syncedLines = extractCleanLines(synced)
            val lines = plainLines.ifEmpty { syncedLines }
            if (lines.isEmpty()) continue

            var matched = findBestMatchingLine(lines, normQuery, queryWords)
            if (matched == null && plainLines.isNotEmpty() && syncedLines.isNotEmpty()) {
                matched = findBestMatchingLine(syncedLines, normQuery, queryWords)
            }
            val (bestLine, score) = matched ?: run {
                val fallback = lines.firstOrNull { isMeaningfulLyricLine(it) } ?: lines.first()
                fallback to 0
            }

            val album = obj.optNonNullString("albumName")
            if (seenKeys.add(dedupKey)) {
                hits.add(
                    ScoredLyricHit(
                        hit = LyricSearchHit(
                            title = title,
                            artist = artist,
                            snippet = formatLyricSnippet(bestLine),
                            album = album,
                        ),
                        score = score,
                        order = i,
                    )
                )
            }
        }

        return hits
    }

    suspend fun lookupTrackLyricSnippet(
        title: String,
        artist: String,
        rawQuery: String,
    ): Pair<String, String>? {
        val cleanTitle = title.trim()
        val cleanArtist = artist.trim()
        if (cleanTitle.isBlank()) return null

        val cleanQuery = stripQuotesAndCollapse(rawQuery)
        val normQuery = normalizeForLyricsMatch(cleanQuery)
        if (normQuery.length < 4) return null
        val queryWords = normQuery.split(' ').filter { it.isNotEmpty() }

        val url = "https://lrclib.net/api/search?track_name=${URLEncoder.encode(cleanTitle, "UTF-8")}" +
            "&artist_name=${URLEncoder.encode(cleanArtist, "UTF-8")}"
        val rawJson = withContext(Dispatchers.IO) {
            withTimeoutOrNull(1100L) {
                fetchLrcLibJson(url)
            }
        } ?: return null

        val arr = runCatching { JSONArray(rawJson) }.getOrNull() ?: return null
        if (arr.length() == 0) return null

        var bestResult: Pair<String, String>? = null
        var bestScore = 0
        val scanCount = arr.length().coerceAtMost(10)
        for (i in 0 until scanCount) {
            val obj = arr.optJSONObject(i) ?: continue
            if (obj.optBoolean("instrumental", false)) continue
            val plainLines = extractCleanLines(obj.optNonNullString("plainLyrics"))
            val syncedLines = extractCleanLines(obj.optNonNullString("syncedLyrics"))
            val plainMatch = if (plainLines.isNotEmpty()) findBestMatchingLine(plainLines, normQuery, queryWords) else null
            val syncedMatch = if (syncedLines.isNotEmpty()) findBestMatchingLine(syncedLines, normQuery, queryWords) else null
            val matched = when {
                plainMatch != null && syncedMatch != null ->
                    if (plainMatch.second >= syncedMatch.second) plainMatch else syncedMatch
                plainMatch != null -> plainMatch
                else -> syncedMatch
            } ?: continue

            val candidate = formatLyricSnippet(matched.first) to obj.optNonNullString("albumName")
            if (matched.second > bestScore ||
                (matched.second == bestScore && bestResult?.second.isNullOrBlank() && candidate.second.isNotBlank())
            ) {
                bestScore = matched.second
                bestResult = candidate
                if (bestScore == 2 && candidate.second.isNotBlank()) break
            }
        }
        return bestResult
    }

    suspend fun searchLyricsByPhrase(rawQuery: String, maxResults: Int = 4): List<LyricSearchHit> {
        if (maxResults <= 0) return emptyList()
        val cleanQuery = stripQuotesAndCollapse(rawQuery)
        val normQuery = normalizeForLyricsMatch(cleanQuery)
        if (normQuery.length < 4) return emptyList()
        val queryWords = normQuery.split(' ').filter { it.isNotEmpty() }

        return withContext(Dispatchers.IO) {
            coroutineScope {
                val cachedDef = async {
                    runCatching { searchCachedLyrics(cleanQuery, maxResults) }.getOrDefault(emptyList())
                }
                val lrcDef = async {
                    withTimeoutOrNull(LYRIC_SEARCH_TIMEOUT_MS) {
                        fetchLrcLibSearchJson(cleanQuery)
                    }?.let { raw ->
                        parseLrcLibHits(raw, normQuery, queryWords, maxResults)
                    }.orEmpty()
                }

                val cachedHits = cachedDef.await()
                val lrcHits = lrcDef.await()

                val combined = ArrayList<LyricSearchHit>(maxResults)
                val seenKeys = HashSet<String>()

                for (hit in cachedHits) {
                    val key = "${hit.title.trim().lowercase()}|${hit.artist.trim().lowercase()}"
                    if (seenKeys.add(key)) {
                        combined.add(hit)
                        if (combined.size >= maxResults) return@coroutineScope combined
                    }
                }

                val sortedLrc = lrcHits.sortedWith(
                    compareByDescending<ScoredLyricHit> { it.score }.thenBy { it.order }
                )
                for (entry in sortedLrc) {
                    val key = "${entry.hit.title.trim().lowercase()}|${entry.hit.artist.trim().lowercase()}"
                    if (seenKeys.add(key)) {
                        combined.add(entry.hit)
                        if (combined.size >= maxResults) break
                    }
                }
                combined
            }
        }
    }
}
