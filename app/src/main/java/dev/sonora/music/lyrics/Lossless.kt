package dev.sonora.music.lyrics

import dev.sonora.music.Lyrics
import java.net.URLEncoder
import kotlin.math.abs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

/** Word-timed TTML lyrics client backed by the lossless.wtf archive. */
object Lossless {

    private val http = OkHttpClient.Builder()
        .connectTimeout(8, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
        .callTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    suspend fun lyrics(title: String, artist: String, durationMs: Long): Lyrics? =
        withContext(Dispatchers.IO) {
            val titles = title.titleVariants()
            if (titles.isEmpty()) return@withContext null
            val primary = artist.primaryArtist()
            val artists = listOf(artist.trim(), primary, primary.foldDiacritics())
                .filter { it.isNotBlank() }
                .distinct()
            if (artists.isEmpty()) return@withContext null

            for (candidateTitle in titles) {
                for (candidateArtist in artists) {
                    val results = search(candidateTitle, candidateArtist, durationMs) ?: continue
                    val url = pick(results, candidateTitle, artist, durationMs) ?: continue
                    val parsed = Ttml.parse(get(url) ?: continue) ?: continue
                    android.util.Log.i(
                        TAG,
                        "$url: ${parsed.lines.size} lines, " +
                            "${parsed.lines.count { it.words.isNotEmpty() }} timed by word, " +
                            "${parsed.lines.count { !it.translation.isNullOrBlank() }} translated",
                    )
                    return@withContext parsed
                }
            }
            android.util.Log.i(TAG, "no match for ${titles.first()} / $artist (${durationMs / 1000}s)")
            null
        }

    private fun search(title: String, artist: String, durationMs: Long): List<JSONObject>? {
        val url = buildString {
            append(SEARCH_URL).append("?track=").append(encode(title))
            append("&artist=").append(encode(artist))
            if (durationMs > 0) append("&duration=").append(durationMs / 1000)
        }
        val body = get(url) ?: return null
        val results = runCatching { JSONObject(body).optJSONArray("results") }.getOrNull()
            ?: return null
        return (0 until results.length())
            .mapNotNull { results.optJSONObject(it) }
            .takeIf { it.isNotEmpty() }
    }

    // Prefer word-timed releases matching the playing duration within MAX_DRIFT_MS.
    private fun pick(
        results: List<JSONObject>,
        queryTitle: String,
        queryArtist: String,
        durationMs: Long,
    ): String? = results
        .filter { result ->
            if (!result.optString("lyricsUrl").startsWith("http")) return@filter false
            val trackName = result.optString("track_name")
            val artistName = result.optString("artist_name")
            val albumName = result.optString("album_name")

            if (trackName.isNotBlank()) {
                if (isIncompatibleVariant(trackName, queryTitle, albumName)) return@filter false
                if (!matchesTrackTitle(trackName, queryTitle)) return@filter false
            }
            if (!matchesArtistName(artistName, queryArtist)) return@filter false

            val resultDurSec = result.optLong("duration", 0L)
            if (durationMs > 0 && durationMs != FALLBACK_DURATION_MS && resultDurSec > 0) {
                val drift = abs(resultDurSec * 1000L - durationMs)
                if (drift > MAX_DRIFT_MS) return@filter false
            }
            true
        }
        .minByOrNull { result ->
            val trackName = result.optString("track_name")
            val exactPenalty = if (trackName.isBlank() || isExactTitleMatch(trackName, queryTitle)) 0L else 10_000_000L
            val byWord = if (result.optString("timing_type") == "word") 0L else 1_000_000L
            val resultDurSec = result.optLong("duration", 0L)
            val drift = if (durationMs > 0 && resultDurSec > 0) {
                abs(resultDurSec * 1000L - durationMs)
            } else {
                0L
            }
            exactPenalty + byWord + drift
        }
        ?.optString("lyricsUrl")

    private fun get(url: String): String? = runCatching {
        val request = Request.Builder()
            .url(url)
            .header("Accept", "application/ttml+xml, application/xml, application/json")
            .header("User-Agent", USER_AGENT)
            .header("Referer", "$PLAYER_URL/")
            .header("Origin", PLAYER_URL)
            .build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) null else response.body?.string()?.takeIf(String::isNotBlank)
        }
    }.getOrNull()

    private fun encode(value: String): String = URLEncoder.encode(value, "UTF-8")

    private const val MAX_DRIFT_MS = 10_000L

    private const val FALLBACK_DURATION_MS = 210_000L

    private const val TAG = "Lossless"

    private const val SEARCH_URL = "https://lyrics-api.binimum.org/"

    private const val PLAYER_URL = "https://lossless.wtf"

    private const val USER_AGENT =
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/139.0.0.0 Mobile Safari/537.36"
}
