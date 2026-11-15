package dev.sonora.music.lyrics

import android.util.Xml
import dev.sonora.music.LyricLine
import dev.sonora.music.LyricWord
import dev.sonora.music.Lyrics
import dev.sonora.music.SonoraLocaleManager
import java.io.StringReader
import java.util.Locale
import org.xmlpull.v1.XmlPullParser

/** Parser for TTML word- and line-timed lyrics documents. */
object Ttml {

    fun parse(raw: String): Lyrics? {
        val document = runCatching { read(raw) }.getOrNull() ?: return null
        val lines = document.lines
        if (lines.isEmpty()) return null

        return Lyrics(withGaps(lines, chosen(document.translations)), synced = true)
    }

    private class Line(
        val startMs: Long?,
        val endMs: Long?,
        val text: String,
        val words: List<LyricWord> = emptyList(),
        val key: String? = null,
    )

    private fun read(raw: String): Document {
        val parser = Xml.newPullParser()
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true)
        parser.setInput(StringReader(raw))

        val lines = mutableListOf<Line>()
        val translations = mutableMapOf<String, MutableMap<String, String>>()
        var inBody = false

        while (parser.next() != XmlPullParser.END_DOCUMENT) {
            when (parser.eventType) {
                XmlPullParser.START_TAG -> when (parser.name) {
                    "body" -> inBody = true
                    "p" -> if (inBody) {
                        val line = readLine(parser)
                        if (line.startMs != null) {
                            lines += line
                        }
                    }
                    // `<translation>` lives in `<head>` outside `<body>`.
                    "translation" -> readTranslation(parser, translations)
                }

                XmlPullParser.END_TAG -> if (parser.name == "body") inBody = false
            }
        }
        return Document(lines, translations)
    }

    private class Document(
        val lines: List<Line>,
        val translations: Map<String, Map<String, String>>,
    )

    private fun readTranslation(
        parser: XmlPullParser,
        into: MutableMap<String, MutableMap<String, String>>,
    ) {
        val language = parser.getAttributeValue(XML_NS, "lang")
            ?: parser.getAttributeValue(null, "lang")
            ?: return
        val texts = into.getOrPut(language) { mutableMapOf() }

        var depth = 1
        while (depth > 0) {
            when (parser.next()) {
                XmlPullParser.START_TAG -> {
                    depth++
                    if (parser.name == "text") {
                        val key = parser.getAttributeValue(null, "for")
                        val text = runCatching { parser.nextText() }.getOrNull()
                        // nextText leaves the parser past the closing tag it
                        // read, so that tag is no longer coming.
                        if (text != null) depth--
                        if (key != null && !text.isNullOrBlank()) texts[key] = text.trim()
                    }
                }

                XmlPullParser.END_TAG -> depth--

                XmlPullParser.END_DOCUMENT -> depth = 0
            }
        }
    }

    private fun chosen(translations: Map<String, Map<String, String>>): Map<String, String> {
        if (translations.isEmpty()) return emptyMap()
        val wanted = SonoraLocaleManager.resolvedLang.ifBlank { Locale.getDefault().language }
        return translations.entries
            .firstOrNull { it.key.substringBefore('-').equals(wanted, ignoreCase = true) }
            ?.value
            .orEmpty()
    }

    private fun readLine(parser: XmlPullParser): Line {
        val startMs = time(parser.getAttributeValue(null, "begin"))
        val endMs = time(parser.getAttributeValue(null, "end"))
        val key = attrByName(parser, "key")

        val text = StringBuilder()
        val words = mutableListOf<LyricWord>()
        var firstSpanMs: Long? = null
        var wordStart: Long? = null
        var wordEnd: Long? = null
        var depth = 1

        while (depth > 0) {
            when (parser.next()) {
                XmlPullParser.START_TAG -> {
                    depth++
                    val begin = time(parser.getAttributeValue(null, "begin"))
                    if (firstSpanMs == null) firstSpanMs = begin
                    if (parser.name == "span") {
                        wordStart = begin
                        wordEnd = time(parser.getAttributeValue(null, "end"))
                    }
                    if (parser.name == "br") {
                        text.append(' ')
                        if (words.isNotEmpty()) {
                            val last = words.last()
                            words[words.size - 1] = last.copy(text = last.text.trimEnd() + " ")
                        }
                    }
                }

                XmlPullParser.END_TAG -> {
                    depth--
                    if (parser.name == "span") {
                        wordStart = null
                        wordEnd = null
                    }
                }

                XmlPullParser.TEXT -> {
                    val piece = parser.text.orEmpty()
                    text.append(piece)
                    val start = wordStart
                    // Spans define words/syllables. Spaces inside or between spans delineate words.
                    if (start != null && piece.isNotBlank()) {
                        if (piece.first().isWhitespace() && words.isNotEmpty()) {
                            val last = words.last()
                            words[words.size - 1] = last.copy(text = last.text.trimEnd() + " ")
                        }
                        val clean = piece.trim()
                        if (clean.isNotEmpty()) {
                            val trailingSpace = if (piece.last().isWhitespace()) " " else ""
                            words += LyricWord(start, wordEnd ?: (start + WORD_MS), clean + trailingSpace)
                        }
                    } else if (start == null && piece.any { it.isWhitespace() } && words.isNotEmpty()) {
                        val last = words.last()
                        words[words.size - 1] = last.copy(text = last.text.trimEnd() + " ")
                    }
                }

                XmlPullParser.END_DOCUMENT -> depth = 0
            }
        }

        // Clean trailing space on the final word of the line
        if (words.isNotEmpty()) {
            val last = words.last()
            words[words.size - 1] = last.copy(text = last.text.trimEnd())
        }

        return Line(
            startMs = startMs ?: firstSpanMs,
            endMs = endMs,
            text = WHITESPACE.replace(text, " ").trim(),
            words = words,
            key = key,
        )
    }

    // Insert empty marker lines on gaps >= GAP_MS so the previous line unhighlights during solos.
    private fun withGaps(lines: List<Line>, translations: Map<String, String>): List<LyricLine> {
        val out = mutableListOf<LyricLine>()
        lines.forEachIndexed { index, line ->
            out += LyricLine(
                startTimeMs = line.startMs,
                text = line.text,
                words = line.words,
                translation = line.key?.let(translations::get),
            )

            val endMs = line.endMs ?: return@forEachIndexed
            val nextMs = lines.getOrNull(index + 1)?.startMs
            // Nothing after the last line, so close it either way.
            if (nextMs == null || nextMs - endMs >= GAP_MS) {
                out += LyricLine(startTimeMs = endMs, text = "")
            }
        }
        return out
    }

    private const val WORD_MS = 300L

    private const val GAP_MS = 3_000L

    private fun time(value: String?): Long? {
        val text = value?.trim().orEmpty()
        if (text.isEmpty()) return null

        CLOCK.matchEntire(text)?.let { match ->
            val (hours, minutes, seconds) = match.destructured
            return (hours.ifEmpty { "0" }.toLong() * 3_600_000) +
                (minutes.toLong() * 60_000) +
                Math.round(seconds.toDouble() * 1_000)
        }

        OFFSET.matchEntire(text)?.let { match ->
            val (amount, unit) = match.destructured
            val millis = when (unit) {
                "h" -> 3_600_000.0
                "m" -> 60_000.0
                // Apple TTML writes bare seconds without a unit suffix.
                "s", "" -> 1_000.0
                "ms" -> 1.0
                else -> return null
            }
            return Math.round(amount.toDouble() * millis)
        }

        return null
    }

    private val CLOCK = Regex("(?:(\\d+):)?(\\d{1,2}):(\\d{1,2}(?:\\.\\d+)?)")
    private val OFFSET = Regex("(\\d+(?:\\.\\d+)?)(ms|h|m|s)?")
    private val WHITESPACE = Regex("\\s+")

    private fun attrByName(parser: XmlPullParser, localName: String): String? {
        parser.getAttributeValue(null, localName)?.let { return it }
        for (i in 0 until parser.attributeCount) {
            if (parser.getAttributeName(i) == localName) {
                return parser.getAttributeValue(i)
            }
        }
        return null
    }

    /** Where `xml:lang` lives, which is the one namespace never declared. */
    private const val XML_NS = "http://www.w3.org/XML/1998/namespace"
}
