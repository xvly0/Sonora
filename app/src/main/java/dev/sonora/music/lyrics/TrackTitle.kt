package dev.sonora.music.lyrics

import java.text.Normalizer

/** Strips video upload noise, featured artists, producer credits, and edition suffixes from track titles. */
internal fun String.songTitle(): String =
    replace(NOISE, "")
        .replace(FEAT_NOISE, "")
        .replace(EDITION_NOISE, "")
        .replace(WHITESPACE, " ")
        .trim()

/**
 * Trims upload/edition/producer noise while preserving featured-artist clauses
 * so versions with featured artists (e.g. "Glue Song (feat. Clairo)") can be
 * looked up specifically before falling back to the base title.
 */
internal fun String.songTitleKeepingFeat(): String =
    replace(NOISE, "")
        .replace(PROD_NOISE, "")
        .replace(EDITION_NOISE, "")
        .replace(WHITESPACE, " ")
        .trim()

/**
 * Normalizes localized feature markers like "(con ...)", "(with ...)", "(featuring ...)"
 * or "[...]" into canonical "(feat. ...)" so international lyrics databases match.
 */
internal fun String.songTitleNormalizedFeat(): String =
    songTitleKeepingFeat()
        .replace(FEAT_CANONICAL_PAREN) { match ->
            val featured = match.groupValues[1].ifBlank { match.groupValues[2] }.trim()
            " (feat. $featured)"
        }
        .replace(WHITESPACE, " ")
        .trim()

/**
 * Ordered title variants to query: canonical "(feat. ...)" version first (if any),
 * followed by the base cleaned title, and finally the original feature wording if different.
 */
internal fun String.titleVariants(): List<String> =
    listOf(songTitleNormalizedFeat(), songTitle(), songTitleKeepingFeat())
        .filter { it.isNotBlank() }
        .distinct()

/** Folds combining diacritical marks (e.g. "Guè" -> "Gue") for accent-insensitive matching. */
internal fun String.foldDiacritics(): String =
    Normalizer.normalize(this, Normalizer.Form.NFD)
        .replace(COMBINING_MARKS, "")

/**
 * Extracts the lead artist from collaboration strings like "Artist A, Artist B"
 * or "Artist A feat. Artist B", which lyrics databases often file under the primary name.
 */
internal fun String.primaryArtist(): String =
    split(',', '&', '/', ';', '、')
        .firstOrNull { it.isNotBlank() }
        ?.replace(FEAT_TRAILING, "")
        ?.trim()
        ?.ifEmpty { this.trim() }
        ?: this.trim()

/**
 * Extracts all distinct artists from collaboration strings like "Artist A, Artist B",
 * "Artist A & Artist B", or "Artist A feat. Artist B".
 */
internal fun String.allArtists(): List<String> {
    val candidates = mutableListOf<String>()
    val raw = this.trim()
    if (raw.isNotBlank()) candidates += raw

    val splitArtists = split(',', '&', '/', ';', '、')
        .flatMap { part ->
            part.split(FEAT_SPLIT)
        }
        .map { it.trim() }
        .filter { it.isNotBlank() }

    for (artist in splitArtists) {
        if (artist !in candidates) {
            candidates += artist
        }
    }
    return candidates
}

/**
 * Returns true if [candidateTitle] (or [candidateAlbum]) introduces a different
 * recording variant (live, remix, mixed, instrumental, sped up, cover, medley, etc.)
 * that was NOT requested in [queryTitle].
 */
internal fun isIncompatibleVariant(
    candidateTitle: String,
    queryTitle: String,
    candidateAlbum: String = "",
): Boolean {
    if (candidateTitle.contains(" / ") && !queryTitle.contains("/")) return true
    val qLower = queryTitle.lowercase()
    val cLower = candidateTitle.lowercase()
    for (pattern in VARIANT_MARKERS) {
        if (pattern.containsMatchIn(cLower) && !pattern.containsMatchIn(qLower)) {
            return true
        }
    }
    if (candidateAlbum.isNotBlank()) {
        val aLower = candidateAlbum.lowercase()
        for (pattern in ALBUM_VARIANT_MARKERS) {
            if (pattern.containsMatchIn(aLower) && !pattern.containsMatchIn(qLower)) {
                return true
            }
        }
    }
    return false
}

/**
 * Returns true when [candidateTitle] represents the same song as [queryTitle].
 * Handles upload noise, optional "Artist - Title" formatting, and "(feat. ...)"
 * when comparing normalized core titles.
 */
internal fun matchesTrackTitle(candidateTitle: String, queryTitle: String): Boolean {
    val qCore = normalizeTitleCore(queryTitle)
    if (qCore.isEmpty()) return false
    val cTrim = candidateTitle.trim()
    if (cTrim.isEmpty()) return false

    if (normalizeTitleCore(cTrim) == qCore) return true
    if (cTrim.contains(" - ") && !queryTitle.contains(" - ")) {
        val afterDash = cTrim.substringAfter(" - ").trim()
        if (normalizeTitleCore(afterDash) == qCore) return true
    }
    return false
}

/**
 * Exact normalized comparison including "(feat. ...)" when present, used to prefer
 * an exact version match (e.g. "Glue Song (feat. Clairo)" over "Glue Song") during scoring.
 */
internal fun isExactTitleMatch(candidateTitle: String, queryTitle: String): Boolean {
    val qNorm = normalizeSimple(queryTitle.songTitleNormalizedFeat())
    val cNorm = normalizeSimple(candidateTitle.songTitleNormalizedFeat())
    return qNorm.isNotEmpty() && qNorm == cNorm
}

/**
 * Returns true if [candidateArtist] matches at least one artist in [queryArtist].
 * Returns true when [candidateArtist] is blank (when a provider omits artist metadata).
 */
internal fun matchesArtistName(candidateArtist: String, queryArtist: String): Boolean {
    if (candidateArtist.isBlank()) return true
    val qArtists = queryArtist.allArtists().map(::normalizeSimple).filter { it.isNotEmpty() }
    if (qArtists.isEmpty()) return true
    val cArtists = candidateArtist.allArtists().map(::normalizeSimple).filter { it.isNotEmpty() }
    if (cArtists.isEmpty()) return true

    for (q in qArtists) {
        val qCompact = q.replace(" ", "")
        val qTokens = q.split(' ').filter { it.isNotEmpty() }
        for (c in cArtists) {
            if (q == c) return true
            val cCompact = c.replace(" ", "")
            if (qCompact.isNotEmpty() && qCompact == cCompact) return true
            if (q.length >= 4 && c.length >= 4 && (c.contains(q) || q.contains(c))) return true
            if (q.length >= 2 && c.length >= 2 && qTokens.isNotEmpty()) {
                val cTokens = c.split(' ').filter { it.isNotEmpty() }
                if (cTokens.isNotEmpty() && (qTokens.all { it in cTokens } || cTokens.all { it in qTokens })) {
                    return true
                }
            }
        }
    }
    return false
}

private fun normalizeTitleCore(value: String): String =
    normalizeSimple(value.songTitle())

private fun normalizeSimple(value: String): String =
    value
        .replace("\uFEFF", "")
        .replace("ï»¿", "")
        .foldDiacritics()
        .lowercase()
        .replace(APOSTROPHES, "")
        .replace(NON_ALNUM, " ")
        .replace(WHITESPACE, " ")
        .trim()

private val COMBINING_MARKS = Regex("\\p{Mn}+")

private val NOISE = Regex(
    "\\((?:official|lyric|audio|video|visualizer|hd|4k|mv|m/v)[^)]*\\)" +
        "|\\[[^\\]]*(?:official|lyric|audio|video|remaster|hd|4k)[^\\]]*\\]",
    RegexOption.IGNORE_CASE,
)

private val PROD_NOISE = Regex(
    "\\s*\\(prod(?:\\.?\\s+by|\\.)?\\s+[^)]+\\)|\\s*\\[prod(?:\\.?\\s+by|\\.)?\\s+[^\\]]+\\]",
    RegexOption.IGNORE_CASE,
)

private val FEAT_CANONICAL_PAREN = Regex(
    "\\s*\\((?:featuring|feat|ft|with|con)\\.?\\s+([^)]+)\\)|\\s*\\[(?:featuring|feat|ft|with|con)\\.?\\s+([^\\]]+)\\]",
    RegexOption.IGNORE_CASE,
)

private val FEAT_NOISE = Regex(
    "\\s*\\((?:featuring|feat|ft|with|con|prod(?:\\.?\\s+by|\\.)?)\\.?\\s+[^)]+\\)" +
        "|\\s*\\[(?:featuring|feat|ft|with|con|prod(?:\\.?\\s+by|\\.)?)\\.?\\s+[^\\]]+\\]" +
        "|\\s+(?:featuring|feat|ft)\\.?\\s+.*",
    RegexOption.IGNORE_CASE,
)

private val FEAT_TRAILING = Regex(
    "\\s+(?:featuring|feat|ft|with|con|prod(?:\\.?\\s+by|\\.)?)\\.?\\s+.*",
    RegexOption.IGNORE_CASE,
)

private val FEAT_SPLIT = Regex(
    "\\s+(?:featuring|feat|ft|with|con)\\.?\\s+",
    RegexOption.IGNORE_CASE,
)

private val EDITION_NOISE = Regex(
    "\\s*-\\s*(?:(?:\\d{4}\\s+)?remaster(?:ed)?|live(?:\\s+at\\s+[^\\-]+)?|anniversary(?:\\s+edition)?|deluxe(?:\\s+edition)?|radio\\s+edit|mono|stereo|bonus\\s+track).*",
    RegexOption.IGNORE_CASE,
)

private val VARIANT_MARKERS = listOf(
    "live", "remix", "mixed", "dj mix", "instrumental", "karaoke",
    "acapella", "a capella", "mochapella", "sped up", "slowed", "reverb",
    "nightcore", "cover", "tribute", "demo", "commentary", "acoustic", "8d",
).map { Regex("\\b$it\\b", RegexOption.IGNORE_CASE) }

private val ALBUM_VARIANT_MARKERS = listOf(
    "live\\s+(?:at|in|from|on)", "dj\\s+mix", "karaoke", "instrumental", "tribute",
).map { Regex("\\b$it\\b", RegexOption.IGNORE_CASE) }

private val APOSTROPHES = Regex("['’`]")
private val NON_ALNUM = Regex("[^\\p{L}\\p{N}\\s]")
private val WHITESPACE = Regex("\\s+")
