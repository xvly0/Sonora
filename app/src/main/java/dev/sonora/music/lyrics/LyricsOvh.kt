package dev.sonora.music.lyrics

import dev.sonora.music.LyricLine
import dev.sonora.music.Lyrics
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/** Unsynced fallback lyrics client using the Lyrics.ovh REST API. */
object LyricsOvh {

    private val http = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(4, TimeUnit.SECONDS)
        .callTimeout(6, TimeUnit.SECONDS)
        .build()

    private const val BASE_URL = "https://api.lyrics.ovh/v1"
    private const val USER_AGENT = "SquareMusicApp/1.0"

    suspend fun lyrics(title: String, artist: String, durationMs: Long): Lyrics? =
        withContext(Dispatchers.IO) {
            val cleanedTitle = title.songTitle()
            if (cleanedTitle.isBlank()) return@withContext null

            // Try combined artist first, then primary artist (avoid querying featured artists alone,
            // which could match an unrelated song of the same name by the featured artist).
            val candidates = listOf(artist.trim(), artist.primaryArtist())
                .filter { it.isNotBlank() }
                .distinct()

            for (candidate in candidates) {
                val rawLyrics = fetch(cleanedTitle, candidate)
                if (!rawLyrics.isNullOrBlank()) {
                    val lines = rawLyrics.lines()
                        .filter { it.isNotBlank() }
                        .map { LyricLine(startTimeMs = null, text = it.trim()) }
                    if (lines.isNotEmpty()) {
                        return@withContext Lyrics(lines, synced = false)
                    }
                }
            }

            null
        }

    private fun fetch(title: String, artist: String): String? = runCatching {
        val encodedArtist = URLEncoder.encode(artist, "UTF-8").replace("+", "%20")
        val encodedTitle = URLEncoder.encode(title, "UTF-8").replace("+", "%20")
        val url = "$BASE_URL/$encodedArtist/$encodedTitle"

        val request = Request.Builder()
            .url(url)
            .header("User-Agent", USER_AGENT)
            .build()

        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return null
            val body = response.body.string()
            val json = JSONObject(body)
            json.optString("lyrics").takeIf { it.isNotBlank() }
        }
    }.getOrNull()
}
