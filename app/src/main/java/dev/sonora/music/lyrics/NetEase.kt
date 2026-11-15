package dev.sonora.music.lyrics

import dev.sonora.music.LyricLine
import dev.sonora.music.Lyrics
import java.net.URLEncoder
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

/** Synced LRC lyrics client backed by NetEase Cloud Music. */
object NetEase {

    private val http = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .callTimeout(10, TimeUnit.SECONDS)
        .build()

    private const val SEARCH_URL = "https://music.163.com/api/search/pc"
    private const val LYRIC_URL = "https://music.163.com/api/song/lyric"
    private const val USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    private const val COOKIE = "os=pc; NMTID=00OAVK3xqDG726ITU6jopU6jF2yMk0AAAGCO8l1BA;"
    private const val FALLBACK_DURATION_MS = 210_000L

    suspend fun lyrics(
        title: String,
        artist: String,
        durationMs: Long,
    ): Lyrics? = withContext(Dispatchers.IO) {
        val titles = title.titleVariants()
        if (titles.isEmpty()) return@withContext null
        val primary = artist.primaryArtist()
        val searchArtists = listOf(artist.trim(), primary, primary.foldDiacritics())
            .filter { it.isNotBlank() }
            .distinct()

        for (candidateTitle in titles) {
            for (candidateArtist in searchArtists) {
                query(candidateTitle, candidateArtist, artist, durationMs)?.let { return@withContext it }
            }
            if (artist.allArtists().size > 1) {
                query(candidateTitle, "", artist, durationMs)?.let { return@withContext it }
            }
        }

        null
    }

    private fun query(
        title: String,
        searchArtist: String,
        fullArtist: String,
        durationMs: Long,
    ): Lyrics? {
        val q = if (searchArtist.isBlank()) title else "$title $searchArtist"
        val searchEncoded = runCatching { URLEncoder.encode(q, "UTF-8") }.getOrNull() ?: return null
        val searchReq = Request.Builder()
            .url("$SEARCH_URL?s=$searchEncoded&type=1&offset=0&limit=10")
            .header("User-Agent", USER_AGENT)
            .header("Referer", "https://music.163.com")
            .header("Cookie", COOKIE)
            .build()

        val searchBody = runCatching {
            http.newCall(searchReq).execute().use { resp ->
                if (resp.isSuccessful) resp.body.string() else null
            }
        }.getOrNull() ?: return null

        val root = runCatching { JSONObject(searchBody) }.getOrNull() ?: return null
        val songs = root.optJSONObject("result")?.optJSONArray("songs") ?: return null
        if (songs.length() == 0) return null

        var bestSongId: Long? = null
        var bestScore = Long.MAX_VALUE

        for (i in 0 until songs.length().coerceAtMost(10)) {
            val song = songs.optJSONObject(i) ?: continue
            val id = song.optLong("id")
            if (id <= 0) continue

            val songName = song.optString("name")
            val albumName = song.optJSONObject("album")?.optString("name").orEmpty()
            if (songName.isNotBlank()) {
                if (isIncompatibleVariant(songName, title, albumName)) continue
                if (!matchesTrackTitle(songName, title)) continue
            }

            val songArtists = (0 until (song.optJSONArray("artists")?.length() ?: 0)).mapNotNull {
                song.optJSONArray("artists")?.optJSONObject(it)?.optString("name")?.takeIf { n -> n.isNotBlank() }
            }.joinToString(", ")
            if (!matchesArtistName(songArtists, fullArtist)) continue

            val songDur = song.optLong("duration", 0L)
            val diff = if (durationMs > 0 && songDur > 0) kotlin.math.abs(songDur - durationMs) else 0L
            if (durationMs > 0 && durationMs != FALLBACK_DURATION_MS && songDur > 0 && diff > 8000L) continue

            val exactPenalty = if (songName.isBlank() || isExactTitleMatch(songName, title)) 0L else 100_000L
            val score = exactPenalty + diff
            if (score < bestScore) {
                bestScore = score
                bestSongId = id
            }
        }

        val targetId = bestSongId ?: return null
        val lyricReq = Request.Builder()
            .url("$LYRIC_URL?id=$targetId&lv=1&kv=1&tv=-1")
            .header("User-Agent", USER_AGENT)
            .header("Referer", "https://music.163.com")
            .build()

        val lyricBody = runCatching {
            http.newCall(lyricReq).execute().use { resp ->
                if (resp.isSuccessful) resp.body.string() else null
            }
        }.getOrNull() ?: return null

        val lyricRoot = runCatching { JSONObject(lyricBody) }.getOrNull() ?: return null
        val rawLrc = lyricRoot.optJSONObject("lrc")?.optString("lyric")?.takeIf { it.isNotBlank() }
            ?: return null
        val rawTranslation = lyricRoot.optJSONObject("tlyric")?.optString("lyric")?.takeIf { it.isNotBlank() }

        return parseLrc(rawLrc, rawTranslation)
    }

    private fun parseTimedLines(raw: String): MutableList<Pair<Long, String>> {
        val result = mutableListOf<Pair<Long, String>>()
        for (line in raw.lines()) {
            val match = LRC_LINE.find(line) ?: continue
            val (minutes, seconds, fraction, text) = match.destructured
            val startMs = minutes.toLong() * 60_000 +
                seconds.toLong() * 1_000 +
                fraction.padEnd(3, '0').take(3).toLong()

            val cleanText = text.trim()
            if (cleanText.isBlank()) continue
            // Filter out metadata lines like [00:00.00] 作曲 : ...
            if (cleanText.startsWith("作词") || cleanText.startsWith("作曲") || cleanText.startsWith("编曲")) {
                continue
            }
            result += startMs to cleanText
        }
        return result
    }

    private fun parseLrc(raw: String, rawTranslation: String? = null): Lyrics? {
        val baseLines = parseTimedLines(raw)
        if (baseLines.isEmpty()) return null

        val lines = baseLines.map { (startMs, text) ->
            LyricLine(startTimeMs = startMs, text = text)
        }.toMutableList()

        if (!rawTranslation.isNullOrBlank()) {
            val transLines = parseTimedLines(rawTranslation)
                .filter { (_, text) -> text != "//" }
            val bestDiffPerLine = LongArray(lines.size) { Long.MAX_VALUE }
            for ((transMs, transText) in transLines) {
                var bestIdx = -1
                var bestDiff = Long.MAX_VALUE
                for (i in lines.indices) {
                    val lineMs = lines[i].startTimeMs ?: continue
                    val diff = kotlin.math.abs(lineMs - transMs)
                    if (diff <= 600L && diff < bestDiff) {
                        bestDiff = diff
                        bestIdx = i
                    }
                }
                if (bestIdx >= 0 && bestDiff < bestDiffPerLine[bestIdx]) {
                    bestDiffPerLine[bestIdx] = bestDiff
                    lines[bestIdx] = lines[bestIdx].copy(translation = transText)
                }
            }
        }

        return Lyrics(lines, synced = true)
    }

    private val LRC_LINE = Regex("\\[(\\d{1,2}):(\\d{2})[.:](\\d{2,3})\\](.*)")
}
