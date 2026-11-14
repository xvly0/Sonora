package dev.sonora.music.lyrics

import dev.sonora.music.LyricLine
import dev.sonora.music.Lyrics
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

/** Synced and plain LRC lyrics client backed by LrcLib. */
object LrcLib {

    private val http = OkHttpClient.Builder()
        .connectTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
        .callTimeout(8, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    suspend fun lyrics(title: String, artist: String, durationMs: Long): Lyrics? =
        withContext(Dispatchers.IO) {
            val titles = title.titleVariants()
            if (titles.isEmpty()) return@withContext null
            val primary = artist.primaryArtist()
            val artists = listOf(artist.trim(), primary).filter { it.isNotBlank() }.distinct()
            if (artists.isEmpty()) return@withContext null

            // 1. Exact lookup with duration across title/artist variants
            for (candidateTitle in titles) {
                for (candidateArtist in artists) {
                    val body = get(url(candidateTitle, candidateArtist, durationMs)) ?: continue
                    parseJson(body, candidateTitle, artist, durationMs, maxDriftSec = 10.0)?.let {
                        return@withContext it
                    }
                }
            }

            // 2. Fallback search via /api/search with strict title/artist/duration verification
            for (candidateTitle in titles) {
                search(candidateTitle, primary, artist, durationMs)?.let { return@withContext it }
            }

            // 3. Exact lookup without duration (only accept if duration is close or unknown/fallback)
            val allowAnyDur = durationMs <= 0L || durationMs == FALLBACK_DURATION_MS
            for (candidateTitle in titles) {
                val body = get(url(candidateTitle, primary, durationMs = null)) ?: continue
                parseJson(
                    body,
                    candidateTitle,
                    artist,
                    durationMs,
                    maxDriftSec = if (allowAnyDur) Double.MAX_VALUE else 10.0,
                )?.let { return@withContext it }
            }

            null
        }

    private fun parseJson(
        body: String,
        queryTitle: String,
        queryArtist: String,
        durationMs: Long,
        maxDriftSec: Double,
    ): Lyrics? {
        val json = runCatching { JSONObject(body) }.getOrNull() ?: return null
        val itemTitle = json.optString("trackName")
        val itemArtist = json.optString("artistName")
        if (itemTitle.isNotBlank()) {
            if (isIncompatibleVariant(itemTitle, queryTitle, json.optString("albumName"))) return null
            if (!matchesTrackTitle(itemTitle, queryTitle)) return null
        }
        if (!matchesArtistName(itemArtist, queryArtist)) return null

        val itemDuration = json.optDouble("duration", 0.0)
        if (itemDuration in 0.1..15.0) return null
        if (durationMs > 0 && itemDuration > 0 && maxDriftSec < Double.MAX_VALUE) {
            val diff = kotlin.math.abs(itemDuration - durationMs / 1000.0)
            if (diff > maxDriftSec) return null
        }

        json.optString("syncedLyrics").takeIf { it.isNotBlank() }?.let { synced ->
            return parseLrc(synced)
        }
        json.optString("plainLyrics").takeIf { it.isNotBlank() }?.let { plain ->
            return parsePlain(plain)
        }
        return null
    }

    private fun parsePlain(plain: String): Lyrics = Lyrics(
        lines = plain.lines()
            .filter { it.isNotBlank() }
            .map { LyricLine(startTimeMs = null, text = it.trim()) },
        synced = false,
    )

    private fun search(
        queryTitle: String,
        searchArtist: String,
        fullArtist: String,
        durationMs: Long,
    ): Lyrics? {
        val query = "$queryTitle $searchArtist".trim()
        val searchUrl = "https://lrclib.net/api/search?q=" + java.net.URLEncoder.encode(query, "UTF-8")
        val raw = get(searchUrl) ?: return null
        val array = runCatching { org.json.JSONArray(raw) }.getOrNull() ?: return null
        if (array.length() == 0) return null

        val targetSec = durationMs / 1000.0
        val allowFallbackDur = durationMs <= 0L || durationMs == FALLBACK_DURATION_MS

        var bestSynced: Lyrics? = null
        var bestSyncedScore = Double.MAX_VALUE
        var bestPlain: Lyrics? = null
        var bestPlainScore = Double.MAX_VALUE

        for (i in 0 until array.length().coerceAtMost(15)) {
            val item = array.optJSONObject(i) ?: continue
            val itemTitle = item.optString("trackName")
            val itemArtist = item.optString("artistName")
            val itemAlbum = item.optString("albumName")

            if (itemTitle.isNotBlank()) {
                if (isIncompatibleVariant(itemTitle, queryTitle, itemAlbum)) continue
                if (!matchesTrackTitle(itemTitle, queryTitle)) continue
            }
            if (!matchesArtistName(itemArtist, fullArtist)) continue

            val synced = item.optString("syncedLyrics").takeIf { it.isNotBlank() }
            val plain = item.optString("plainLyrics").takeIf { it.isNotBlank() }
            if (synced == null && plain == null) continue

            val itemDuration = item.optDouble("duration", 0.0)
            if (itemDuration in 0.1..15.0) continue

            val diff = if (targetSec > 0 && itemDuration > 0) kotlin.math.abs(itemDuration - targetSec) else 0.0
            if (targetSec > 0 && itemDuration > 0 && diff > 10.0 && !allowFallbackDur) continue

            val exactPenalty = if (itemTitle.isBlank() || isExactTitleMatch(itemTitle, queryTitle)) 0.0 else 1000.0
            val score = exactPenalty + diff

            if (synced != null && score < bestSyncedScore) {
                parseLrc(synced)?.let {
                    bestSyncedScore = score
                    bestSynced = it
                }
            } else if (plain != null && score < bestPlainScore) {
                bestPlainScore = score
                bestPlain = parsePlain(plain)
            }
        }

        return bestSynced ?: bestPlain
    }

    private const val FALLBACK_DURATION_MS = 210_000L

    private fun url(title: String, artist: String, durationMs: Long?): String = buildString {
        append("https://lrclib.net/api/get?track_name=")
        append(java.net.URLEncoder.encode(title, "UTF-8"))
        append("&artist_name=")
        append(java.net.URLEncoder.encode(artist, "UTF-8"))
        if (durationMs != null && durationMs > 0) {
            append("&duration=").append(durationMs / 1000)
        }
    }

    private fun get(url: String): String? = runCatching {
        val request = Request.Builder()
            .url(url)
            .header("User-Agent", USER_AGENT)
            .build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) null else response.body.string()
        }
    }.getOrNull()

    // Keep empty timed lines so the UI clears the previous line during instrumental breaks.
    private fun parseLrc(raw: String): Lyrics? {
        val lines = raw.lines().mapNotNull { line ->
            val match = LRC_LINE.find(line) ?: return@mapNotNull null
            val (minutes, seconds, fraction, text) = match.destructured
            val startMs = minutes.toLong() * 60_000 +
                seconds.toLong() * 1_000 +
                // Two digits are hundredths, three are milliseconds.
                fraction.padEnd(3, '0').take(3).toLong()
            LyricLine(startTimeMs = startMs, text = text.trim())
        }
        return lines.takeIf { it.isNotEmpty() }?.let { Lyrics(it, synced = true) }
    }

    private val LRC_LINE = Regex("\\[(\\d{1,2}):(\\d{2})[.:](\\d{2,3})\\](.*)")

    private const val USER_AGENT = "Square (https://github.com/lelonio/square)"
}
