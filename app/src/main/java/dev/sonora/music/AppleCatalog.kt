package dev.sonora.music

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Cache
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * Resolves artist, album, and track artwork and editorial metadata from Apple Music's public catalog endpoints.
 */
object AppleCatalog {

    private const val TAG = "AppleCatalog"
    private const val SITE = "https://beta.music.apple.com"
    private const val API = "https://amp-api.music.apple.com/v1/catalog"

    private val lookupScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @Volatile
    private var client: OkHttpClient = buildClient(null)

    private fun buildClient(cacheBaseDir: File?): OkHttpClient = OkHttpClient.Builder()
        .connectionPool(SonoraHttpPool.connectionPool)
        .dispatcher(SonoraHttpPool.dispatcher)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .apply {
            if (cacheBaseDir != null) {
                cache(Cache(File(cacheBaseDir, "apple_http_cache"), 16L * 1024L * 1024L))
            }
        }
        .build()

    private val json = Json { ignoreUnknownKeys = true }

    @Volatile
    private var token: String? = null
    private val tokenLock = Mutex()

    private const val MAX_MEMORY_ENTRIES = 400
    private const val MISS_SENTINEL = "__MISS__"
    private const val MISS_CACHE_MS = 24L * 60 * 60 * 1000

    private val cache: MutableMap<String, Any?> = object : LinkedHashMap<String, Any?>(128, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Any?>?): Boolean =
            size > MAX_MEMORY_ENTRIES
    }

    fun clearMemoryCache() {
        synchronized(cache) { cache.clear() }
    }

    private val inFlight = ConcurrentHashMap<String, Deferred<Any?>>()

    private data class LookupOutcome<T>(val value: T?, val authoritative: Boolean)

    private sealed class DiskEntry {
        data class Hit(val value: String) : DiskEntry()
        object Miss : DiskEntry()
    }

    @Volatile
    private var store: android.content.SharedPreferences? = null

    fun hasReadyToken(): Boolean {
        if (token != null) return true
        val saved = keptToken() ?: return false
        token = saved
        return true
    }

    fun attach(context: android.content.Context) {
        val appCtx = context.applicationContext ?: context
        connectivityRef = java.lang.ref.WeakReference(
            appCtx.getSystemService(android.net.ConnectivityManager::class.java),
        )
        store = appCtx.getSharedPreferences(
            "apple-catalog-v7",
            android.content.Context.MODE_PRIVATE,
        )
        runCatching {
            client = buildClient(appCtx.cacheDir)
        }
        keptToken()?.let { token = it }
        if (token == null) {
            lookupScope.launch {
                kotlinx.coroutines.delay(350L)
                if (token == null) {
                    runCatching { token() }
                }
            }
        }
    }

    private fun remembered(key: String): DiskEntry? {
        val prefs = store ?: return null
        val row = prefs.getString(key, null) ?: return null
        val cut = row.indexOf('\n')
        if (cut < 0) return null
        val written = row.take(cut).toLongOrNull() ?: return null
        val payload = row.substring(cut + 1)
        val ttl = if (payload == MISS_SENTINEL) MISS_CACHE_MS else CACHE_MS
        if (System.currentTimeMillis() - written > ttl) {
            prefs.edit().remove(key).apply()
            return null
        }
        return if (payload == MISS_SENTINEL) DiskEntry.Miss else DiskEntry.Hit(payload)
    }

    @Suppress("UNCHECKED_CAST")
    private suspend fun <T> coalesced(key: String, block: suspend () -> T): T {
        while (true) {
            val existing = inFlight[key]
            if (existing != null) {
                try {
                    return existing.await() as T
                } catch (_: kotlinx.coroutines.CancellationException) {
                    currentCoroutineContext().ensureActive()
                }
            }
            lateinit var created: Deferred<Any?>
            created = lookupScope.async(start = CoroutineStart.LAZY) {
                try {
                    block()
                } finally {
                    inFlight.remove(key, created)
                }
            }
            val prev = inFlight.putIfAbsent(key, created)
            if (prev == null) {
                created.start()
                try {
                    return created.await() as T
                } catch (_: kotlinx.coroutines.CancellationException) {
                    currentCoroutineContext().ensureActive()
                }
            } else {
                created.cancel()
            }
        }
    }

    private fun mayAsk(): Boolean = true

    private fun unmetered(): Boolean = true

    private var connectivityRef: java.lang.ref.WeakReference<android.net.ConnectivityManager>? = null


    private fun remember(key: String, value: String) {
        store?.edit()?.putString(key, System.currentTimeMillis().toString() + "\n" + value)?.apply()
    }

    @kotlinx.serialization.Serializable
    data class Album(
        val heroUrl: String?,
        val coverUrl: String?,
        val bgColor: String? = null,
        val heroAspect: Float? = null,
        val textHex: String? = null,
        val inkPalette: List<String> = emptyList(),
        val notes: String? = null,
        val motionUrl: String? = null,
    )

    @kotlinx.serialization.Serializable
    data class Artist(
        val heroUrl: String?,
        val bgColor: String? = null,
        val heroAspect: Float? = null,
        val textHex: String? = null,
        val inkPalette: List<String> = emptyList(),
        val bio: String? = null,
        val origin: String? = null,
        val logoUrl: String?,
    )

    suspend fun artist(
        name: String,
        storefront: String = storefront(),
        lang: String = SonoraLocaleManager.resolvedLang,
    ): Artist? {
        if (name.isBlank()) return null
        val clean = name.replace(Regex("(?i)\\s*-\\s*topic$"), "")
            .replace(Regex("(?i)\\b(feat|ft)\\.?.*$"), "")
            .trim()
        val key = "artist $storefront/$lang/${clean.lowercase()}"
        synchronized(cache) { if (cache.containsKey(key)) return cache[key] as Artist? }

        when (val disk = remembered(key)) {
            is DiskEntry.Miss -> {
                synchronized(cache) { cache[key] = null }
                return null
            }
            is DiskEntry.Hit -> {
                val kept = runCatching { json.decodeFromString<Artist>(disk.value) }.getOrNull()
                synchronized(cache) { cache[key] = kept }
                return kept
            }
            null -> {}
        }

        return coalesced(key) {
            synchronized(cache) { if (cache.containsKey(key)) return@coalesced cache[key] as Artist? }
            var outcome = ask(clean) { lookUpArtist(clean, storefront, lang) }
            if (outcome.value == null && clean != name) {
                val alt = ask(name) { lookUpArtist(name, storefront, lang) }
                if (alt.value != null || !alt.authoritative) {
                    outcome = alt
                }
            }
            val found = outcome.value
            if (found != null) {
                runCatching { remember(key, json.encodeToString(found)) }
                synchronized(cache) { cache[key] = found }
            } else if (outcome.authoritative) {
                runCatching { remember(key, MISS_SENTINEL) }
                synchronized(cache) { cache[key] = null }
            }
            found
        }
    }

    suspend fun album(
        name: String,
        artist: String,
        storefront: String = storefront(),
        lang: String = SonoraLocaleManager.resolvedLang,
    ): Album? {
        if (name.isBlank()) return null
        val key = "album2 $storefront/$lang/${artist.lowercase()}/${name.lowercase()}"
        synchronized(cache) { if (cache.containsKey(key)) return cache[key] as Album? }

        when (val disk = remembered(key)) {
            is DiskEntry.Miss -> {
                synchronized(cache) { cache[key] = null }
                return null
            }
            is DiskEntry.Hit -> {
                val kept = runCatching { json.decodeFromString<Album>(disk.value) }.getOrNull()
                    ?.let {
                        val generated = it.heroUrl?.contains(SUPER_HERO_CROP) == true
                        it.copy(
                            heroUrl = if (generated) null else it.heroUrl?.let(::asWebp),
                            heroAspect = if (generated) null else it.heroAspect,
                            coverUrl = it.coverUrl?.let(::asWebp),
                        )
                    }
                synchronized(cache) { cache[key] = kept }
                return kept
            }
            null -> {}
        }

        if (!mayAsk()) return null

        return coalesced(key) {
            synchronized(cache) { if (cache.containsKey(key)) return@coalesced cache[key] as Album? }
            val outcome = ask(name) { lookUpAlbum(name, artist, storefront, lang) }
            val found = outcome.value
            if (found != null) {
                runCatching { remember(key, json.encodeToString(found)) }
                synchronized(cache) { cache[key] = found }
            } else if (outcome.authoritative) {
                runCatching { remember(key, MISS_SENTINEL) }
                synchronized(cache) { cache[key] = null }
            }
            found
        }
    }

    /** One song's canonical artwork URL and the studio album name it came from. */
    @kotlinx.serialization.Serializable
    data class SongCover(
        val coverUrl: String,
        val albumName: String,
    )

    suspend fun song(
        name: String,
        artist: String,
        album: String = "",
        storefront: String = storefront(),
        lang: String = SonoraLocaleManager.resolvedLang,
    ): String? = songMatch(name, artist, album, storefront, lang)?.coverUrl

    /**
     * Resolves a track's canonical cover and album name, preferring its original studio
     * album over compilations or later anthologies.
     */
    suspend fun songMatch(
        name: String,
        artist: String,
        album: String = "",
        storefront: String = storefront(),
        lang: String = SonoraLocaleManager.resolvedLang,
    ): SongCover? {
        if (name.isBlank()) return null
        val effectiveAlbum = if (album.isNotBlank() &&
            !SonoraApiInterceptor.isLikelyCompilationAlbum(album, name, lead(artist))
        ) album.trim() else ""
        val key = "song_meta_v3 $storefront/${artist.lowercase()}/${name.lowercase()}/${effectiveAlbum.lowercase()}"
        synchronized(cache) { if (cache.containsKey(key)) return cache[key] as SongCover? }

        when (val disk = remembered(key)) {
            is DiskEntry.Miss -> {
                synchronized(cache) { cache[key] = null }
                return null
            }
            is DiskEntry.Hit -> {
                val kept = runCatching { json.decodeFromString<SongCover>(disk.value) }.getOrNull()
                    ?.takeIf { it.coverUrl.isNotBlank() }
                synchronized(cache) { cache[key] = kept }
                return kept
            }
            null -> {}
        }

        if (!mayAsk()) return null

        return coalesced(key) {
            synchronized(cache) { if (cache.containsKey(key)) return@coalesced cache[key] as SongCover? }
            val outcome = ask(name) { lookUpSong(name, artist, effectiveAlbum, storefront, lang) }
            val found = outcome.value
            if (found != null) {
                runCatching { remember(key, json.encodeToString(found)) }
                synchronized(cache) { cache[key] = found }
            } else if (outcome.authoritative) {
                runCatching { remember(key, MISS_SENTINEL) }
                synchronized(cache) { cache[key] = null }
            }
            found
        }
    }

    // Propagate CancellationException so cancelled lookups are not cached as authoritative misses.
    private suspend fun <T> ask(
        name: String,
        lookUp: suspend () -> LookupOutcome<T>,
    ): LookupOutcome<T> =
        try {
            lookUp()
        } catch (failure: Throwable) {
            if (failure is kotlinx.coroutines.CancellationException) throw failure
            android.util.Log.w(TAG, "no artwork for $name: ${failure.message}")
            LookupOutcome(null, authoritative = false)
        }

    private suspend fun lookUpSong(
        name: String,
        artist: String,
        album: String,
        storefront: String,
        lang: String = SonoraLocaleManager.resolvedLang,
    ): LookupOutcome<SongCover> {
        val searchTitle = if (SonoraApiInterceptor.hasTrackVariantTag(name)) {
            SonoraApiInterceptor.stripTitleDecorations(name).ifBlank { plain(name) }
        } else {
            plain(name)
        }
        val results = search("${lead(artist)} $searchTitle", "songs", storefront, lang)
            ?: return LookupOutcome(null, authoritative = false)
        return LookupOutcome(selectCanonicalSongMatch(results, name, artist, album), authoritative = true)
    }

    internal fun selectCanonicalSongMatch(
        results: List<kotlinx.serialization.json.JsonElement>,
        name: String,
        artist: String,
        album: String = "",
    ): SongCover? {
        val plain = plain(name)
        val plainCompact = SonoraApiInterceptor.normCompactKey(plain)
        val nameCompact = SonoraApiInterceptor.normCompactKey(name)
        val hasRequestedVariant = SonoraApiInterceptor.hasTrackVariantTag(name)
        val nameLow = name.lowercase()
        val credited = credited(artist)
        val leadArtist = lead(artist)
        val effectiveAlbum = if (album.isNotBlank() &&
            !SonoraApiInterceptor.isLikelyCompilationAlbum(album, name, leadArtist)
        ) album.trim() else ""

        val matches = results.mapNotNull { it.jsonObject["attributes"]?.jsonObject }
            .filter { row ->
                val filed = row["name"]?.jsonPrimitive?.content.orEmpty()
                val filedLow = filed.lowercase()
                if (listOf("karaoke", "tribute", "nightcore", "8d audio", "parodia", "parody").any {
                        it in filedLow && it !in nameLow
                    }
                ) {
                    return@filter false
                }
                filed.equals(name, ignoreCase = true) ||
                    plain(filed).equals(plain, ignoreCase = true)
            }
            .filter { row ->
                val filed = row["artistName"]?.jsonPrimitive?.content.orEmpty()
                filed.equals(artist, ignoreCase = true) ||
                    credited.any { filed.contains(it, ignoreCase = true) } ||
                    credited.any { it.contains(filed, ignoreCase = true) }
            }
        if (matches.isEmpty()) return null

        data class ScoredRow(
            val row: JsonObject,
            val albumName: String,
            val cleanAlbum: String,
            val trackName: String,
            val requestedVariantMatch: Boolean,
            val fullDecoratedTitleMatch: Boolean,
            val isCompTitle: Boolean,
            val isCompGenre: Boolean,
            val isSoundtrackGenre: Boolean,
            val isSingleOrEp: Boolean,
            val isReissue: Boolean,
            val releaseDayNum: Int?,
        )

        val singleSuffixRe = Regex("""\s*-\s*(?:Single|EP)\s*$""", RegexOption.IGNORE_CASE)
        val parsed = matches.mapNotNull { row ->
            val coverUrl = row["artwork"]?.jsonObject?.template()?.let { size(it, COVER_PX, COVER_PX) }
                ?: return@mapNotNull null
            val trackName = row["name"]?.jsonPrimitive?.content.orEmpty().trim()
            val albumName = row["albumName"]?.jsonPrimitive?.content.orEmpty().trim()
            // Never overwrite a track's cover with an unrequested remix/live/acoustic/etc. variant.
            if (SonoraApiInterceptor.isUnrequestedTrackVariant(trackName, name)) {
                return@mapNotNull null
            }
            val cleanAlbum = albumName.replace(singleSuffixRe, "").trim().ifBlank { albumName }
            val genres = row["genreNames"]?.jsonArray
                ?.mapNotNull { runCatching { it.jsonPrimitive.content }.getOrNull() }
                .orEmpty()
            val requestedVariantMatch = SonoraApiInterceptor.isRequestedTrackVariantMatch(trackName, name)
            val fullDecoratedTitleMatch = nameCompact.isNotEmpty() &&
                nameCompact != plainCompact &&
                SonoraApiInterceptor.normCompactKey(trackName) == nameCompact
            val isCompTitle = albumName.isBlank() ||
                SonoraApiInterceptor.isLikelyCompilationAlbum(albumName, name, leadArtist)
            val isCompGenre = genres.any {
                it.equals("Compilation", ignoreCase = true) ||
                    it.equals("Fitness & Workout", ignoreCase = true)
            }
            val isSoundtrackGenre = genres.any {
                it.contains("Soundtrack", ignoreCase = true) ||
                    it.contains("Colonna sonora", ignoreCase = true)
            } && !SonoraApiInterceptor.hasSoundtrackHint(name, effectiveAlbum)
            val isSingleOrEp = sameTitle(albumName, name) ||
                singleSuffixRe.containsMatchIn(albumName)
            val isReissue = SonoraApiInterceptor.isReissueAlbumTitle(albumName) ||
                SonoraApiInterceptor.isReissueAlbumTitle(trackName)
            val releaseDayNum = SonoraApiInterceptor.parseReleaseDayNum(
                row["releaseDate"]?.jsonPrimitive?.content.orEmpty()
            )
            ScoredRow(
                row = row,
                albumName = albumName,
                cleanAlbum = cleanAlbum,
                trackName = trackName,
                requestedVariantMatch = requestedVariantMatch,
                fullDecoratedTitleMatch = fullDecoratedTitleMatch,
                isCompTitle = isCompTitle,
                isCompGenre = isCompGenre,
                isSoundtrackGenre = isSoundtrackGenre,
                isSingleOrEp = isSingleOrEp,
                isReissue = isReissue,
                releaseDayNum = releaseDayNum,
            ) to coverUrl
        }
        if (parsed.isEmpty()) return null

        val variantScoped = if (hasRequestedVariant &&
            parsed.any { it.first.requestedVariantMatch && it.first.releaseDayNum != null }
        ) {
            parsed.filter { it.first.requestedVariantMatch }
        } else {
            parsed
        }

        val cleanStudioPool = variantScoped.map { it.first }.filter {
            !it.isCompTitle && !it.isCompGenre && !it.isSingleOrEp &&
                !it.isSoundtrackGenre && it.releaseDayNum != null
        }
        val anchorPool = cleanStudioPool.ifEmpty {
            variantScoped.map { it.first }.filter {
                !it.isCompTitle && !it.isCompGenre && it.releaseDayNum != null
            }
        }
        val anchorDay = anchorPool.minOfOrNull { it.releaseDayNum!! }
        val hasStudioAnchor = cleanStudioPool.isNotEmpty() || variantScoped.any {
            val r = it.first
            !r.isCompTitle && !r.isCompGenre && !r.isSingleOrEp && !r.isSoundtrackGenre
        }

        var best: Pair<ScoredRow, String>? = null
        var bestScore = Int.MIN_VALUE
        for (entry in parsed) {
            val r = entry.first
            var score = 0
            score += if (!r.isCompTitle && !r.isCompGenre) 30 else -52
            if (r.isSoundtrackGenre) score -= 12
            if (!r.isSingleOrEp) {
                score += 16
            } else if (hasStudioAnchor) {
                score -= 8
            }
            if (hasRequestedVariant && !r.requestedVariantMatch) score -= 48
            if (r.requestedVariantMatch) score += 14
            if (r.fullDecoratedTitleMatch) score += 16
            if (r.trackName.equals(name, ignoreCase = true)) score += 8

            val hintMatch = effectiveAlbum.isNotBlank() && sameTitle(r.albumName, effectiveAlbum)
            if (r.isReissue && !hintMatch) score -= 6

            val daysAfter = if (anchorDay != null && r.releaseDayNum != null) r.releaseDayNum - anchorDay else null
            if (daysAfter != null) {
                score += when {
                    daysAfter <= 90 -> 28
                    daysAfter <= 548 -> 14
                    daysAfter <= 1096 -> 6
                    daysAfter <= 2192 -> -14
                    else -> -26
                }
            }
            if (hintMatch && !r.isCompTitle && !r.isCompGenre) {
                score += when {
                    !r.isSingleOrEp && (daysAfter == null || daysAfter <= 1096) -> 24
                    !r.isSingleOrEp -> 6
                    else -> 8
                }
            }
            if (score > bestScore) {
                bestScore = score
                best = entry
            }
        }

        val chosen = best?.takeIf { bestScore > 0 } ?: return null
        return SongCover(coverUrl = chosen.second, albumName = chosen.first.cleanAlbum)
    }

    private fun credited(artist: String): List<String> = artist
        .split(",", "&", "feat.", "Feat.")
        .map { it.trim() }
        .filter { it.isNotEmpty() }

    private fun lead(artist: String): String = credited(artist).firstOrNull() ?: artist

    private fun foldAccents(s: String): String =
        java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
            .replace(Regex("""\p{InCombiningDiacriticalMarks}+"""), "")

    private fun sameTitle(a: String, b: String): Boolean =
        a.equals(b, ignoreCase = true) || plain(a).equals(plain(b), ignoreCase = true)

    private fun sameTitleFolded(a: String, b: String): Boolean =
        foldAccents(plain(a)).equals(foldAccents(plain(b)), ignoreCase = true)

    private suspend fun lookUpArtist(
        name: String,
        storefront: String,
        lang: String = SonoraLocaleManager.resolvedLang,
    ): LookupOutcome<Artist> {
        val results = search(name, "artists", storefront, lang)
            ?: return LookupOutcome(null, authoritative = false)
        val match = results.firstOrNull {
            val n = it.jsonObject["attributes"]?.jsonObject?.get("name")?.jsonPrimitive?.content.orEmpty()
            sameTitle(n, name)
        } ?: results.firstOrNull {
            val n = it.jsonObject["attributes"]?.jsonObject?.get("name")?.jsonPrimitive?.content.orEmpty()
            sameTitleFolded(n, name)
        } ?: return LookupOutcome(null, authoritative = true)

        val attributes = match.jsonObject["attributes"]?.jsonObject
            ?: return LookupOutcome(null, authoritative = true)
        val editorial = attributes["editorialArtwork"]?.jsonObject

        // Prefer tall editorial portraits; fall back to square artist artwork using its native ratio.
        val heroArt = editorial?.get("superHeroTall")?.jsonObject
            ?: editorial?.get("staticDetailTall")?.jsonObject
            ?: attributes["artwork"]?.jsonObject
            ?: editorial?.get("subscriptionHero")?.jsonObject
        val hero = heroArt?.template()

        // Palette colors live on the square identity artwork; tall portraits carry padding colors.
        val colourArt = attributes["artwork"]?.jsonObject ?: heroArt

        val logo = listOf("musicContentColorLogoTrimmed", "brandLogo", "logo")
            .firstNotNullOfOrNull { editorial?.get(it)?.jsonObject }

        if (hero == null && logo == null) return LookupOutcome(null, authoritative = true)
        return LookupOutcome(
            Artist(
                heroUrl = hero?.let {
                    val ratio = heroRatio(heroArt)
                    if (ratio == null) {
                        size(it, HERO_W, HERO_H, crop = "va")
                    } else {
                        size(it, HERO_W, (HERO_W / ratio).toInt().coerceAtLeast(1))
                    }
                },
                heroAspect = heroRatio(heroArt),
                bgColor = colourArt?.get("bgColor")?.jsonPrimitive?.content,
                textHex = colourArt?.get("textColor1")?.jsonPrimitive?.content,
                inkPalette = inkPaletteOf(colourArt),
                bio = attributes["artistBio"]?.jsonPrimitive?.content,
                origin = attributes["bornOrFormed"]?.jsonPrimitive?.content,
                // Request transparent PNG cropped "sr" at native aspect ratio so logos stay unclipped.
                logoUrl = logo?.template()?.let { url ->
                    val width = logo["width"]?.jsonPrimitive?.content?.toIntOrNull() ?: LOGO_W
                    val height = logo["height"]?.jsonPrimitive?.content?.toIntOrNull() ?: LOGO_H
                    size(
                        url,
                        LOGO_W,
                        (LOGO_W.toLong() * height / width).toInt().coerceAtLeast(1),
                        format = "png",
                        crop = "sr",
                    )
                },
            ),
            authoritative = true,
        )
    }

    private suspend fun lookUpAlbum(
        name: String,
        artist: String,
        storefront: String,
        lang: String = SonoraLocaleManager.resolvedLang,
    ): LookupOutcome<Album> {
        val cleanLead = lead(artist).trim()
        val query = if (cleanLead.isNotEmpty()) "$cleanLead $name" else name
        val results = search(query, "albums", storefront, lang)
            ?: return LookupOutcome(null, authoritative = false)

        val credited = credited(artist)

        val candidates = results.mapNotNull { it.jsonObject["attributes"]?.jsonObject }
            .filter { sameTitle(it["name"]?.jsonPrimitive?.content.orEmpty(), name) }
            .filter { row ->
                val filed = row["artistName"]?.jsonPrimitive?.content.orEmpty()
                credited.isEmpty() ||
                    filed.equals(artist, ignoreCase = true) ||
                    credited.any { filed.contains(it, ignoreCase = true) } ||
                    credited.any { it.contains(filed, ignoreCase = true) }
            }

        fun single(row: kotlinx.serialization.json.JsonObject): Boolean =
            row["isSingle"]?.jsonPrimitive?.content?.toBooleanStrictOrNull() == true ||
                row["trackCount"]?.jsonPrimitive?.content?.toIntOrNull() == 1

        fun exact(row: kotlinx.serialization.json.JsonObject): Boolean =
            row["name"]?.jsonPrimitive?.content.orEmpty()
                .substringBefore(" - ")
                .trim()
                .equals(name.substringBefore(" - ").trim(), ignoreCase = true)

        // Rank by: editorial artwork/motion availability > exact title > full album over single.
        val match = candidates.maxByOrNull { row ->
            (if (row.tall() != null || row.motion() != null) 4 else 0) +
                (if (exact(row)) 2 else 0) +
                (if (single(row)) 0 else 1)
        }
        val attributes = match ?: return LookupOutcome(null, authoritative = true)
        val tall = attributes.tall()
        val cover = attributes["artwork"]?.jsonObject?.template()

        val motion = attributes.motion()
        val motionUrl = motion?.get("video")?.jsonPrimitive?.content
        val motionStill = motion?.get("previewFrame")?.jsonObject?.template()
        val notes = attributes["editorialNotes"]?.jsonObject
            ?.let { it["standard"] ?: it["short"] }
            ?.jsonPrimitive?.content

        val pageArt = attributes["editorialArtwork"]?.jsonObject
            ?.get("staticDetailTall")?.jsonObject
            ?: attributes["artwork"]?.jsonObject

        if (tall == null && cover == null) return LookupOutcome(null, authoritative = true)
        return LookupOutcome(
            Album(
                heroUrl = (tall ?: motionStill)?.let { size(it, DETAIL_W, DETAIL_H) },
                motionUrl = motionUrl,
                bgColor = pageArt?.get("bgColor")?.jsonPrimitive?.content,
                textHex = pageArt?.get("textColor1")?.jsonPrimitive?.content,
                inkPalette = inkPaletteOf(pageArt),
                coverUrl = cover?.let { size(it, COVER_PX, COVER_PX) },
                notes = notes,
            ),
            authoritative = true,
        )
    }

    private fun heroRatio(art: JsonObject?): Float? {
        val w = art?.get("width")?.jsonPrimitive?.content?.toFloatOrNull() ?: return null
        val h = art["height"]?.jsonPrimitive?.content?.toFloatOrNull() ?: return null
        return (w / h).takeIf { it.isFinite() && it > 0f }
    }

    private fun inkPaletteOf(art: JsonObject?): List<String> =
        listOf("textColor1", "textColor2", "textColor3", "textColor4")
            .mapNotNull { art?.get(it)?.jsonPrimitive?.content }

    private fun kotlinx.serialization.json.JsonObject.motion(): kotlinx.serialization.json.JsonObject? =
        listOf("motionDetailTall", "motionTallVideo3x4", "motionDetailSquare")
            .firstNotNullOfOrNull { get("editorialVideo")?.jsonObject?.get(it)?.jsonObject }

    // Exclude superHeroTall: it is auto-generated from the square sleeve and slow to generate on cold paths.
    private fun kotlinx.serialization.json.JsonObject.tall(): String? =
        get("editorialArtwork")?.jsonObject?.get("staticDetailTall")?.jsonObject?.template()

    private suspend fun search(
        term: String,
        types: String,
        storefront: String,
        lang: String = SonoraLocaleManager.resolvedLang,
    ): List<kotlinx.serialization.json.JsonElement>? {
        val bearer = token() ?: return null
        val langTag = SonoraLocaleManager.appleLanguageTag(lang, storefront)
        val url = "$API/$storefront/search" +
            "?term=${java.net.URLEncoder.encode(term, "UTF-8")}" +
            "&types=$types&limit=25" +
            "&l=$langTag" +
            "&extend=editorialArtwork,editorialVideo,editorialNotes,artistBio,bornOrFormed"

        val body = get(url, bearer) ?: return null
        return json.parseToJsonElement(body)
            .jsonObject["results"]?.jsonObject
            ?.get(types)?.jsonObject
            ?.get("data")?.jsonArray
            ?.toList()
    }

    private fun plain(title: String): String = title
        .replace(Regex("\\([^)]*\\)"), " ")
        .replace(Regex("\\[[^]]*]"), " ")
        .substringBefore(" - ")
        .replace(Regex("[^\\p{L}\\p{N}' ]"), " ")
        .replace(Regex("\\s+"), " ")
        .trim()

    private fun storefront(): String = SonoraLocaleManager.storefront()

    private suspend fun token(): String? {
        token?.let { return it }
        return tokenLock.withLock {
            token?.let { return it }

            keptToken()?.let {
                token = it
                return it
            }

            scrapeToken()
        }
    }

    @Volatile
    private var last429RefreshAt: Long = 0L

    private suspend fun refreshTokenAfterUnauthorized(failedBearer: String): String? {
        return tokenLock.withLock {
            // Another concurrent request may already have rotated the token while we waited.
            val current = token
            if (current != null && current != failedBearer) return@withLock current

            token = null
            // Commit synchronously before scraping so keptToken() never reads a stale JWT.
            store?.edit()
                ?.remove(KEY_TOKEN)
                ?.remove(KEY_TOKEN_UNTIL)
                ?.remove(LEGACY_KEY_TOKEN)
                ?.remove(LEGACY_KEY_TOKEN_UNTIL)
                ?.commit()
            scrapeToken()
        }
    }

    private fun jwtClaimsJson(jwt: String): JsonObject? = runCatching {
        val claims = jwt.split('.').getOrNull(1) ?: return@runCatching null
        val decoded = String(java.util.Base64.getUrlDecoder().decode(claims), Charsets.UTF_8)
        json.parseToJsonElement(decoded).jsonObject
    }.getOrNull()

    private fun isTokenUsable(jwt: String): Boolean {
        val claims = jwtClaimsJson(jwt) ?: return true
        val expSec = claims["exp"]?.jsonPrimitive?.content?.toLongOrNull()
        if (expSec != null && expSec * 1000L <= System.currentTimeMillis() + 60_000L) {
            return false
        }
        val iss = claims["iss"]?.jsonPrimitive?.content.orEmpty()
        if (iss.equals("AMPWebPlay", ignoreCase = true)) return false
        return true
    }

    private suspend fun probeToken(jwt: String): Boolean = withContext(Dispatchers.IO) {
        val url = "$API/${storefront()}/search?term=a&types=artists&limit=1"
        val request = Request.Builder()
            .url(url)
            .header("Accept-Language", SonoraLocaleManager.appleAcceptLanguage())
            .header("Authorization", "Bearer $jwt")
            .header("Origin", "https://music.apple.com")
            .header("Referer", "https://music.apple.com/")
            .build()
        runCatching {
            client.newCall(request).execute().use { response ->
                android.util.Log.i(TAG, "probeToken HTTP ${response.code}")
                response.isSuccessful
            }
        }.getOrDefault(false)
    }

    private suspend fun scrapeToken(): String? {
        for (site in listOf("https://beta.music.apple.com", "https://music.apple.com")) {
            val page = get(site, null) ?: continue
            val script = Regex("""/assets/[^"']*index[^"']*\.js""").find(page)?.value ?: continue
            val bundle = get("$site$script", null) ?: continue
            val rawCandidates = Regex("""eyJ[\w-]+\.[\w-]+\.[\w-]+""")
                .findAll(bundle)
                .map { it.value }
                .distinct()
                .toList()
            if (rawCandidates.isEmpty()) continue

            val now = System.currentTimeMillis()
            val prioritized = rawCandidates
                .filter { jwt ->
                    val expSec = jwtClaimsJson(jwt)?.get("exp")?.jsonPrimitive?.content?.toLongOrNull()
                    expSec == null || expSec * 1000L > now + 60_000L
                }
                .sortedBy { jwt ->
                    val claims = jwtClaimsJson(jwt)
                    val iss = claims?.get("iss")?.jsonPrimitive?.content.orEmpty()
                    val hasOriginRestriction = claims?.get("origin") != null
                    when {
                        !iss.equals("AMPWebPlay", ignoreCase = true) && !hasOriginRestriction -> 0
                        !iss.equals("AMPWebPlay", ignoreCase = true) -> 1
                        else -> 2
                    }
                }

            for (jwt in prioritized) {
                if (probeToken(jwt)) {
                    token = jwt
                    rememberToken(jwt)
                    return jwt
                }
            }
        }
        return null
    }

    private fun keptToken(): String? {
        val prefs = store ?: return null
        if (prefs.contains(LEGACY_KEY_TOKEN) || prefs.contains(LEGACY_KEY_TOKEN_UNTIL)) {
            prefs.edit().remove(LEGACY_KEY_TOKEN).remove(LEGACY_KEY_TOKEN_UNTIL).apply()
        }
        val jwt = prefs.getString(KEY_TOKEN, null) ?: return null
        val expiresAt = prefs.getLong(KEY_TOKEN_UNTIL, 0L)
        if (System.currentTimeMillis() > expiresAt - TOKEN_MARGIN_MS || !isTokenUsable(jwt)) {
            prefs.edit().remove(KEY_TOKEN).remove(KEY_TOKEN_UNTIL).apply()
            return null
        }
        return jwt
    }

    private fun rememberToken(jwt: String) {
        val prefs = store ?: return
        val now = System.currentTimeMillis()
        val parsedExp = jwtClaimsJson(jwt)
            ?.get("exp")?.jsonPrimitive?.content?.toLongOrNull()?.times(1000L)
            ?: 0L

        // Fallback to a 7-day TTL if JWT lacks "exp" (401/403 in get() still clears stale tokens).
        val expiresAt = if (parsedExp > now) parsedExp else now + 7L * 24 * 60 * 60 * 1000L
        prefs.edit()
            .remove(LEGACY_KEY_TOKEN)
            .remove(LEGACY_KEY_TOKEN_UNTIL)
            .putString(KEY_TOKEN, jwt)
            .putLong(KEY_TOKEN_UNTIL, expiresAt)
            .apply()
    }

    private suspend fun get(
        url: String,
        bearer: String?,
        retryOnAuth: Boolean = bearer != null,
    ): String? {
        var unauthorized = false
        var rateLimitedToken = false
        val body = withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url(url)
                .header("Accept-Language", SonoraLocaleManager.appleAcceptLanguage())
                .apply {
                    if (bearer != null) {
                        header("Authorization", "Bearer $bearer")
                        header("Origin", "https://music.apple.com")
                        header("Referer", "https://music.apple.com/")
                    }
                }
                .build()

            val started = android.os.SystemClock.elapsedRealtime()
            client.newCall(request).execute().use { response ->
                android.util.Log.i(
                    TAG,
                    "timing: ${response.code} in ${android.os.SystemClock.elapsedRealtime() - started} ms " +
                        url.substringBefore('?').takeLast(60),
                )
                if (response.code == 401 || response.code == 403) {
                    unauthorized = true
                    return@use null
                }
                if (response.code == 429 && retryOnAuth && bearer != null) {
                    rateLimitedToken = true
                    return@use null
                }
                if (!response.isSuccessful) return@use null
                response.body.string()
            }
        }
        val shouldRefresh429 = rateLimitedToken && run {
            val now = System.currentTimeMillis()
            if (now - last429RefreshAt >= TOKEN_429_REFRESH_COOLDOWN_MS) {
                last429RefreshAt = now
                true
            } else {
                false
            }
        }
        if ((unauthorized || shouldRefresh429) && retryOnAuth && bearer != null) {
            val freshBearer = refreshTokenAfterUnauthorized(bearer) ?: return null
            return get(url, freshBearer, retryOnAuth = false)
        }
        return body
    }

    private fun asWebp(url: String): String =
        if (!url.contains("mzstatic.com")) url
        else url.replace(Regex("(/\\d+x\\d+[A-Za-z0-9.]*?)\\.jpg(\\?[^/]*)?$"), "$1.webp$2")

    private fun kotlinx.serialization.json.JsonObject.template(): String? =
        get("url")?.jsonPrimitive?.content

    private fun size(
        template: String,
        width: Int,
        height: Int,
        format: String = "webp",
        crop: String = "bb",
    ): String {
        val filled = template
            .replace("{w}", width.toString())
            .replace("{h}", height.toString())
            .replace("{f}", format)
            .replace("{c}", crop)

        val simple = Regex("/\\d+x\\d+[a-z]{2}\\.(jpg|png|webp)$")
        if (simple.containsMatchIn(filled)) {
            return filled.replace(simple, "/" + width + "x" + height + crop + "." + format)
        }
        // Preserve custom crop segments while requesting WebP when applicable.
        if (format != "webp") return filled
        return filled.replace(
            Regex("(/\\d+x\\d+[A-Za-z0-9.]*?)\\.(jpg|png)(\\?[^/]*)?$"),
            "$1.webp$3",
        )
    }

    private const val CACHE_MS = 30L * 24 * 60 * 60 * 1000
    private const val SUPER_HERO_CROP = "SHT.AMTPPS01"
    private const val LEGACY_KEY_TOKEN = "token"
    private const val LEGACY_KEY_TOKEN_UNTIL = "token-until"
    private const val KEY_TOKEN = "token_v2"
    private const val KEY_TOKEN_UNTIL = "token_until_v2"
    private const val TOKEN_MARGIN_MS = 24L * 60 * 60 * 1000
    private const val TOKEN_429_REFRESH_COOLDOWN_MS = 60_000L
    private const val HERO_W = 1400
    private const val HERO_H = 1867
    private const val LOGO_W = 900
    private const val LOGO_H = 276
    private const val COVER_PX = 1600
    private const val DETAIL_W = 1600
    private const val DETAIL_H = 2134
}

