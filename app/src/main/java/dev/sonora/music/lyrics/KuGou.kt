package dev.sonora.music.lyrics

import dev.sonora.music.LyricLine
import dev.sonora.music.LyricWord
import dev.sonora.music.Lyrics
import dev.sonora.music.SonoraHttpPool
import java.net.URLEncoder
import kotlin.math.abs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

/** Word-timed KRC lyrics client backed by KuGou. */
object KuGou {

    private val http: OkHttpClient by lazy {
        SonoraHttpPool.baseClient.newBuilder()
            .connectTimeout(8, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
            .callTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
            .build()
    }

    suspend fun lyrics(title: String, artist: String, durationMs: Long): Lyrics? =
        withContext(Dispatchers.IO) {
            val titles = title.titleVariants()
            if (titles.isEmpty()) return@withContext null
            val primary = artist.primaryArtist()
            for (candidateTitle in titles) {
                val candidate = search(candidateTitle, primary, artist, durationMs) ?: continue
                val krc = download(candidate.first, candidate.second) ?: continue
                val parsed = parse(krc, candidateTitle) ?: continue
                android.util.Log.i(TAG, "$candidateTitle: ${parsed.lines.size} lines, ${parsed.lines.count { l -> l.words.isNotEmpty() }} timed by word")
                return@withContext parsed
            }
            null
        }

    private fun search(
        queryTitle: String,
        searchArtist: String,
        fullArtist: String,
        durationMs: Long,
    ): Pair<String, String>? {
        val url = buildString {
            append(SEARCH_URL).append("?ver=1&man=yes&client=pc&hash=")
            append("&keyword=").append(encode("$searchArtist - $queryTitle"))
            if (durationMs > 0) append("&duration=").append(durationMs)
        }
        val body = get(url) ?: return null
        val candidates = runCatching { JSONObject(body).optJSONArray("candidates") }.getOrNull() ?: return null
        val best = (0 until candidates.length())
            .mapNotNull { candidates.optJSONObject(it) }
            .filter { candidate ->
                if (candidate.optString("id").isEmpty() || candidate.optString("accesskey").isEmpty()) {
                    return@filter false
                }
                val songName = candidate.optString("song")
                val singer = candidate.optString("singer")
                if (songName.isNotBlank()) {
                    if (isIncompatibleVariant(songName, queryTitle)) return@filter false
                    if (!matchesTrackTitle(songName, queryTitle)) return@filter false
                }
                if (!matchesArtistName(singer, fullArtist)) return@filter false
                val candDur = candidate.optLong("duration", 0L)
                durationMs <= 0 || durationMs == FALLBACK_DURATION_MS || candDur <= 0 || abs(candDur - durationMs) <= MAX_DRIFT_MS
            }
            .minByOrNull { candidate ->
                val songName = candidate.optString("song")
                val exactPenalty = if (songName.isBlank() || isExactTitleMatch(songName, queryTitle)) 0L else 100_000L
                val drift = if (durationMs > 0) abs(candidate.optLong("duration", 0L) - durationMs) else 0L
                exactPenalty + drift
            }
            ?: return null
        return best.optString("id") to best.optString("accesskey")
    }

    private fun download(id: String, key: String): String? {
        val url = "$DOWNLOAD_URL?ver=1&client=pc&fmt=krc&charset=utf8&id=${encode(id)}&accesskey=${encode(key)}"
        val body = get(url) ?: return null
        val content = runCatching { JSONObject(body).optString("content") }.getOrNull()
            ?.takeIf { it.isNotEmpty() } ?: return null
        return runCatching { decrypt(android.util.Base64.decode(content, android.util.Base64.DEFAULT)) }.getOrNull()
    }

    // KRC format: "krc1" magic header + 16-byte XOR key + zlib-compressed payload.
    internal fun decrypt(raw: ByteArray): String? {
        if (raw.size <= 4 || String(raw, 0, 4, Charsets.US_ASCII) != "krc1") return null
        val body = ByteArray(raw.size - 4) { i -> (raw[i + 4].toInt() xor KEY[i % KEY.size]).toByte() }
        val inflater = java.util.zip.Inflater()
        inflater.setInput(body)
        val out = java.io.ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        while (!inflater.finished()) {
            val n = inflater.inflate(buffer)
            if (n == 0 && (inflater.needsInput() || inflater.needsDictionary())) break
            out.write(buffer, 0, n)
        }
        inflater.end()
        return out.toString("UTF-8")
    }

    /** Parses decrypted KRC text into timed lines and words, stripping leading credit lines. */
    internal fun parse(krc: String, title: String): Lyrics? {
        val lines = krc.lineSequence().mapNotNull { line ->
            val head = LINE.find(line) ?: return@mapNotNull null
            val start = head.groupValues[1].toLong()
            val pieces = WORD.findAll(line.substring(head.range.last + 1)).toList()
            val text = pieces.joinToString("") { it.groupValues[3] }.trim()
            val validPieces = pieces.filter { it.groupValues[3].trim().isNotEmpty() }
            val words = validPieces.mapIndexed { index, word ->
                val offset = word.groupValues[1].toLong()
                val length = word.groupValues[2].toLong()
                val raw = word.groupValues[3].trim()
                val withSpace = if (index < validPieces.size - 1) "$raw " else raw
                LyricWord(start + offset, start + offset + length, withSpace)
            }
            if (text.isEmpty()) null else LyricLine(startTimeMs = start, text = text, words = words)
        }.toList()
        val firstSung = lines.indexOfFirst { line ->
            val text = line.text
            !(text.contains('：') || text.contains(':') ||
                text.startsWith(title, ignoreCase = true) && text.contains(" - "))
        }
        val sung = if (firstSung < 0) emptyList() else lines.drop(firstSung)
        return sung.takeIf { it.isNotEmpty() }?.let { Lyrics(lines = it, synced = true) }
    }

    private fun get(url: String): String? = runCatching {
        val request = Request.Builder().url(url).header("User-Agent", USER_AGENT).build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) null else response.body?.string()?.takeIf(String::isNotBlank)
        }
    }.getOrNull()

    private fun encode(value: String): String = URLEncoder.encode(value, "UTF-8")

    private val LINE = Regex("""^\[(\d+),(\d+)]""")
    private val WORD = Regex("""<(\d+),(\d+),\d+>([^<]*)""")

    private val KEY = intArrayOf(64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105)

    private const val MAX_DRIFT_MS = 4_000L
    private const val FALLBACK_DURATION_MS = 210_000L

    private const val TAG = "KuGou"
    private const val SEARCH_URL = "https://lyrics.kugou.com/search"
    private const val DOWNLOAD_URL = "https://lyrics.kugou.com/download"
    private const val USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}
