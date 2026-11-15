package dev.sonora.music.lyrics

import dev.sonora.music.Lyrics
import java.net.URLEncoder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

/** Word-timed TTML lyrics client backed by Better Lyrics. */
object BetterLyrics {

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
            val artists = listOf(primary, artist.trim(), primary.foldDiacritics())
                .filter { it.isNotBlank() }
                .distinct()
            if (artists.isEmpty()) return@withContext null

            for (candidateTitle in titles) {
                for (candidateArtist in artists) {
                    val url = buildString {
                        append(API_URL).append("?s=").append(encode(candidateTitle))
                        append("&a=").append(encode(candidateArtist))
                        if (durationMs > 0) append("&d=").append(durationMs / 1000)
                    }
                    val body = get(url) ?: continue
                    val ttml = runCatching { JSONObject(body).optString("ttml") }.getOrNull()
                        ?.takeIf { it.startsWith("<") } ?: continue
                    val parsed = Ttml.parse(ttml)?.takeIf { it.lines.isNotEmpty() } ?: continue
                    android.util.Log.i(
                        TAG,
                        "$candidateTitle: ${parsed.lines.size} lines, " +
                            "${parsed.lines.count { it.words.isNotEmpty() }} timed by word",
                    )
                    return@withContext parsed
                }
            }
            null
        }

    private fun get(url: String): String? = runCatching {
        val request = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .header("User-Agent", USER_AGENT)
            .build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) null else response.body?.string()?.takeIf(String::isNotBlank)
        }
    }.getOrNull()

    private fun encode(value: String): String = URLEncoder.encode(value, "UTF-8")

    private const val TAG = "BetterLyrics"

    private const val API_URL = "https://lyrics-api.boidu.dev/getLyrics"

    private const val USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
}
