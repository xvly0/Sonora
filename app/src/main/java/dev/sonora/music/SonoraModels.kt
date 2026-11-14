package dev.sonora.music

import kotlinx.serialization.Serializable

@Serializable
data class LyricWord(
    val startMs: Long,
    val endMs: Long,
    val text: String
)

@Serializable
data class LyricLine(
    val startTimeMs: Long?,
    val text: String,
    val words: List<LyricWord> = emptyList(),
    val translation: String? = null
)

@Serializable
data class LyricsCredit(
    val provider: String,
    val uploader: String? = null,
    val uploaderUrl: String? = null,
    val maker: String? = null,
    val makerUrl: String? = null
)

@Serializable
data class Lyrics(
    val lines: List<LyricLine>,
    val synced: Boolean,
    val source: String? = null,
    val credit: LyricsCredit? = null
)

object SonoraColors {
    fun h32(s: String): Long {
        var h = 2166136261L
        for (ch in s) {
            h = ((h xor ch.code.toLong()) * 16777619L) and 0xFFFFFFFFL
        }
        return h
    }

    fun look(id: String): Pair<Int, Int> {
        val h = h32(if (id.isEmpty()) "x" else id)
        val hue = (h % 360).toInt()
        val style = ((h shr 9) % 6).toInt()
        return hue to style
    }
}
