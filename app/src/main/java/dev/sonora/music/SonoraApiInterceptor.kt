package dev.sonora.music

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceResponse
import com.metrolist.innertube.YouTube
import com.metrolist.innertube.models.AlbumItem
import com.metrolist.innertube.models.Artist
import com.metrolist.innertube.models.ArtistItem
import com.metrolist.innertube.models.BrowseEndpoint
import com.metrolist.innertube.models.PlaylistItem
import com.metrolist.innertube.models.SongItem
import com.metrolist.innertube.models.WatchEndpoint
import com.metrolist.innertube.models.YouTubeLocale
import com.metrolist.innertube.models.YTItem
import com.metrolist.innertube.pages.ArtistPage
import com.metrolist.innertube.pages.BrowseResult
import com.metrolist.innertube.pages.ChartsPage
import com.metrolist.innertube.pages.ExplorePage
import com.metrolist.innertube.pages.HomePage
import com.metrolist.innertube.pages.SearchResult
import dev.sonora.music.lyrics.LyricSearchHit
import dev.sonora.music.lyrics.LyricsLibrary
import dev.sonora.music.lyrics.LyricsQuery
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import java.net.URLDecoder
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.Cache
import okhttp3.Call
import okhttp3.Callback
import okhttp3.ConnectionPool
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject

object SonoraLocaleManager {
    private const val PREFS_NAME = "sonora_locale_prefs"
    private const val KEY_LANG = "lang"
    private const val KEY_COUNTRY = "country"
    private val ISO2_REGEX = Regex("^[A-Za-z]{2}$")
    private val lock = Any()

    @Volatile
    private var prefs: android.content.SharedPreferences? = null

    @Volatile
    var configuredLang: String = "auto"
        private set

    @Volatile
    var configuredCountry: String = "auto"
        private set

    @Volatile
    var resolvedLang: String = resolveLang("auto")
        private set

    @Volatile
    var resolvedCountry: String = resolveCountry("auto")
        private set

    fun attach(context: Context) {
        val appCtx = context.applicationContext ?: context
        synchronized(lock) {
            if (prefs == null) {
                prefs = appCtx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            }
            val p = prefs!!
            configuredLang = normalizeConfiguredLang(p.getString(KEY_LANG, "auto"))
            configuredCountry = normalizeConfiguredCountry(p.getString(KEY_COUNTRY, "auto"))
            resolvedLang = resolveLang(configuredLang)
            resolvedCountry = resolveCountry(configuredCountry)
            applyToClientsLocked()
        }
    }

    fun normalizeConfiguredLang(raw: String?): String {
        val t = raw?.trim()?.lowercase().orEmpty()
        return when {
            t.isEmpty() || t == "auto" -> "auto"
            t == "it" || t.startsWith("it-") || t.startsWith("it_") -> "it"
            else -> "en"
        }
    }

    fun normalizeConfiguredCountry(raw: String?): String {
        val t = raw?.trim()?.uppercase().orEmpty()
        return if (t.isEmpty() || t == "AUTO" || !ISO2_REGEX.matches(t)) "auto" else t
    }

    fun resolveLang(configured: String = configuredLang): String {
        return when (normalizeConfiguredLang(configured)) {
            "it" -> "it"
            "en" -> "en"
            else -> {
                val sys = java.util.Locale.getDefault().language.trim().lowercase()
                if (sys == "it" || sys.startsWith("it-") || sys.startsWith("it_")) "it" else "en"
            }
        }
    }

    fun resolveCountry(configured: String = configuredCountry): String {
        val norm = normalizeConfiguredCountry(configured)
        if (norm != "auto") return norm
        val sys = java.util.Locale.getDefault().country.trim().uppercase()
        return if (ISO2_REGEX.matches(sys)) sys else "US"
    }

    fun storefront(): String = resolvedCountry.lowercase()

    fun cacheTag(): String = "${resolvedCountry}_${resolvedLang}"

    fun youtubeLocale(): YouTubeLocale = YouTubeLocale(gl = resolvedCountry, hl = resolvedLang)

    fun effectiveRegionalYoutubeLocale(gl: String = resolvedCountry, hl: String = resolvedLang): YouTubeLocale {
        val cleanGl = normalizeConfiguredCountry(gl).let { if (it == "auto") resolveCountry("auto") else it }
        val cleanHl = hl.trim().lowercase().ifEmpty { "en" }
        val regionalHl = when (cleanGl) {
            "IT" -> "it"
            "FR" -> "fr"
            "DE", "AT" -> "de"
            "ES", "MX", "AR", "CO", "CL" -> "es"
            "BR", "PT" -> "pt"
            "JP" -> "ja"
            "KR" -> "ko"
            "NL" -> "nl"
            "SE" -> "sv"
            "PL" -> "pl"
            "TR" -> "tr"
            else -> "en"
        }
        return YouTubeLocale(gl = cleanGl, hl = regionalHl)
    }

    fun isExplicitForeignRegion(): Boolean {
        if (configuredCountry == "auto") return false
        val deviceCountry = java.util.Locale.getDefault().country.trim().uppercase()
        return !ISO2_REGEX.matches(deviceCountry) || !resolvedCountry.equals(deviceCountry, ignoreCase = true)
    }

    fun appleLanguageTag(lang: String = resolvedLang, country: String = resolvedCountry): String {
        if (lang == "it") return "it-IT"
        return when (country.uppercase()) {
            "GB" -> "en-GB"
            "AU" -> "en-AU"
            "CA" -> "en-CA"
            else -> "en-US"
        }
    }

    fun appleAcceptLanguage(lang: String = resolvedLang, country: String = resolvedCountry): String {
        val tag = appleLanguageTag(lang, country)
        return if (lang == "it") "$tag,it;q=0.9,en;q=0.8" else "$tag,en;q=0.9"
    }

    fun newPipeLocalization(): org.schabi.newpipe.extractor.localization.Localization =
        org.schabi.newpipe.extractor.localization.Localization(resolvedLang, resolvedCountry)

    fun newPipeContentCountry(): org.schabi.newpipe.extractor.localization.ContentCountry =
        org.schabi.newpipe.extractor.localization.ContentCountry(resolvedCountry)

    fun updateConfig(lang: String?, country: String?): Boolean {
        val changed: Boolean
        synchronized(lock) {
            val prevHl = resolvedLang
            val prevGl = resolvedCountry
            val nextLang = if (lang == null || lang.trim().isEmpty()) configuredLang else normalizeConfiguredLang(lang)
            val nextCountry = if (country == null || country.trim().isEmpty()) configuredCountry else normalizeConfiguredCountry(country)
            configuredLang = nextLang
            configuredCountry = nextCountry
            resolvedLang = resolveLang(nextLang)
            resolvedCountry = resolveCountry(nextCountry)
            prefs?.edit()
                ?.putString(KEY_LANG, nextLang)
                ?.putString(KEY_COUNTRY, nextCountry)
                ?.apply()
            changed = (prevHl != resolvedLang || prevGl != resolvedCountry)
            applyToClientsLocked()
        }
        if (changed) {
            notifyLocaleChanged()
        }
        return changed
    }

    fun syncSystemLocaleIfAuto(): Boolean {
        if (configuredLang != "auto" && configuredCountry != "auto") return false
        val changed: Boolean
        synchronized(lock) {
            val prevHl = resolvedLang
            val prevGl = resolvedCountry
            resolvedLang = resolveLang(configuredLang)
            resolvedCountry = resolveCountry(configuredCountry)
            changed = (prevHl != resolvedLang || prevGl != resolvedCountry)
            if (changed) {
                applyToClientsLocked()
            }
        }
        if (changed) {
            notifyLocaleChanged()
        }
        return changed
    }

    fun toJson(includeChanged: Boolean? = null): JSONObject = JSONObject().apply {
        put("lang", configuredLang)
        put("country", configuredCountry)
        put("resolvedLang", resolvedLang)
        put("resolvedCountry", resolvedCountry)
        put("storefront", storefront())
        if (includeChanged != null) {
            put("changed", includeChanged)
        }
    }

    fun getString(context: Context, resId: Int): String {
        val targetLocale = if (resolvedLang == "it") java.util.Locale.ITALIAN else java.util.Locale.ENGLISH
        val cfg = android.content.res.Configuration(context.resources.configuration)
        cfg.setLocale(targetLocale)
        return runCatching {
            context.createConfigurationContext(cfg).resources.getString(resId)
        }.getOrElse {
            context.getString(resId)
        }
    }

    private fun applyToClientsLocked() {
        YouTube.locale = YouTubeLocale(gl = resolvedCountry, hl = resolvedLang)
        SonoraAudioResolver.updateNewPipeLocale(resolvedLang, resolvedCountry)
    }

    private fun notifyLocaleChanged() {
        YouTube.visitorData = null
        ApiCache.clear()
        HomeSubCache.clearLocaleContent()
        SonoraApiInterceptor.onLocaleChanged()
        AppleCatalog.clearMemoryCache()
        SonoraPlaybackService.instance?.onLocaleUpdated()
    }
}

object ApiCache {
    private data class Entry(val expiry: Long, val data: String)
    private const val MAX_ENTRIES = 500
    private val cache = ConcurrentHashMap<String, Entry>()

    fun get(key: String): String? {
        val entry = cache[key] ?: return null
        if (System.currentTimeMillis() > entry.expiry) {
            cache.remove(key, entry)
            return null
        }
        return entry.data
    }

    fun put(key: String, data: String, ttlSeconds: Long) {
        if (ttlSeconds <= 0L) {
            cache.remove(key)
            return
        }
        val now = System.currentTimeMillis()
        if (!cache.containsKey(key) && cache.size >= MAX_ENTRIES) {
            cache.entries.forEach { (k, v) ->
                if (v.expiry <= now) cache.remove(k, v)
            }
            while (cache.size >= MAX_ENTRIES) {
                val oldest = cache.entries.minByOrNull { it.value.expiry } ?: break
                cache.remove(oldest.key, oldest.value)
            }
        }
        cache[key] = Entry(now + ttlSeconds * 1000L, data)
    }

    fun clear() {
        cache.clear()
    }
}

object HomeSubCache {
    data class StorefrontFeed(val songs: List<SongItem>, val albums: List<AlbumItem>)
    private data class Entry<T>(val expiry: Long, val value: T)
    private val cachedHome = ConcurrentHashMap<String, Entry<HomePage>>()
    private val cachedExplore = ConcurrentHashMap<String, Entry<ExplorePage>>()
    private val cachedHits = ConcurrentHashMap<String, Entry<SearchResult>>()
    private val cachedCharts = ConcurrentHashMap<String, Entry<ChartsPage>>()
    private val cachedNewReleases = ConcurrentHashMap<String, Entry<BrowseResult>>()
    private val cachedStorefront = ConcurrentHashMap<String, Entry<StorefrontFeed>>()
    private val artistCache = ConcurrentHashMap<String, Entry<ArtistPage>>()
    private val artistThumbCache = ConcurrentHashMap<String, Entry<String>>()
    private val albumThumbCache = ConcurrentHashMap<String, Entry<String>>()

    fun getStorefront(gl: String = SonoraLocaleManager.resolvedCountry): StorefrontFeed? {
        val k = gl.trim().uppercase()
        val e = cachedStorefront[k] ?: return null
        if (System.currentTimeMillis() > e.expiry) {
            cachedStorefront.remove(k, e)
            return null
        }
        return e.value
    }

    fun putStorefront(feed: StorefrontFeed, ttlSeconds: Long = 1800, gl: String = SonoraLocaleManager.resolvedCountry) {
        cachedStorefront[gl.trim().uppercase()] = Entry(System.currentTimeMillis() + ttlSeconds * 1000L, feed)
    }

    fun clearLocaleKey(locKey: String, gl: String) {
        cachedHome.remove(locKey)
        cachedExplore.remove(locKey)
        cachedHits.remove(locKey)
        cachedCharts.remove(locKey)
        cachedNewReleases.remove(locKey)
        cachedStorefront.remove(gl.trim().uppercase())
    }

    fun getHome(locKey: String = SonoraLocaleManager.cacheTag()): HomePage? {
        val e = cachedHome[locKey] ?: return null
        if (System.currentTimeMillis() > e.expiry) {
            cachedHome.remove(locKey, e)
            return null
        }
        return e.value
    }

    fun putHome(res: HomePage, ttlSeconds: Long = 600, locKey: String = SonoraLocaleManager.cacheTag()) {
        cachedHome[locKey] = Entry(System.currentTimeMillis() + ttlSeconds * 1000L, res)
    }

    fun getExplore(locKey: String = SonoraLocaleManager.cacheTag()): ExplorePage? {
        val e = cachedExplore[locKey] ?: return null
        if (System.currentTimeMillis() > e.expiry) {
            cachedExplore.remove(locKey, e)
            return null
        }
        return e.value
    }

    fun putExplore(res: ExplorePage, ttlSeconds: Long = 900, locKey: String = SonoraLocaleManager.cacheTag()) {
        cachedExplore[locKey] = Entry(System.currentTimeMillis() + ttlSeconds * 1000L, res)
    }

    fun getHits(locKey: String = SonoraLocaleManager.cacheTag()): SearchResult? {
        val e = cachedHits[locKey] ?: return null
        if (System.currentTimeMillis() > e.expiry) {
            cachedHits.remove(locKey, e)
            return null
        }
        return e.value
    }

    fun putHits(res: SearchResult, ttlSeconds: Long = 1800, locKey: String = SonoraLocaleManager.cacheTag()) {
        cachedHits[locKey] = Entry(System.currentTimeMillis() + ttlSeconds * 1000L, res)
    }

    fun getCharts(locKey: String = SonoraLocaleManager.cacheTag()): ChartsPage? {
        val e = cachedCharts[locKey] ?: return null
        if (System.currentTimeMillis() > e.expiry) {
            cachedCharts.remove(locKey, e)
            return null
        }
        return e.value
    }

    fun putCharts(res: ChartsPage, ttlSeconds: Long = 1800, locKey: String = SonoraLocaleManager.cacheTag()) {
        cachedCharts[locKey] = Entry(System.currentTimeMillis() + ttlSeconds * 1000L, res)
    }

    fun getNewReleases(locKey: String = SonoraLocaleManager.cacheTag()): BrowseResult? {
        val e = cachedNewReleases[locKey] ?: return null
        if (System.currentTimeMillis() > e.expiry) {
            cachedNewReleases.remove(locKey, e)
            return null
        }
        return e.value
    }

    fun putNewReleases(res: BrowseResult, ttlSeconds: Long = 1800, locKey: String = SonoraLocaleManager.cacheTag()) {
        cachedNewReleases[locKey] = Entry(System.currentTimeMillis() + ttlSeconds * 1000L, res)
    }

    private const val MAX_ARTISTS = 200
    private const val MAX_ARTIST_THUMBS = 400
    private const val MAX_ALBUM_THUMBS = 600

    fun getArtistThumb(name: String): String? {
        val key = name.trim().lowercase()
        if (key.isEmpty()) return null
        val e = artistThumbCache[key] ?: return null
        if (System.currentTimeMillis() > e.expiry) {
            artistThumbCache.remove(key, e)
            return null
        }
        return e.value
    }

    fun putArtistThumb(name: String, url: String, ttlSeconds: Long = 86_400) {
        val key = name.trim().lowercase()
        if (key.isEmpty() || url.isBlank()) return
        val now = System.currentTimeMillis()
        if (!artistThumbCache.containsKey(key) && artistThumbCache.size >= MAX_ARTIST_THUMBS) {
            artistThumbCache.entries.forEach { (k, v) ->
                if (v.expiry <= now) artistThumbCache.remove(k, v)
            }
            while (artistThumbCache.size >= MAX_ARTIST_THUMBS) {
                val oldest = artistThumbCache.entries.minByOrNull { it.value.expiry } ?: break
                artistThumbCache.remove(oldest.key, oldest.value)
            }
        }
        artistThumbCache[key] = Entry(now + ttlSeconds * 1000L, url)
    }

    fun getAlbumThumb(key: String): String? {
        val norm = key.trim().lowercase()
        if (norm.isEmpty()) return null
        val e = albumThumbCache[norm] ?: return null
        if (System.currentTimeMillis() > e.expiry) {
            albumThumbCache.remove(norm, e)
            return null
        }
        return e.value
    }

    fun putAlbumThumb(key: String, url: String, ttlSeconds: Long = 86_400) {
        val norm = key.trim().lowercase()
        if (norm.isEmpty() || url.isBlank()) return
        val now = System.currentTimeMillis()
        if (!albumThumbCache.containsKey(norm) && albumThumbCache.size >= MAX_ALBUM_THUMBS) {
            albumThumbCache.entries.forEach { (k, v) ->
                if (v.expiry <= now) albumThumbCache.remove(k, v)
            }
            while (albumThumbCache.size >= MAX_ALBUM_THUMBS) {
                val oldest = albumThumbCache.entries.minByOrNull { it.value.expiry } ?: break
                albumThumbCache.remove(oldest.key, oldest.value)
            }
        }
        albumThumbCache[norm] = Entry(now + ttlSeconds * 1000L, url)
    }

    fun getArtist(aid: String, locKey: String = SonoraLocaleManager.cacheTag()): ArtistPage? {
        val k = "$locKey:$aid"
        val e = artistCache[k] ?: return null
        if (System.currentTimeMillis() > e.expiry) {
            artistCache.remove(k, e)
            return null
        }
        return e.value
    }

    fun putArtist(aid: String, res: ArtistPage, ttlSeconds: Long = 1800, locKey: String = SonoraLocaleManager.cacheTag()) {
        val k = "$locKey:$aid"
        if (ttlSeconds <= 0L) {
            artistCache.remove(k)
            return
        }
        val now = System.currentTimeMillis()
        if (!artistCache.containsKey(k) && artistCache.size >= MAX_ARTISTS) {
            artistCache.entries.forEach { (key, v) ->
                if (v.expiry <= now) artistCache.remove(key, v)
            }
            while (artistCache.size >= MAX_ARTISTS) {
                val oldest = artistCache.entries.minByOrNull { it.value.expiry } ?: break
                artistCache.remove(oldest.key, oldest.value)
            }
        }
        artistCache[k] = Entry(now + ttlSeconds * 1000L, res)
    }

    fun clearLocaleContent() {
        cachedHome.clear()
        cachedExplore.clear()
        cachedHits.clear()
        cachedCharts.clear()
        cachedNewReleases.clear()
        cachedStorefront.clear()
        artistCache.clear()
    }

    fun clear() {
        clearLocaleContent()
        artistThumbCache.clear()
        albumThumbCache.clear()
    }
}

internal object SonoraHttpPool {
    val connectionPool = ConnectionPool(24, 5, TimeUnit.MINUTES)
    val dispatcher = okhttp3.Dispatcher().apply {
        maxRequests = 64
        maxRequestsPerHost = 16
    }
}

object SnapshotDiskCache {
    private const val PREFIX = "it_v5_"
    private const val MAX_STALE_MS = 7L * 24 * 60 * 60 * 1000L

    data class Snapshot(val data: String, val isFresh: Boolean)

    @Volatile
    private var dir: File? = null
    private val inFlight = ConcurrentHashMap<String, Boolean>()
    private val bgScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun attach(context: Context) {
        val target = File(context.cacheDir, "sonora_api_snapshots")
        dir = target
        bgScope.launch {
            runCatching { target.mkdirs() }
        }
    }

    private fun fileFor(key: String): File? {
        val base = dir ?: return null
        val safe = if (key.length <= 48 && key.all { it.isLetterOrDigit() || it == '_' || it == '-' }) {
            key
        } else {
            val digest = java.security.MessageDigest.getInstance("SHA-256")
                .digest(key.toByteArray(Charsets.UTF_8))
                .take(12)
                .joinToString("") { "%02x".format(it) }
            "${key.take(20).replace(Regex("[^A-Za-z0-9_-]"), "_")}_$digest"
        }
        return File(base, "$PREFIX$safe.snap")
    }

    fun get(key: String, freshTtlMs: Long): Snapshot? {
        val file = fileFor(key) ?: return null
        if (!file.exists()) return null
        return runCatching {
            val raw = file.readText(Charsets.UTF_8)
            val nl = raw.indexOf('\n')
            if (nl <= 0) return@runCatching null
            val writtenMs = raw.substring(0, nl).toLongOrNull() ?: return@runCatching null
            val age = System.currentTimeMillis() - writtenMs
            if (age < 0L || age > MAX_STALE_MS) {
                file.delete()
                return@runCatching null
            }
            val payload = raw.substring(nl + 1)
            if (payload.isBlank()) return@runCatching null
            Snapshot(payload, isFresh = age < freshTtlMs)
        }.getOrNull()
    }

    fun put(key: String, data: String) {
        val file = fileFor(key) ?: return
        runCatching {
            file.parentFile?.mkdirs()
            val tmp = File(file.parentFile, "${file.name}.tmp")
            tmp.writeText("${System.currentTimeMillis()}\n$data", Charsets.UTF_8)
            if (!tmp.renameTo(file)) {
                file.writeText("${System.currentTimeMillis()}\n$data", Charsets.UTF_8)
                tmp.delete()
            }
        }
    }

    fun putAsync(key: String, data: String) {
        bgScope.launch {
            put(key, data)
        }
    }

    fun revalidate(key: String, block: suspend () -> Unit) {
        if (inFlight.putIfAbsent(key, true) != null) return
        bgScope.launch {
            try {
                block()
            } finally {
                inFlight.remove(key)
            }
        }
    }

    fun sizeBytes(): Long {
        val base = dir ?: return 0L
        if (!base.exists()) return 0L
        return base.listFiles()?.sumOf { if (it.isFile) it.length() else 0L } ?: 0L
    }

    fun clear() {
        inFlight.clear()
        val base = dir ?: return
        runCatching {
            base.listFiles()?.forEach { it.delete() }
        }
    }
}

object CoverCache {
    class CachedCover(val mime: String, val bytes: ByteArray)
    private const val MAX_ENTRIES = 350
    private const val MAX_BYTES = 24L * 1024L * 1024L
    private const val MAX_ALIASES = 500
    private val map = LinkedHashMap<String, CachedCover>(64, 0.75f, true)
    private val aliases = LinkedHashMap<String, String>(64, 0.75f, true)
    private var currentBytes = 0L

    @Synchronized
    fun get(url: String): CachedCover? {
        map[url]?.let { return it }
        val target = aliases[url] ?: return null
        return map[target] ?: run {
            aliases.remove(url)
            null
        }
    }

    @Synchronized
    fun put(url: String, mime: String, bytes: ByteArray, aliasUrl: String? = null) {
        val size = bytes.size.toLong()
        if (size <= MAX_BYTES) {
            map.remove(url)?.let { currentBytes -= it.bytes.size.toLong() }
            map[url] = CachedCover(mime, bytes)
            currentBytes += size
            val it = map.entries.iterator()
            while (it.hasNext() && (map.size > MAX_ENTRIES || currentBytes > MAX_BYTES)) {
                val eldest = it.next()
                currentBytes -= eldest.value.bytes.size.toLong()
                it.remove()
            }
        }
        if (!aliasUrl.isNullOrBlank() && aliasUrl != url) {
            aliases[aliasUrl] = url
            val ait = aliases.entries.iterator()
            while (ait.hasNext() && aliases.size > MAX_ALIASES) {
                ait.next()
                ait.remove()
            }
        }
    }

    @Synchronized
    fun count(): Int = map.size

    @Synchronized
    fun totalBytes(): Long = currentBytes

    @Synchronized
    fun clear() {
        map.clear()
        aliases.clear()
        currentBytes = 0L
    }
}

private object CoverDiskCache {
    class DiskCover(val mime: String, val bytes: ByteArray)
    private const val MAX_STALE_MS = 14L * 24 * 60 * 60 * 1000L
    @Volatile
    private var dir: File? = null
    private val writeScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun attach(cacheRootDir: File?) {
        val base = cacheRootDir ?: return
        val target = File(base, "sonora_covers_v1")
        dir = target
        writeScope.launch {
            runCatching { target.mkdirs() }
        }
    }

    fun keyFor(id: String, url: String, size: Int): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest("$id:$url:$size".toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    fun get(cacheKey: String): DiskCover? {
        val base = dir ?: return null
        val file = File(base, "$cacheKey.cov")
        if (!file.exists()) return null
        return runCatching {
            val age = System.currentTimeMillis() - file.lastModified()
            if (age < 0L || age > MAX_STALE_MS) {
                file.delete()
                return@runCatching null
            }
            val totalLen = file.length()
            if (totalLen <= 2L || totalLen > 16L * 1024L * 1024L) return@runCatching null
            java.io.FileInputStream(file).use { fis ->
                val hdr = ByteArray(minOf(64, totalLen.toInt()))
                var hdrRead = 0
                while (hdrRead < hdr.size) {
                    val n = fis.read(hdr, hdrRead, hdr.size - hdrRead)
                    if (n <= 0) break
                    hdrRead += n
                }
                var nl = -1
                for (i in 0 until hdrRead) {
                    if (hdr[i] == '\n'.code.toByte()) {
                        nl = i
                        break
                    }
                }
                if (nl <= 0 || nl >= totalLen - 1) return@runCatching null
                val mime = String(hdr, 0, nl, Charsets.UTF_8).trim().ifBlank { "image/jpeg" }
                val bodySize = (totalLen - (nl + 1)).toInt()
                val body = ByteArray(bodySize)
                val leftover = hdrRead - (nl + 1)
                if (leftover > 0) {
                    System.arraycopy(hdr, nl + 1, body, 0, leftover)
                }
                var pos = leftover
                while (pos < bodySize) {
                    val n = fis.read(body, pos, bodySize - pos)
                    if (n <= 0) break
                    pos += n
                }
                if (pos != bodySize) return@runCatching null
                DiskCover(mime, body)
            }
        }.getOrNull()
    }

    fun putAsync(cacheKey: String, mime: String, bytes: ByteArray) {
        if (bytes.isEmpty()) return
        val base = dir ?: return
        val cleanMime = mime.trim().ifBlank { "image/jpeg" }
        writeScope.launch {
            runCatching {
                base.mkdirs()
                val header = "$cleanMime\n".toByteArray(Charsets.UTF_8)
                val out = ByteArray(header.size + bytes.size)
                System.arraycopy(header, 0, out, 0, header.size)
                System.arraycopy(bytes, 0, out, header.size, bytes.size)
                val file = File(base, "$cacheKey.cov")
                val tmp = File(base, "$cacheKey.${Thread.currentThread().id}.tmp")
                tmp.writeBytes(out)
                if (!tmp.renameTo(file)) {
                    file.writeBytes(out)
                    tmp.delete()
                }
            }
        }
    }

    fun sizeBytes(): Long {
        val base = dir ?: return 0L
        if (!base.exists()) return 0L
        return base.listFiles()?.sumOf { if (it.isFile) it.length() else 0L } ?: 0L
    }

    fun clear() {
        val base = dir ?: return
        runCatching {
            base.listFiles()?.forEach { it.delete() }
        }
    }
}

object SonoraApiInterceptor {

    init {
        YouTube.locale = SonoraLocaleManager.youtubeLocale()
        YouTube.sharedConnectionPool = SonoraHttpPool.connectionPool
        YouTube.sharedDispatcher = SonoraHttpPool.dispatcher
    }

    @Volatile
    private var okHttp: OkHttpClient = OkHttpClient.Builder()
        .connectionPool(SonoraHttpPool.connectionPool)
        .dispatcher(SonoraHttpPool.dispatcher)
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    @Volatile
    private var httpCacheDir: File? = null

    @Volatile
    private var appContext: Context? = null

    private val attachScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun attach(context: Context) {
        val appCtx = context.applicationContext ?: context
        appContext = appCtx
        SonoraLocaleManager.attach(appCtx)
        SnapshotDiskCache.attach(appCtx)
        CoverDiskCache.attach(appCtx.cacheDir)
        try {
            val cacheDir = File(appCtx.cacheDir, "sonora_http_cache")
            httpCacheDir = cacheDir
            val cache = Cache(cacheDir, 64L * 1024L * 1024L)
            okHttp = OkHttpClient.Builder()
                .connectionPool(SonoraHttpPool.connectionPool)
                .dispatcher(SonoraHttpPool.dispatcher)
                .connectTimeout(12, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .cache(cache)
                .build()
        } catch (e: Exception) {
            android.util.Log.w("SonoraApi", "Failed to attach disk cache: ${e.message}")
        }
    }

    internal fun onLocaleChanged() {
        PlaylistSeedCache.clear()
        homeWarmScheduled.set(false)
    }

    private fun dirSize(dir: File?): Long {
        if (dir == null || !dir.exists()) return 0L
        var sum = 0L
        dir.walkTopDown().forEach { if (it.isFile) sum += it.length() }
        return sum
    }

    fun getCoverAndHttpCacheBytes(): Long {
        val httpBytes = runCatching { okHttp.cache?.size() }.getOrNull() ?: dirSize(httpCacheDir)
        return CoverCache.totalBytes() + CoverDiskCache.sizeBytes() + httpBytes + SnapshotDiskCache.sizeBytes()
    }

    fun clearCaches() {
        YouTube.visitorData = null
        ApiCache.clear()
        HomeSubCache.clear()
        PlaylistSeedCache.clear()
        AppleCatalog.clearMemoryCache()
        homeWarmScheduled.set(false)
        CoverCache.clear()
        CoverDiskCache.clear()
        SnapshotDiskCache.clear()
        LyricsLibrary.clearCache()
        canonicalSongMetaCache.clear()
        canonicalSongMissUntil.clear()
        runCatching {
            okHttp.cache?.evictAll()
        }
    }

    private val NON_LATIN_SCRIPT_REGEX = Regex(
        """[\p{InCyrillic}\p{InArabic}\p{InHebrew}\p{InDevanagari}\p{InThai}\p{InKhmer}\p{IsHan}\p{IsHiragana}\p{IsKatakana}\p{IsHangul}]"""
    )
    private val JP_ALLOWED_SCRIPT_REGEX = Regex("""[\p{IsHan}\p{IsHiragana}\p{IsKatakana}]""")
    private val KR_ALLOWED_SCRIPT_REGEX = Regex("""[\p{IsHan}\p{IsHangul}]""")
    private val CYRILLIC_REGEX = Regex("""\p{InCyrillic}""")
    private val ARABIC_REGEX = Regex("""\p{InArabic}""")
    private val HEBREW_REGEX = Regex("""\p{InHebrew}""")
    private val DEVANAGARI_REGEX = Regex("""\p{InDevanagari}""")
    private val THAI_REGEX = Regex("""\p{InThai}""")
    private val ROMANIAN_DIACRITICS_REGEX = Regex("""[\u0102\u0103\u0218\u0219\u021A\u021B\u015E\u015F\u0162\u0163]""")
    private val COMBINING_MARKS_REGEX = Regex("""\p{InCombiningDiacriticalMarks}+""")

    private val SPAM_REGIONAL_TERMS = listOf(
        "tzanca", "uraganu", "manele", "manelele", "nicolae guta", "dani mocanu",
        "florin salam", "bogdan dlp", "bogdan de la", "costel biju", "culita sterp",
        "jador", "babi minune", "luis gabriel", "dragos clt", "zeno music",
        "cand ai bani", "portofel", "portofelos", "ingerul meu", "vieti imaginare",
        "omul cu zambet", "norocu", "ramy sabry", "elissa", "umu obiligbo"
    )

    private val AI_STOCK_SPAM_TERMS = listOf(
        "deep house", "house bar", "house italiano", "country west music", "dj mix",
        "dj b-supreme", "velvet voice", "harmony sessions", "piano doodles", "kimo sounds",
        "riviera vintage", "rebel riddim", "ragal ironbull", "let babylon burn",
        "sleep music", "relaxing music", "study music", "white noise", "meditation",
        "karaoke", "tribute", "8d audio", "nightcore", "parodia", "artisti vari", "various artists"
    )

    private val ITALIAN_POPULAR_ARTISTS = setOf(
        "geolier", "lazza", "marracash", "luche", "sfera ebbasta", "shiva", "kid yugi",
        "tony effe", "capo plaza", "tedua", "artie 5ive", "anna", "olly", "blanco",
        "mahmood", "tananai", "irama", "ultimo", "cesare cremonini", "malika ayane",
        "claudio baglioni", "moda", "gianna nannini", "pinguini tattici nucleari",
        "maneskin", "annalisa", "elodie", "angelina mango", "rose villain", "alfa",
        "ghali", "bresh", "coez", "frah quintale", "gue", "fabri fibra", "salmo",
        "noyz narcos", "ernia", "rkomi", "rocco hunt", "clementino", "mv killa",
        "22simba", "promessa", "shablo", "francesca michielin", "giorgia",
        "marco mengoni", "vasco rossi", "ligabue", "jovanotti", "tiziano ferro",
        "laura pausini", "eros ramazzotti", "calcutta", "liberato", "achille lauro",
        "sangiovanni", "vinicio capossela", "max pezzali", "883", "ornella vanoni",
        "lucio dalla"
    )

    private val GLOBAL_POPULAR_ARTISTS = setOf(
        "eminem", "u2", "the weeknd", "taylor swift", "billie eilish",
        "drake", "travis scott", "kendrick lamar", "bad bunny", "karol g", "dua lipa",
        "coldplay", "linkin park", "lady gaga", "bruno mars", "ariana grande",
        "post malone", "sabrina carpenter", "olivia rodrigo", "olivia dean",
        "fontaines d c", "bob dylan", "david kushner", "nicky jam", "offset",
        "future", "metro boomin", "sza", "charli xcx", "lana del rey",
        "arctic monkeys", "imagine dragons", "ed sheeran", "rihanna", "kanye west",
        "ateez", "kings of leon", "steven wilson", "joe hisaishi", "sdm", "lara fabian",
        "morgan wallen", "lil baby", "tate mcrae", "ella langley", "hozier"
    )

    internal fun isPopularArtistForCountry(normalizedName: String, gl: String = SonoraLocaleManager.resolvedCountry): Boolean {
        if (normalizedName in GLOBAL_POPULAR_ARTISTS) return true
        return gl.equals("IT", ignoreCase = true) && normalizedName in ITALIAN_POPULAR_ARTISTS
    }

    private val COUNTRY_CHART_LABEL_TOKENS: List<Pair<String, List<String>>> = listOf(
        "IT" to listOf("italia", "italy", "italian"),
        "US" to listOf("united states", "stati uniti", "usa"),
        "GB" to listOf("united kingdom", "regno unito"),
        "FR" to listOf("france", "francia"),
        "DE" to listOf("germany", "germania", "deutschland"),
        "ES" to listOf("spain", "spagna", "espana"),
        "JP" to listOf("japan", "giappone"),
        "BR" to listOf("brazil", "brasile", "brasil")
    )

    internal fun isMismatchedCountryPlaylist(title: String, gl: String): Boolean {
        val low = title.trim().lowercase()
        if (low.isEmpty()) return false
        val upperGl = gl.trim().uppercase()
        for ((code, tokens) in COUNTRY_CHART_LABEL_TOKENS) {
            if (code == upperGl) continue
            if (tokens.any { tok -> Regex("""\b${Regex.escape(tok)}\b""").containsMatchIn(low) }) {
                return true
            }
        }
        return false
    }

    private fun stripDiacriticsLower(s: String): String {
        val nfd = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
        return nfd.replace(COMBINING_MARKS_REGEX, "").lowercase()
    }

    private fun shouldBlockForeignScriptForCountry(rawText: String, gl: String): Boolean {
        val stripped = when (gl) {
            "JP", "TW", "HK", "CN" -> rawText.replace(JP_ALLOWED_SCRIPT_REGEX, "")
            "KR" -> rawText.replace(KR_ALLOWED_SCRIPT_REGEX, "")
            "RU", "UA", "BG", "RS", "BY" -> rawText.replace(CYRILLIC_REGEX, "")
            "EG", "SA", "AE", "MA", "DZ", "TN", "LB", "JO" -> rawText.replace(ARABIC_REGEX, "")
            "IL" -> rawText.replace(HEBREW_REGEX, "")
            "IN" -> rawText.replace(DEVANAGARI_REGEX, "")
            "TH" -> rawText.replace(THAI_REGEX, "")
            else -> rawText
        }
        if (NON_LATIN_SCRIPT_REGEX.containsMatchIn(stripped)) return true
        if (gl != "RO" && gl != "MD" && ROMANIAN_DIACRITICS_REGEX.containsMatchIn(rawText)) return true
        return false
    }

    private fun hasBlockedScriptOrSpam(rawText: String, queryLower: String = ""): Boolean {
        if (queryLower.isEmpty()) {
            if (shouldBlockForeignScriptForCountry(rawText, SonoraLocaleManager.resolvedCountry)) return true
        }
        val asciiLow = stripDiacriticsLower(rawText)
        val qAscii = if (queryLower.isEmpty()) "" else stripDiacriticsLower(queryLower)
        return SPAM_REGIONAL_TERMS.any { it in asciiLow && (qAscii.isEmpty() || it !in qAscii) } ||
            AI_STOCK_SPAM_TERMS.any { it in asciiLow && (qAscii.isEmpty() || it !in qAscii) }
    }

    internal fun shouldFilterReleaseAlbum(album: AlbumItem): Boolean {
        val validArtists = cleanArtistsList(album.artists)
        if (validArtists.isEmpty()) return true
        if ('|' in album.title) return true
        val combined = "${album.title} ${validArtists.joinToString(" ") { it.name }}"
        return hasBlockedScriptOrSpam(combined)
    }

    private fun shouldFilterTrack(item: SongItem, query: String = ""): Boolean {
        val titleLow = item.title.lowercase()
        val qLow = query.lowercase()
        val badTerms = if (qLow.isNotBlank()) {
            listOf("karaoke", "tribute", "cover", "8d", "nightcore", "parodia")
        } else {
            listOf("karaoke", "tribute", "8d audio", "nightcore", "parodia", "(cover)", "[cover]", "cover version")
        }
        if (badTerms.any { it in titleLow && (qLow.isEmpty() || it !in qLow) }) return true
        val validArtists = cleanArtistsList(item.artists)
        val combined = "${item.title} ${validArtists.joinToString(" ") { it.name }}"
        return hasBlockedScriptOrSpam(combined, qLow)
    }

    private val NOISY_VIDEO_REGEX = Regex(
        """\b(official\s*(?:music\s*)?video|music\s*video|video\s*ufficiale|videoclip|performance\s*video|lyric\s*video|visual\s*video|official\s*visual(?:izer|iser)?|visualizer|visualiser|short\s*film|making\s*of|behind\s*the\s*scenes|full\s*album\s*stream)\b""",
        RegexOption.IGNORE_CASE
    )
    private val WORD_VIDEO_REGEX = Regex("""\bvideo\b""", RegexOption.IGNORE_CASE)

    internal fun isFeedVideoTrack(item: SongItem): Boolean =
        item.isVideoSong || isNoisyVideoTitle(item.title)
    private val COMPILATION_ALBUM_REGEX = Regex(
        """\b(mi\s+manchi|rap\s+italiano|hit\s+mania|hits|top\s+hits|top\s+\d+|greatest\s+hits|super\s+hits|classic\s+hits|all\s+time\s+hits|chart\s+hits|number\s+ones|compilation|best\s+of|the\s+(?:very\s+)?best(?:\s+of)?|anthology|antologia|raccolta|collezione|(?:gold|platinum|ultimate|definitive|complete|singles)\s+collection|essentials|le\s+pi[uù]\s+belle|i\s+grandi\s+successi|grandi\s+successi|tutti\s+i\s+successi|i\s+miei\s+successi|tutte\s+le\s+canzoni|il\s+meglio(?:\s+di)?|artisti\s+vari|various\s+artists|aa\.?\s*vv\.?|estate\s+\d*|summer\s+hits|mix\s+\d*|mega\s+mix|party\s+hits|workout|chill\s+hits|love\s+songs|canzoni\s+d'amore|100%\s+|successi|classifica|sanremo\s+\d*|festivalbar|power\s+hits|radio\s+italia|anni\s+(?:60|70|80|90|2000)|radio\s+hits|italia\s+hits|italian\s+hits|musica\s+italiana|canzoni\s+italiane|colonna\s+sonora|soundtrack|motion\s+picture|original\s+score)\b""",
        RegexOption.IGNORE_CASE
    )
    private val VARIOUS_COLLECTION_ARTIST_REGEX = Regex(
        """\b(various\s+artists?|artisti\s+vari|aa\.?\s*vv\.?|v\.?\s*a\.?|interpreti\s+vari|autori\s+vari|multiple\s+artists?|compilation)\b""",
        RegexOption.IGNORE_CASE
    )
    private val REISSUE_ALBUM_REGEX = Regex(
        """\b(deluxe|expanded|special\s+edition|anniversary|remaster(?:ed)?|reissue|super\s+deluxe|collector'?s?\s+edition|bonus\s+track|legacy\s+edition|platinum\s+edition|gold\s+edition)\b""",
        RegexOption.IGNORE_CASE
    )
    private val TRACK_VARIANT_TAG_REGEX = Regex(
        """\b(live|dal\s+vivo|unplugged|acoustic|acustic[oa]?|remix|rmx|club\s+mix|extended\s+mix|dub\s+mix|instrumental|strumentale|demo|sped\s+up|slowed|nuova\s+versione|orchestral)\b""",
        RegexOption.IGNORE_CASE
    )
    private val SOUNDTRACK_HINT_REGEX = Regex(
        """\b(soundtrack|colonna\s+sonora|motion\s+picture|original\s+score|ost|film|movie)\b""",
        RegexOption.IGNORE_CASE
    )
    private val RELEASE_DATE_PREFIX_REGEX = Regex("""^(\d{4})-(\d{2})-(\d{2})""")
    private val SINGLE_OR_EP_SUFFIX_REGEX = Regex("""\s*-\s*(?:Single|EP)\s*$""", RegexOption.IGNORE_CASE)
    private val COLLAPSE_WS_REGEX = Regex("""\s+""")

    internal fun parseReleaseDayNum(raw: String?): Int? {
        val trimmed = raw?.trim() ?: return null
        val m = RELEASE_DATE_PREFIX_REGEX.find(trimmed) ?: return null
        val year = m.groupValues[1].toIntOrNull() ?: return null
        val month = m.groupValues[2].toIntOrNull() ?: return null
        val day = m.groupValues[3].toIntOrNull() ?: return null
        if (year !in 1900..2100 || month !in 1..12 || day !in 1..31) return null
        val y = if (month <= 2) year - 1 else year
        val era = (if (y >= 0) y else y - 399) / 400
        val yoe = y - era * 400
        val mAdj = month + (if (month > 2) -3 else 9)
        val doy = (153 * mAdj + 2) / 5 + day - 1
        val doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146097 + doe - 719468
    }

    internal fun isReissueAlbumTitle(title: String?): Boolean =
        !title.isNullOrBlank() && REISSUE_ALBUM_REGEX.containsMatchIn(title)

    internal fun hasSoundtrackHint(title: String, album: String): Boolean =
        SOUNDTRACK_HINT_REGEX.containsMatchIn(title) || SOUNDTRACK_HINT_REGEX.containsMatchIn(album)

    internal fun isUnrequestedTrackVariant(candidateTrackName: String, targetTrackName: String): Boolean {
        val targetLow = targetTrackName.lowercase()
        return TRACK_VARIANT_TAG_REGEX.findAll(candidateTrackName).any { m ->
            val tag = m.value.trim().lowercase().replace(COLLAPSE_WS_REGEX, " ")
            tag.isNotEmpty() && tag !in targetLow
        }
    }

    internal fun isRequestedTrackVariantMatch(candidateTrackName: String, targetTrackName: String): Boolean {
        val targetLow = targetTrackName.lowercase()
        val candLow = candidateTrackName.lowercase()
        return TRACK_VARIANT_TAG_REGEX.findAll(targetLow).any { m ->
            val tag = m.value.trim().lowercase().replace(COLLAPSE_WS_REGEX, " ")
            tag.isNotEmpty() && tag in candLow
        }
    }

    private fun primaryArtistName(item: SongItem): String =
        cleanArtistsList(item.artists).firstOrNull()?.name
            ?: item.artists.firstOrNull()?.name.orEmpty()

    internal fun isLikelyCompilationAlbum(
        albumName: String?,
        songTitle: String = "",
        artistName: String = "",
    ): Boolean {
        val alb = albumName?.trim().orEmpty()
        if (alb.isEmpty()) return false
        val albCore = normTitleCore(alb)
        val titleCore = if (songTitle.isNotBlank()) normTitleCore(songTitle) else ""
        if (titleCore.isNotEmpty() && albCore == titleCore) return false
        val albNorm = alb.replace('\u2019', '\'')
        val titleNorm = songTitle.lowercase().replace('\u2019', '\'').replace(COLLAPSE_WS_REGEX, " ")
        val artistNorm = artistName.lowercase().replace('\u2019', '\'').replace(COLLAPSE_WS_REGEX, " ")
        return COMPILATION_ALBUM_REGEX.findAll(albNorm).any { match ->
            val kw = match.value.trim().lowercase().replace(COLLAPSE_WS_REGEX, " ")
            kw.isNotEmpty() && kw !in titleNorm && kw !in artistNorm
        }
    }

    internal fun isNoisyVideoTitle(title: String, query: String = ""): Boolean {
        if (!NOISY_VIDEO_REGEX.containsMatchIn(title)) return false
        if (query.isNotBlank()) {
            if (NOISY_VIDEO_REGEX.containsMatchIn(query)) return false
            val titleWithoutNoisy = title.replace(NOISY_VIDEO_REGEX, "")
            if (WORD_VIDEO_REGEX.containsMatchIn(query) && !WORD_VIDEO_REGEX.containsMatchIn(titleWithoutNoisy)) {
                return false
            }
        }
        return true
    }

    internal fun studioAudioScore(item: SongItem, query: String = ""): Int {
        var score = if (!item.isVideoSong) 12 else -8
        val primaryArtist = primaryArtistName(item)
        val albumName = item.album?.name
        if (!albumName.isNullOrBlank()) {
            if (isLikelyCompilationAlbum(albumName, item.title, primaryArtist) &&
                (query.isBlank() || !COMPILATION_ALBUM_REGEX.containsMatchIn(query))
            ) {
                score -= 14
            } else {
                score += 6
            }
        }
        val thumb = item.thumbnail
        if (thumb.contains("googleusercontent.com", ignoreCase = true) ||
            thumb.contains("ggpht.com", ignoreCase = true)
        ) {
            score += 5
        } else if (thumb.contains("i.ytimg.com", ignoreCase = true) ||
            thumb.contains("ytimg.com/vi", ignoreCase = true)
        ) {
            score -= 5
        }
        if (isNoisyVideoTitle(item.title, query)) score -= 16
        val dur = item.duration
        if (dur != null) {
            if (dur in 85..390) score += 3
            else if (dur > 540 || dur in 1..45) score -= 8
        }
        if (item.explicit) score += 1
        return score
    }

    internal data class CanonicalSongMeta(val coverUrl: String, val albumName: String)

    internal data class ItunesSongCandidate(
        val trackName: String,
        val artistName: String,
        val collectionName: String,
        val collectionCensoredName: String = "",
        val collectionArtistName: String = "",
        val primaryGenreName: String = "",
        val releaseDate: String = "",
        val trackCount: Int = 0,
        val discCount: Int = 1,
        val artworkUrl100: String = "",
    )

    private val canonicalSongMetaCache = ConcurrentHashMap<String, CanonicalSongMeta>()
    private val canonicalSongMissUntil = ConcurrentHashMap<String, Long>()
    private const val CANONICAL_META_TTL_MS = 7L * 24 * 60 * 60 * 1000L
    private const val CANONICAL_MISS_TTL_MS = 15L * 60 * 1000L
    private const val CANONICAL_ERR_TTL_MS = 60L * 1000L
    private const val MAX_CANONICAL_CACHE_ENTRIES = 600
    private val ARTIST_STOP_TOKENS = setOf("the", "los", "las", "gli", "il", "la", "le", "dj", "mc")

    internal fun isCompilationCollectionArtist(
        collectionArtistName: String,
        targetArtist: String,
        trackArtist: String,
    ): Boolean {
        val colArt = collectionArtistName.trim()
        if (colArt.isEmpty()) return false
        if (VARIOUS_COLLECTION_ARTIST_REGEX.containsMatchIn(colArt)) return true
        if (artistSharesPrimaryToken(colArt, targetArtist)) return false
        if (artistSharesPrimaryToken(colArt, trackArtist)) return false
        if (artistSharesPrimaryToken(targetArtist, colArt)) return false
        if (artistSharesPrimaryToken(trackArtist, colArt)) return false
        return true
    }

    internal fun peekCachedCanonicalSongMeta(
        title: String,
        artist: String,
        hintAlbum: String = "",
    ): CanonicalSongMeta? {
        val cleanTitle = title.trim()
        val cleanArtist = artist.trim()
        if (cleanTitle.isEmpty() || cleanArtist.isEmpty()) return null
        val targetTitleCore = normTitleCore(cleanTitle)
        val artistCompact = normCompactKey(cleanArtist)
        if (targetTitleCore.isEmpty() || artistCompact.isEmpty()) return null
        val effectiveHint = if (hintAlbum.isNotBlank() && !isLikelyCompilationAlbum(hintAlbum, cleanTitle, cleanArtist)) {
            normTitleCore(hintAlbum)
        } else {
            ""
        }
        val gl = SonoraLocaleManager.resolvedCountry
        if (effectiveHint.isNotEmpty()) {
            canonicalSongMetaCache["$gl|$targetTitleCore|$artistCompact|$effectiveHint"]?.let { return it }
        }
        return canonicalSongMetaCache["$gl|$targetTitleCore|$artistCompact|"]
    }

    private suspend fun fetchItunesSearchJson(url: String): Pair<String?, Boolean> =
        suspendCancellableCoroutine { cont ->
            val req = Request.Builder()
                .url(url)
                .header("Accept", "application/json")
                .header("User-Agent", "Sonora/1.0")
                .build()
            val call = okHttp.newCall(req)
            cont.invokeOnCancellation {
                runCatching { call.cancel() }
            }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    if (cont.isActive) cont.resume(null to false)
                }

                override fun onResponse(call: Call, response: Response) {
                    val resPair = runCatching {
                        response.use { res ->
                            if (!res.isSuccessful) null to false
                            else res.body.string() to true
                        }
                    }.getOrElse { null to false }
                    if (cont.isActive) cont.resume(resPair)
                }
            })
        }

    private fun artistSharesPrimaryToken(itemArtist: String, targetArtist: String): Boolean {
        val targetPrimary = extractArtistKeys(targetArtist).firstOrNull()
            ?: normSearchKey(targetArtist)
        if (targetPrimary.isBlank()) return false
        val targetCompact = targetPrimary.replace(" ", "")
        val rawTokens = targetPrimary.split(' ').filter { it.length >= 2 }
        val sigTokens = rawTokens.filter { it !in ARTIST_STOP_TOKENS }.ifEmpty { rawTokens }
        val itemKeys = extractArtistKeys(itemArtist).ifEmpty {
            listOf(normSearchKey(itemArtist)).filter { it.isNotBlank() }
        }
        return itemKeys.any { k ->
            val kCompact = k.replace(" ", "")
            val kWords = k.split(' ').filter { it.isNotEmpty() }
            kCompact == targetCompact ||
                (targetCompact.length >= 4 && (kCompact.contains(targetCompact) || targetCompact.contains(kCompact))) ||
                (sigTokens.size == 1 && sigTokens[0] in kWords) ||
                (sigTokens.size > 1 && sigTokens.all { it in kWords })
        }
    }

    internal fun selectCanonicalItunesCandidate(
        candidates: List<ItunesSongCandidate>,
        cleanTitle: String,
        cleanArtist: String,
        hintAlbum: String = "",
    ): CanonicalSongMeta? {
        if (candidates.isEmpty() || cleanTitle.isBlank() || cleanArtist.isBlank()) return null
        val targetTitleCore = normTitleCore(cleanTitle)
        if (targetTitleCore.isEmpty()) return null
        val searchTitle = stripTitleDecorations(cleanTitle).ifBlank { cleanTitle }
        val leadArtist = cleanArtist.split(ALBUM_ARTIST_SPLIT_RE).firstOrNull()?.let { cleanArtistKey(it) }
            .orEmpty().ifBlank { cleanArtist }
        val effectiveHint = if (hintAlbum.isNotBlank() && !isLikelyCompilationAlbum(hintAlbum, cleanTitle, cleanArtist)) {
            hintAlbum.trim()
        } else {
            ""
        }
        val hintAlbumCore = if (effectiveHint.isNotBlank()) normTitleCore(effectiveHint) else ""
        val titleLow = searchTitle.lowercase()
        val cleanTitleCompact = normCompactKey(cleanTitle)
        val targetArtists = extractArtistKeys(cleanArtist)

        data class ParsedCandidate(
            val raw: ItunesSongCandidate,
            val exactTitle: Boolean,
            val fullDecoratedTitleMatch: Boolean,
            val allArtistsMatch: Boolean,
            val isCompTitle: Boolean,
            val isVariousArtist: Boolean,
            val isCompGenre: Boolean,
            val isSoundtrackGenre: Boolean,
            val isSingleOrEp: Boolean,
            val isMegaCollection: Boolean,
            val isExtremeCollection: Boolean,
            val isUnrequestedVariant: Boolean,
            val requestedVariantMatch: Boolean,
            val isReissue: Boolean,
            val releaseDayNum: Int?,
        )

        val parsed = ArrayList<ParsedCandidate>(candidates.size)
        for (item in candidates) {
            val trackName = item.trackName.trim()
            val artistName = item.artistName.trim()
            val rawArt = item.artworkUrl100.trim()
            if (trackName.isBlank() || artistName.isBlank() || rawArt.isBlank()) continue

            val trackLow = trackName.lowercase()
            if (listOf("karaoke", "tribute", "nightcore", "8d audio", "parodia", "parody").any {
                    it in trackLow && it !in titleLow && it !in cleanTitle.lowercase()
                }
            ) {
                continue
            }

            val itemTitleCore = normTitleCore(trackName)
            val exactTitle = itemTitleCore == targetTitleCore
            val containsTitle = !exactTitle && targetTitleCore.length >= 4 && itemTitleCore.length >= 4 &&
                (itemTitleCore.contains(targetTitleCore) || targetTitleCore.contains(itemTitleCore))
            if (!exactTitle && !containsTitle) continue
            if (!artistSharesPrimaryToken(artistName, cleanArtist)) continue

            val collectionName = item.collectionName.trim()
            val collectionCensored = item.collectionCensoredName.trim()
            val collectionArtistName = item.collectionArtistName.trim()
            val primaryGenre = item.primaryGenreName.trim()
            val trackCount = item.trackCount
            val discCount = item.discCount.coerceAtLeast(1)

            val isCompTitle = collectionName.isBlank() ||
                isLikelyCompilationAlbum(collectionName, searchTitle, leadArtist) ||
                (collectionCensored.isNotBlank() && isLikelyCompilationAlbum(collectionCensored, searchTitle, leadArtist))
            val isVariousArtist = isCompilationCollectionArtist(collectionArtistName, cleanArtist, artistName)
            val isCompGenre = primaryGenre.equals("Compilation", ignoreCase = true) ||
                primaryGenre.equals("Fitness & Workout", ignoreCase = true)
            val isSoundtrackGenre = (primaryGenre.contains("Soundtrack", ignoreCase = true) ||
                primaryGenre.contains("Colonna sonora", ignoreCase = true)) &&
                !hasSoundtrackHint(cleanTitle, effectiveHint)
            val isSingleOrEp = SINGLE_OR_EP_SUFFIX_REGEX.containsMatchIn(collectionName) ||
                normTitleCore(collectionName) == itemTitleCore ||
                (trackCount in 1..3)
            val isMegaCollection = trackCount >= 28 || discCount >= 2
            val isExtremeCollection = trackCount >= 40 || discCount >= 3
            val isUnrequestedVariant = isUnrequestedTrackVariant(trackName, cleanTitle)
            val requestedVariantMatch = isRequestedTrackVariantMatch(trackName, cleanTitle)
            val isReissue = isReissueAlbumTitle(collectionName) || isReissueAlbumTitle(trackName)
            val releaseDayNum = parseReleaseDayNum(item.releaseDate)
            val fullDecoratedTitleMatch = cleanTitleCompact.isNotEmpty() &&
                cleanTitleCompact != targetTitleCore &&
                normCompactKey(trackName) == cleanTitleCompact
            val candidateArtists = extractArtistKeys(artistName)
            val allArtistsMatch = targetArtists.size > 1 && targetArtists.all { tk ->
                val tkCompact = tk.replace(" ", "")
                candidateArtists.any { ck ->
                    val ckCompact = ck.replace(" ", "")
                    ckCompact == tkCompact ||
                        (tkCompact.length >= 4 && (ckCompact.contains(tkCompact) || tkCompact.contains(ckCompact)))
                }
            }

            parsed.add(
                ParsedCandidate(
                    raw = item,
                    exactTitle = exactTitle,
                    fullDecoratedTitleMatch = fullDecoratedTitleMatch,
                    allArtistsMatch = allArtistsMatch,
                    isCompTitle = isCompTitle,
                    isVariousArtist = isVariousArtist,
                    isCompGenre = isCompGenre,
                    isSoundtrackGenre = isSoundtrackGenre,
                    isSingleOrEp = isSingleOrEp,
                    isMegaCollection = isMegaCollection,
                    isExtremeCollection = isExtremeCollection,
                    isUnrequestedVariant = isUnrequestedVariant,
                    requestedVariantMatch = requestedVariantMatch,
                    isReissue = isReissue,
                    releaseDayNum = releaseDayNum,
                )
            )
        }
        if (parsed.isEmpty()) return null

        val tier1 = parsed.filter {
            !it.isCompTitle && !it.isVariousArtist && !it.isCompGenre && !it.isSoundtrackGenre &&
                !it.isSingleOrEp && !it.isUnrequestedVariant && !it.isMegaCollection && it.releaseDayNum != null
        }
        val tier2 = tier1.ifEmpty {
            parsed.filter {
                !it.isCompTitle && !it.isVariousArtist && !it.isCompGenre &&
                    !it.isSingleOrEp && !it.isUnrequestedVariant && it.releaseDayNum != null
            }
        }
        val anchorPool = tier2.ifEmpty {
            parsed.filter {
                !it.isCompTitle && !it.isVariousArtist && !it.isCompGenre &&
                    !it.isUnrequestedVariant && it.releaseDayNum != null
            }
        }
        val anchorDay = anchorPool.minOfOrNull { it.releaseDayNum!! }
        val hasStudioAnchor = tier2.isNotEmpty() || parsed.any {
            !it.isCompTitle && !it.isVariousArtist && !it.isCompGenre &&
                !it.isSingleOrEp && !it.isUnrequestedVariant && !it.isSoundtrackGenre
        }

        var bestItem: ParsedCandidate? = null
        var bestScore = Int.MIN_VALUE
        for (c in parsed) {
            var score = 0
            score += if (!c.isCompTitle && !c.isCompGenre) 30 else -30
            score += if (!c.isVariousArtist) 15 else -32
            if (c.isSoundtrackGenre) score -= 10
            if (!c.exactTitle) score -= 18
            if (c.isUnrequestedVariant) score -= 32
            if (c.requestedVariantMatch) score += 14
            if (c.fullDecoratedTitleMatch) score += 16
            if (c.allArtistsMatch) score += 6

            if (!c.isSingleOrEp && c.raw.trackCount >= 4 && !c.isMegaCollection) {
                score += 18
            } else if (!c.isSingleOrEp && c.raw.trackCount > 1 && !c.isExtremeCollection) {
                score += 8
            } else if (c.isMegaCollection) {
                score -= 14
                if (c.isExtremeCollection) score -= 10
            }
            if (c.isSingleOrEp && hasStudioAnchor) {
                score -= 8
            }

            val hintMatch = hintAlbumCore.isNotEmpty() && normTitleCore(c.raw.collectionName) == hintAlbumCore
            if (c.isReissue && !hintMatch) {
                score -= 6
            }

            val daysAfter = if (anchorDay != null && c.releaseDayNum != null) c.releaseDayNum - anchorDay else null
            if (daysAfter != null) {
                score += when {
                    daysAfter <= 90 -> 28
                    daysAfter <= 548 -> 14
                    daysAfter <= 1096 -> 6
                    daysAfter <= 2192 -> -14
                    else -> -26
                }
            }

            if (hintMatch && !c.isCompTitle && !c.isVariousArtist && !c.isCompGenre) {
                score += when {
                    !c.isSingleOrEp && !c.isMegaCollection && (daysAfter == null || daysAfter <= 1096) -> 24
                    !c.isSingleOrEp && !c.isExtremeCollection -> 6
                    c.isSingleOrEp -> 8
                    else -> 0
                }
            }

            if (score > bestScore) {
                bestScore = score
                bestItem = c
            }
        }

        val chosen = bestItem?.takeIf { bestScore > 0 } ?: return null
        val artHq = chosen.raw.artworkUrl100.trim().replace(Regex("""\d+x\d+bb"""), "1200x1200bb")
        val coverUrl = "/api/cover?u=${URLEncoder.encode(artHq, "UTF-8")}&s=544"
        val rawAlbum = chosen.raw.collectionName.trim()
        val cleanAlbum = rawAlbum.replace(SINGLE_OR_EP_SUFFIX_REGEX, "").trim().ifBlank { rawAlbum }
        return CanonicalSongMeta(coverUrl, cleanAlbum)
    }

    internal suspend fun resolveCanonicalSongMeta(
        title: String,
        artist: String,
        hintAlbum: String = "",
    ): CanonicalSongMeta? {
        val cleanTitle = title.trim()
        val cleanArtist = artist.trim()
        if (cleanTitle.isEmpty() || cleanArtist.isEmpty()) return null
        val targetTitleCore = normTitleCore(cleanTitle)
        val artistCompact = normCompactKey(cleanArtist)
        if (targetTitleCore.isEmpty() || artistCompact.isEmpty() ||
            artistCompact == "artistasconosciuto" || artistCompact == "unknownartist"
        ) {
            return null
        }

        val effectiveHint = if (hintAlbum.isNotBlank() && !isLikelyCompilationAlbum(hintAlbum, cleanTitle, cleanArtist)) {
            hintAlbum.trim()
        } else {
            ""
        }
        val hintAlbumCore = if (effectiveHint.isNotBlank()) normTitleCore(effectiveHint) else ""
        val gl = SonoraLocaleManager.resolvedCountry
        val key = "$gl|$targetTitleCore|$artistCompact|$hintAlbumCore"

        canonicalSongMetaCache[key]?.let { return it }
        val missUntil = canonicalSongMissUntil[key]
        if (missUntil != null) {
            if (System.currentTimeMillis() < missUntil) return null
            canonicalSongMissUntil.remove(key, missUntil)
        }

        val diskKey = "canonsong_v3:$key"
        SnapshotDiskCache.get(diskKey, freshTtlMs = CANONICAL_META_TTL_MS)?.let { snap ->
            val parsed = runCatching {
                val obj = JSONObject(snap.data)
                val coverUrl = obj.optString("coverUrl", "").trim()
                val albumName = obj.optString("albumName", "").trim()
                if (coverUrl.isNotBlank()) CanonicalSongMeta(coverUrl, albumName) else null
            }.getOrNull()
            if (parsed != null) {
                canonicalSongMetaCache[key] = parsed
                return parsed
            }
        }

        val searchTitle = stripTitleDecorations(cleanTitle).ifBlank { cleanTitle }
        val leadArtist = cleanArtist.split(ALBUM_ARTIST_SPLIT_RE).firstOrNull()?.let { cleanArtistKey(it) }
            .orEmpty().ifBlank { cleanArtist }
        val term = URLEncoder.encode("$searchTitle $leadArtist", "UTF-8")
        val url = "https://itunes.apple.com/search?country=$gl&media=music&entity=song&limit=25&term=$term"
        val fetchRes = withContext(Dispatchers.IO) {
            withTimeoutOrNull(1500L) {
                fetchItunesSearchJson(url)
            }
        }
        val rawJson = fetchRes?.first
        val httpOk = fetchRes?.second == true

        val results = if (httpOk && !rawJson.isNullOrBlank()) {
            runCatching { JSONObject(rawJson).optJSONArray("results") }.getOrNull()
        } else null

        val candidates = if (results != null && results.length() > 0) {
            ArrayList<ItunesSongCandidate>(results.length()).apply {
                for (i in 0 until results.length()) {
                    val item = results.optJSONObject(i) ?: continue
                    val kind = item.optString("kind", "")
                    if (kind.isNotBlank() && kind != "song") continue
                    add(
                        ItunesSongCandidate(
                            trackName = item.optString("trackName", ""),
                            artistName = item.optString("artistName", ""),
                            collectionName = item.optString("collectionName", ""),
                            collectionCensoredName = item.optString("collectionCensoredName", ""),
                            collectionArtistName = item.optString("collectionArtistName", ""),
                            primaryGenreName = item.optString("primaryGenreName", ""),
                            releaseDate = item.optString("releaseDate", ""),
                            trackCount = item.optInt("trackCount", 0),
                            discCount = item.optInt("discCount", 1).coerceAtLeast(1),
                            artworkUrl100 = item.optString("artworkUrl100", ""),
                        )
                    )
                }
            }
        } else emptyList()

        val resolvedMeta: CanonicalSongMeta? = selectCanonicalItunesCandidate(
            candidates = candidates,
            cleanTitle = cleanTitle,
            cleanArtist = cleanArtist,
            hintAlbum = effectiveHint,
        ) ?: if (AppleCatalog.hasReadyToken()) {
            val appleSongMatch = withTimeoutOrNull(1400L) {
                AppleCatalog.songMatch(searchTitle, leadArtist, effectiveHint)
            }
            appleSongMatch?.takeIf { it.coverUrl.isNotBlank() }?.let { match ->
                CanonicalSongMeta(
                    coverUrl = "/api/cover?u=${URLEncoder.encode(match.coverUrl, "UTF-8")}&s=544",
                    albumName = match.albumName.ifBlank { effectiveHint }
                )
            }
        } else null

        if (resolvedMeta == null) {
            canonicalSongMissUntil[key] = System.currentTimeMillis() +
                (if (!httpOk) CANONICAL_ERR_TTL_MS else CANONICAL_MISS_TTL_MS)
            return null
        }

        if (resolvedMeta.albumName.isNotBlank() &&
            !isLikelyCompilationAlbum(resolvedMeta.albumName, searchTitle, leadArtist)
        ) {
            rememberResolvedAlbumThumb(resolvedMeta.albumName, leadArtist, resolvedMeta.coverUrl)
        }
        if (canonicalSongMetaCache.size >= MAX_CANONICAL_CACHE_ENTRIES) {
            canonicalSongMetaCache.clear()
        }
        canonicalSongMetaCache[key] = resolvedMeta
        canonicalSongMissUntil.remove(key)
        SnapshotDiskCache.putAsync(
            diskKey,
            JSONObject().apply {
                put("coverUrl", resolvedMeta.coverUrl)
                put("albumName", resolvedMeta.albumName)
            }.toString()
        )
        return resolvedMeta
    }

    internal fun deduplicateAndPreferStudio(items: List<SongItem>, query: String = ""): List<SongItem> {
        if (items.size <= 1) return items
        val result = ArrayList<SongItem>(items.size)
        val scores = ArrayList<Int>(items.size)
        val indexByKey = HashMap<String, Int>(items.size)
        val seenIds = HashSet<String>(items.size)

        for (item in items) {
            if (item.id.isNotBlank() && !seenIds.add(item.id)) continue
            val coreTitle = normTitleCore(item.title)
            val primaryArtist = extractSongArtistKeys(item).firstOrNull()
                ?: normSearchKey(item.artists.firstOrNull()?.name.orEmpty())
            val artistCompact = normCompactKey(primaryArtist)
            val key = if (coreTitle.length >= 2 && artistCompact.isNotEmpty()) {
                "sig:$coreTitle|$artistCompact"
            } else {
                "id:${item.id}"
            }
            val score = studioAudioScore(item, query)
            val existingIdx = indexByKey[key]
            if (existingIdx == null) {
                indexByKey[key] = result.size
                result.add(item)
                scores.add(score)
            } else if (score > scores[existingIdx]) {
                result[existingIdx] = item
                scores[existingIdx] = score
            }
        }
        return result
    }

    internal fun upgradeThumb(url: String?, size: Int = 544): String? {
        val raw = url?.trim()?.takeIf { it.isNotBlank() && !isBannerUrl(it) } ?: return null
        val sized = raw.atSize(size)
        return "/api/cover?u=${URLEncoder.encode(sized, "UTF-8")}&s=$size"
    }

    private fun cleanArtistKey(name: String): String = name
        .replace(Regex("(?i)\\s*-\\s*topic$"), "")
        .replace(Regex("(?i)\\b(feat|ft)\\.?.*$"), "")
        .trim()

    private fun upgradeArtistThumbSize(url: String, size: Int = 544): String =
        url.replace(Regex("([?&])s=\\d+\\b"), "$1s=$size")

    internal fun resizeCoverApiUrl(url: String, size: Int): String =
        url.replace(Regex("([?&])s=\\d+\\b"), "$1s=$size")

    private val ALBUM_CLEAN_RE = Regex(
        """\s*[(\[][^)\]]*(?:deluxe|expanded|remaster|bonus|edition|version|anniversary|explicit|clean)[^)\]]*[)\]]""",
        RegexOption.IGNORE_CASE
    )
    private val ALBUM_ARTIST_SPLIT_RE = Regex("""[,&]|\bfeat\.?\b|\bft\.?\b""", RegexOption.IGNORE_CASE)

    internal fun normAlbumCacheKey(title: String, artist: String): String {
        val cleanTitle = title.replace(ALBUM_CLEAN_RE, "")
            .replace(SINGLE_OR_EP_SUFFIX_REGEX, "")
            .replace('\u2019', '\'')
            .replace(COLLAPSE_WS_REGEX, " ")
            .trim()
            .lowercase()
        if (cleanTitle.isEmpty()) return ""
        val firstArtist = artist.split(ALBUM_ARTIST_SPLIT_RE).firstOrNull().orEmpty()
        val cleanArtist = cleanArtistKey(firstArtist).replace('\u2019', '\'').lowercase()
        return "$cleanTitle|$cleanArtist"
    }

    internal fun peekCachedArtistThumb(name: String, size: Int = 544): String? {
        val effSize = size.coerceIn(120, 1400)
        val rawTrim = name.trim()
        val clean = cleanArtistKey(rawTrim)
        if (clean.isEmpty() && rawTrim.isEmpty()) return null
        val keys = if (clean.isNotEmpty() && !clean.equals(rawTrim, ignoreCase = true)) {
            listOf(clean, rawTrim)
        } else {
            listOf(clean.ifEmpty { rawTrim })
        }
        for (k in keys) {
            HomeSubCache.getArtistThumb(k)?.let { return resizeCoverApiUrl(it, effSize) }
            val disk = SnapshotDiskCache.get("artthumb:${k.lowercase()}", freshTtlMs = 7L * 24 * 60 * 60 * 1000L)?.data?.takeIf { it.isNotBlank() }
            if (disk != null) {
                val canonical = upgradeArtistThumbSize(disk, 544)
                HomeSubCache.putArtistThumb(k, canonical)
                if (keys.size > 1 && k != clean && clean.isNotEmpty()) {
                    HomeSubCache.putArtistThumb(clean, canonical)
                }
                return resizeCoverApiUrl(canonical, effSize)
            }
        }
        return null
    }

    private fun rememberResolvedArtistThumb(name: String, thumbUrl: String?) {
        val rawTrim = name.trim()
        val clean = cleanArtistKey(rawTrim)
        if ((clean.isEmpty() && rawTrim.isEmpty()) || thumbUrl.isNullOrBlank()) return
        val canonical = upgradeArtistThumbSize(thumbUrl, 544)
        val primary = clean.ifEmpty { rawTrim }
        HomeSubCache.putArtistThumb(primary, canonical)
        SnapshotDiskCache.put("artthumb:${primary.lowercase()}", canonical)
        if (rawTrim.isNotEmpty() && !rawTrim.equals(primary, ignoreCase = true)) {
            HomeSubCache.putArtistThumb(rawTrim, canonical)
            SnapshotDiskCache.put("artthumb:${rawTrim.lowercase()}", canonical)
        }
    }

    internal fun peekCachedAlbumThumb(title: String, artist: String, size: Int = 544): String? {
        val effSize = size.coerceIn(120, 1400)
        val primaryKey = normAlbumCacheKey(title, artist)
        if (primaryKey.isEmpty()) return null
        val rawTitle = title.replace('\u2019', '\'').replace(COLLAPSE_WS_REGEX, " ").trim().lowercase()
        val cleanArt = primaryKey.substringAfter('|', "")
        val exactKey = if (rawTitle.isNotEmpty()) "$rawTitle|$cleanArt" else primaryKey
        val keys = if (exactKey != primaryKey) listOf(exactKey, primaryKey) else listOf(primaryKey)
        for (k in keys) {
            HomeSubCache.getAlbumThumb(k)?.let { return resizeCoverApiUrl(it, effSize) }
            val disk = SnapshotDiskCache.get("albthumb_v3:$k", freshTtlMs = 7L * 24 * 60 * 60 * 1000L)?.data?.takeIf { it.isNotBlank() }
            if (disk != null) {
                val canonical = resizeCoverApiUrl(disk, 544)
                HomeSubCache.putAlbumThumb(k, canonical)
                if (k != primaryKey) HomeSubCache.putAlbumThumb(primaryKey, canonical)
                return resizeCoverApiUrl(canonical, effSize)
            }
        }
        return null
    }

    internal fun rememberResolvedAlbumThumb(title: String, artist: String, thumbUrl: String?) {
        val primaryKey = normAlbumCacheKey(title, artist)
        if (primaryKey.isEmpty() || thumbUrl.isNullOrBlank()) return
        val rawTitle = title.replace('\u2019', '\'').replace(COLLAPSE_WS_REGEX, " ").trim().lowercase()
        val cleanArt = primaryKey.substringAfter('|', "")
        val exactKey = if (rawTitle.isNotEmpty()) "$rawTitle|$cleanArt" else primaryKey
        val normalized = resizeCoverApiUrl(thumbUrl, 544)
        HomeSubCache.putAlbumThumb(primaryKey, normalized)
        SnapshotDiskCache.putAsync("albthumb_v3:$primaryKey", normalized)
        if (exactKey != primaryKey) {
            HomeSubCache.putAlbumThumb(exactKey, normalized)
            SnapshotDiskCache.putAsync("albthumb_v3:$exactKey", normalized)
        }
    }

    private val albumThumbMissUntil = ConcurrentHashMap<String, Long>()
    private const val ALBUM_THUMB_MISS_TTL_MS = 2L * 60L * 1000L

    private suspend fun fetchItunesAlbumCover(title: String, artist: String): String? {
        val cleanTitle = stripTitleDecorations(title).ifBlank { title.trim() }
        if (cleanTitle.isEmpty()) return null
        val targetCore = normTitleCore(title)
        if (targetCore.isEmpty()) return null
        val gl = SonoraLocaleManager.resolvedCountry.ifBlank { "IT" }.uppercase()
        val firstArtist = artist.split(ALBUM_ARTIST_SPLIT_RE).firstOrNull()?.let { cleanArtistKey(it) }.orEmpty()
        val queryText = if (firstArtist.isNotBlank()) "$firstArtist $cleanTitle" else cleanTitle
        val encoded = URLEncoder.encode(queryText, "UTF-8")
        val url = "https://itunes.apple.com/search?country=$gl&media=music&entity=album&limit=12&term=$encoded"
        val (body, ok) = fetchItunesSearchJson(url)
        if (!ok || body.isNullOrBlank()) return null
        val results = runCatching { JSONObject(body).optJSONArray("results") }.getOrNull() ?: return null

        var bestUrl: String? = null
        var bestScore = Int.MIN_VALUE
        for (i in 0 until results.length()) {
            val row = results.optJSONObject(i) ?: continue
            val art100 = row.optString("artworkUrl100").trim()
            if (art100.isBlank()) continue
            val colName = row.optString("collectionName").trim()
            val rowArtist = row.optString("artistName").trim()
            val colCore = normTitleCore(colName)
            if (colCore.isEmpty()) continue
            val exactCore = colCore == targetCore
            val prefixCore = !exactCore && (colCore.startsWith(targetCore) || targetCore.startsWith(colCore))
            if (!exactCore && !prefixCore) continue
            if (firstArtist.isNotBlank()) {
                val artistOk = artistSharesPrimaryToken(rowArtist, artist) ||
                    artistSharesPrimaryToken(artist, rowArtist) ||
                    artistSharesPrimaryToken(rowArtist, firstArtist)
                if (!artistOk) continue
            }
            val trackCount = row.optInt("trackCount", 0)
            val isSingleOrEp = SINGLE_OR_EP_SUFFIX_REGEX.containsMatchIn(colName) || trackCount == 1
            var score = 0
            score += if (exactCore) 20 else 6
            if (!isSingleOrEp && trackCount >= 4) score += 10
            else if (!isSingleOrEp) score += 4
            if (colName.substringBefore(" - ").trim().equals(cleanTitle, ignoreCase = true)) score += 6
            if (score > bestScore) {
                bestScore = score
                bestUrl = art100
            }
        }
        val rawCover = bestUrl ?: return null
        return if (MZSTATIC_DIM_REGEX.containsMatchIn(rawCover)) {
            MZSTATIC_DIM_REGEX.replace(rawCover) { m -> "/1200x1200${m.groupValues[3]}" }
        } else {
            rawCover
        }
    }

    internal suspend fun resolveAlbumThumb(title: String, artist: String, size: Int = 544): String? {
        val cleanTitle = title.trim()
        if (cleanTitle.isEmpty()) return null
        val effSize = size.coerceIn(120, 1400)
        peekCachedAlbumThumb(cleanTitle, artist, effSize)?.let { return it }
        val baseKey = normAlbumCacheKey(cleanTitle, artist)
        val hasToken = AppleCatalog.hasReadyToken()
        val scopedMissKey = if (baseKey.isNotEmpty()) "$baseKey|${if (hasToken) 1 else 0}" else ""
        if (scopedMissKey.isNotEmpty()) {
            val blockedUntil = albumThumbMissUntil[scopedMissKey]
            if (blockedUntil != null && System.currentTimeMillis() < blockedUntil) return null
        }
        val resolved = runCatching {
            val cleanArtist = artist.split(ALBUM_ARTIST_SPLIT_RE).firstOrNull()?.let { cleanArtistKey(it) }.orEmpty()
            var cover: String? = null
            if (hasToken) {
                val album = AppleCatalog.album(cleanTitle, cleanArtist)
                    ?: (if (cleanArtist != artist.trim()) AppleCatalog.album(cleanTitle, artist.trim()) else null)
                cover = album?.coverUrl?.takeIf { it.isNotBlank() }
            }
            if (cover == null) {
                cover = fetchItunesAlbumCover(cleanTitle, artist)
            }
            cover ?: return@runCatching null
        }.getOrNull()
        if (resolved == null) {
            if (scopedMissKey.isNotEmpty()) {
                albumThumbMissUntil[scopedMissKey] = System.currentTimeMillis() + ALBUM_THUMB_MISS_TTL_MS
            }
            return null
        }
        if (baseKey.isNotEmpty()) {
            albumThumbMissUntil.remove("$baseKey|0")
            albumThumbMissUntil.remove("$baseKey|1")
        }
        val proxied = "/api/cover?u=${URLEncoder.encode(resolved, "UTF-8")}&s=$effSize"
        rememberResolvedAlbumThumb(cleanTitle, artist, proxied)
        return proxied
    }

    private const val VISITOR_DATA_KEY_PREFIX = "yt_visitor_data_v2_"
    private const val VISITOR_DATA_TTL_MS = 86_400_000L

    private fun visitorDataDiskKey(locKey: String = SonoraLocaleManager.cacheTag()): String =
        "$VISITOR_DATA_KEY_PREFIX$locKey"

    private fun refreshVisitorDataAsync(locKey: String = SonoraLocaleManager.cacheTag()) {
        val key = visitorDataDiskKey(locKey)
        SnapshotDiskCache.revalidate(key) {
            val vd = withTimeoutOrNull(2500L) { YouTube.visitorData().getOrNull() }?.takeIf { it.isNotBlank() }
            if (vd != null && SonoraLocaleManager.cacheTag() == locKey) {
                YouTube.visitorData = vd
                SnapshotDiskCache.put(key, vd)
            }
        }
    }

    private suspend fun ensureVisitorData() {
        if (!YouTube.visitorData.isNullOrBlank()) return
        val locKey = SonoraLocaleManager.cacheTag()
        val key = visitorDataDiskKey(locKey)
        val disk = SnapshotDiskCache.get(key, freshTtlMs = VISITOR_DATA_TTL_MS)
        if (disk != null && disk.data.isNotBlank()) {
            YouTube.visitorData = disk.data
            if (!disk.isFresh) refreshVisitorDataAsync(locKey)
            return
        }
        val vd = withTimeoutOrNull(1200L) { YouTube.visitorData().getOrNull() }?.takeIf { it.isNotBlank() }
        if (vd != null && SonoraLocaleManager.cacheTag() == locKey) {
            YouTube.visitorData = vd
            SnapshotDiskCache.put(key, vd)
        }
    }

    private fun ensureLocale() {
        val target = SonoraLocaleManager.youtubeLocale()
        if (YouTube.locale.gl != target.gl || YouTube.locale.hl != target.hl) {
            YouTube.locale = target
        }
        if (YouTube.visitorData.isNullOrBlank()) {
            val locKey = SonoraLocaleManager.cacheTag()
            val disk = SnapshotDiskCache.get(visitorDataDiskKey(locKey), freshTtlMs = VISITOR_DATA_TTL_MS)
            if (disk != null && disk.data.isNotBlank()) {
                YouTube.visitorData = disk.data
                if (!disk.isFresh) refreshVisitorDataAsync(locKey)
            }
        }
    }

    private fun localizedMsg(itMsg: String, enMsg: String): String =
        if (SonoraLocaleManager.resolvedLang == "it") itMsg else enMsg

    fun handle(uri: Uri, requestHeaders: Map<String, String> = emptyMap()): WebResourceResponse {
        ensureLocale()
        val path = uri.path ?: ""
        return try {
            when {
                path == "/api/health" -> handleHealth()
                path == "/api/locale" -> handleLocale(uri, requestHeaders)
                path == "/api/home" -> handleHome(uri)
                path == "/api/search" -> handleSearch(
                    uri.getQueryParameter("q").orEmpty(),
                    uri.getQueryParameter("type")?.takeIf { it.isNotBlank() } ?: "all"
                )
                path == "/api/lyrics_search" -> handleLyricsSearchEndpoint(uri.getQueryParameter("q").orEmpty())
                path == "/api/suggest" -> handleSuggest(uri.getQueryParameter("q").orEmpty())
                path == "/api/album_art" -> handleAlbumArt(
                    uri.getQueryParameter("title").orEmpty(),
                    uri.getQueryParameter("artist").orEmpty(),
                    uri.getQueryParameter("id").orEmpty(),
                    uri.getQueryParameter("s")?.toIntOrNull() ?: 544
                )
                path == "/api/track_art" -> handleTrackArt(
                    uri.getQueryParameter("title").orEmpty(),
                    uri.getQueryParameter("artist").orEmpty(),
                    uri.getQueryParameter("album").orEmpty(),
                    uri.getQueryParameter("id").orEmpty(),
                    uri.getQueryParameter("s")?.toIntOrNull() ?: 544
                )
                path.startsWith("/api/album/") -> handleAlbum(path.removePrefix("/api/album/"), uri)
                path == "/api/artist_art" -> handleArtistArt(
                    uri.getQueryParameter("name").orEmpty(),
                    uri.getQueryParameter("id").orEmpty(),
                    uri.getQueryParameter("s")?.toIntOrNull() ?: 544
                )
                path.startsWith("/api/artist/") -> handleArtist(path.removePrefix("/api/artist/"), uri)
                path.startsWith("/api/playlist/") -> handlePlaylist(path.removePrefix("/api/playlist/"))
                path == "/api/radio_feed" -> handleRadioFeed()
                path == "/api/playlist_recs" -> handlePlaylistRecs(uri, requestHeaders)
                path.startsWith("/api/mood/") -> handleMood(path.removePrefix("/api/mood/"))
                path.startsWith("/api/radio/") -> handleRadio(path.removePrefix("/api/radio/"))
                path == "/api/charts" -> handleCharts()
                path.startsWith("/api/lyrics/") -> handleLyrics(path.removePrefix("/api/lyrics/"), uri)
                path == "/api/cover" -> handleCover(
                    uri.getQueryParameter("u").orEmpty(),
                    uri.getQueryParameter("s")?.toIntOrNull() ?: 544,
                    uri.getQueryParameter("id").orEmpty(),
                )
                path.startsWith("/api/prefetch/") -> handlePrefetch(path.removePrefix("/api/prefetch/"))
                path.startsWith("/api/download_track/") -> handleDownloadTrack(path.removePrefix("/api/download_track/"))
                path.startsWith("/api/remove_download/") -> handleRemoveDownload(path.removePrefix("/api/remove_download/"))
                path.startsWith("/api/stream/") -> handleStream(path.removePrefix("/api/stream/"), requestHeaders)
                else -> errorResponse(404, localizedMsg("Endpoint non trovato: $path", "Endpoint not found: $path"))
            }
        } catch (e: Exception) {
            android.util.Log.e("SonoraApi", "Error handling $path: ${e.message}", e)
            errorResponse(500, e.message ?: localizedMsg("Errore interno", "Internal error"))
        }
    }

    private fun handleLocale(uri: Uri, requestHeaders: Map<String, String>): WebResourceResponse {
        val headerPayload = requestHeaders.entries
            .firstOrNull { it.key.equals("X-Sonora-Payload", ignoreCase = true) }
            ?.value
            ?.takeIf { it.isNotBlank() }
        val payloadObj = headerPayload?.let { raw ->
            runCatching {
                val decoded = if (raw.trimStart().startsWith("{")) raw else URLDecoder.decode(raw, "UTF-8")
                JSONObject(decoded)
            }.getOrNull()
        }
        val qLang = uri.getQueryParameter("lang") ?: uri.getQueryParameter("hl") ?: payloadObj?.optString("lang")?.takeIf { it.isNotBlank() }
        val qCountry = uri.getQueryParameter("country") ?: uri.getQueryParameter("gl") ?: payloadObj?.optString("country")?.takeIf { it.isNotBlank() }
        return if (qLang != null || qCountry != null) {
            val changed = SonoraLocaleManager.updateConfig(qLang, qCountry)
            ensureLocale()
            jsonResponse(SonoraLocaleManager.toJson(includeChanged = changed).toString())
        } else {
            jsonResponse(SonoraLocaleManager.toJson().toString())
        }
    }

    private fun handleHealth(): WebResourceResponse {
        val json = JSONObject().apply {
            put("status", "ok")
            put("ok", true)
            put("lang", SonoraLocaleManager.configuredLang)
            put("country", SonoraLocaleManager.configuredCountry)
            put("resolvedLang", SonoraLocaleManager.resolvedLang)
            put("resolvedCountry", SonoraLocaleManager.resolvedCountry)
        }
        return jsonResponse(json.toString())
    }

    private enum class RegionalQueryKind {
        HITS_HOME,
        CHARTS_ARTISTS,
        CHARTS_TRENDING,
        CHARTS_NEW_RELEASES,
        CHARTS_TOP_SONGS,
    }

    private fun countryDisplayNameEn(gl: String): String {
        val clean = gl.trim().uppercase()
        if (clean.length != 2) return ""
        return java.util.Locale("", clean).getDisplayCountry(java.util.Locale.ENGLISH)
            .takeIf { it.isNotBlank() && !it.equals(clean, ignoreCase = true) }
            .orEmpty()
    }

    private fun regionalFallbackQuery(kind: RegionalQueryKind, gl: String, hl: String): String {
        val upperGl = gl.trim().uppercase()
        if (upperGl == "IT") {
            return when (kind) {
                RegionalQueryKind.HITS_HOME -> "hit italiane momento"
                RegionalQueryKind.CHARTS_ARTISTS -> "artisti italiani"
                RegionalQueryKind.CHARTS_TRENDING -> "hit italia"
                RegionalQueryKind.CHARTS_NEW_RELEASES -> "nuove uscite italia"
                RegionalQueryKind.CHARTS_TOP_SONGS -> "classifica italia"
            }
        }
        val countryName = countryDisplayNameEn(upperGl)
        val suffix = if (countryName.isNotEmpty() && upperGl != "US") " $countryName" else ""
        return when (kind) {
            RegionalQueryKind.HITS_HOME -> "top hits$suffix"
            RegionalQueryKind.CHARTS_ARTISTS -> if (suffix.isNotEmpty()) "top artists$suffix" else "top music artists"
            RegionalQueryKind.CHARTS_TRENDING -> "trending hits$suffix"
            RegionalQueryKind.CHARTS_NEW_RELEASES -> "new album releases$suffix"
            RegionalQueryKind.CHARTS_TOP_SONGS -> "top songs chart$suffix"
        }
    }

    private data class HomeSectionMeta(val key: String, val title: String)

    private fun classifyHomeSection(rawTitle: String, hl: String): HomeSectionMeta {
        val t = rawTitle.trim()
        val isIt = hl == "it"
        return when {
            t.contains("quick picks", ignoreCase = true) || t.contains("scelte rapide", ignoreCase = true) ->
                HomeSectionMeta("quick_picks", if (isIt) "Scelte rapide" else "Quick picks")
            t.contains("community", ignoreCase = true) ->
                HomeSectionMeta("community_playlists", if (isIt) "Playlist della community" else "Community playlists")
            t.contains("featured playlists", ignoreCase = true) || t.contains("playlist in primo piano", ignoreCase = true) ->
                HomeSectionMeta("featured_playlists", if (isIt) "Playlist in primo piano" else "Featured playlists")
            t.contains("recommended playlists", ignoreCase = true) || t.contains("playlist consigliate", ignoreCase = true) ->
                HomeSectionMeta("recommended_playlists", if (isIt) "Playlist consigliate" else "Recommended playlists")
            t.contains("recommended songs", ignoreCase = true) || t.contains("brani consigliati", ignoreCase = true) ->
                HomeSectionMeta("recommended_songs", if (isIt) "Brani consigliati" else "Recommended songs")
            t.contains("recommended artists", ignoreCase = true) || t.contains("artisti consigliati", ignoreCase = true) ->
                HomeSectionMeta("recommended_artists", if (isIt) "Artisti consigliati" else "Recommended artists")
            t.contains("recommended albums", ignoreCase = true) || t.contains("album consigliati", ignoreCase = true) ->
                HomeSectionMeta("recommended_albums", if (isIt) "Album consigliati" else "Recommended albums")
            t.contains("new releases", ignoreCase = true) || t.contains("nuove uscite", ignoreCase = true) ||
                t.contains("new albums", ignoreCase = true) || t.contains("nuovi album", ignoreCase = true) ->
                HomeSectionMeta("new_releases", if (isIt) "Nuove uscite" else "New releases")
            t.contains("trending", ignoreCase = true) || t.contains("tendenza", ignoreCase = true) ->
                HomeSectionMeta("trending", if (isIt) "Brani in tendenza" else "Trending songs")
            t.contains("listen again", ignoreCase = true) || t.contains("ascolta di nuovo", ignoreCase = true) ||
                t.contains("ascoltati di recente", ignoreCase = true) ->
                HomeSectionMeta("listen_again", if (isIt) "Ascolta di nuovo" else "Listen again")
            t.contains("forgotten favorites", ignoreCase = true) || t.contains("preferiti dimenticati", ignoreCase = true) ->
                HomeSectionMeta("forgotten_favorites", if (isIt) "Preferiti dimenticati" else "Forgotten favorites")
            t.contains("mixed for you", ignoreCase = true) || t.contains("mix per te", ignoreCase = true) ->
                HomeSectionMeta("mixed_for_you", if (isIt) "Mix per te" else "Mixed for you")
            t.contains("today's biggest hits", ignoreCase = true) || t.contains("today's hits", ignoreCase = true) ||
                t.contains("hit di oggi", ignoreCase = true) ->
                HomeSectionMeta("todays_hits", if (isIt) "Hit di oggi" else "Today's hits")
            t.contains("from your library", ignoreCase = true) || t.contains("dalla tua libreria", ignoreCase = true) ->
                HomeSectionMeta("from_library", if (isIt) "Dalla tua libreria" else "From your library")
            t.contains("live performances", ignoreCase = true) || t.contains("esibizioni dal vivo", ignoreCase = true) ->
                HomeSectionMeta("live_performances", if (isIt) "Esibizioni dal vivo" else "Live performances")
            t.contains("covers and remixes", ignoreCase = true) || t.contains("cover e remix", ignoreCase = true) ->
                HomeSectionMeta("covers_remixes", if (isIt) "Cover e remix" else "Covers and remixes")
            t.contains("music videos", ignoreCase = true) || t.contains("video musicali", ignoreCase = true) ->
                HomeSectionMeta("music_videos", if (isIt) "Video musicali" else "Music videos")
            t.equals("charts", ignoreCase = true) || t.equals("classifiche", ignoreCase = true) ->
                HomeSectionMeta("charts", if (isIt) "Classifiche" else "Charts")
            else -> HomeSectionMeta("", t)
        }
    }

    private fun sectionRank(title: String, sectionKey: String = ""): Int {
        when (sectionKey) {
            "quick_picks" -> return 0
            "listen_again" -> return 1
            "trending" -> return 2
            "new_releases" -> return 3
            "similar_artists", "artist_releases" -> return 4
            "charts" -> return 5
        }
        val t = title.lowercase()
        return when {
            "scelte rapide" in t || "quick picks" in t -> 0
            "ascoltati di recente" in t || "ascolta di nuovo" in t || "listen again" in t -> 1
            "tendenza" in t || "trending" in t -> 2
            "nuove uscite" in t || "new releases" in t -> 3
            "simile a" in t || "altro da" in t || "similar to" in t || "more from" in t -> 4
            "classific" in t || "charts" in t || "top " in t || "hit " in t -> 5
            else -> 6
        }
    }

    private fun isItalianLeakArtist(artists: List<Artist>?, gl: String): Boolean {
        if (gl.equals("IT", ignoreCase = true) || artists.isNullOrEmpty()) return false
        return cleanArtistsList(artists).any { art ->
            val n = normSearchKey(art.name)
            n in ITALIAN_POPULAR_ARTISTS && n !in GLOBAL_POPULAR_ARTISTS
        }
    }

    private fun selectPopularNewReleases(
        homeAlbums: List<AlbumItem>,
        exploreAlbums: List<AlbumItem>,
        fallbackAlbums: List<AlbumItem> = emptyList(),
        userArtistIds: Set<String> = emptySet(),
        chartsResult: ChartsPage? = null,
        gl: String = SonoraLocaleManager.resolvedCountry,
        storefrontAlbums: List<AlbumItem> = emptyList(),
        limit: Int = 16
    ): List<AlbumItem> {
        val chartArtistIds = HashSet<String>()
        val chartArtistNames = HashSet<String>()
        val skipItalianLeaks = SonoraLocaleManager.isExplicitForeignRegion() && !gl.equals("IT", ignoreCase = true)
        chartsResult?.sections.orEmpty().flatMap { it.items }.forEach { item ->
            when (item) {
                is ArtistItem -> {
                    chartArtistIds.add(item.id)
                    val n = normSearchKey(item.title)
                    if (n.isNotEmpty()) chartArtistNames.add(n)
                }
                is SongItem -> {
                    cleanArtistsList(item.artists).forEach { art ->
                        art.id?.let { chartArtistIds.add(it) }
                        val n = normSearchKey(art.name)
                        if (n.isNotEmpty()) chartArtistNames.add(n)
                    }
                }
                is AlbumItem -> {
                    cleanArtistsList(item.artists).forEach { art ->
                        art.id?.let { chartArtistIds.add(it) }
                        val n = normSearchKey(art.name)
                        if (n.isNotEmpty()) chartArtistNames.add(n)
                    }
                }
                else -> {}
            }
        }

        data class Candidate(
            val album: AlbumItem,
            var fromStorefront: Boolean,
            var fromHome: Boolean,
            var fromExplore: Boolean,
            var fromFallback: Boolean,
            val orderIdx: Int
        )

        val candidates = ArrayList<Candidate>()
        val seenIds = HashMap<String, Candidate>()
        val seenSigs = HashMap<String, Candidate>()
        var seq = 0

        fun addSource(list: List<AlbumItem>, isStorefront: Boolean, isHome: Boolean, isExplore: Boolean, isFallback: Boolean) {
            for (album in list) {
                if (shouldFilterReleaseAlbum(album)) continue
                if (skipItalianLeaks && !isStorefront && isItalianLeakArtist(album.artists, gl)) continue
                val validArtists = cleanArtistsList(album.artists)
                val titleKey = normCompactKey(album.title)
                val firstArt = validArtists.firstOrNull()?.name ?: ""
                val sig = if (titleKey.isNotEmpty()) "$titleKey|${normCompactKey(firstArt)}" else ""
                val existing = seenIds[album.browseId] ?: if (sig.isNotEmpty()) seenSigs[sig] else null
                if (existing != null) {
                    if (isStorefront) existing.fromStorefront = true
                    if (isHome) existing.fromHome = true
                    if (isExplore) existing.fromExplore = true
                    if (isFallback) existing.fromFallback = true
                } else {
                    val c = Candidate(album, isStorefront, isHome, isExplore, isFallback, seq++)
                    candidates.add(c)
                    seenIds[album.browseId] = c
                    if (sig.isNotEmpty()) seenSigs[sig] = c
                }
            }
        }

        addSource(storefrontAlbums, isStorefront = true, isHome = false, isExplore = false, isFallback = false)
        addSource(homeAlbums, isStorefront = false, isHome = true, isExplore = false, isFallback = false)
        addSource(exploreAlbums, isStorefront = false, isHome = false, isExplore = true, isFallback = false)
        addSource(fallbackAlbums, isStorefront = false, isHome = false, isExplore = false, isFallback = true)

        data class Scored(val candidate: Candidate, val score: Int, val isPopularArtist: Boolean)

        val scored = candidates.map { c ->
            val validArtists = cleanArtistsList(c.album.artists)
            val isUserOrChart = validArtists.any { art ->
                (art.id != null && (art.id in userArtistIds || art.id in chartArtistIds)) ||
                    normSearchKey(art.name) in chartArtistNames
            }
            val isKnownPopular = validArtists.any { art ->
                isPopularArtistForCountry(normSearchKey(art.name), gl)
            }
            val isPopularArtist = c.fromStorefront || isUserOrChart || isKnownPopular
            var score = 0
            if (c.fromStorefront) score += 140
            if (isUserOrChart && (!skipItalianLeaks || c.fromStorefront)) score += 100
            if (isKnownPopular) score += 80
            if (c.fromHome) score += 40
            Scored(c, score, isPopularArtist)
        }.sortedWith(compareByDescending<Scored> { it.score }.thenBy { it.candidate.orderIdx })

        val primary = scored.filter { !(it.candidate.fromExplore && !it.candidate.fromHome && !it.isPopularArtist) }
            .map { it.candidate.album }
            .toMutableList()
        if (primary.size < 6) {
            val primaryIds = primary.map { it.browseId }.toHashSet()
            for (s in scored) {
                if (primary.size >= limit) break
                if (primaryIds.add(s.candidate.album.browseId)) {
                    primary.add(s.candidate.album)
                }
            }
        }
        return primary.take(limit)
    }

    private const val HOME_THUMB_SIZE = 544
    private val homeWarmScheduled = java.util.concurrent.atomic.AtomicBoolean(false)

    private data class StorefrontRssEntry(val title: String, val artist: String, val artUrl: String?)

    private fun fetchItunesRssEntries(url: String, limit: Int): List<StorefrontRssEntry> {
        return runCatching {
            val req = Request.Builder()
                .url(url)
                .header("Accept", "application/json")
                .build()
            okHttp.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return@use emptyList()
                val body = resp.body?.string().orEmpty()
                if (body.isBlank()) return@use emptyList()
                val feed = JSONObject(body).optJSONObject("feed") ?: return@use emptyList()
                val rawObj = feed.opt("entry")
                val entries = when (rawObj) {
                    is JSONArray -> rawObj
                    is JSONObject -> JSONArray().apply { put(rawObj) }
                    else -> return@use emptyList()
                }
                val out = ArrayList<StorefrontRssEntry>(minOf(limit, entries.length()))
                for (i in 0 until minOf(limit, entries.length())) {
                    val e = entries.optJSONObject(i) ?: continue
                    val title = e.optJSONObject("im:name")?.optString("label")?.trim().orEmpty()
                    val artist = e.optJSONObject("im:artist")?.optString("label")?.trim().orEmpty()
                    if (title.isEmpty() || artist.isEmpty()) continue
                    val imgs = e.optJSONArray("im:image")
                    val rawArt = if (imgs != null && imgs.length() > 0) {
                        imgs.optJSONObject(imgs.length() - 1)?.optString("label")?.trim()
                    } else null
                    val hqArt = rawArt?.takeIf { it.isNotBlank() }
                        ?.replace(Regex("""/\d+x\d+bb(-\d+)?\."""), "/544x544bb$1.")
                    out.add(StorefrontRssEntry(title, artist, hqArt))
                }
                out
            }
        }.getOrDefault(emptyList())
    }

    private fun normAlbumBaseTitle(title: String): String =
        normAlbumCacheKey(title, "").substringBefore('|')

    private fun storefrontAlbumMatches(item: AlbumItem, entryTitle: String, entryArtist: String): Boolean {
        if (shouldFilterReleaseAlbum(item)) return false
        val itemBase = normAlbumBaseTitle(item.title)
        val entryBase = normAlbumBaseTitle(entryTitle)
        if (itemBase.isEmpty() || entryBase.isEmpty()) return false
        val itemCore = normTitleCore(item.title)
        val entryCore = normTitleCore(entryTitle)
        val titleOk = itemBase == entryBase || (itemCore.isNotEmpty() && itemCore == entryCore)
        if (!titleOk) return false
        val validArtists = cleanArtistsList(item.artists)
        if (validArtists.isNotEmpty()) {
            val artistOk = validArtists.any {
                artistSharesPrimaryToken(it.name, entryArtist) || artistSharesPrimaryToken(entryArtist, it.name)
            }
            if (!artistOk) return false
        }
        return true
    }

    private suspend fun fetchStorefrontRegionalFeed(gl: String): HomeSubCache.StorefrontFeed {
        HomeSubCache.getStorefront(gl)?.let { return it }
        val sf = gl.trim().lowercase().takeIf { it.length == 2 } ?: "us"
        return coroutineScope {
            val songsRssDef = async(Dispatchers.IO) {
                withTimeoutOrNull(2400L) {
                    fetchItunesRssEntries("https://itunes.apple.com/$sf/rss/topsongs/limit=20/json", 16)
                }.orEmpty()
            }
            val albumsRssDef = async(Dispatchers.IO) {
                withTimeoutOrNull(2400L) {
                    fetchItunesRssEntries("https://itunes.apple.com/$sf/rss/topalbums/limit=12/json", 10)
                }.orEmpty()
            }
            val songEntries = songsRssDef.await()
            val albumEntries = albumsRssDef.await()
            if (songEntries.isEmpty() && albumEntries.isEmpty()) {
                return@coroutineScope HomeSubCache.StorefrontFeed(emptyList(), emptyList())
            }

            val songSem = Semaphore(8)
            val albumSem = Semaphore(4)
            val resolvedSongsDef = async(Dispatchers.IO) {
                withTimeoutOrNull(3600L) {
                    songEntries.map { entry ->
                        async(Dispatchers.IO) {
                            songSem.withPermit {
                                withTimeoutOrNull(1400L) {
                                    val res = YouTube.search("${entry.title} ${entry.artist}", YouTube.SearchFilter.FILTER_SONG).getOrNull()
                                    val targetCore = normTitleCore(entry.title)
                                    val item = res?.items?.filterIsInstance<SongItem>()
                                        ?.firstOrNull { cand ->
                                            if (shouldFilterTrack(cand) || isFeedVideoTrack(cand)) return@firstOrNull false
                                            val candCore = normTitleCore(cand.title)
                                            val titleOk = candCore.isNotEmpty() && targetCore.isNotEmpty() &&
                                                (candCore == targetCore ||
                                                    (targetCore.length >= 5 && candCore.contains(targetCore)) ||
                                                    (candCore.length >= 5 && targetCore.contains(candCore)))
                                            if (!titleOk) return@firstOrNull false
                                            val validArtists = cleanArtistsList(cand.artists)
                                            validArtists.isEmpty() || validArtists.any {
                                                artistSharesPrimaryToken(it.name, entry.artist) || artistSharesPrimaryToken(entry.artist, it.name)
                                            }
                                        }
                                    if (item != null && !entry.artUrl.isNullOrBlank()) {
                                        val alb = item.album?.name?.trim().orEmpty()
                                        if (alb.isNotEmpty() && normTitleCore(alb) == targetCore) {
                                            val proxyCover = "/api/cover?u=${URLEncoder.encode(entry.artUrl, "UTF-8")}&s=544"
                                            rememberResolvedAlbumThumb(alb, entry.artist, proxyCover)
                                        }
                                    }
                                    item
                                }
                            }
                        }
                    }.awaitAll().filterNotNull()
                }.orEmpty()
            }
            val resolvedAlbumsDef = async(Dispatchers.IO) {
                withTimeoutOrNull(3400L) {
                    albumEntries.map { entry ->
                        async(Dispatchers.IO) {
                            albumSem.withPermit {
                                withTimeoutOrNull(1400L) {
                                    val res = YouTube.search("${entry.title} ${entry.artist}", YouTube.SearchFilter.FILTER_ALBUM).getOrNull()
                                    val item = res?.items?.filterIsInstance<AlbumItem>()
                                        ?.firstOrNull { storefrontAlbumMatches(it, entry.title, entry.artist) }
                                    if (item != null && !entry.artUrl.isNullOrBlank()) {
                                        val proxyCover = "/api/cover?u=${URLEncoder.encode(entry.artUrl, "UTF-8")}&s=544"
                                        val albArt = cleanArtistsList(item.artists).firstOrNull()?.name ?: entry.artist
                                        rememberResolvedAlbumThumb(item.title, albArt, proxyCover)
                                    }
                                    item
                                }
                            }
                        }
                    }.awaitAll().filterNotNull()
                }.orEmpty()
            }

            val feed = HomeSubCache.StorefrontFeed(
                songs = deduplicateAndPreferStudio(resolvedSongsDef.await()),
                albums = resolvedAlbumsDef.await().distinctBy { it.browseId }
            )
            if (feed.songs.isNotEmpty() || feed.albums.isNotEmpty()) {
                HomeSubCache.putStorefront(feed, 1800, gl)
            }
            feed
        }
    }

    private fun scheduleHomeSecondaryWarm(
        aids: List<String>,
        locKey: String = SonoraLocaleManager.cacheTag(),
        gl: String = SonoraLocaleManager.resolvedCountry,
        hl: String = SonoraLocaleManager.resolvedLang,
    ) {
        if (!homeWarmScheduled.compareAndSet(false, true)) return
        attachScope.launch {
            try {
                delay(3000L)
                if (SonoraLocaleManager.cacheTag() != locKey) return@launch
                ensureLocale()
                val ytLocale = SonoraLocaleManager.effectiveRegionalYoutubeLocale(gl, hl)
                if (HomeSubCache.getNewReleases(locKey) == null && SonoraLocaleManager.cacheTag() == locKey) {
                    withTimeoutOrNull(2500L) {
                        YouTube.browse("FEmusic_new_releases", null, localeOverride = ytLocale).getOrNull()?.also {
                            if (SonoraLocaleManager.cacheTag() == locKey && it.items.isNotEmpty()) {
                                HomeSubCache.putNewReleases(it, 1800, locKey)
                            }
                        }
                    }
                }
                if (HomeSubCache.getExplore(locKey) == null && SonoraLocaleManager.cacheTag() == locKey) {
                    withTimeoutOrNull(2500L) {
                        YouTube.explore(localeOverride = ytLocale).getOrNull()?.also {
                            if (SonoraLocaleManager.cacheTag() == locKey) HomeSubCache.putExplore(it, 900, locKey)
                        }
                    }
                }
                if (HomeSubCache.getCharts(locKey) == null && SonoraLocaleManager.cacheTag() == locKey) {
                    withTimeoutOrNull(2500L) {
                        YouTube.getChartsPage(localeOverride = ytLocale).getOrNull()?.also {
                            if (SonoraLocaleManager.cacheTag() == locKey) HomeSubCache.putCharts(it, 1800, locKey)
                        }
                    }
                }
                for (aid in aids) {
                    if (SonoraLocaleManager.cacheTag() != locKey) break
                    if (HomeSubCache.getArtist(aid, locKey) == null) {
                        withTimeoutOrNull(2000L) {
                            YouTube.artist(aid).getOrNull()?.also {
                                if (SonoraLocaleManager.cacheTag() == locKey) HomeSubCache.putArtist(aid, it, 1800, locKey)
                            }
                        }
                    }
                }
            } finally {
                homeWarmScheduled.set(false)
            }
        }
    }

    private suspend fun buildHomeJson(
        seed: String,
        artistsParam: String,
        locKey: String = SonoraLocaleManager.cacheTag(),
        gl: String = SonoraLocaleManager.resolvedCountry,
        hl: String = SonoraLocaleManager.resolvedLang,
    ): Pair<String, Boolean> = coroutineScope {
        if (YouTube.visitorData.isNullOrBlank()) {
            val vdKey = visitorDataDiskKey(locKey)
            val disk = SnapshotDiskCache.get(vdKey, freshTtlMs = VISITOR_DATA_TTL_MS)
            if (disk != null && disk.data.isNotBlank()) {
                YouTube.visitorData = disk.data
                if (!disk.isFresh) refreshVisitorDataAsync(locKey)
            } else {
                withTimeoutOrNull(1500L) { ensureVisitorData() }
                if (YouTube.visitorData.isNullOrBlank()) refreshVisitorDataAsync(locKey)
            }
        }
        val aids = artistsParam.split(',', ' ', ';')
            .map { it.trim() }
            .filter { it.matches(Regex("UC[\\w-]{10,40}")) }
            .take(3)

        val explicitForeign = SonoraLocaleManager.isExplicitForeignRegion()
        val ytLocale = SonoraLocaleManager.effectiveRegionalYoutubeLocale(gl, hl)

        val homeDeferred = async(Dispatchers.IO) {
            HomeSubCache.getHome(locKey) ?: run {
                var effectiveLoc = ytLocale
                var page = YouTube.home(localeOverride = effectiveLoc).getOrNull()
                if ((page == null || page.sections.isEmpty()) && !effectiveLoc.gl.equals("US", ignoreCase = true)) {
                    effectiveLoc = effectiveLoc.copy(gl = "US")
                    page = YouTube.home(localeOverride = effectiveLoc).getOrNull()
                }
                if (page != null && page.sections.isNotEmpty()) {
                    val mergedSections = page.sections.toMutableList()
                    val cont = page.continuation
                    if (!cont.isNullOrBlank()) {
                        val nextPage = withTimeoutOrNull(1800L) {
                            YouTube.home(continuation = cont, localeOverride = effectiveLoc).getOrNull()
                        }
                        if (nextPage != null && nextPage.sections.isNotEmpty()) {
                            val seenTitles = mergedSections.map { it.title.lowercase() }.toHashSet()
                            nextPage.sections.forEach { sec ->
                                if (seenTitles.add(sec.title.lowercase())) mergedSections.add(sec)
                            }
                            page = HomePage(page.chips, mergedSections, nextPage.continuation)
                        }
                    }
                    if (SonoraLocaleManager.cacheTag() == locKey) HomeSubCache.putHome(page, 600, locKey)
                }
                page
            }
        }
        val seedDeferred = if (!explicitForeign && seed.isNotBlank() && seed.matches(Regex("^[A-Za-z0-9_-]{11}$"))) {
            async(Dispatchers.IO) {
                YouTube.next(WatchEndpoint(videoId = seed)).getOrNull()
            }
        } else null

        val homeResult = withTimeoutOrNull(3600L) { homeDeferred.await() }
        val seedResult = seedDeferred?.let { withTimeoutOrNull(1200L) { it.await() } }

        var exploreResult = HomeSubCache.getExplore(locKey)
        val chartsResult = HomeSubCache.getCharts(locKey)

        if (homeResult == null && exploreResult == null) {
            exploreResult = withTimeoutOrNull(1800L) {
                YouTube.explore(localeOverride = ytLocale).getOrNull()?.also {
                    if (SonoraLocaleManager.cacheTag() == locKey) HomeSubCache.putExplore(it, 900, locKey)
                }
            }
        }

        val sectionsList = mutableListOf<JSONObject>()
        val ytHomeQuick = mutableListOf<SongItem>()
        val ytRecommendedSongs = mutableListOf<SongItem>()
        val homeNewReleaseAlbums = mutableListOf<AlbumItem>()
        val homeSectionAlbums = mutableListOf<AlbumItem>()
        val homeSectionArtists = mutableListOf<ArtistItem>()

        if (homeResult != null) {
            for (sec in homeResult.sections) {
                val meta = classifyHomeSection(sec.title, hl)
                if (meta.key == "quick_picks") {
                    sec.items.filterIsInstance<SongItem>()
                        .filterTo(ytHomeQuick) {
                            !shouldFilterTrack(it) &&
                                !isFeedVideoTrack(it) &&
                                !(explicitForeign && !gl.equals("IT", true) && isItalianLeakArtist(it.artists, gl))
                        }
                    continue
                }
                if (meta.key == "trending" || meta.key == "music_videos") {
                    continue
                }
                for (item in sec.items) {
                    when (item) {
                        is SongItem -> if ((meta.key == "recommended_songs" || meta.key == "todays_hits") &&
                            !shouldFilterTrack(item) && !isFeedVideoTrack(item) &&
                            !(explicitForeign && !gl.equals("IT", true) && isItalianLeakArtist(item.artists, gl))
                        ) {
                            ytRecommendedSongs.add(item)
                        }
                        is AlbumItem -> if (!shouldFilterReleaseAlbum(item) && !(explicitForeign && !gl.equals("IT", true) && isItalianLeakArtist(item.artists, gl))) {
                            homeSectionAlbums.add(item)
                            if (meta.key == "new_releases") homeNewReleaseAlbums.add(item)
                        }
                        is ArtistItem -> homeSectionArtists.add(item)
                        else -> {}
                    }
                }
            }
        }

        // Match Square: use YouTube Music's curated Home Quick Picks directly without overriding with RSS/search noise.
        val cleanYtHomeQuick = deduplicateAndPreferStudio(ytHomeQuick)
        val finalQuickSongs = if (cleanYtHomeQuick.isNotEmpty()) {
            cleanYtHomeQuick.take(20)
        } else {
            val fallbackQuick = buildList {
                addAll(ytRecommendedSongs)
                chartsResult?.sections?.flatMap { it.items }?.filterIsInstance<SongItem>()?.forEach { song ->
                    if (!shouldFilterTrack(song) && !isFeedVideoTrack(song)) add(song)
                }
                if (!explicitForeign) {
                    seedResult?.items?.filterIsInstance<SongItem>()?.forEach { song ->
                        if (!shouldFilterTrack(song) && !isFeedVideoTrack(song)) add(song)
                    }
                }
            }
            deduplicateAndPreferStudio(fallbackQuick).take(20)
        }

        // Match Square: Home New Releases come from FEmusic_home's own New Releases shelf (localized editorial picks)
        // and must NOT be padded with FEmusic_new_releases/Explore (which mixes global/foreign catalog releases).
        val fallbackBrowseAlbums = if (homeNewReleaseAlbums.isEmpty()) {
            val res = HomeSubCache.getNewReleases(locKey) ?: withTimeoutOrNull(2800L) {
                var fetched = YouTube.browse("FEmusic_new_releases", null, localeOverride = ytLocale).getOrNull()
                if ((fetched == null || fetched.items.isEmpty()) && !ytLocale.gl.equals("US", ignoreCase = true)) {
                    fetched = YouTube.browse("FEmusic_new_releases", null, localeOverride = ytLocale.copy(gl = "US")).getOrNull()
                }
                if (fetched != null && fetched.items.isNotEmpty() && SonoraLocaleManager.cacheTag() == locKey) {
                    HomeSubCache.putNewReleases(fetched, 1800, locKey)
                }
                fetched
            }
            if (exploreResult == null) {
                exploreResult = withTimeoutOrNull(1800L) {
                    YouTube.explore(localeOverride = ytLocale).getOrNull()?.also {
                        if (SonoraLocaleManager.cacheTag() == locKey) HomeSubCache.putExplore(it, 900, locKey)
                    }
                }
            }
            res?.items.orEmpty()
                .flatMap { it.items }
                .filterIsInstance<AlbumItem>()
                .filter {
                    !shouldFilterReleaseAlbum(it) &&
                        !(explicitForeign && !gl.equals("IT", true) && isItalianLeakArtist(it.artists, gl))
                }
        } else {
            emptyList()
        }
        val popularNewReleases = buildList {
            val seenIds = HashSet<String>()
            val seenSigs = HashSet<String>()
            fun addRelease(alb: AlbumItem) {
                if (size >= 16) return
                if (shouldFilterReleaseAlbum(alb)) return
                if (explicitForeign && !gl.equals("IT", true) && isItalianLeakArtist(alb.artists, gl)) return
                val validArt = cleanArtistsList(alb.artists).firstOrNull()?.name ?: alb.artists?.firstOrNull()?.name.orEmpty()
                val sig = "${normCompactKey(alb.title)}|${normCompactKey(validArt)}"
                if (seenIds.add(alb.browseId) && (normCompactKey(alb.title).isEmpty() || seenSigs.add(sig))) {
                    add(alb)
                }
            }
            if (homeNewReleaseAlbums.isNotEmpty()) {
                homeNewReleaseAlbums.forEach { addRelease(it) }
            } else {
                fallbackBrowseAlbums.forEach { addRelease(it) }
                exploreResult?.newReleaseAlbums.orEmpty().forEach { addRelease(it) }
            }
        }

        run {
            val seenAlbKeys = HashSet<String>()
            val pendingHomeAlbums = mutableListOf<Pair<String, String>>()
            fun addAlbTarget(title: String, artist: String, limit: Int) {
                if (pendingHomeAlbums.size >= limit) return
                val k = normAlbumCacheKey(title, artist)
                if (k.isNotEmpty() && seenAlbKeys.add(k) && peekCachedAlbumThumb(title, artist, HOME_THUMB_SIZE) == null) {
                    pendingHomeAlbums.add(title to artist)
                }
            }
            popularNewReleases.forEach { alb ->
                val artName = cleanArtistsList(alb.artists).firstOrNull()?.name ?: alb.artists?.firstOrNull()?.name.orEmpty()
                addAlbTarget(alb.title, artName, 30)
            }
            homeSectionAlbums.forEach { alb ->
                val artName = cleanArtistsList(alb.artists).firstOrNull()?.name ?: alb.artists?.firstOrNull()?.name.orEmpty()
                addAlbTarget(alb.title, artName, 30)
            }
            for (aid in aids) {
                val artistRes = HomeSubCache.getArtist(aid, locKey) ?: continue
                val aName = artistRes.artist.title
                for (sec in artistRes.sections) {
                    val secTitle = sec.title.lowercase()
                    if (secTitle.contains("album") || secTitle.contains("single") || secTitle.contains("singol") || Regex("""\bep\b""").containsMatchIn(secTitle)) {
                        for (item in sec.items) {
                            if (item is AlbumItem) {
                                val itemArt = cleanArtistsList(item.artists).firstOrNull()?.name ?: item.artists?.firstOrNull()?.name ?: aName
                                addAlbTarget(item.title, itemArt, 30)
                            }
                        }
                    }
                }
            }
            val seenArtKeys = HashSet<String>()
            val pendingHomeArtists = mutableListOf<ArtistItem>()
            fun addArtTarget(item: ArtistItem) {
                if (pendingHomeArtists.size >= 8) return
                val clean = cleanArtistKey(item.title).lowercase()
                if (clean.isNotEmpty() && seenArtKeys.add(clean) && peekCachedArtistThumb(item.title) == null) {
                    pendingHomeArtists.add(item)
                }
            }
            if (AppleCatalog.hasReadyToken()) {
                homeSectionArtists.forEach { addArtTarget(it) }
                for (aid in aids) {
                    val artistRes = HomeSubCache.getArtist(aid, locKey) ?: continue
                    for (sec in artistRes.sections) {
                        sec.items.filterIsInstance<ArtistItem>().forEach { addArtTarget(it) }
                    }
                }
            }
            if (pendingHomeAlbums.isNotEmpty() || pendingHomeArtists.isNotEmpty()) {
                val sem = Semaphore(6)
                val albDefs = pendingHomeAlbums.map { (title, artist) ->
                    async(Dispatchers.IO) {
                        sem.withPermit {
                            withTimeoutOrNull(2200L) { resolveAlbumThumb(title, artist, HOME_THUMB_SIZE) }
                        }
                    }
                }
                val artDefs = pendingHomeArtists.map { art ->
                    async(Dispatchers.IO) {
                        sem.withPermit {
                            withTimeoutOrNull(1500L) { resolveArtistThumb(art.title) }
                        }
                    }
                }
                albDefs.awaitAll()
                artDefs.awaitAll()
            }
        }

        if (homeResult != null) {
            for (sec in homeResult.sections) {
                val meta = classifyHomeSection(sec.title, hl)
                if (meta.key == "quick_picks" || meta.key == "trending" || meta.key == "music_videos") continue
                val secObj = JSONObject()
                secObj.put("title", meta.title)
                secObj.put("sectionKey", meta.key)
                secObj.put("type", "")
                secObj.put("artist", "")
                val itemsArr = JSONArray()
                for (item in sec.items) {
                    when (item) {
                        is SongItem -> if (!shouldFilterTrack(item) && !isFeedVideoTrack(item) && !(explicitForeign && !gl.equals("IT", true) && isItalianLeakArtist(item.artists, gl))) {
                            itemsArr.put(item.toJson(thumbSize = HOME_THUMB_SIZE).apply { put("kind", "track") })
                        }
                        is AlbumItem -> if (!shouldFilterReleaseAlbum(item) && !(explicitForeign && !gl.equals("IT", true) && isItalianLeakArtist(item.artists, gl))) {
                            itemsArr.put(item.toJson(thumbSize = HOME_THUMB_SIZE))
                        }
                        is ArtistItem -> if (!(explicitForeign && !gl.equals("IT", true) && normSearchKey(item.title).let { it in ITALIAN_POPULAR_ARTISTS && it !in GLOBAL_POPULAR_ARTISTS })) {
                            itemsArr.put(item.toJson(peekCachedArtistThumb(item.title) ?: upgradeThumb(item.thumbnail, HOME_THUMB_SIZE)))
                        }
                        is PlaylistItem -> if (!isMismatchedCountryPlaylist(item.title, gl)) {
                            itemsArr.put(item.toJson(thumbSize = HOME_THUMB_SIZE))
                        }
                        else -> {}
                    }
                }
                if (itemsArr.length() > 0) {
                    secObj.put("items", itemsArr)
                    sectionsList.add(secObj)
                }
            }
        }

        if (finalQuickSongs.isNotEmpty()) {
            val quickArr = enrichSongsToJson(finalQuickSongs, maxResolve = 20, thumbSize = HOME_THUMB_SIZE)
            for (i in 0 until quickArr.length()) {
                quickArr.optJSONObject(i)?.put("kind", "track")
            }
            sectionsList.removeAll { sec ->
                val sk = sec.optString("sectionKey")
                val t = sec.optString("title").lowercase()
                sk == "quick_picks" || "scelte rapide" in t || "quick picks" in t
            }
            sectionsList.add(0, JSONObject().apply {
                put("title", if (hl == "it") "Scelte rapide" else "Quick picks")
                put("sectionKey", "quick_picks")
                put("type", "")
                put("artist", "")
                put("items", quickArr)
            })
        }

        if (popularNewReleases.isNotEmpty()) {
            val itemsArr = JSONArray()
            popularNewReleases.forEach { album -> itemsArr.put(album.toJson(thumbSize = HOME_THUMB_SIZE)) }
            sectionsList.removeAll { sec ->
                val sk = sec.optString("sectionKey")
                val t = sec.optString("title").lowercase()
                sk == "new_releases" || "nuove uscite" in t || "new releases" in t
            }
            sectionsList.add(JSONObject().apply {
                put("title", if (hl == "it") "Nuove uscite" else "New releases")
                put("sectionKey", "new_releases")
                put("type", "")
                put("artist", "")
                put("items", itemsArr)
            })
        }

        val artistRows = mutableListOf<JSONObject>()
        for (aid in aids) {
            val artistRes = HomeSubCache.getArtist(aid, locKey) ?: continue
            val name = artistRes.artist.title.ifEmpty { if (hl == "it") "questo artista" else "this artist" }

            val relArr = JSONArray()
            val relItems = mutableListOf<ArtistItem>()
            for (sec in artistRes.sections) {
                for (item in sec.items) {
                    if (item is ArtistItem && relItems.size < 14) {
                        relItems.add(item)
                    }
                }
            }
            for (item in relItems) {
                val artThumb = peekCachedArtistThumb(item.title) ?: upgradeThumb(item.thumbnail, HOME_THUMB_SIZE)
                relArr.put(item.toJson(artThumb))
            }
            if (relArr.length() > 0) {
                artistRows.add(JSONObject().apply {
                    put("title", if (hl == "it") "Simile a $name" else "Similar to $name")
                    put("sectionKey", "similar_artists")
                    put("type", "similar_artists")
                    put("artist", name)
                    put("items", relArr)
                })
            }

            val albArr = JSONArray()
            for (sec in artistRes.sections) {
                val secTitle = sec.title.lowercase()
                if (secTitle.contains("album") || secTitle.contains("single") || secTitle.contains("singol") || Regex("""\bep\b""").containsMatchIn(secTitle)) {
                    for (item in sec.items) {
                        if (item is AlbumItem && albArr.length() < 14) {
                            val hqAlb = peekCachedAlbumThumb(item.title, name, HOME_THUMB_SIZE)
                            val j = item.toJson(thumbSize = HOME_THUMB_SIZE, hqThumb = hqAlb)
                            if (j.optString("artist").isBlank() && name.isNotBlank()) j.put("artist", name)
                            if (j.optString("artistId").isBlank()) j.put("artistId", aid)
                            albArr.put(j)
                        }
                    }
                }
            }
            if (albArr.length() > 0) {
                artistRows.add(JSONObject().apply {
                    put("title", if (hl == "it") "Altro da $name" else "More from $name")
                    put("sectionKey", "artist_releases")
                    put("type", "artist_releases")
                    put("artist", name)
                    put("items", albArr)
                })
            }
        }

        if (exploreResult == null || chartsResult == null || aids.any { HomeSubCache.getArtist(it, locKey) == null }) {
            scheduleHomeSecondaryWarm(aids, locKey, gl, hl)
        }

        val allSections = ArrayList<JSONObject>(sectionsList.size + artistRows.size).apply {
            addAll(sectionsList)
            addAll(artistRows)
        }
        val sortedSections = allSections
            .withIndex()
            .sortedWith(compareBy({ sectionRank(it.value.optString("title"), it.value.optString("sectionKey")) }, { it.index }))
            .map { it.value }

        val mergedArray = JSONArray()
        sortedSections.forEach { mergedArray.put(it) }

        val root = JSONObject().apply {
            put("rows", mergedArray)
        }
        root.toString() to (mergedArray.length() > 0)
    }

    private fun homeHasAppleNewReleases(jsonStr: String): Boolean = runCatching {
        val rows = JSONObject(jsonStr).optJSONArray("rows") ?: return@runCatching true
        for (i in 0 until rows.length()) {
            val row = rows.optJSONObject(i) ?: continue
            if (row.optString("sectionKey") == "new_releases") {
                val items = row.optJSONArray("items") ?: return@runCatching true
                if (items.length() == 0) return@runCatching false
                for (j in 0 until items.length()) {
                    val thumb = items.optJSONObject(j)?.optString("thumb").orEmpty()
                    if (!thumb.contains("mzstatic.com", ignoreCase = true)) {
                        return@runCatching false
                    }
                }
            }
        }
        true
    }.getOrDefault(true)

    private fun handleHome(uri: Uri): WebResourceResponse = runBlocking {
        val noSeed = uri.getQueryParameter("noSeed") == "1"
        val seed = if (noSeed) "" else uri.getQueryParameter("seed").orEmpty()
        val artistsParam = uri.getQueryParameter("artists").orEmpty()
        val forceRefresh = uri.getQueryParameter("refresh") == "1"
        val locKey = SonoraLocaleManager.cacheTag()
        val gl = SonoraLocaleManager.resolvedCountry
        val hl = SonoraLocaleManager.resolvedLang
        val cacheKey = "home_v11:$locKey:$seed:$artistsParam"

        if (!forceRefresh) {
            ApiCache.get(cacheKey)?.let { return@runBlocking jsonResponse(it) }
        }

        val normalizedArtists = artistsParam.split(',', ' ', ';')
            .asSequence()
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .take(3)
            .sorted()
            .joinToString(",")
        val snapshotKey = if (normalizedArtists.isEmpty()) "home_default_v11:$locKey" else "home_v11:$locKey:$normalizedArtists"
        val lastGoodKey = "home_last_good_v11:$locKey"

        if (!forceRefresh) {
            val disk = SnapshotDiskCache.get(snapshotKey, freshTtlMs = 600_000L)
            if (disk != null) {
                val completeDisk = homeHasAppleNewReleases(disk.data)
                val needsImmediateHeal = !completeDisk && AppleCatalog.hasReadyToken()
                if (disk.isFresh && !needsImmediateHeal) {
                    ApiCache.put(cacheKey, disk.data, 300)
                } else {
                    ApiCache.put(cacheKey, disk.data, if (needsImmediateHeal) 15 else 30)
                    SnapshotDiskCache.revalidate(snapshotKey) {
                        if (!needsImmediateHeal) delay(1800L)
                        if (SonoraLocaleManager.cacheTag() != locKey) return@revalidate
                        ensureLocale()
                        val (fresh, valid) = buildHomeJson(seed, artistsParam, locKey, gl, hl)
                        val completeFresh = valid && (AppleCatalog.hasReadyToken() || homeHasAppleNewReleases(fresh))
                        if (valid && SonoraLocaleManager.cacheTag() == locKey) {
                            ApiCache.put(cacheKey, fresh, if (completeFresh) 600 else 20)
                            if (completeFresh) {
                                SnapshotDiskCache.put(snapshotKey, fresh)
                                SnapshotDiskCache.put(lastGoodKey, fresh)
                            }
                        }
                    }
                }
                return@runBlocking jsonResponse(disk.data)
            }

            val lastGood = SnapshotDiskCache.get(lastGoodKey, freshTtlMs = 600_000L)
            if (lastGood != null) {
                val completeLast = homeHasAppleNewReleases(lastGood.data)
                val needsImmediateHeal = !completeLast && AppleCatalog.hasReadyToken()
                ApiCache.put(cacheKey, lastGood.data, if (needsImmediateHeal) 15 else 60)
                if (!lastGood.isFresh || normalizedArtists.isNotEmpty() || needsImmediateHeal) {
                    SnapshotDiskCache.revalidate(snapshotKey) {
                        if (!needsImmediateHeal) delay(1800L)
                        if (SonoraLocaleManager.cacheTag() != locKey) return@revalidate
                        ensureLocale()
                        val (fresh, valid) = buildHomeJson(seed, artistsParam, locKey, gl, hl)
                        val completeFresh = valid && (AppleCatalog.hasReadyToken() || homeHasAppleNewReleases(fresh))
                        if (valid && SonoraLocaleManager.cacheTag() == locKey) {
                            ApiCache.put(cacheKey, fresh, if (completeFresh) 600 else 20)
                            if (completeFresh) {
                                SnapshotDiskCache.put(snapshotKey, fresh)
                                SnapshotDiskCache.put(lastGoodKey, fresh)
                            }
                        }
                    }
                }
                return@runBlocking jsonResponse(lastGood.data)
            }
        } else {
            HomeSubCache.clearLocaleKey(locKey, gl)
        }

        val (rootStr, valid) = buildHomeJson(seed, artistsParam, locKey, gl, hl)
        if (valid && SonoraLocaleManager.cacheTag() == locKey) {
            val completeFresh = AppleCatalog.hasReadyToken() || homeHasAppleNewReleases(rootStr)
            ApiCache.put(cacheKey, rootStr, if (completeFresh) 600 else 20)
            if (completeFresh) {
                SnapshotDiskCache.putAsync(snapshotKey, rootStr)
                SnapshotDiskCache.putAsync(lastGoodKey, rootStr)
            }
        }
        jsonResponse(rootStr)
    }

    private suspend fun resolveArtistThumb(name: String, rawThumb: String? = null, size: Int = 544): String? {
        val effSize = size.coerceIn(120, 1400)
        peekCachedArtistThumb(name, effSize)?.let { return it }
        return runCatching {
            withTimeoutOrNull(1500) {
                // AppleCatalog.artist(name) already strips "- Topic" / "feat." and falls back to raw name if needed.
                AppleCatalog.artist(name)?.heroUrl?.let {
                    val coverUrl = "/api/cover?u=${URLEncoder.encode(it, "UTF-8")}&s=$effSize"
                    rememberResolvedArtistThumb(name, coverUrl)
                    coverUrl
                }
            }
        }.getOrNull()
    }

    private suspend fun resolveArtistThumb(item: ArtistItem, size: Int = 544): String? {
        return resolveArtistThumb(item.title, size = size)
    }

    private fun normSearchKey(s: String): String {
        val nfd = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
        return nfd.replace(Regex("""\p{InCombiningDiacriticalMarks}+"""), "")
            .lowercase()
            .replace(Regex("""[^a-z0-9]+"""), " ")
            .trim()
    }

    private fun normCompactKey(s: String): String = normSearchKey(s).replace(" ", "")

    private suspend fun buildSearchJson(cleanQ: String, type: String): Pair<String, Boolean> {
        val songs = mutableListOf<SongItem>()
        val albums = mutableListOf<AlbumItem>()
        val artists = mutableListOf<ArtistItem>()
        val playlists = mutableListOf<PlaylistItem>()
        val seenSongs = HashSet<String>()
        val songIndexBySig = HashMap<String, Int>()
        val seenAlbums = HashSet<String>()
        val seenAlbumSigs = HashSet<String>()
        val seenArtists = HashSet<String>()
        val seenArtistNames = HashSet<String>()
        val seenPlaylists = HashSet<String>()

        fun songQualityScore(item: SongItem): Int = studioAudioScore(item, cleanQ)

        fun addSong(item: SongItem) {
            if (shouldFilterTrack(item, cleanQ)) return
            if (seenSongs.contains(item.id)) return
            val titleKey = normCompactKey(item.title)
            val firstArtist = cleanArtistsList(item.artists).firstOrNull()?.name ?: ""
            val sig = if (titleKey.isNotEmpty()) "$titleKey|${normCompactKey(firstArtist)}" else ""
            if (sig.isNotEmpty()) {
                val existingIdx = songIndexBySig[sig]
                if (existingIdx != null) {
                    if (songQualityScore(item) > songQualityScore(songs[existingIdx])) {
                        seenSongs.add(item.id)
                        songs[existingIdx] = item
                    }
                    return
                }
            }
            seenSongs.add(item.id)
            if (sig.isNotEmpty()) songIndexBySig[sig] = songs.size
            songs.add(item)
        }

        fun addAlbum(item: AlbumItem) {
            val titleKey = normCompactKey(item.title)
            val firstArtist = cleanArtistsList(item.artists).firstOrNull()?.name ?: ""
            val sig = if (titleKey.isNotEmpty()) "$titleKey|${normCompactKey(firstArtist)}" else ""
            if (seenAlbums.contains(item.browseId) || (sig.isNotEmpty() && seenAlbumSigs.contains(sig))) return
            seenAlbums.add(item.browseId)
            if (sig.isNotEmpty()) seenAlbumSigs.add(sig)
            albums.add(item)
        }

        fun addArtist(item: ArtistItem) {
            val nameKey = normCompactKey(item.title)
            if (seenArtists.contains(item.id) || (nameKey.isNotEmpty() && seenArtistNames.contains(nameKey))) return
            seenArtists.add(item.id)
            if (nameKey.isNotEmpty()) seenArtistNames.add(nameKey)
            artists.add(item)
        }

        fun addPlaylist(item: PlaylistItem) {
            if (seenPlaylists.add(item.id)) playlists.add(item)
        }

        var topKind = when (type) {
            "artists" -> "artists"
            "albums" -> "albums"
            "playlists" -> "playlists"
            else -> "songs"
        }

        val searchLocale = SonoraLocaleManager.effectiveRegionalYoutubeLocale()

        if (type == "all") {
            val (summary, songResults) = coroutineScope {
                val summaryDef = async(Dispatchers.IO) {
                    runCatching { YouTube.searchSummary(cleanQ, localeOverride = searchLocale).getOrNull() }.getOrElse {
                        android.util.Log.w("SonoraSearch", "searchSummary failed for $cleanQ: ${it.message}")
                        null
                    }
                }
                val songsDef = async(Dispatchers.IO) {
                    runCatching {
                        YouTube.search(cleanQ, YouTube.SearchFilter.FILTER_SONG, localeOverride = searchLocale).getOrNull()
                            ?.items?.filterIsInstance<SongItem>().orEmpty()
                    }.getOrElse {
                        android.util.Log.w("SonoraSearch", "FILTER_SONG failed for $cleanQ: ${it.message}")
                        emptyList()
                    }
                }
                summaryDef.await() to songsDef.await()
            }

            val topSec = summary?.summaries?.firstOrNull {
                it.title.equals("Top result", true) || it.title.equals("Risultato principale", true)
            } ?: summary?.summaries?.firstOrNull()
            val firstTopItem = topSec?.items?.firstOrNull()
            topKind = when (firstTopItem) {
                is ArtistItem -> "artists"
                is AlbumItem -> "albums"
                is PlaylistItem -> "playlists"
                else -> "songs"
            }

            if (firstTopItem is SongItem && !firstTopItem.isVideoSong && !isNoisyVideoTitle(firstTopItem.title, cleanQ)) {
                addSong(firstTopItem)
            }
            if (firstTopItem !is SongItem) {
                topSec?.items?.filterIsInstance<SongItem>()
                    ?.filter { !it.isVideoSong && !isNoisyVideoTitle(it.title, cleanQ) }
                    ?.forEach { addSong(it) }
            }
            songResults.filter { !it.isVideoSong && !isNoisyVideoTitle(it.title, cleanQ) }.forEach { addSong(it) }
            for (sec in summary?.summaries.orEmpty()) {
                val secLow = sec.title.lowercase()
                if (secLow in setOf("songs", "brani", "titres", "titel", "canciones", "musicas", "músicas")) {
                    sec.items.filterIsInstance<SongItem>().forEach { addSong(it) }
                }
            }
            if (firstTopItem is SongItem) addSong(firstTopItem)
            songResults.forEach { addSong(it) }

            when (firstTopItem) {
                is ArtistItem -> addArtist(firstTopItem)
                is AlbumItem -> addAlbum(firstTopItem)
                is PlaylistItem -> addPlaylist(firstTopItem)
                else -> {}
            }
            for (sec in summary?.summaries.orEmpty()) {
                if (sec.title.equals("Video", true) ||
                    sec.title.equals("Videos", true) ||
                    sec.title.equals("Episodi", true) ||
                    sec.title.equals("Episodes", true)
                ) {
                    continue
                }
                for (item in sec.items) {
                    when (item) {
                        is ArtistItem -> addArtist(item)
                        is AlbumItem -> addAlbum(item)
                        is PlaylistItem -> addPlaylist(item)
                        else -> {}
                    }
                }
            }
        } else {
            when (type) {
                "songs" -> runCatching {
                    YouTube.search(cleanQ, YouTube.SearchFilter.FILTER_SONG, localeOverride = searchLocale).getOrNull()
                        ?.items?.filterIsInstance<SongItem>().orEmpty()
                }.getOrDefault(emptyList()).forEach { addSong(it) }
                "albums" -> runCatching {
                    YouTube.search(cleanQ, YouTube.SearchFilter.FILTER_ALBUM, localeOverride = searchLocale).getOrNull()
                        ?.items?.filterIsInstance<AlbumItem>().orEmpty()
                }.getOrDefault(emptyList()).forEach { addAlbum(it) }
                "artists" -> runCatching {
                    YouTube.search(cleanQ, YouTube.SearchFilter.FILTER_ARTIST, localeOverride = searchLocale).getOrNull()
                        ?.items?.filterIsInstance<ArtistItem>().orEmpty()
                }.getOrDefault(emptyList()).forEach { addArtist(it) }
                "playlists" -> runCatching {
                    YouTube.search(cleanQ, YouTube.SearchFilter.FILTER_COMMUNITY_PLAYLIST, localeOverride = searchLocale).getOrNull()
                        ?.items?.filterIsInstance<PlaylistItem>().orEmpty()
                }.getOrDefault(emptyList()).forEach { addPlaylist(it) }
            }
        }

        val mergedSongs = deduplicateAndPreferStudio(songs, cleanQ)
        val limit = if (type == "all") 12 else 30
        val topSongs = mergedSongs.take(limit)
        val songResolveLimit = if (type == "all") 12 else 16
        val canonicalTargets = topSongs.take(songResolveLimit).mapIndexedNotNull { idx, song ->
            val firstArtist = primaryArtistName(song)
            val albName = song.album?.name?.trim().orEmpty()
            val isComp = albName.isEmpty() || isLikelyCompilationAlbum(albName, song.title, firstArtist)
            if (firstArtist.isNotBlank()) {
                idx to Triple(song, firstArtist, if (isComp) "" else albName)
            } else {
                null
            }
        }
        val artistLimit = if (type == "all") 4 else 8
        val artistThumbTargets = artists.take(artistLimit).filter { peekCachedArtistThumb(it.title, 544) == null }
        val albumLimit = if (type == "all") 6 else 10
        val albumThumbTargets = albums.take(albumLimit).filter { alb ->
            val artistName = cleanArtistsList(alb.artists).firstOrNull()?.name ?: alb.artists?.firstOrNull()?.name.orEmpty()
            peekCachedAlbumThumb(alb.title, artistName, 544) == null
        }
        val songFallbackThumbs = HashMap<Int, String>()
        val (canonicalOverrides, resolvedArtistThumbs, resolvedAlbumThumbs) =
            if (canonicalTargets.isEmpty() && artistThumbTargets.isEmpty() && albumThumbTargets.isEmpty()) {
                Triple(emptyMap<Int, CanonicalSongMeta>(), emptyMap<String, String>(), emptyMap<String, String>())
            } else {
                coroutineScope {
                    val songSem = Semaphore(5)
                    val songDefs = canonicalTargets.map { (idx, triple) ->
                        async(Dispatchers.IO) {
                            val (song, firstArtist, hintAlb) = triple
                            val meta = songSem.withPermit {
                                withTimeoutOrNull(1400L) {
                                    resolveCanonicalSongMeta(song.title, firstArtist, hintAlb)
                                }
                            }
                            if (meta != null) {
                                idx to (meta to null)
                            } else if (hintAlb.isNotBlank() && AppleCatalog.hasReadyToken()) {
                                val fallbackAlb = songSem.withPermit {
                                    withTimeoutOrNull(1200L) {
                                        resolveAlbumThumb(hintAlb, firstArtist, 544)
                                    }
                                }
                                fallbackAlb?.let { idx to (null to it) }
                            } else {
                                null
                            }
                        }
                    }
                    val artistDefs = artistThumbTargets.map { artistItem ->
                        async(Dispatchers.IO) {
                            val thumb = withTimeoutOrNull(1400L) {
                                resolveArtistThumb(artistItem.title, size = 544)
                            }
                            thumb?.let { artistItem.id to it }
                        }
                    }
                    val albumDefs = albumThumbTargets.map { alb ->
                        val artistName = cleanArtistsList(alb.artists).firstOrNull()?.name ?: alb.artists?.firstOrNull()?.name.orEmpty()
                        async(Dispatchers.IO) {
                            val thumb = withTimeoutOrNull(1400L) {
                                resolveAlbumThumb(alb.title, artistName, 544)
                            }
                            thumb?.let { alb.browseId to it }
                        }
                    }
                    val canonMap = HashMap<Int, CanonicalSongMeta>()
                    for (entry in songDefs.awaitAll().filterNotNull()) {
                        val (idx, pair) = entry
                        pair.first?.let { canonMap[idx] = it }
                        pair.second?.let { songFallbackThumbs[idx] = it }
                    }
                    Triple(
                        canonMap,
                        artistDefs.awaitAll().filterNotNull().toMap(),
                        albumDefs.awaitAll().filterNotNull().toMap()
                    )
                }
            }
        val songsArr = JSONArray()
        topSongs.forEachIndexed { idx, song ->
            val obj = song.toJson()
            val override = canonicalOverrides[idx]
            if (override != null) {
                obj.put("thumb", resizeCoverApiUrl(override.coverUrl, 544))
                val curAlb = song.album?.name?.trim().orEmpty()
                val firstArtist = primaryArtistName(song)
                val albumReplaced = override.albumName.isNotBlank() && (
                    curAlb.isEmpty() ||
                        isLikelyCompilationAlbum(curAlb, song.title, firstArtist) ||
                        normAlbumCacheKey(curAlb, firstArtist) != normAlbumCacheKey(override.albumName, firstArtist)
                    )
                if (albumReplaced) {
                    obj.put("album", override.albumName)
                    if (curAlb.isNotEmpty()) obj.put("albumId", JSONObject.NULL)
                } else if (curAlb.isNotEmpty() && isLikelyCompilationAlbum(curAlb, song.title, firstArtist)) {
                    obj.put("albumId", JSONObject.NULL)
                }
                obj.put("canonicalCover", true)
            } else {
                val fbThumb = songFallbackThumbs[idx] ?: run {
                    val albName = song.album?.name?.trim().orEmpty()
                    val firstArtist = primaryArtistName(song)
                    if (albName.isNotEmpty() && !isLikelyCompilationAlbum(albName, song.title, firstArtist)) {
                        peekCachedAlbumThumb(albName, firstArtist, 544)
                    } else null
                }
                fbThumb?.let { appleAlb ->
                    obj.put("thumb", appleAlb)
                }
            }
            songsArr.put(obj)
        }
        val albumsArr = JSONArray()
        albums.take(limit).forEach { alb ->
            val artistName = cleanArtistsList(alb.artists).firstOrNull()?.name ?: alb.artists?.firstOrNull()?.name.orEmpty()
            val hqThumb = resolvedAlbumThumbs[alb.browseId] ?: peekCachedAlbumThumb(alb.title, artistName, 544)
            albumsArr.put(alb.toJson(thumbSize = 544, hqThumb = hqThumb))
        }
        val artistsArr = JSONArray()
        artists.take(limit).forEach { item ->
            val thumb = peekCachedArtistThumb(item.title, 544) ?: resolvedArtistThumbs[item.id] ?: upgradeThumb(item.thumbnail, 544)
            artistsArr.put(item.toJson(thumb))
        }
        val playlistsArr = JSONArray()
        playlists.take(limit).forEach { playlistsArr.put(it.toJson()) }

        val valid = songsArr.length() > 0 || albumsArr.length() > 0 || artistsArr.length() > 0 || playlistsArr.length() > 0
        val root = JSONObject().apply {
            put("q", cleanQ)
            put("topKind", topKind)
            put("songs", songsArr)
            put("albums", albumsArr)
            put("artists", artistsArr)
            put("playlists", playlistsArr)
        }
        android.util.Log.d(
            "SonoraSearch",
            "Search '$cleanQ' type='$type' topKind='$topKind': songs=${songsArr.length()}, albums=${albumsArr.length()}, artists=${artistsArr.length()}, playlists=${playlistsArr.length()}",
        )
        return root.toString() to valid
    }

    private fun handleSearch(q: String, typeParam: String = "all"): WebResourceResponse = runBlocking {
        val cleanQ = q.trim()
        val type = if (typeParam.isBlank()) "all" else typeParam
        if (cleanQ.isBlank()) return@runBlocking jsonResponse(JSONObject().apply {
            put("q", cleanQ)
            put("topKind", "songs")
            put("songs", JSONArray())
            put("albums", JSONArray())
            put("artists", JSONArray())
            put("playlists", JSONArray())
        }.toString())

        val locKey = SonoraLocaleManager.cacheTag()
        val cacheKey = "search_v13:$locKey:$type:${cleanQ.lowercase()}"
        ApiCache.get(cacheKey)?.let { return@runBlocking jsonResponse(it) }

        val disk = SnapshotDiskCache.get(cacheKey, freshTtlMs = 1_800_000L)
        if (disk != null) {
            if (disk.isFresh) {
                ApiCache.put(cacheKey, disk.data, 600)
            } else {
                ApiCache.put(cacheKey, disk.data, 60)
                SnapshotDiskCache.revalidate(cacheKey) {
                    if (SonoraLocaleManager.cacheTag() != locKey) return@revalidate
                    ensureLocale()
                    val (fresh, valid) = buildSearchJson(cleanQ, type)
                    if (valid && AppleCatalog.hasReadyToken() && SonoraLocaleManager.cacheTag() == locKey) {
                        ApiCache.put(cacheKey, fresh, 600)
                        SnapshotDiskCache.put(cacheKey, fresh)
                    }
                }
            }
            return@runBlocking jsonResponse(disk.data)
        }

        val (rootStr, valid) = buildSearchJson(cleanQ, type)
        if (valid && SonoraLocaleManager.cacheTag() == locKey) {
            if (AppleCatalog.hasReadyToken()) {
                ApiCache.put(cacheKey, rootStr, 600)
                SnapshotDiskCache.put(cacheKey, rootStr)
            } else {
                ApiCache.put(cacheKey, rootStr, 10)
            }
        }
        jsonResponse(rootStr)
    }

    private fun handleSuggest(q: String): WebResourceResponse = runBlocking {
        if (q.isBlank()) return@runBlocking jsonResponse("{\"q\":\"\",\"suggestions\":[]}")
        val locKey = SonoraLocaleManager.cacheTag()
        val cacheKey = "suggest_v2:$locKey:$q"
        ApiCache.get(cacheKey)?.let { return@runBlocking jsonResponse(it) }
        val suggestions = YouTube.searchSuggestions(q).getOrNull()?.queries.orEmpty()
        val root = JSONObject().apply {
            put("q", q)
            val arr = JSONArray()
            suggestions.take(10).forEach { arr.put(it) }
            put("suggestions", arr)
        }
        val rootStr = root.toString()
        ApiCache.put(cacheKey, rootStr, 300)
        jsonResponse(rootStr)
    }

    private fun handleAlbum(id: String, uri: Uri): WebResourceResponse = runBlocking {
        val locKey = SonoraLocaleManager.cacheTag()
        val cacheKey = "album_v4:$locKey:$id"
        ApiCache.get(cacheKey)?.let { return@runBlocking jsonResponse(it) }

        val hintTitle = uri.getQueryParameter("title")?.trim().orEmpty()
        val hintArtist = uri.getQueryParameter("artist")?.trim().orEmpty()

        val (albumResult, hintAppleAlbum) = coroutineScope {
            val albumDeferred = async(Dispatchers.IO) { YouTube.album(id).getOrNull() }
            val appleDeferred = if (hintTitle.isNotBlank()) {
                async(Dispatchers.IO) { AppleCatalog.album(hintTitle, hintArtist) }
            } else null
            albumDeferred.await() to appleDeferred?.await()
        }

        if (albumResult != null) {
            val artistName = albumResult.album.artists?.joinToString(", ") { it.name }.orEmpty()
            val json = albumResult.album.toJson(withTracks = true, songs = albumResult.songs, thumbSize = 1200)
            val resolvedApple = hintAppleAlbum ?: run {
                val exactMatch = hintTitle.equals(albumResult.album.title, ignoreCase = true) &&
                    (hintArtist.isNotBlank() || artistName.isBlank())
                if (hintTitle.isNotBlank() && exactMatch) null
                else AppleCatalog.album(albumResult.album.title, artistName)
            }
            val appleCover = resolvedApple?.coverUrl
            val cachedApple = if (appleCover == null) {
                peekCachedAlbumThumb(albumResult.album.title, artistName, 1200)
                    ?: (if (hintTitle.isNotBlank()) peekCachedAlbumThumb(hintTitle, hintArtist, 1200) else null)
            } else null
            val albumThumb = if (appleCover != null) {
                "/api/cover?u=${URLEncoder.encode(appleCover, "UTF-8")}&s=1200".also { u ->
                    rememberResolvedAlbumThumb(albumResult.album.title, artistName, u)
                    if (hintTitle.isNotBlank()) rememberResolvedAlbumThumb(hintTitle, hintArtist, u)
                }
            } else {
                cachedApple ?: upgradeThumb(albumResult.album.thumbnail, 1200) ?: json.optString("thumb")
            }
            val isAppleAlb = appleCover != null || cachedApple != null
            if (albumThumb.isNotBlank()) {
                json.put("thumb", albumThumb)
                val tracks = json.optJSONArray("tracks")
                if (tracks != null) {
                    val trackThumb = resizeCoverApiUrl(albumThumb, 544)
                    val hue = json.optInt("hue", 100)
                    val style = json.optInt("style", 1)
                    for (i in 0 until tracks.length()) {
                        val tr = tracks.optJSONObject(i)
                        if (tr != null) {
                            tr.put("thumb", trackThumb)
                            tr.put("hue", hue)
                            tr.put("style", style)
                            if (isAppleAlb) tr.put("canonicalCover", true)
                        }
                    }
                }
            }
            val jsonStr = json.toString()
            ApiCache.put(cacheKey, jsonStr, if (AppleCatalog.hasReadyToken()) 1800 else 15)
            jsonResponse(jsonStr)
        } else {
            errorResponse(404, localizedMsg("Album non trovato", "Album not found"))
        }
    }

    private fun handleArtist(id: String, uri: Uri): WebResourceResponse = runBlocking {
        val locKey = SonoraLocaleManager.cacheTag()
        val hl = SonoraLocaleManager.resolvedLang
        val cacheKey = "artist_v6:$locKey:$id"
        ApiCache.get(cacheKey)?.let { return@runBlocking jsonResponse(it) }

        val hintName = uri.getQueryParameter("name")?.trim()?.takeIf { it.isNotBlank() }
            ?: uri.getQueryParameter("title")?.trim().orEmpty()
        val cleanHint = hintName.replace(Regex("(?i)\\s*-\\s*topic$"), "")
            .replace(Regex("(?i)\\b(feat|ft)\\.?.*$"), "")
            .trim()

        val (artistResult, hintAppleArtist) = coroutineScope {
            val artistDeferred = async(Dispatchers.IO) { YouTube.artist(id).getOrNull() }
            val appleDeferred = if (cleanHint.isNotBlank()) {
                async(Dispatchers.IO) { AppleCatalog.artist(hintName).takeIf { it?.heroUrl != null } }
            } else null
            artistDeferred.await() to appleDeferred?.await()
        }

        if (artistResult != null) {
            val songsArr = JSONArray()
            val albumsArr = JSONArray()
            val singlesArr = JSONArray()
            val relatedArr = JSONArray()
            val relatedItems = mutableListOf<ArtistItem>()
            val pendingAlbumItems = mutableListOf<Pair<Boolean, AlbumItem>>()

            val (hue, style) = SonoraColors.look(artistResult.artist.id)
            val cleanTitle = artistResult.artist.title.replace(Regex("(?i)\\s*-\\s*topic$"), "")
                .replace(Regex("(?i)\\b(feat|ft)\\.?.*$"), "")
                .trim()
            val appleArtist = if (cleanTitle.equals(cleanHint, ignoreCase = true) && hintAppleArtist != null) {
                hintAppleArtist
            } else if (
                cleanTitle.equals(cleanHint, ignoreCase = true) &&
                artistResult.artist.title.equals(hintName, ignoreCase = true) &&
                cleanHint.isNotBlank()
            ) {
                null
            } else {
                AppleCatalog.artist(artistResult.artist.title).takeIf { it?.heroUrl != null }
            }
            val thumb = appleArtist?.heroUrl?.let {
                val coverUrl = "/api/cover?u=${URLEncoder.encode(it, "UTF-8")}&s=1200"
                rememberResolvedArtistThumb(artistResult.artist.title, coverUrl)
                coverUrl
            } ?: peekCachedArtistThumb(artistResult.artist.title, 1200)
                ?: upgradeThumb(artistResult.artist.thumbnail, 1200)

            val pendingSongItems = mutableListOf<SongItem>()
            for (sec in artistResult.sections) {
                val secTitle = sec.title.lowercase()
                val isSingleSec = secTitle.contains("single") || secTitle.contains("singol") || Regex("""\bep\b""").containsMatchIn(secTitle)
                for (item in sec.items) {
                    when (item) {
                        is SongItem -> pendingSongItems.add(item)
                        is AlbumItem -> pendingAlbumItems.add(isSingleSec to item)
                        is ArtistItem -> relatedItems.add(item)
                        else -> {}
                    }
                }
            }

            val resolvedAlbMap = if (AppleCatalog.hasReadyToken() && pendingAlbumItems.isNotEmpty()) {
                val targets = pendingAlbumItems.map { it.second }.distinctBy { it.browseId }.filter { alb ->
                    val artName = cleanArtistsList(alb.artists).firstOrNull()?.name ?: alb.artists?.firstOrNull()?.name ?: cleanTitle
                    peekCachedAlbumThumb(alb.title, artName, 544) == null
                }.take(24)

                if (targets.isNotEmpty()) {
                    coroutineScope {
                        val albDefs = targets.map { alb ->
                            val artName = cleanArtistsList(alb.artists).firstOrNull()?.name ?: alb.artists?.firstOrNull()?.name ?: cleanTitle
                            async(Dispatchers.IO) {
                                val resolved = withTimeoutOrNull(1500L) {
                                    resolveAlbumThumb(alb.title, artName, 544)
                                }
                                resolved?.let { alb.browseId to it }
                            }
                        }
                        albDefs.awaitAll().filterNotNull().toMap()
                    }
                } else emptyMap()
            } else emptyMap()

            val songArtistThumb = thumb?.let { resizeCoverApiUrl(it, 544) }
            val enrichedSongs = enrichSongsToJson(
                pendingSongItems,
                maxResolve = 12,
                thumbSize = 544,
                artistThumbFor = { songArtistThumb }
            )
            for (i in 0 until enrichedSongs.length()) {
                songsArr.put(enrichedSongs.getJSONObject(i))
            }

            val seenAlbumIds = HashSet<String>()
            val seenSingleIds = HashSet<String>()
            for ((isSingleSec, item) in pendingAlbumItems) {
                if (isSingleSec && !seenSingleIds.add(item.browseId)) continue
                if (!isSingleSec && !seenAlbumIds.add(item.browseId)) continue
                val itemArtist = cleanArtistsList(item.artists).firstOrNull()?.name ?: item.artists?.firstOrNull()?.name ?: cleanTitle
                val hqAlb = resolvedAlbMap[item.browseId] ?: peekCachedAlbumThumb(item.title, itemArtist, 544)
                val albJson = item.toJson(thumbSize = 544, hqThumb = hqAlb)
                if (isSingleSec) {
                    albJson.put("type", if (hl == "it") "Singolo" else "Single")
                    albJson.put("typeKey", "single")
                } else {
                    albJson.put("typeKey", "album")
                }
                if (albJson.optString("artist").isBlank() && cleanTitle.isNotBlank()) {
                    albJson.put("artist", cleanTitle)
                }
                if (albJson.optString("artistId").isBlank()) {
                    albJson.put("artistId", artistResult.artist.id)
                }
                if (isSingleSec) singlesArr.put(albJson) else albumsArr.put(albJson)
            }

            for (item in relatedItems.take(14)) {
                val relThumb = peekCachedArtistThumb(item.title, 544) ?: upgradeThumb(item.thumbnail, 544)
                relatedArr.put(item.toJson(relThumb))
            }

            val root = JSONObject().apply {
                put("kind", "artist")
                put("id", artistResult.artist.id)
                put("title", artistResult.artist.title)
                put("subscribers", artistResult.subscriberCountText ?: JSONObject.NULL)
                put("monthly", artistResult.monthlyListenerCount ?: JSONObject.NULL)
                put("thumb", thumb ?: JSONObject.NULL)
                put("bio", appleArtist?.bio ?: artistResult.description.orEmpty())
                put("hue", hue)
                put("style", style)
                put("songs", songsArr)
                put("albums", albumsArr)
                put("singles", singlesArr)
                put("related", relatedArr)
            }
            val rootStr = root.toString()
            ApiCache.put(cacheKey, rootStr, if (AppleCatalog.hasReadyToken()) 1800 else 15)
            jsonResponse(rootStr)
        } else {
            errorResponse(404, localizedMsg("Artista non trovato", "Artist not found"))
        }
    }

    private fun handleArtistArt(name: String, id: String, sizeParam: Int = 544): WebResourceResponse = runBlocking {
        val clean = name.replace(Regex("(?i)\\s*-\\s*topic$"), "")
            .replace(Regex("(?i)\\b(feat|ft)\\.?.*$"), "")
            .trim()
        if (clean.isBlank()) return@runBlocking jsonResponse("{\"ok\":false}")

        val size = sizeParam.coerceIn(120, 1400)
        val cacheKey = "art_fast:$clean:$size"
        ApiCache.get(cacheKey)?.let { return@runBlocking jsonResponse(it) }

        peekCachedArtistThumb(clean, size)?.let { cachedThumb ->
            val resp = JSONObject().apply {
                put("ok", true)
                put("name", name)
                put("thumb", cachedThumb)
            }.toString()
            ApiCache.put(cacheKey, resp, 86400)
            return@runBlocking jsonResponse(resp)
        }

        // Never stall WebView shouldInterceptRequest threads on cold Apple Music token scraping.
        if (!AppleCatalog.hasReadyToken()) {
            return@runBlocking jsonResponse(
                JSONObject().apply {
                    put("ok", false)
                    put("cold", true)
                    put("name", name)
                    put("thumb", JSONObject.NULL)
                }.toString()
            )
        }

        val resThumb = resolveArtistThumb(name, size = size)

        val resp = JSONObject().apply {
            put("ok", resThumb != null)
            put("name", name)
            put("thumb", resThumb ?: JSONObject.NULL)
        }.toString()

        if (resThumb != null) {
            ApiCache.put(cacheKey, resp, 86400)
        } else {
            ApiCache.put(cacheKey, resp, 120)
        }
        jsonResponse(resp)
    }

    private fun handleAlbumArt(title: String, artist: String, id: String, sizeParam: Int = 544): WebResourceResponse = runBlocking {
        val cleanTitle = title.trim()
        if (cleanTitle.isBlank()) return@runBlocking jsonResponse("{\"ok\":false}")

        val size = sizeParam.coerceIn(120, 1400)
        val keyNorm = normAlbumCacheKey(cleanTitle, artist)
        val cacheKey = "alb_fast_v2:$keyNorm:$size"
        ApiCache.get(cacheKey)?.let { return@runBlocking jsonResponse(it) }

        peekCachedAlbumThumb(cleanTitle, artist, size)?.let { cachedThumb ->
            val resp = JSONObject().apply {
                put("ok", true)
                put("id", id)
                put("title", title)
                put("artist", artist)
                put("thumb", cachedThumb)
            }.toString()
            ApiCache.put(cacheKey, resp, 86400)
            return@runBlocking jsonResponse(resp)
        }

        val hasToken = AppleCatalog.hasReadyToken()
        val resThumb = resolveAlbumThumb(cleanTitle, artist, size)

        if (resThumb == null && !hasToken) {
            return@runBlocking jsonResponse(
                JSONObject().apply {
                    put("ok", false)
                    put("cold", true)
                    put("id", id)
                    put("title", title)
                    put("artist", artist)
                    put("thumb", JSONObject.NULL)
                }.toString()
            )
        }

        val resp = JSONObject().apply {
            put("ok", resThumb != null)
            put("id", id)
            put("title", title)
            put("artist", artist)
            put("thumb", resThumb ?: JSONObject.NULL)
        }.toString()

        if (resThumb != null) {
            ApiCache.put(cacheKey, resp, 86400)
        } else {
            ApiCache.put(cacheKey, resp, 120)
        }
        jsonResponse(resp)
    }

    private fun handleTrackArt(
        title: String,
        artist: String,
        album: String,
        id: String,
        sizeParam: Int = 544,
    ): WebResourceResponse = runBlocking {
        val cleanTitle = title.trim()
        val cleanArtist = artist.trim()
        val cleanAlbum = album.trim()
        if (cleanTitle.isBlank() || cleanArtist.isBlank()) {
            return@runBlocking jsonResponse("{\"ok\":false}")
        }

        val size = sizeParam.coerceIn(120, 1400)
        val titleCore = normTitleCore(cleanTitle)
        val artCore = normCompactKey(cleanArtist)
        val albCore = if (cleanAlbum.isNotBlank()) normTitleCore(cleanAlbum) else ""
        val cacheKey = "trk_art_v3:$titleCore|$artCore|$albCore:$size"
        ApiCache.get(cacheKey)?.let { return@runBlocking jsonResponse(it) }

        val nonCompAlbum = cleanAlbum.isNotEmpty() && !isLikelyCompilationAlbum(cleanAlbum, cleanTitle, cleanArtist)
        val meta = resolveCanonicalSongMeta(cleanTitle, cleanArtist, if (nonCompAlbum) cleanAlbum else "")
        if (meta != null) {
            val resThumb = resizeCoverApiUrl(meta.coverUrl, size)
            val resolvedAlb = meta.albumName.takeIf { it.isNotBlank() } ?: cleanAlbum
            val resp = JSONObject().apply {
                put("ok", true)
                put("id", id)
                put("title", title)
                put("artist", artist)
                put("album", resolvedAlb)
                put("thumb", resThumb)
                put("canonicalCover", true)
            }.toString()
            ApiCache.put(cacheKey, resp, 86400)
            return@runBlocking jsonResponse(resp)
        }

        if (nonCompAlbum) {
            peekCachedAlbumThumb(cleanAlbum, cleanArtist, size)?.let { cachedAlb ->
                val resp = JSONObject().apply {
                    put("ok", true)
                    put("id", id)
                    put("title", title)
                    put("artist", artist)
                    put("album", cleanAlbum)
                    put("thumb", cachedAlb)
                    put("canonicalCover", false)
                }.toString()
                ApiCache.put(cacheKey, resp, 600)
                return@runBlocking jsonResponse(resp)
            }
            if (AppleCatalog.hasReadyToken()) {
                val albThumb = resolveAlbumThumb(cleanAlbum, cleanArtist, size)
                if (albThumb != null) {
                    val resp = JSONObject().apply {
                        put("ok", true)
                        put("id", id)
                        put("title", title)
                        put("artist", artist)
                        put("album", cleanAlbum)
                        put("thumb", albThumb)
                        put("canonicalCover", false)
                    }.toString()
                    ApiCache.put(cacheKey, resp, 600)
                    return@runBlocking jsonResponse(resp)
                }
            }
        }

        val resp = JSONObject().apply {
            put("ok", false)
            put("id", id)
            put("title", title)
            put("artist", artist)
            put("thumb", JSONObject.NULL)
        }.toString()
        ApiCache.put(cacheKey, resp, 120)
        jsonResponse(resp)
    }

    private suspend fun enrichSongsToJson(
        songs: List<SongItem>,
        maxResolve: Int = 18,
        thumbSize: Int = 544,
        withTrackNo: Boolean = false,
        artistThumbFor: ((SongItem) -> String?)? = null,
    ): JSONArray = coroutineScope {
        if (songs.isEmpty()) return@coroutineScope JSONArray()
        val scopeSongs = songs.take(maxResolve)
        val sem = Semaphore(5)

        val canonicalMap = HashMap<Int, CanonicalSongMeta>()
        val needCanonical = scopeSongs.mapIndexedNotNull { idx, s ->
            val firstArt = primaryArtistName(s)
            if (firstArt.isNotEmpty()) idx to (s to firstArt) else null
        }
        if (needCanonical.isNotEmpty()) {
            needCanonical.map { (idx, pair) ->
                async(Dispatchers.IO) {
                    val (song, firstArt) = pair
                    val rawAlb = song.album?.name?.trim().orEmpty()
                    val hintAlb = if (rawAlb.isNotEmpty() && !isLikelyCompilationAlbum(rawAlb, song.title, firstArt)) rawAlb else ""
                    val meta = sem.withPermit {
                        withTimeoutOrNull(1600L) {
                            resolveCanonicalSongMeta(song.title, firstArt, hintAlb)
                        }
                    }
                    meta?.let { idx to it }
                }
            }.awaitAll().filterNotNull().forEach { (idx, meta) -> canonicalMap[idx] = meta }
        }

        val fallbackAlbums = LinkedHashMap<String, Pair<String, String>>()
        for ((idx, s) in scopeSongs.withIndex()) {
            if (idx in canonicalMap) continue
            val albName = s.album?.name?.trim().orEmpty()
            val firstArt = primaryArtistName(s)
            if (albName.isNotEmpty() && firstArt.isNotEmpty() && !isLikelyCompilationAlbum(albName, s.title, firstArt)) {
                val ak = normAlbumCacheKey(albName, firstArt)
                if (ak.isNotEmpty() && ak !in fallbackAlbums && peekCachedAlbumThumb(albName, firstArt, thumbSize) == null) {
                    fallbackAlbums[ak] = albName to firstArt
                }
            }
        }
        if (fallbackAlbums.isNotEmpty() && AppleCatalog.hasReadyToken()) {
            fallbackAlbums.values.map { (albName, firstArt) ->
                async(Dispatchers.IO) {
                    sem.withPermit {
                        withTimeoutOrNull(1400L) {
                            resolveAlbumThumb(albName, firstArt, thumbSize)
                        }
                    }
                }
            }.awaitAll()
        }

        val arr = JSONArray()
        songs.forEachIndexed { idx, song ->
            val obj = song.toJson(
                no = if (withTrackNo) idx + 1 else null,
                artistThumb = artistThumbFor?.invoke(song),
                thumbSize = thumbSize
            )
            val meta = canonicalMap[idx]
            if (meta != null) {
                obj.put("thumb", resizeCoverApiUrl(meta.coverUrl, thumbSize))
                obj.put("canonicalCover", true)
                val curAlb = song.album?.name?.trim().orEmpty()
                val firstArt = primaryArtistName(song)
                val albumReplaced = meta.albumName.isNotBlank() && (
                    curAlb.isEmpty() ||
                        isLikelyCompilationAlbum(curAlb, song.title, firstArt) ||
                        normAlbumCacheKey(curAlb, firstArt) != normAlbumCacheKey(meta.albumName, firstArt)
                    )
                if (albumReplaced) {
                    obj.put("album", meta.albumName)
                    if (curAlb.isNotEmpty()) obj.put("albumId", JSONObject.NULL)
                } else if (curAlb.isNotEmpty() && isLikelyCompilationAlbum(curAlb, song.title, firstArt)) {
                    obj.put("albumId", JSONObject.NULL)
                }
            }
            arr.put(obj)
        }
        arr
    }

    private fun handlePlaylist(id: String): WebResourceResponse = runBlocking {
        val locKey = SonoraLocaleManager.cacheTag()
        val cacheKey = "playlist_v3:$locKey:$id"
        ApiCache.get(cacheKey)?.let { return@runBlocking jsonResponse(it) }
        val playlistResult = YouTube.playlist(id).getOrNull()
        if (playlistResult != null) {
            val tracksArr = enrichSongsToJson(playlistResult.songs, maxResolve = 24, withTrackNo = true)
            val totalDur = playlistResult.songs.sumOf { it.duration ?: 0 }
            val json = playlistResult.playlist.toJson(withTracks = false).apply {
                put("tracks", tracksArr)
                put("trackCount", playlistResult.songs.size)
                put("duration", totalDur)
            }
            val jsonStr = json.toString()
            ApiCache.put(cacheKey, jsonStr, if (AppleCatalog.hasReadyToken()) 1800 else 15)
            jsonResponse(jsonStr)
        } else {
            errorResponse(404, localizedMsg("Playlist non trovata", "Playlist not found"))
        }
    }

    private fun handleRadio(videoId: String): WebResourceResponse = runBlocking {
        val locKey = SonoraLocaleManager.cacheTag()
        val cacheKey = "radio_v5:$locKey:$videoId"
        ApiCache.get(cacheKey)?.let { return@runBlocking jsonResponse(it) }
        val nextResult = YouTube.next(WatchEndpoint(videoId = videoId, playlistId = "RDAMVM$videoId")).getOrNull()
            ?: YouTube.next(WatchEndpoint(videoId = videoId)).getOrNull()
        val more = nextResult?.continuation?.let { cont ->
            YouTube.next(nextResult.endpoint, cont).getOrNull()?.items
        }.orEmpty()
        val deduped = deduplicateAndPreferStudio(
            (nextResult?.items.orEmpty() + more)
                .filterIsInstance<SongItem>()
                .distinctBy { it.id }
                .filter { it.id != videoId && !shouldFilterTrack(it) && !isNoisyVideoTitle(it.title) }
        )
        val audioOnly = deduped.filter { !it.isVideoSong }
        val radioSongs = if (audioOnly.size >= 5) audioOnly else deduped
        val tracksArr = enrichSongsToJson(radioSongs, maxResolve = 20)
        val root = JSONObject().apply { put("tracks", tracksArr) }
        val rootStr = root.toString()
        ApiCache.put(cacheKey, rootStr, 600)
        jsonResponse(rootStr)
    }

    internal data class PlaylistSeedTrack(
        val id: String,
        val title: String,
        val artist: String,
        val artistId: String? = null,
        val album: String? = null,
        val position: Int = 0
    )

    internal data class PlaylistRecsRequest(
        val tracks: List<PlaylistSeedTrack>,
        val excludeIds: Set<String>,
        val limit: Int,
        val refreshSalt: String
    )

    internal data class CandidateSeedHit(
        val seedId: String,
        val seedArtistKeys: Set<String>,
        val seedArtistFreqWeight: Double,
        val rankInSeed: Int
    )

    private object PlaylistSeedCache {
        data class Entry(
            val expiryMs: Long,
            val items: List<SongItem>,
            val relatedBrowseId: String?,
            val continuation: String?,
            val endpoint: WatchEndpoint
        )

        private const val MAX_ENTRIES = 160
        private val map = ConcurrentHashMap<String, Entry>()

        fun get(videoId: String): Entry? {
            val e = map[videoId] ?: return null
            if (System.currentTimeMillis() > e.expiryMs) {
                map.remove(videoId, e)
                return null
            }
            return e
        }

        fun put(videoId: String, entry: Entry) {
            if (map.size >= MAX_ENTRIES && !map.containsKey(videoId)) {
                val now = System.currentTimeMillis()
                map.entries.forEach { (k, v) -> if (v.expiryMs <= now) map.remove(k, v) }
                while (map.size >= MAX_ENTRIES) {
                    val oldest = map.entries.minByOrNull { it.value.expiryMs } ?: break
                    map.remove(oldest.key, oldest.value)
                }
            }
            map[videoId] = entry
        }

        fun clear() {
            map.clear()
        }
    }

    private val YT_VIDEO_ID_REGEX = Regex("""^[A-Za-z0-9_-]{11}$""")
    private val YT_ARTIST_ID_REGEX = Regex("""^UC[\w-]{10,40}$""")
    private val ARTIST_SPLIT_REGEX = Regex("""\s*(?:,|&|;|\bfeat\.?|\bft\.?|\bwith\b)\s*""", RegexOption.IGNORE_CASE)
    private val TITLE_SUFFIX_PAREN_REGEX = Regex(
        """\s*[\(\[]\s*(?:feat\.?|ft\.?|with|con|official\s*(?:audio|video|lyric\s*video|music\s*video|visual(?:izer|iser)?)|visual\s*video|lyric\s*video|lyrics?|audio|video|videoclip|performance\s*video|visualizer|visualiser|remaster(?:ed)?(?:\s*\d{4})?|explicit|clean|radio\s*edit|version|live(?:\s*at\s*[^)\]]*)?)\b[^)\]]*[\)\]]""",
        RegexOption.IGNORE_CASE
    )
    private val TITLE_SUFFIX_DASH_REGEX = Regex(
        """\s+-\s+(?:feat\.?|ft\.?|con|official\s*(?:audio|video|lyric\s*video|music\s*video|visual(?:izer|iser)?)|visual\s*video|video\s*ufficiale|videoclip|lyric\s*video|visualizer|visualiser|remaster(?:ed)?|radio\s*edit|explicit|live\b).*$""",
        RegexOption.IGNORE_CASE
    )
    private val REC_JUNK_TERMS = listOf(
        "full album", "album completo", "megamix", "dj mix", "continuous mix",
        "non stop", "non-stop", "compilation", "mashup mix", "podcast",
        "episodio", "episode", "audiobook", "reaction", "reacts to",
        "intervista", "interview", "slowed + reverb", "slowed and reverb",
        "sped up", "bass boosted", "karaoke", "8d audio", "nightcore",
        "parodia", "backing track", "type beat"
    )

    internal fun extractArtistKeys(artistRaw: String?): List<String> {
        if (artistRaw.isNullOrBlank()) return emptyList()
        return artistRaw.split(ARTIST_SPLIT_REGEX)
            .asSequence()
            .map { normSearchKey(it) }
            .filter {
                it.isNotEmpty() &&
                    it != "artista sconosciuto" &&
                    it != "unknown artist" &&
                    it != "various artists" &&
                    it != "artisti vari"
            }
            .distinct()
            .toList()
    }

    internal fun extractSongArtistKeys(item: SongItem): List<String> {
        val valid = cleanArtistsList(item.artists).ifEmpty { item.artists }
        return valid.flatMap { extractArtistKeys(it.name) }.distinct()
    }

    internal fun stripTitleDecorations(rawTitle: String): String {
        var cleaned = rawTitle.trim()
        // Strip trailing feat/con/official/remaster tags iteratively
        repeat(2) {
            cleaned = cleaned.replace(TITLE_SUFFIX_PAREN_REGEX, " ")
        }
        cleaned = cleaned.replace(TITLE_SUFFIX_DASH_REGEX, "")
        return cleaned.replace(COLLAPSE_WS_REGEX, " ").trim()
    }

    internal fun normTitleCore(rawTitle: String): String {
        val cleaned = stripTitleDecorations(rawTitle)
        val core = normCompactKey(cleaned)
        return core.ifEmpty { normCompactKey(rawTitle) }
    }

    internal fun isJunkRecTrack(item: SongItem): Boolean {
        if (item.id.isBlank() || item.isEpisode) return true
        if (shouldFilterTrack(item) || isFeedVideoTrack(item)) return true
        val dur = item.duration
        if (dur != null && (dur < 45 || dur > 600)) return true
        val validArtists = cleanArtistsList(item.artists)
        if (validArtists.isEmpty()) return true
        val artistLow = validArtists.joinToString(" ") { it.name.lowercase() }
        if ("various artists" in artistLow || "artisti vari" in artistLow) return true
        val titleAscii = stripDiacriticsLower(item.title)
        if (REC_JUNK_TERMS.any { it in titleAscii }) return true
        return false
    }

    internal fun computePlaylistArtistFrequencies(tracks: List<PlaylistSeedTrack>): Map<String, Int> {
        val freq = LinkedHashMap<String, Int>()
        for (tr in tracks) {
            val keys = extractArtistKeys(tr.artist)
            keys.forEachIndexed { idx, key ->
                val inc = if (idx == 0) 2 else 1
                freq[key] = (freq[key] ?: 0) + inc
            }
        }
        return freq
    }

    internal fun selectBalancedSeeds(
        tracks: List<PlaylistSeedTrack>,
        maxSeeds: Int = 6,
        refreshSalt: String = ""
    ): List<PlaylistSeedTrack> {
        if (tracks.isEmpty() || maxSeeds <= 0) return emptyList()
        val eligible = tracks.filter { YT_VIDEO_ID_REGEX.matches(it.id.trim()) }
            .distinctBy { it.id.trim() }
        if (eligible.isEmpty()) return emptyList()
        if (eligible.size <= maxSeeds) return eligible

        val artistFreq = computePlaylistArtistFrequencies(tracks)
        val saltHash = if (refreshSalt.isNotEmpty()) refreshSalt.hashCode() else 0

        data class IndexedSeed(
            val track: PlaylistSeedTrack,
            val primaryArtistKey: String,
            val freq: Int,
            val indexInEligible: Int
        )

        val indexed = eligible.mapIndexed { idx, tr ->
            val pKey = extractArtistKeys(tr.artist).firstOrNull() ?: "__anon_$idx"
            IndexedSeed(
                track = tr,
                primaryArtistKey = pKey,
                freq = artistFreq[pKey] ?: 1,
                indexInEligible = idx
            )
        }

        val byArtist = indexed.groupBy { it.primaryArtistKey }
        val rankedArtists = byArtist.keys.sortedWith(
            compareByDescending<String> { artistFreq[it] ?: 1 }
                .thenBy { byArtist[it]!!.first().indexInEligible }
        )

        val picked = ArrayList<PlaylistSeedTrack>(maxSeeds)
        val pickedIds = HashSet<String>()
        val artistPickCursor = HashMap<String, Int>()

        fun pickFromArtistGroup(artistKey: String, preferStratumStart: Int? = null): Boolean {
            val group = byArtist[artistKey] ?: return false
            val cur = artistPickCursor[artistKey] ?: 0
            val baseOffset = if (saltHash != 0) kotlin.math.abs(saltHash + artistKey.hashCode()) % group.size else 0
            val startIdx = if (preferStratumStart != null && cur == 0) {
                var bestIdx = 0
                var bestDist = Int.MAX_VALUE
                for (i in group.indices) {
                    val d = kotlin.math.abs(group[i].indexInEligible - preferStratumStart)
                    if (d < bestDist) {
                        bestDist = d
                        bestIdx = i
                    }
                }
                (bestIdx + (if (saltHash != 0) kotlin.math.abs(saltHash) % group.size else 0)) % group.size
            } else {
                (baseOffset + cur) % group.size
            }
            for (step in group.indices) {
                val cand = group[(startIdx + step) % group.size].track
                if (pickedIds.add(cand.id)) {
                    artistPickCursor[artistKey] = cur + step + 1
                    picked.add(cand)
                    return true
                }
            }
            return false
        }

        // Phase 1: Core artists across the whole playlist (top up to half of maxSeeds, leaving room for positional strata)
        val coreQuota = if (rankedArtists.size > maxSeeds) (maxSeeds + 1) / 2 else minOf(rankedArtists.size, maxSeeds)
        val artistWindowShift = if (saltHash != 0 && rankedArtists.size > maxSeeds) {
            kotlin.math.abs(saltHash) % minOf(3, rankedArtists.size)
        } else 0

        for (i in 0 until coreQuota) {
            if (picked.size >= maxSeeds) break
            val targetStratum = (i * eligible.size) / maxSeeds
            pickFromArtistGroup(rankedArtists[(i + artistWindowShift) % rankedArtists.size], preferStratumStart = targetStratum)
        }

        // Phase 2: Stratified sweep across ALL positions of the playlist (beginning, middle, end)
        // Pass 2a: prioritize unrepresented artists across strata so diverse playlist artists contribute.
        val strataCount = maxSeeds
        for (s in 0 until strataCount) {
            if (picked.size >= maxSeeds) break
            val shiftedStratum = if (saltHash != 0) (s + kotlin.math.abs(saltHash)) % strataCount else s
            val lo = (shiftedStratum * eligible.size) / strataCount
            val hi = (((shiftedStratum + 1) * eligible.size) / strataCount).coerceAtLeast(lo + 1).coerceAtMost(eligible.size)
            val slice = indexed.subList(lo, hi)
            val freshArtistCand = slice.firstOrNull { cand ->
                cand.track.id !in pickedIds && (artistPickCursor[cand.primaryArtistKey] ?: 0) == 0
            }
            if (freshArtistCand != null && pickedIds.add(freshArtistCand.track.id)) {
                artistPickCursor[freshArtistCand.primaryArtistKey] = (artistPickCursor[freshArtistCand.primaryArtistKey] ?: 0) + 1
                picked.add(freshArtistCand.track)
            }
        }
        // Pass 2b: if fewer distinct artists than maxSeeds, fill remaining strata with unpicked tracks.
        if (picked.size < maxSeeds) {
            for (s in 0 until strataCount) {
                if (picked.size >= maxSeeds) break
                val shiftedStratum = if (saltHash != 0) (s + kotlin.math.abs(saltHash)) % strataCount else s
                val lo = (shiftedStratum * eligible.size) / strataCount
                val hi = (((shiftedStratum + 1) * eligible.size) / strataCount).coerceAtLeast(lo + 1).coerceAtMost(eligible.size)
                val chosen = indexed.subList(lo, hi).firstOrNull { it.track.id !in pickedIds }
                if (chosen != null && pickedIds.add(chosen.track.id)) {
                    artistPickCursor[chosen.primaryArtistKey] = (artistPickCursor[chosen.primaryArtistKey] ?: 0) + 1
                    picked.add(chosen.track)
                }
            }
        }

        // Phase 3: Round-robin across artists (for playlists with fewer distinct artists than maxSeeds)
        var round = 0
        while (picked.size < maxSeeds && round < eligible.size) {
            var progressed = false
            for (artistKey in rankedArtists) {
                if (picked.size >= maxSeeds) break
                if (pickFromArtistGroup(artistKey)) progressed = true
            }
            if (!progressed) break
            round++
        }

        return picked
    }

    internal fun scoreAndRankPlaylistRecs(
        playlistTracks: List<PlaylistSeedTrack>,
        excludeIds: Set<String>,
        candidatesWithHits: List<Pair<SongItem, List<CandidateSeedHit>>>,
        relatedArtistKeys: Set<String> = emptySet(),
        limit: Int = 15,
        refreshSalt: String = ""
    ): List<SongItem> {
        if (candidatesWithHits.isEmpty() || limit <= 0) return emptyList()

        val excludedVideoIds = HashSet<String>(playlistTracks.size + excludeIds.size)
        val excludedExactSigs = HashSet<String>(playlistTracks.size)
        val excludedCoreSigs = HashSet<String>(playlistTracks.size)
        val playlistCoreTitleArtists = HashMap<String, MutableSet<String>>()

        for (id in excludeIds) {
            val clean = id.trim()
            if (clean.isNotEmpty()) excludedVideoIds.add(clean)
        }
        for (tr in playlistTracks) {
            val tid = tr.id.trim()
            if (tid.isNotEmpty()) excludedVideoIds.add(tid)
            val exactTitle = normCompactKey(tr.title)
            val coreTitle = normTitleCore(tr.title)
            val artistKeys = extractArtistKeys(tr.artist)
            val firstArtistCompact = normCompactKey(artistKeys.firstOrNull() ?: tr.artist)
            if (exactTitle.isNotEmpty() && firstArtistCompact.isNotEmpty()) {
                excludedExactSigs.add("$exactTitle|$firstArtistCompact")
            }
            if (coreTitle.isNotEmpty() && firstArtistCompact.isNotEmpty()) {
                excludedCoreSigs.add("$coreTitle|$firstArtistCompact")
            }
            if (coreTitle.isNotEmpty() && artistKeys.isNotEmpty()) {
                val set = playlistCoreTitleArtists.getOrPut(coreTitle) { HashSet() }
                set.addAll(artistKeys)
            }
        }

        fun isAlreadyInPlaylist(item: SongItem): Boolean {
            if (item.id in excludedVideoIds) return true
            val candArtists = extractSongArtistKeys(item)
            val firstArtistCompact = normCompactKey(candArtists.firstOrNull() ?: "")
            val exactTitle = normCompactKey(item.title)
            val coreTitle = normTitleCore(item.title)
            if (exactTitle.isNotEmpty() && firstArtistCompact.isNotEmpty()) {
                if ("$exactTitle|$firstArtistCompact" in excludedExactSigs) return true
            }
            if (coreTitle.isNotEmpty() && firstArtistCompact.isNotEmpty()) {
                if ("$coreTitle|$firstArtistCompact" in excludedCoreSigs) return true
            }
            if (coreTitle.isNotEmpty() && candArtists.isNotEmpty()) {
                val plArtistsForTitle = playlistCoreTitleArtists[coreTitle]
                if (plArtistsForTitle != null && candArtists.any { it in plArtistsForTitle }) return true
            }
            return false
        }

        fun qualityScore(item: SongItem, candArtists: List<String>): Double {
            var q = studioAudioScore(item).toDouble()
            if (candArtists.any { isPopularArtistForCountry(it) }) q += 4.0
            return q
        }

        // Merge duplicate candidate versions (e.g. audio vs video upload of same song) while keeping best SongItem and combining hits
        data class MergedCandidate(
            var bestItem: SongItem,
            var bestQuality: Double,
            val hits: MutableList<CandidateSeedHit>,
            val artistKeys: List<String>,
            val primaryArtistKey: String
        )

        val mergedBySig = LinkedHashMap<String, MergedCandidate>()
        for ((item, hits) in candidatesWithHits) {
            if (isJunkRecTrack(item)) continue
            if (isAlreadyInPlaylist(item)) continue
            val candArtists = extractSongArtistKeys(item)
            val primaryArtist = candArtists.firstOrNull() ?: normSearchKey(item.artists.firstOrNull()?.name.orEmpty())
            val coreTitle = normTitleCore(item.title)
            val sig = if (coreTitle.isNotEmpty() && primaryArtist.isNotEmpty()) {
                "$coreTitle|${normCompactKey(primaryArtist)}"
            } else {
                "id:${item.id}"
            }
            val q = qualityScore(item, candArtists)
            val existing = mergedBySig[sig]
            if (existing == null) {
                mergedBySig[sig] = MergedCandidate(
                    bestItem = item,
                    bestQuality = q,
                    hits = hits.toMutableList(),
                    artistKeys = candArtists,
                    primaryArtistKey = primaryArtist
                )
            } else {
                existing.hits.addAll(hits)
                if (q > existing.bestQuality) {
                    existing.bestItem = item
                    existing.bestQuality = q
                }
            }
        }

        if (mergedBySig.isEmpty()) return emptyList()

        val artistFreq = computePlaylistArtistFrequencies(playlistTracks)
        val hasRefresh = refreshSalt.isNotEmpty()
        val refreshSeed = refreshSalt.hashCode()

        data class ScoredCandidate(
            val item: SongItem,
            val primaryArtistKey: String,
            val albumId: String?,
            val score: Double
        )

        val scored = mergedBySig.values.map { cand ->
            val bestHitPerSeed = HashMap<String, CandidateSeedHit>()
            for (h in cand.hits) {
                val prev = bestHitPerSeed[h.seedId]
                if (prev == null || h.rankInSeed < prev.rankInSeed) {
                    bestHitPerSeed[h.seedId] = h
                }
            }
            val distinctSeeds = bestHitPerSeed.size
            val distinctSeedArtists = bestHitPerSeed.values.flatMap { it.seedArtistKeys }.toSet().size

            val consensusScore =
                (distinctSeeds - 1).coerceAtLeast(0) * 18.0 +
                    (distinctSeedArtists - 1).coerceAtLeast(0) * 10.0

            val rankScore = bestHitPerSeed.values
                .map { h -> (15.0 - h.rankInSeed * 0.55).coerceAtLeast(1.0) * h.seedArtistFreqWeight }
                .sortedDescending()
                .take(3)
                .sum()

            val matchedPlaylistFreq = cand.artistKeys.maxOfOrNull { artistFreq[it] ?: 0 } ?: 0
            val affinityScore = when {
                matchedPlaylistFreq > 0 -> minOf(matchedPlaylistFreq, 4) * 5.5
                cand.artistKeys.any { it in relatedArtistKeys } -> 9.0
                else -> 0.0
            }

            val jitter = if (hasRefresh) {
                val h = (cand.bestItem.id.hashCode() * 31) xor refreshSeed
                ((h and 0x7fffffff) % 1000) / 1000.0 * 11.0
            } else 0.0

            val total = consensusScore + rankScore + affinityScore + cand.bestQuality + jitter
            ScoredCandidate(
                item = cand.bestItem,
                primaryArtistKey = cand.primaryArtistKey.ifEmpty { "id:${cand.bestItem.id}" },
                albumId = cand.bestItem.album?.id,
                score = total
            )
        }.sortedByDescending { it.score }

        val selected = ArrayList<SongItem>(limit)
        val selectedIds = HashSet<String>(limit)
        val artistCounts = HashMap<String, Int>()
        val albumCounts = HashMap<String, Int>()

        fun collectPass(maxPerArtist: Int, maxPerAlbum: Int) {
            for (sc in scored) {
                if (selected.size >= limit) break
                if (sc.item.id in selectedIds) continue
                val aCount = artistCounts[sc.primaryArtistKey] ?: 0
                if (aCount >= maxPerArtist) continue
                val albCount = if (sc.albumId != null) (albumCounts[sc.albumId] ?: 0) else 0
                if (sc.albumId != null && albCount >= maxPerAlbum) continue
                if (selectedIds.add(sc.item.id)) {
                    selected.add(sc.item)
                    artistCounts[sc.primaryArtistKey] = aCount + 1
                    if (sc.albumId != null) albumCounts[sc.albumId] = albCount + 1
                }
            }
        }

        // Anti-flooding cap: max 2 tracks per artist, relaxing only if pool is too small
        collectPass(maxPerArtist = 2, maxPerAlbum = 2)
        if (selected.size < limit) collectPass(maxPerArtist = 3, maxPerAlbum = 4)
        if (selected.size < limit) collectPass(maxPerArtist = Int.MAX_VALUE, maxPerAlbum = Int.MAX_VALUE)

        return selected
    }

    internal fun parsePlaylistRecsJson(rawJson: String): PlaylistRecsRequest {
        val obj = JSONObject(rawJson)
        val tracks = ArrayList<PlaylistSeedTrack>()
        val tracksArr = obj.optJSONArray("tracks")
        if (tracksArr != null) {
            for (i in 0 until tracksArr.length()) {
                val t = tracksArr.optJSONObject(i) ?: continue
                val id = t.optString("id", "").trim()
                val title = t.optString("title", "").trim()
                val artist = t.optString("artist", "").trim()
                val artistId = t.optString("artistId", "").trim().takeIf { it.isNotEmpty() && it != "null" }
                val album = t.optString("album", "").trim().takeIf { it.isNotEmpty() && it != "null" }
                if (id.isNotEmpty() || title.isNotEmpty() || artist.isNotEmpty()) {
                    tracks.add(
                        PlaylistSeedTrack(
                            id = id,
                            title = title,
                            artist = artist,
                            artistId = artistId,
                            album = album,
                            position = i
                        )
                    )
                }
            }
        }
        val excludeIds = HashSet<String>()
        val excArr = obj.optJSONArray("excludeIds")
        if (excArr != null) {
            for (i in 0 until excArr.length()) {
                val v = excArr.optString(i, "").trim()
                if (v.isNotEmpty()) excludeIds.add(v)
            }
        }
        val limit = obj.optInt("limit", 15).coerceIn(1, 30)
        val refreshRaw = obj.opt("refresh")
        val refreshSalt = when (refreshRaw) {
            null, JSONObject.NULL -> ""
            is Boolean -> if (refreshRaw) System.nanoTime().toString() else ""
            is Number -> if (refreshRaw.toLong() == 0L) "" else refreshRaw.toString()
            is String -> {
                val trimmed = refreshRaw.trim()
                when {
                    trimmed.isEmpty() || trimmed.equals("false", ignoreCase = true) || trimmed == "0" -> ""
                    trimmed.equals("true", ignoreCase = true) -> System.nanoTime().toString()
                    else -> trimmed
                }
            }
            else -> ""
        }
        return PlaylistRecsRequest(
            tracks = tracks,
            excludeIds = excludeIds,
            limit = limit,
            refreshSalt = refreshSalt
        )
    }

    private fun parsePlaylistRecsRequest(uri: Uri, requestHeaders: Map<String, String>): PlaylistRecsRequest {
        val dataParam = uri.getQueryParameter("data")?.takeIf { it.isNotBlank() }
        val headerPayload = requestHeaders.entries
            .firstOrNull { it.key.equals("X-Sonora-Payload", ignoreCase = true) }
            ?.value
            ?.takeIf { it.isNotBlank() }

        val rawJson = dataParam ?: headerPayload?.let { raw ->
            if (raw.trimStart().startsWith("{")) raw
            else runCatching { URLDecoder.decode(raw, "UTF-8") }.getOrDefault(raw)
        }
        if (rawJson != null) {
            return runCatching { parsePlaylistRecsJson(rawJson) }.getOrElse {
                PlaylistRecsRequest(emptyList(), emptySet(), 15, "")
            }
        }

        // Individual query param fallback
        val tracksJson = uri.getQueryParameter("tracks")?.takeIf { it.isNotBlank() }
        val idsParam = uri.getQueryParameter("ids")?.takeIf { it.isNotBlank() }
        val excludeParam = uri.getQueryParameter("excludeIds")?.takeIf { it.isNotBlank() }
        val limit = uri.getQueryParameter("limit")?.toIntOrNull()?.coerceIn(1, 30) ?: 15
        val refreshParam = uri.getQueryParameter("refresh")?.trim().orEmpty()
        val refreshSalt = when {
            refreshParam.isEmpty() || refreshParam.equals("false", ignoreCase = true) || refreshParam == "0" -> ""
            refreshParam.equals("true", ignoreCase = true) -> System.nanoTime().toString()
            else -> refreshParam
        }

        val tracks = ArrayList<PlaylistSeedTrack>()
        if (tracksJson != null && tracksJson.trimStart().startsWith("[")) {
            runCatching {
                val arr = JSONArray(tracksJson)
                for (i in 0 until arr.length()) {
                    val t = arr.optJSONObject(i) ?: continue
                    tracks.add(
                        PlaylistSeedTrack(
                            id = t.optString("id", "").trim(),
                            title = t.optString("title", "").trim(),
                            artist = t.optString("artist", "").trim(),
                            artistId = t.optString("artistId", "").trim().takeIf { it.isNotEmpty() && it != "null" },
                            album = t.optString("album", "").trim().takeIf { it.isNotEmpty() && it != "null" },
                            position = i
                        )
                    )
                }
            }
        } else if (idsParam != null) {
            idsParam.split(',').map { it.trim() }.filter { it.isNotEmpty() }.forEachIndexed { idx, id ->
                tracks.add(PlaylistSeedTrack(id = id, title = "", artist = "", position = idx))
            }
        }

        val excludeIds = HashSet<String>()
        if (excludeParam != null) {
            if (excludeParam.trimStart().startsWith("[")) {
                runCatching {
                    val arr = JSONArray(excludeParam)
                    for (i in 0 until arr.length()) {
                        arr.optString(i, "").trim().takeIf { it.isNotEmpty() }?.let { excludeIds.add(it) }
                    }
                }
            } else {
                excludeParam.split(',').map { it.trim() }.filter { it.isNotEmpty() }.forEach { excludeIds.add(it) }
            }
        }

        return PlaylistRecsRequest(
            tracks = tracks,
            excludeIds = excludeIds,
            limit = limit,
            refreshSalt = refreshSalt
        )
    }

    private suspend fun fetchSeedRadioCached(videoId: String, fetchContinuation: Boolean = false): Pair<List<SongItem>, String?> {
        val seedKey = "${SonoraLocaleManager.cacheTag()}:$videoId"
        val cached = PlaylistSeedCache.get(seedKey)
        if (cached != null) {
            if (!fetchContinuation || cached.continuation == null) {
                return cached.items to cached.relatedBrowseId
            }
            val contItems = withTimeoutOrNull(1200L) {
                YouTube.next(cached.endpoint, cached.continuation).getOrNull()?.items.orEmpty()
            }.orEmpty()
            val merged = deduplicateAndPreferStudio((cached.items + contItems).distinctBy { it.id })
            PlaylistSeedCache.put(
                seedKey,
                cached.copy(items = merged, continuation = null, expiryMs = System.currentTimeMillis() + 600_000L)
            )
            return merged to cached.relatedBrowseId
        }

        val nextRes = withTimeoutOrNull(1700L) {
            YouTube.next(WatchEndpoint(videoId = videoId, playlistId = "RDAMVM$videoId")).getOrNull()
                ?: YouTube.next(WatchEndpoint(videoId = videoId)).getOrNull()
        } ?: return emptyList<SongItem>() to null

        var items = deduplicateAndPreferStudio(nextRes.items.filter { it.id != videoId })
        var cont = nextRes.continuation
        if (fetchContinuation && cont != null) {
            val contItems = withTimeoutOrNull(1000L) {
                YouTube.next(nextRes.endpoint, cont).getOrNull()?.items.orEmpty()
            }.orEmpty()
            if (contItems.isNotEmpty()) {
                items = deduplicateAndPreferStudio((items + contItems).distinctBy { it.id })
                cont = null
            }
        }

        val relatedId = nextRes.relatedEndpoint?.browseId
        PlaylistSeedCache.put(
            seedKey,
            PlaylistSeedCache.Entry(
                expiryMs = System.currentTimeMillis() + 600_000L,
                items = items,
                relatedBrowseId = relatedId,
                continuation = cont,
                endpoint = nextRes.endpoint
            )
        )
        return items to relatedId
    }

    private suspend fun buildPlaylistRecsJson(req: PlaylistRecsRequest): String = coroutineScope {
        if (req.tracks.isEmpty()) {
            return@coroutineScope JSONObject().apply {
                put("tracks", JSONArray())
                put("seedCount", 0)
            }.toString()
        }

        val artistFreq = computePlaylistArtistFrequencies(req.tracks)
        val maxArtistFreq = (artistFreq.values.maxOrNull() ?: 1).coerceAtLeast(1)

        var selectedSeeds = selectBalancedSeeds(
            tracks = req.tracks,
            maxSeeds = 6,
            refreshSalt = req.refreshSalt
        )

        // Fallback when playlist tracks lack YouTube video IDs: resolve representative seeds via search
        if (selectedSeeds.isEmpty()) {
            val fallbackQueries = req.tracks
                .filter { it.title.isNotBlank() || it.artist.isNotBlank() }
                .let { list ->
                    if (list.size <= 3) list
                    else listOf(list.first(), list[list.size / 2], list.last())
                }
            val resolvedSeeds = fallbackQueries.map { tr ->
                async(Dispatchers.IO) {
                    val q = "${tr.artist} ${tr.title}".trim()
                    if (q.isEmpty()) null
                    else {
                        val hit = withTimeoutOrNull(1400L) {
                            YouTube.search(q, YouTube.SearchFilter.FILTER_SONG).getOrNull()
                                ?.items?.filterIsInstance<SongItem>()?.firstOrNull()
                        }
                        hit?.let {
                            PlaylistSeedTrack(
                                id = it.id,
                                title = it.title,
                                artist = it.artists.joinToString(", ") { a -> a.name },
                                artistId = it.artists.firstOrNull { a -> a.id != null }?.id,
                                album = it.album?.name,
                                position = tr.position
                            )
                        }
                    }
                }
            }.awaitAll().filterNotNull().distinctBy { it.id }
            selectedSeeds = resolvedSeeds
        }

        if (selectedSeeds.isEmpty()) {
            return@coroutineScope JSONObject().apply {
                put("tracks", JSONArray())
                put("seedCount", 0)
            }.toString()
        }

        // Top 1-2 playlist artist IDs for related-artist & artist-catalog enrichment
        val artistIdByKey = HashMap<String, String>()
        for (tr in req.tracks) {
            val aid = tr.artistId?.trim()
            if (aid != null && YT_ARTIST_ID_REGEX.matches(aid)) {
                val pKey = extractArtistKeys(tr.artist).firstOrNull()
                if (pKey != null && !artistIdByKey.containsKey(pKey)) {
                    artistIdByKey[pKey] = aid
                }
            }
        }
        val topArtistEntries = artistFreq.entries
            .sortedByDescending { it.value }
            .mapNotNull { e -> artistIdByKey[e.key]?.let { aid -> e.key to aid } }
            .take(2)

        val wantContinuation = req.refreshSalt.isNotEmpty() || selectedSeeds.size <= 2
        val seedJobs = selectedSeeds.mapIndexed { idx, seed ->
            async(Dispatchers.IO) {
                val fetchCont = wantContinuation && idx < 2
                val (items, relatedId) = fetchSeedRadioCached(seed.id, fetchContinuation = fetchCont)
                val seedArtists = extractArtistKeys(seed.artist).toSet()
                val primaryFreq = seedArtists.maxOfOrNull { artistFreq[it] ?: 1 } ?: 1
                val weight = 1.0 + kotlin.math.ln(1.0 + primaryFreq.toDouble()) /
                    kotlin.math.ln(1.0 + maxArtistFreq.toDouble()) * 0.45
                Triple(seed, seedArtists to weight, items to relatedId)
            }
        }

        val artistJobs = topArtistEntries.map { (artistKey, aid) ->
            async(Dispatchers.IO) {
                val page = HomeSubCache.getArtist(aid)
                    ?: withTimeoutOrNull(1400L) {
                        YouTube.artist(aid).getOrNull()?.also { HomeSubCache.putArtist(aid, it, 1800) }
                    }
                artistKey to page
            }
        }

        val seedResults = seedJobs.awaitAll()
        val artistResults = artistJobs.awaitAll()

        val candidateHits = ArrayList<Pair<SongItem, List<CandidateSeedHit>>>(160)
        val relatedBrowseIds = ArrayList<Pair<String, PlaylistSeedTrack>>()

        for ((seed, meta, payload) in seedResults) {
            val (seedArtists, weight) = meta
            val (items, relatedId) = payload
            if (relatedId != null) {
                relatedBrowseIds.add(relatedId to seed)
            }
            items.forEachIndexed { rank, item ->
                candidateHits.add(
                    item to listOf(
                        CandidateSeedHit(
                            seedId = seed.id,
                            seedArtistKeys = seedArtists,
                            seedArtistFreqWeight = weight,
                            rankInSeed = rank
                        )
                    )
                )
            }
        }

        val relatedArtistKeys = HashSet<String>()
        for ((artistKey, page) in artistResults) {
            if (page == null) continue
            for (sec in page.sections) {
                for (item in sec.items) {
                    when (item) {
                        is ArtistItem -> {
                            relatedArtistKeys.addAll(extractArtistKeys(item.title))
                        }
                        is SongItem -> {
                            candidateHits.add(
                                item to listOf(
                                    CandidateSeedHit(
                                        seedId = "artist:${page.artist.id}",
                                        seedArtistKeys = setOf(artistKey),
                                        seedArtistFreqWeight = 0.85,
                                        rankInSeed = 6
                                    )
                                )
                            )
                        }
                        else -> {}
                    }
                }
            }
        }

        // For small playlists (or if candidate pool is thin), pull YouTube.related() from first 1-2 seeds
        if ((selectedSeeds.size <= 2 || candidateHits.size < req.limit * 2) && relatedBrowseIds.isNotEmpty()) {
            val relJobs = relatedBrowseIds.take(2).map { (browseId, seed) ->
                async(Dispatchers.IO) {
                    val relPage = withTimeoutOrNull(1100L) {
                        YouTube.related(BrowseEndpoint(browseId = browseId)).getOrNull()
                    }
                    seed to relPage
                }
            }
            for ((seed, relPage) in relJobs.awaitAll()) {
                if (relPage == null) continue
                relPage.artists.forEach { relatedArtistKeys.addAll(extractArtistKeys(it.title)) }
                val seedArtists = extractArtistKeys(seed.artist).toSet()
                relPage.songs.forEachIndexed { rank, song ->
                    candidateHits.add(
                        song to listOf(
                            CandidateSeedHit(
                                seedId = "rel:${seed.id}",
                                seedArtistKeys = seedArtists,
                                seedArtistFreqWeight = 0.95,
                                rankInSeed = rank + 2
                            )
                        )
                    )
                }
            }
        }

        val ranked = scoreAndRankPlaylistRecs(
            playlistTracks = req.tracks,
            excludeIds = req.excludeIds,
            candidatesWithHits = candidateHits,
            relatedArtistKeys = relatedArtistKeys,
            limit = req.limit,
            refreshSalt = req.refreshSalt
        )

        val tracksArr = enrichSongsToJson(ranked, maxResolve = 15)
        return@coroutineScope JSONObject().apply {
            put("tracks", tracksArr)
            put("seedCount", selectedSeeds.size)
        }.toString()
    }

    private fun handlePlaylistRecs(uri: Uri, requestHeaders: Map<String, String>): WebResourceResponse = runBlocking {
        val req = parsePlaylistRecsRequest(uri, requestHeaders)
        if (req.tracks.isEmpty()) {
            return@runBlocking jsonResponse(
                JSONObject().apply {
                    put("tracks", JSONArray())
                    put("seedCount", 0)
                }.toString()
            )
        }

        val sigInput = buildString {
            req.tracks.map { "${it.id}|${normCompactKey(it.title)}|${normCompactKey(it.artist)}" }
                .sorted()
                .forEach { append(it).append('\n') }
            append("ex:").append(req.excludeIds.sorted().joinToString(",")).append('\n')
            append("lim:").append(req.limit).append('\n')
            append("ref:").append(req.refreshSalt)
        }
        val sigHash = MessageDigest.getInstance("SHA-256")
            .digest(sigInput.toByteArray(Charsets.UTF_8))
            .take(12)
            .joinToString("") { "%02x".format(it) }
        val locKey = SonoraLocaleManager.cacheTag()
        val cacheKey = "pl_recs_v2:$locKey:$sigHash"

        if (req.refreshSalt.isEmpty()) {
            ApiCache.get(cacheKey)?.let { return@runBlocking jsonResponse(it) }
        }

        val jsonStr = buildPlaylistRecsJson(req)
        if (req.refreshSalt.isEmpty()) {
            ApiCache.put(cacheKey, jsonStr, 300)
        } else {
            ApiCache.put(cacheKey, jsonStr, 120)
        }
        jsonResponse(jsonStr)
    }

    private suspend fun buildRadioFeedJson(hl: String = SonoraLocaleManager.resolvedLang): Pair<String, Boolean> {
        val moodResult = YouTube.moodAndGenres().getOrNull().orEmpty()
        val sectionsArr = JSONArray()
        val categoriesArr = JSONArray()

        val prefMoods = listOf(
            "Allenamento", "Amore", "Buonumore", "Concentrazione",
            "Energia", "Festa", "Relax", "Viaggio", "Triste",
            "Workout", "Romance", "Feel good", "Focus",
            "Energize", "Party", "Chill", "Commute", "Sad"
        )
        val prefGenres = listOf(
            "Hip-hop", "Pop", "Dance ed elettronica", "Indie e alternativa",
            "Rock", "R&B e soul", "Latina", "Jazz",
            "Hip-Hop", "Dance & Electronic", "Indie & Alternative",
            "R&B & Soul", "Latin"
        )

        val moodsEyebrow = if (hl == "it") "MOOD E MOMENTI" else "MOODS & MOMENTS"
        val genresEyebrow = if (hl == "it") "GENERI E STAZIONI" else "GENRES & STATIONS"
        val genresGroup = if (hl == "it") "Generi" else "Genres"

        data class RadioTaskMeta(val eyebrowKey: String, val eyebrow: String, val title: String, val params: String)
        val tasksMeta = mutableListOf<RadioTaskMeta>()
        val allGenreItems = mutableMapOf<String, String>() // title -> params

        for (m in moodResult) {
            val isGenreGroup = m.title.contains("generi", ignoreCase = true) || m.title.contains("genres", ignoreCase = true)
            for (item in m.items) {
                val params = item.endpoint.params ?: continue
                val title = item.title.trim()
                if (isGenreGroup) {
                    allGenreItems[title] = params
                }
            }
        }

        for (m in moodResult) {
            val isMoodGroup = !m.title.contains("generi", ignoreCase = true) && !m.title.contains("genres", ignoreCase = true)
            if (isMoodGroup) {
                for (item in m.items) {
                    val params = item.endpoint.params ?: continue
                    val title = item.title.trim()
                    if (prefMoods.any { it.equals(title, ignoreCase = true) } && tasksMeta.size < 6) {
                        tasksMeta.add(RadioTaskMeta("moods_moments", moodsEyebrow, title, params))
                    }
                }
            }
        }

        for (g in prefGenres) {
            val params = allGenreItems.entries.firstOrNull { it.key.equals(g, ignoreCase = true) }?.value
            if (params != null && tasksMeta.none { it.params == params } && tasksMeta.size < 10) {
                tasksMeta.add(RadioTaskMeta("genres_stations", genresEyebrow, g, params))
            }
        }

        if (tasksMeta.isEmpty()) {
            for (m in moodResult) {
                for (item in m.items) {
                    val params = item.endpoint.params ?: continue
                    if (tasksMeta.size < 8) {
                        tasksMeta.add(RadioTaskMeta("moods_moments", moodsEyebrow, item.title, params))
                    }
                }
            }
        }

        val shownTitles = mutableSetOf<String>()
        coroutineScope {
            val sectionDeferreds = tasksMeta.map { task ->
                async(Dispatchers.IO) {
                    val browseResult = YouTube.browse("FEmusic_moods_and_genres_category", task.params).getOrNull()
                    val itemsArr = JSONArray()
                    browseResult?.items?.forEach { sec ->
                        sec.items.forEach { itm ->
                            if (itemsArr.length() < 12) {
                                when (itm) {
                                    is PlaylistItem -> itemsArr.put(itm.toJson())
                                    is AlbumItem -> itemsArr.put(itm.toJson())
                                    else -> {}
                                }
                            }
                        }
                    }
                    if (itemsArr.length() > 0) {
                        JSONObject().apply {
                            put("eyebrow", task.eyebrow)
                            put("eyebrowKey", task.eyebrowKey)
                            put("title", task.title)
                            put("params", task.params)
                            put("items", itemsArr)
                        }
                    } else null
                }
            }

            sectionDeferreds.awaitAll().filterNotNull().forEach { secObj ->
                sectionsArr.put(secObj)
                shownTitles.add(secObj.optString("title").lowercase())
            }
        }

        val keepGenres = listOf(
            "Latina", "Latin", "Jazz", "Classica", "Classical", "Metal",
            "Reggae e caraibica", "Reggae & Caribbean", "Blues", "K-Pop",
            "Country e americana", "Country & Americana", "Folk e acustica", "Folk & Acoustic",
            "Pop", "Rock"
        )
        val selectedCats = mutableListOf<JSONObject>()
        val seenCatParams = mutableSetOf<String>()
        for (kg in keepGenres) {
            val entry = allGenreItems.entries.firstOrNull { it.key.equals(kg, ignoreCase = true) }
            if (entry != null && !shownTitles.contains(entry.key.lowercase()) && seenCatParams.add(entry.value) && selectedCats.size < 8) {
                val (hue, style) = SonoraColors.look(entry.value)
                selectedCats.add(JSONObject().apply {
                    put("group", genresGroup)
                    put("groupKey", "genres")
                    put("title", entry.key)
                    put("params", entry.value)
                    put("hue", hue)
                    put("style", style)
                })
            }
        }

        if (selectedCats.size < 4) {
            for ((t, p) in allGenreItems) {
                if (!shownTitles.contains(t.lowercase()) && seenCatParams.add(p) && selectedCats.none { it.optString("title") == t } && selectedCats.size < 7) {
                    val (hue, style) = SonoraColors.look(p)
                    selectedCats.add(JSONObject().apply {
                        put("group", genresGroup)
                        put("groupKey", "genres")
                        put("title", t)
                        put("params", p)
                        put("hue", hue)
                        put("style", style)
                    })
                }
            }
        }

        selectedCats.forEach { categoriesArr.put(it) }

        val root = JSONObject().apply {
            put("sections", sectionsArr)
            put("categories", categoriesArr)
        }
        return root.toString() to (sectionsArr.length() > 0 || categoriesArr.length() > 0)
    }

    private fun handleRadioFeed(): WebResourceResponse = runBlocking {
        val locKey = SonoraLocaleManager.cacheTag()
        val hl = SonoraLocaleManager.resolvedLang
        val cacheKey = "radio_feed_v2:$locKey"
        ApiCache.get(cacheKey)?.let { return@runBlocking jsonResponse(it) }

        val disk = SnapshotDiskCache.get(cacheKey, freshTtlMs = 900_000L)
        if (disk != null) {
            if (disk.isFresh) {
                ApiCache.put(cacheKey, disk.data, 450)
            } else {
                ApiCache.put(cacheKey, disk.data, 30)
                SnapshotDiskCache.revalidate(cacheKey) {
                    if (SonoraLocaleManager.cacheTag() != locKey) return@revalidate
                    ensureLocale()
                    val (fresh, valid) = buildRadioFeedJson(hl)
                    if (valid && SonoraLocaleManager.cacheTag() == locKey) {
                        ApiCache.put(cacheKey, fresh, 900)
                        SnapshotDiskCache.put(cacheKey, fresh)
                    }
                }
            }
            return@runBlocking jsonResponse(disk.data)
        }

        val (rootStr, valid) = buildRadioFeedJson(hl)
        if (valid && SonoraLocaleManager.cacheTag() == locKey) {
            ApiCache.put(cacheKey, rootStr, 900)
            SnapshotDiskCache.put(cacheKey, rootStr)
        }
        jsonResponse(rootStr)
    }

    private fun handleMood(params: String): WebResourceResponse = runBlocking {
        val locKey = SonoraLocaleManager.cacheTag()
        val cacheKey = "mood_v2:$locKey:$params"
        ApiCache.get(cacheKey)?.let { return@runBlocking jsonResponse(it) }
        val browseResult = YouTube.browse("FEmusic_moods_and_genres_category", params).getOrNull()
        val itemsArr = JSONArray()

        browseResult?.items?.forEach { section ->
            section.items.forEach { item ->
                when (item) {
                    is PlaylistItem -> itemsArr.put(item.toJson())
                    is AlbumItem -> itemsArr.put(item.toJson())
                    is SongItem -> itemsArr.put(item.toJson())
                    else -> {}
                }
            }
        }

        val root = JSONObject().apply {
            put("params", params)
            put("items", itemsArr)
        }
        val rootStr = root.toString()
        ApiCache.put(cacheKey, rootStr, 1800)
        jsonResponse(rootStr)
    }

    private suspend fun buildChartsJson(
        locKey: String = SonoraLocaleManager.cacheTag(),
        gl: String = SonoraLocaleManager.resolvedCountry,
        hl: String = SonoraLocaleManager.resolvedLang,
    ): Pair<String, Boolean> {
        if (YouTube.visitorData.isNullOrBlank()) {
            withTimeoutOrNull(1200L) { ensureVisitorData() }
        }
        val songsArr = JSONArray()
        val trendingArr = JSONArray()
        val newTracksArr = JSONArray()
        val albumsArr = JSONArray()
        val artistsArr = JSONArray()
        val moodsArr = JSONArray()
        val explicitForeign = SonoraLocaleManager.isExplicitForeignRegion()
        val ytLocale = SonoraLocaleManager.effectiveRegionalYoutubeLocale(gl, hl)

        coroutineScope {
            val chartsDeferred = async(Dispatchers.IO) {
                HomeSubCache.getCharts(locKey) ?: YouTube.getChartsPage(localeOverride = ytLocale).getOrNull()?.also {
                    if (SonoraLocaleManager.cacheTag() == locKey) {
                        HomeSubCache.putCharts(it, 1800, locKey)
                    }
                }
            }
            val exploreDeferred = async(Dispatchers.IO) { YouTube.explore(localeOverride = ytLocale).getOrNull() }
            val storefrontDeferred = async(Dispatchers.IO) { fetchStorefrontRegionalFeed(gl) }

            val chartsResult = chartsDeferred.await()

            val chartSections = chartsResult?.sections.orEmpty()
            val chartArtists = chartSections.flatMap { it.items }.filterIsInstance<ArtistItem>().distinctBy { it.id }
                .filterNot { explicitForeign && !gl.equals("IT", true) && normSearchKey(it.title).let { k -> k in ITALIAN_POPULAR_ARTISTS && k !in GLOBAL_POPULAR_ARTISTS } }
            val chartPlaylists = chartSections.flatMap { sec ->
                sec.items.filterIsInstance<PlaylistItem>()
                    .filterNot { isMismatchedCountryPlaylist(it.title, gl) }
                    .map { sec to it }
            }
            val directTrendingSongs = chartSections
                .filter { it.chartType == ChartsPage.ChartType.TRENDING }
                .flatMap { it.items }
                .filterIsInstance<SongItem>()
            val directTopSongs = chartSections
                .filter { it.chartType == ChartsPage.ChartType.TOP }
                .flatMap { it.items }
                .filterIsInstance<SongItem>()

            val trendingPlaylist = chartPlaylists.firstOrNull { (sec, pl) ->
                pl.title.contains("tendenza", ignoreCase = true) ||
                    pl.title.contains("trending", ignoreCase = true) ||
                    sec.chartType == ChartsPage.ChartType.TRENDING
            }?.second
            val topPlaylist = chartPlaylists.firstOrNull { (_, pl) ->
                pl.id != trendingPlaylist?.id && (
                    pl.title.contains("100", ignoreCase = true) ||
                        pl.title.contains("più visti", ignoreCase = true) ||
                        pl.title.contains("most viewed", ignoreCase = true) ||
                        pl.title.contains("classific", ignoreCase = true) ||
                        pl.title.contains("top", ignoreCase = true)
                    )
            }?.second ?: chartPlaylists.firstOrNull { (_, pl) -> pl.id != trendingPlaylist?.id }?.second

            val trendingPlDeferred = trendingPlaylist?.let { pl ->
                async(Dispatchers.IO) { YouTube.playlist(pl.id).getOrNull()?.songs.orEmpty() }
            }
            val topPlDeferred = topPlaylist?.let { pl ->
                async(Dispatchers.IO) { YouTube.playlist(pl.id).getOrNull()?.songs.orEmpty() }
            }

            val storefrontFeed = withTimeoutOrNull(4200L) { storefrontDeferred.await() } ?: HomeSubCache.StorefrontFeed(emptyList(), emptyList())
            val exploreResult = exploreDeferred.await()
            val trendingFromPl = trendingPlDeferred?.await().orEmpty().ifEmpty { directTrendingSongs }
                .filterNot { explicitForeign && !gl.equals("IT", true) && isItalianLeakArtist(it.artists, gl) }
            val topFromPl = topPlDeferred?.await().orEmpty().ifEmpty { directTopSongs }
                .filterNot { explicitForeign && !gl.equals("IT", true) && isItalianLeakArtist(it.artists, gl) }

            val useChartArtists = chartArtists.isNotEmpty() && !explicitForeign
            val fallbackArtistsDeferred = if (!useChartArtists) {
                async(Dispatchers.IO) {
                    val query = regionalFallbackQuery(RegionalQueryKind.CHARTS_ARTISTS, gl, hl)
                    YouTube.search(query, YouTube.SearchFilter.FILTER_ARTIST).getOrNull()
                        ?.items?.filterIsInstance<ArtistItem>().orEmpty()
                }
            } else null

            val artistJobs = if (useChartArtists) {
                chartArtists.take(16).map { artist ->
                    async(Dispatchers.IO) {
                        val json = artist.toJson()
                        val artThumb = resolveArtistThumb(artist)
                        if (artThumb != null) json.put("thumb", artThumb)
                        json
                    }
                }
            } else null

            val fallbackTrendingDeferred = if (storefrontFeed.songs.isEmpty() && trendingFromPl.isEmpty()) {
                async(Dispatchers.IO) {
                    val query = regionalFallbackQuery(RegionalQueryKind.CHARTS_TRENDING, gl, hl)
                    YouTube.search(query, YouTube.SearchFilter.FILTER_SONG).getOrNull()
                        ?.items?.filterIsInstance<SongItem>().orEmpty()
                }
            } else null
            val rawExploreAlbums = exploreResult?.newReleaseAlbums.orEmpty()
            val cachedHomeNewReleases = HomeSubCache.getHome(locKey)?.sections.orEmpty()
                .filter { it.title.contains("new releases", ignoreCase = true) || it.title.contains("nuove uscite", ignoreCase = true) }
                .flatMap { it.items }
                .filterIsInstance<AlbumItem>()
            val preSelectedAlbums = selectPopularNewReleases(
                homeAlbums = cachedHomeNewReleases,
                exploreAlbums = rawExploreAlbums,
                fallbackAlbums = emptyList(),
                userArtistIds = emptySet(),
                chartsResult = chartsResult,
                gl = gl,
                storefrontAlbums = storefrontFeed.albums
            )
            val fallbackAlbumsDeferred = if (preSelectedAlbums.size < 6) {
                async(Dispatchers.IO) {
                    val query = regionalFallbackQuery(RegionalQueryKind.CHARTS_NEW_RELEASES, gl, hl)
                    YouTube.search(query, YouTube.SearchFilter.FILTER_ALBUM).getOrNull()
                        ?.items?.filterIsInstance<AlbumItem>().orEmpty()
                }
            } else null

            val trendingSongs = deduplicateAndPreferStudio(
                storefrontFeed.songs + trendingFromPl.ifEmpty { fallbackTrendingDeferred?.await().orEmpty() }
            )
            val topSongs = deduplicateAndPreferStudio(
                storefrontFeed.songs + topFromPl.ifEmpty {
                    trendingSongs.ifEmpty {
                        val query = regionalFallbackQuery(RegionalQueryKind.CHARTS_TOP_SONGS, gl, hl)
                        YouTube.search(query, YouTube.SearchFilter.FILTER_SONG).getOrNull()
                            ?.items?.filterIsInstance<SongItem>().orEmpty()
                    }
                }
            )

            // 1. Albums ("Album e singoli" / "Albums & singles")
            val fallbackAlbums = fallbackAlbumsDeferred?.await().orEmpty()
            val selectedChartAlbums = if (fallbackAlbums.isNotEmpty()) {
                selectPopularNewReleases(
                    homeAlbums = cachedHomeNewReleases,
                    exploreAlbums = rawExploreAlbums,
                    fallbackAlbums = fallbackAlbums,
                    userArtistIds = emptySet(),
                    chartsResult = chartsResult,
                    gl = gl,
                    storefrontAlbums = storefrontFeed.albums
                )
            } else {
                preSelectedAlbums
            }
            val topChartAlbums = selectedChartAlbums.take(16)
            val resolvedChartAlbs = if (AppleCatalog.hasReadyToken() && topChartAlbums.isNotEmpty()) {
                val pendingAlbs = topChartAlbums.filter { alb ->
                    val artName = cleanArtistsList(alb.artists).firstOrNull()?.name ?: alb.artists?.firstOrNull()?.name.orEmpty()
                    peekCachedAlbumThumb(alb.title, artName, 544) == null
                }.take(10)
                if (pendingAlbs.isNotEmpty()) {
                    pendingAlbs.map { alb ->
                        val artName = cleanArtistsList(alb.artists).firstOrNull()?.name ?: alb.artists?.firstOrNull()?.name.orEmpty()
                        async(Dispatchers.IO) {
                            val resolved = withTimeoutOrNull(1400L) {
                                resolveAlbumThumb(alb.title, artName, 544)
                            }
                            resolved?.let { alb.browseId to it }
                        }
                    }.awaitAll().filterNotNull().toMap()
                } else emptyMap()
            } else emptyMap()
            topChartAlbums.forEach { alb ->
                val artName = cleanArtistsList(alb.artists).firstOrNull()?.name ?: alb.artists?.firstOrNull()?.name.orEmpty()
                val hqAlb = resolvedChartAlbs[alb.browseId] ?: peekCachedAlbumThumb(alb.title, artName, 544)
                albumsArr.put(alb.toJson(thumbSize = 544, hqThumb = hqAlb))
            }

            // 2. Moods
            exploreResult?.moodAndGenres?.forEach { mg ->
                val (hue, style) = SonoraColors.look(mg.title)
                val mgObj = JSONObject().apply {
                    put("title", mg.title)
                    put("params", mg.endpoint.params ?: "")
                    put("hue", hue)
                    put("style", style)
                }
                moodsArr.put(mgObj)
            }

            // 3. Trending ("Brani del momento" / "Trending songs")
            trendingSongs.take(20).forEach { song ->
                val trJson = song.toJson().apply { put("kind", "track") }
                trendingArr.put(trJson)
                newTracksArr.put(trJson)
            }

            // 4. Songs ("Classifica Top Brani" / "Top Songs Chart")
            topSongs.take(20).forEach { song ->
                songsArr.put(song.toJson().apply { put("kind", "track") })
            }

            // 5. Artists ("Artisti in tendenza" / "Trending artists")
            if (artistJobs != null) {
                artistJobs.awaitAll().forEach { artistsArr.put(it) }
            } else {
                val fallbackArtists = fallbackArtistsDeferred?.await().orEmpty().take(16)
                fallbackArtists.map { artist ->
                    async(Dispatchers.IO) {
                        val json = artist.toJson()
                        val artThumb = resolveArtistThumb(artist)
                        if (artThumb != null) json.put("thumb", artThumb)
                        json
                    }
                }.awaitAll().forEach { artistsArr.put(it) }
            }
        }

        val root = JSONObject().apply {
            put("songs", songsArr)
            put("trending", trendingArr)
            put("new_tracks", newTracksArr)
            put("albums", albumsArr)
            put("artists", artistsArr)
            put("moods", moodsArr)
        }
        val valid = songsArr.length() > 0 || trendingArr.length() > 0 || artistsArr.length() > 0 || albumsArr.length() > 0
        return root.toString() to valid
    }

    private fun handleCharts(): WebResourceResponse = runBlocking {
        val locKey = SonoraLocaleManager.cacheTag()
        val gl = SonoraLocaleManager.resolvedCountry
        val hl = SonoraLocaleManager.resolvedLang
        val cacheKey = "charts_v4:$locKey"
        ApiCache.get(cacheKey)?.let { return@runBlocking jsonResponse(it) }

        val disk = SnapshotDiskCache.get(cacheKey, freshTtlMs = 900_000L)
        if (disk != null) {
            if (disk.isFresh) {
                ApiCache.put(cacheKey, disk.data, 450)
            } else {
                ApiCache.put(cacheKey, disk.data, 30)
                SnapshotDiskCache.revalidate(cacheKey) {
                    ensureLocale()
                    val (fresh, valid) = buildChartsJson(locKey, gl, hl)
                    if (valid && SonoraLocaleManager.cacheTag() == locKey) {
                        ApiCache.put(cacheKey, fresh, 900)
                        SnapshotDiskCache.put(cacheKey, fresh)
                    }
                }
            }
            return@runBlocking jsonResponse(disk.data)
        }

        val (rootStr, valid) = buildChartsJson(locKey, gl, hl)
        if (valid && SonoraLocaleManager.cacheTag() == locKey) {
            ApiCache.put(cacheKey, rootStr, 900)
            SnapshotDiskCache.put(cacheKey, rootStr)
        }
        jsonResponse(rootStr)
    }

    private fun handleLyrics(videoId: String, uri: Uri): WebResourceResponse = runBlocking {
        var title = uri.getQueryParameter("title").orEmpty()
        var artist = uri.getQueryParameter("artist").orEmpty()
        var durSec = uri.getQueryParameter("dur")?.toLongOrNull() ?: 0L
        val src = uri.getQueryParameter("src").orEmpty().ifEmpty { "auto" }
        val waitMode = uri.getQueryParameter("wait").orEmpty().ifEmpty { "fast" }

        if (title.isBlank() || artist.isBlank()) {
            val svc = SonoraPlaybackService.instance
            val curTitle = svc?.currentTitle
            val curArtist = svc?.currentArtist
            if (svc != null && svc.currentTrackId == videoId && !curTitle.isNullOrBlank() && curTitle != "Sonora") {
                title = curTitle
                artist = curArtist ?: ""
            } else {
                val nextRes = YouTube.next(WatchEndpoint(videoId = videoId)).getOrNull()
                val song = nextRes?.items?.filterIsInstance<SongItem>()?.firstOrNull { it.id == videoId }
                    ?: nextRes?.items?.filterIsInstance<SongItem>()?.firstOrNull()
                if (song != null) {
                    title = song.title
                    artist = song.artists.joinToString(", ") { it.name }
                    if (durSec <= 0L) durSec = song.duration?.toLong() ?: 210L
                }
            }
        }

        val cacheKey = "lyrics:$videoId:$src:$waitMode:${title.trim().lowercase()}:${artist.trim().lowercase()}:$durSec"
        ApiCache.get(cacheKey)?.let { return@runBlocking jsonResponse(it) }

        val query = LyricsQuery(
            uri = "youtube:$videoId",
            title = title,
            artist = artist,
            durationMs = (if (durSec > 0) durSec else 210L) * 1000L
        )

        val resultJson = LyricsLibrary.collect(query, src, waitMode)
        val jsonStr = resultJson.toString()
        val hasAvailable = resultJson.optBoolean("available", false)
        val hasLines = (resultJson.optJSONArray("lines")?.length() ?: 0) > 0
        val hasPending = (resultJson.optJSONArray("pending")?.length() ?: 0) > 0
        val isTopTierAuto = src != "auto" || (
            resultJson.optString("kind") == "word" &&
                resultJson.optString("source") in setOf("apple", "better")
            )
        if (hasAvailable && hasLines && !hasPending && (waitMode == "all" || isTopTierAuto)) {
            ApiCache.put(cacheKey, jsonStr, 3600)
        }
        jsonResponse(jsonStr)
    }

    private fun handleLyricsSearchEndpoint(rawQuery: String): WebResourceResponse = runBlocking {
        jsonResponse(handleLyricsSearch(rawQuery))
    }

    private data class ResolvedLyricTrack(
        val song: SongItem,
        val hit: LyricSearchHit,
        val meta: CanonicalSongMeta?,
        val primaryArtist: String,
    )

    private suspend fun handleLyricsSearch(rawQuery: String): String {
        val cleanQ = rawQuery.trim()
            .trim('"', '\'', '«', '»', '“', '”', '‘', '’', '„')
            .replace(COLLAPSE_WS_REGEX, " ")
            .trim()
        if (cleanQ.length < 4) return """{"tracks":[]}"""

        val cacheKey = "lyrics_search_v4:${SonoraLocaleManager.cacheTag()}:${cleanQ.lowercase()}"
        ApiCache.get(cacheKey)?.let { return it }

        val baseHits = LyricsLibrary.searchLyricsByPhrase(cleanQ, maxResults = 4).toMutableList()
        val preloadedByVideoId = HashMap<String, SongItem>()

        if (baseHits.size < 2) {
            val ytSongs = withTimeoutOrNull(1100L) {
                runCatching {
                    YouTube.search(cleanQ, YouTube.SearchFilter.FILTER_SONG).getOrNull()
                        ?.items?.filterIsInstance<SongItem>().orEmpty()
                }.getOrDefault(emptyList())
            }.orEmpty()
            val seenHitKeys = baseHits.mapTo(HashSet()) { hit ->
                val hitArtistKey = extractArtistKeys(hit.artist).firstOrNull()?.replace(" ", "")
                    ?: normCompactKey(hit.artist)
                "${normTitleCore(hit.title)}|$hitArtistKey"
            }
            val fallbackCandidates = ArrayList<Pair<SongItem, String>>(2)
            for (s in ytSongs) {
                if (shouldFilterTrack(s, cleanQ)) continue
                val primaryArtist = primaryArtistName(s)
                if (primaryArtist.isBlank()) continue
                val key = "${normTitleCore(s.title)}|${normCompactKey(primaryArtist)}"
                if (!seenHitKeys.add(key)) continue
                fallbackCandidates.add(s to primaryArtist)
                if (fallbackCandidates.size >= 2) break
            }
            if (fallbackCandidates.isNotEmpty()) {
                val verifiedHits = coroutineScope {
                    fallbackCandidates.map { (s, primaryArtist) ->
                        async(Dispatchers.IO) {
                            val (snippet, lrcAlbum) = LyricsLibrary.lookupTrackLyricSnippet(
                                s.title,
                                primaryArtist,
                                cleanQ
                            ) ?: return@async null
                            LyricSearchHit(
                                title = s.title,
                                artist = primaryArtist,
                                snippet = snippet,
                                album = lrcAlbum,
                                videoId = s.id,
                            ) to s
                        }
                    }.awaitAll().filterNotNull()
                }
                for ((hit, song) in verifiedHits) {
                    baseHits.add(hit)
                    if (song.id.isNotBlank()) preloadedByVideoId[song.id] = song
                }
            }
        }

        if (baseHits.isEmpty()) return """{"tracks":[]}"""

        val resolved = coroutineScope {
            baseHits.map { hit ->
                async(Dispatchers.IO) {
                    val searchQ = "${hit.title} ${hit.artist}".trim()
                    val hitPrimaryArtist = hit.artist.split(ARTIST_SPLIT_REGEX)
                        .firstOrNull()?.trim().orEmpty().ifBlank { hit.artist.trim() }
                    val ytDeferred = async {
                        withTimeoutOrNull(1300L) {
                            runCatching {
                                YouTube.search(searchQ, YouTube.SearchFilter.FILTER_SONG).getOrNull()
                                    ?.items?.filterIsInstance<SongItem>().orEmpty()
                            }.getOrDefault(emptyList())
                        }.orEmpty()
                    }
                    val canonDeferred = async {
                        resolveCanonicalSongMeta(hit.title, hitPrimaryArtist, hit.album)
                    }

                    val rawItems = ytDeferred.await().ifEmpty {
                        listOfNotNull(preloadedByVideoId[hit.videoId])
                    }
                    val candidates = rawItems.filter { !shouldFilterTrack(it, searchQ) }.ifEmpty { rawItems }
                    val hitTitleCore = normTitleCore(hit.title)
                    val hitArtistKey = extractArtistKeys(hit.artist).firstOrNull()?.replace(" ", "")
                        ?: normCompactKey(hit.artist)
                    val hitAlbumCore = if (hit.album.isNotBlank() &&
                        !isLikelyCompilationAlbum(hit.album, hit.title, hitPrimaryArtist)
                    ) {
                        normTitleCore(hit.album)
                    } else {
                        ""
                    }

                    val best = candidates.maxByOrNull { item ->
                        var sc = studioAudioScore(item)
                        val itemTitleCore = normTitleCore(item.title)
                        if (hitTitleCore.isNotEmpty()) {
                            if (itemTitleCore == hitTitleCore) sc += 35
                            else if (hitTitleCore.length >= 4 &&
                                (itemTitleCore.contains(hitTitleCore) || hitTitleCore.contains(itemTitleCore))
                            ) {
                                sc += 15
                            }
                        }
                        val itemArtistKeys = extractSongArtistKeys(item).map { it.replace(" ", "") }
                        if (hitArtistKey.isNotEmpty() && itemArtistKeys.any {
                                it == hitArtistKey ||
                                    (hitArtistKey.length >= 4 && (it.contains(hitArtistKey) || hitArtistKey.contains(it)))
                            }
                        ) {
                            sc += 30
                        }
                        val itemAlbumName = item.album?.name.orEmpty()
                        val itemPrimaryArtist = primaryArtistName(item)
                        val itemIsComp = isLikelyCompilationAlbum(itemAlbumName, item.title, itemPrimaryArtist)
                        if (hitAlbumCore.isNotEmpty() && itemAlbumName.isNotBlank() &&
                            normTitleCore(itemAlbumName) == hitAlbumCore
                        ) {
                            sc += 40
                        }
                        if (hit.videoId.isNotBlank() && item.id == hit.videoId && !itemIsComp) {
                            sc += 20
                        }
                        sc
                    } ?: return@async null

                    val bestPrimaryArtist = primaryArtistName(best)
                    val sameCanonKey = normTitleCore(best.title) == hitTitleCore &&
                        normCompactKey(bestPrimaryArtist) == normCompactKey(hitPrimaryArtist)
                    val meta = if (sameCanonKey) {
                        canonDeferred.await()
                    } else {
                        canonDeferred.cancel()
                        resolveCanonicalSongMeta(best.title, bestPrimaryArtist, hit.album)
                    }
                    ResolvedLyricTrack(best, hit, meta, bestPrimaryArtist)
                }
            }.awaitAll().filterNotNull()
        }

        val seenSongIds = HashSet<String>(resolved.size)
        val tracksArr = JSONArray()
        for ((song, hit, meta, primaryArtist) in resolved) {
            if (!seenSongIds.add(song.id)) continue
            val obj = song.toJson()
            obj.put("lyricSnippet", hit.snippet)
            if (meta != null) {
                obj.put("thumb", meta.coverUrl)
                val curAlb = song.album?.name?.trim().orEmpty()
                if (meta.albumName.isNotBlank()) {
                    val albumReplaced = curAlb.isEmpty() ||
                        isLikelyCompilationAlbum(curAlb, song.title, primaryArtist) ||
                        normAlbumCacheKey(curAlb, primaryArtist) != normAlbumCacheKey(meta.albumName, primaryArtist)
                    if (albumReplaced) {
                        obj.put("album", meta.albumName)
                        if (curAlb.isNotEmpty()) obj.put("albumId", JSONObject.NULL)
                    } else if (curAlb.isNotEmpty() && isLikelyCompilationAlbum(curAlb, song.title, primaryArtist)) {
                        obj.put("albumId", JSONObject.NULL)
                    }
                }
                obj.put("canonicalCover", true)
            }
            tracksArr.put(obj)
        }

        val result = JSONObject().put("tracks", tracksArr).toString()
        if (tracksArr.length() > 0) {
            ApiCache.put(cacheKey, result, 600)
        }
        return result
    }

    private class CoverPayload(
        val mime: String,
        val bytes: ByteArray,
        val statusCode: Int,
        val errorMsg: String?,
    )

    private val inFlightCovers =
        ConcurrentHashMap<String, java.util.concurrent.CompletableFuture<CoverPayload>>()

    private fun coverCacheHeaders(): Map<String, String> = mapOf(
        "Access-Control-Allow-Origin" to "*",
        "Cache-Control" to "public, max-age=604800, immutable",
    )

    private fun fetchCoverUncached(
        cacheKey: String,
        id: String,
        hqUrl: String,
        decoded: String,
        size: Int,
    ): CoverPayload {
        // Re-check RAM & disk caches in case an earlier coalesced request completed right before putIfAbsent.
        (CoverCache.get(cacheKey)
            ?: CoverCache.get(hqUrl)
            ?: if (size <= 544) CoverCache.get(decoded) else null)?.let { hit ->
            return CoverPayload(hit.mime, hit.bytes, 200, null)
        }
        (CoverDiskCache.get(cacheKey)
            ?: if (id.isNotEmpty()) CoverDiskCache.get(CoverDiskCache.keyFor("", decoded, size)) else null)?.let { disk ->
            CoverCache.put(cacheKey, disk.mime, disk.bytes, aliasUrl = hqUrl)
            return CoverPayload(disk.mime, disk.bytes, 200, null)
        }

        val candidates = ArrayList<String>(3).apply {
            add(hqUrl)
            if (decoded != hqUrl) add(decoded)
            val ytMatch = Regex("""^https?://i\.ytimg\.com/vi/([^/]+)/""").find(decoded)
                ?: Regex("""^https?://i\.ytimg\.com/vi/([^/]+)/""").find(hqUrl)
            val ytFallback = ytMatch?.groupValues?.getOrNull(1)?.let {
                "https://i.ytimg.com/vi/$it/hqdefault.jpg"
            }
            if (ytFallback != null && ytFallback !in this) add(ytFallback)
        }

        var lastStatus = 502
        var lastError = "Cover fetch failed"
        for (candidate in candidates) {
            try {
                okHttp.newCall(Request.Builder().url(candidate).build()).execute().use { r ->
                    if (!r.isSuccessful) {
                        lastStatus = r.code.takeIf { it >= 400 } ?: 404
                        lastError = "Cover upstream error (${r.code})"
                        return@use
                    }
                    val mime = (r.header("Content-Type", "image/jpeg") ?: "image/jpeg")
                        .substringBefore(';')
                        .trim()
                        .ifBlank { "image/jpeg" }
                    val bytes = try { r.body.bytes() } catch (_: Exception) { ByteArray(0) }
                    if (bytes.isEmpty()) {
                        lastStatus = 404
                        lastError = "Empty cover response"
                        return@use
                    }
                    CoverCache.put(cacheKey, mime, bytes, aliasUrl = hqUrl)
                    CoverDiskCache.putAsync(cacheKey, mime, bytes)
                    return CoverPayload(mime, bytes, 200, null)
                }
            } catch (e: Exception) {
                lastStatus = 502
                lastError = "Cover fetch failed: ${e.message ?: "network error"}"
            }
        }
        return CoverPayload("application/json", ByteArray(0), lastStatus, lastError)
    }

    private val MZSTATIC_DIM_REGEX = Regex("""/(\d{3,4})x(\d{3,4})([a-z]{0,4}\.(?:webp|jpe?g|png))(?=$|\?)""", RegexOption.IGNORE_CASE)

    private fun sizedCoverUrl(decoded: String, size: Int): String {
        val effSize = if (decoded.contains("mzstatic.com")) size.coerceAtLeast(288) else size
        val baseSized = decoded.atSize(effSize)
        if (baseSized.contains("mzstatic.com")) {
            return MZSTATIC_DIM_REGEX.replace(baseSized) { m ->
                val curW = m.groupValues[1].toIntOrNull() ?: effSize
                val curH = m.groupValues[2].toIntOrNull() ?: effSize
                if (curW == curH && effSize < curW) {
                    "/${effSize}x${effSize}${m.groupValues[3]}"
                } else {
                    m.value
                }
            }
        }
        return baseSized
    }

    private fun unwrapCoverRequest(rawUrl: String, sizeParam: Int, idParam: String): Triple<String, Int, String> {
        val trimmed = rawUrl.trim()
        val apiIdx = trimmed.indexOf("/api/cover?")
        if (apiIdx < 0) return Triple(trimmed, sizeParam, idParam)
        val query = trimmed.substring(apiIdx + "/api/cover?".length)
        var target = ""
        var s = sizeParam
        var id = idParam
        for (pair in query.split('&')) {
            val eq = pair.indexOf('=')
            if (eq <= 0) continue
            val k = pair.substring(0, eq)
            val v = try { URLDecoder.decode(pair.substring(eq + 1), "UTF-8") } catch (_: Exception) { pair.substring(eq + 1) }
            when (k) {
                "u" -> if (v.isNotBlank()) target = v
                "s" -> v.toIntOrNull()?.let { s = it }
                "id" -> if (id.isBlank() && v.isNotBlank()) id = v
            }
        }
        return Triple(target.ifBlank { trimmed }, s, id)
    }

    private fun lookupCachedCover(
        cacheKey: String,
        id: String,
        decoded: String,
        hqUrl: String,
        size: Int,
    ): CoverPayload? {
        val candidateKeys = LinkedHashSet<String>(6).apply {
            add(cacheKey)
            if (id.isNotEmpty()) add(CoverDiskCache.keyFor("", decoded, size))
            for (altSize in intArrayOf(1400, 1200, 544, 288)) {
                if (altSize >= size && altSize != size) {
                    add(CoverDiskCache.keyFor(id, decoded, altSize))
                    if (id.isNotEmpty()) add(CoverDiskCache.keyFor("", decoded, altSize))
                }
            }
        }
        for (key in candidateKeys) {
            CoverCache.get(key)?.let { return CoverPayload(it.mime, it.bytes, 200, null) }
        }
        (CoverCache.get(hqUrl) ?: if (size <= 544) CoverCache.get(decoded) else null)?.let {
            return CoverPayload(it.mime, it.bytes, 200, null)
        }
        for (key in candidateKeys) {
            CoverDiskCache.get(key)?.let { disk ->
                CoverCache.put(cacheKey, disk.mime, disk.bytes, aliasUrl = hqUrl)
                return CoverPayload(disk.mime, disk.bytes, 200, null)
            }
        }
        return null
    }

    private fun fetchCoverPayload(rawUrl: String, sizeParam: Int = 544, idParam: String = ""): CoverPayload {
        val (unwrapped, resolvedSize, resolvedId) = unwrapCoverRequest(rawUrl, sizeParam, idParam)
        val decoded = try { URLDecoder.decode(unwrapped, "UTF-8") } catch (_: Exception) { unwrapped }.trim()
        if (decoded.isBlank()) return CoverPayload("application/json", ByteArray(0), 400, "Missing cover URL")
        val size = resolvedSize.coerceIn(120, 1400)
        val id = resolvedId.trim()
        val hqUrl = sizedCoverUrl(decoded, size)
        val cacheKey = CoverDiskCache.keyFor(id, decoded, size)

        lookupCachedCover(cacheKey, id, decoded, hqUrl, size)?.let { return it }

        val created = java.util.concurrent.CompletableFuture<CoverPayload>()
        val existing = inFlightCovers.putIfAbsent(cacheKey, created)
        if (existing != null) {
            return try {
                existing.get()
            } catch (e: Exception) {
                CoverPayload("application/json", ByteArray(0), 502, "Cover fetch failed: ${e.message ?: "network error"}")
            }
        }

        return try {
            fetchCoverUncached(cacheKey, id, hqUrl, decoded, size).also { res ->
                created.complete(res)
            }
        } catch (t: Throwable) {
            val err = CoverPayload("application/json", ByteArray(0), 502, "Cover fetch failed: ${t.message ?: "network error"}")
            created.complete(err)
            err
        } finally {
            inFlightCovers.remove(cacheKey, created)
        }
    }

    /**
     * Fetches artwork bytes via the shared RAM/disk cover cache and coalesced OkHttp pipeline.
     */
    fun fetchCoverBytes(rawUrl: String, sizeParam: Int = 544, idParam: String = ""): ByteArray? {
        val payload = fetchCoverPayload(rawUrl, sizeParam, idParam)
        return if (payload.statusCode == 200 && payload.bytes.isNotEmpty()) payload.bytes else null
    }

    private fun handleCover(rawUrl: String, sizeParam: Int = 544, idParam: String = ""): WebResourceResponse {
        val payload = fetchCoverPayload(rawUrl, sizeParam, idParam)
        return if (payload.statusCode == 200 && payload.bytes.isNotEmpty()) {
            WebResourceResponse(payload.mime, null, 200, "OK", coverCacheHeaders(), ByteArrayInputStream(payload.bytes))
        } else {
            errorResponse(payload.statusCode, payload.errorMsg ?: "Cover error")
        }
    }

    private fun handlePrefetch(videoId: String): WebResourceResponse {
        SonoraPlaybackService.instance?.prefetch(videoId)
        return jsonResponse("{\"ok\":true}")
    }

    private fun handleDownloadTrack(rawId: String): WebResourceResponse = runBlocking {
        val ctx = appContext ?: return@runBlocking errorResponse(503, "App context not ready")
        val id = try { URLDecoder.decode(rawId, "UTF-8") } catch (_: Exception) { rawId }.trim()
        if (id.isBlank()) return@runBlocking errorResponse(400, "Missing track id")
        val ok = withTimeoutOrNull(35_000L) {
            SonoraPlaybackService.cacheTrackAudio(ctx, id)
        } ?: false
        if (ok) {
            jsonResponse(JSONObject().apply { put("ok", true); put("id", id) }.toString())
        } else {
            errorResponse(502, localizedMsg("Download audio non riuscito per $id", "Audio download failed for $id"))
        }
    }

    private fun handleRemoveDownload(rawId: String): WebResourceResponse {
        val ctx = appContext
        val id = try { URLDecoder.decode(rawId, "UTF-8") } catch (_: Exception) { rawId }.trim()
        if (ctx != null && id.isNotBlank()) {
            SonoraPlaybackService.removeCachedTrackAudio(ctx, id)
        }
        return jsonResponse("{\"ok\":true}")
    }

    private fun fetchStreamResponse(streamUrl: String, rangeHeader: String?): okhttp3.Response {
        val reqBuilder = Request.Builder()
            .url(streamUrl)
            .cacheControl(okhttp3.CacheControl.FORCE_NETWORK)
        if (!rangeHeader.isNullOrBlank()) {
            reqBuilder.header("Range", rangeHeader)
        }
        return okHttp.newCall(reqBuilder.build()).execute()
    }

    private fun handleStream(videoId: String, requestHeaders: Map<String, String> = emptyMap()): WebResourceResponse = runBlocking {
        SonoraAudioResolver.ensureNewPipe()

        val streamUrl = SonoraPlaybackService.instance?.extractAudioUrl(videoId)
            ?: SonoraAudioResolver.resolve(videoId)

        if (streamUrl == null) {
            return@runBlocking errorResponse(404, localizedMsg("Stream non trovato per $videoId", "Stream not found for $videoId"))
        }

        val rangeHeader = requestHeaders.entries.firstOrNull { it.key.equals("Range", ignoreCase = true) }?.value
        var resp = fetchStreamResponse(streamUrl, rangeHeader)
        if (!resp.isSuccessful && (resp.code == 403 || resp.code == 410)) {
            resp.close()
            StreamCache.forget(videoId)
            val freshUrl = SonoraPlaybackService.instance?.extractAudioUrl(videoId)
                ?: SonoraAudioResolver.resolve(videoId)
                ?: return@runBlocking errorResponse(404, localizedMsg("Stream non trovato per $videoId", "Stream not found for $videoId"))
            resp = fetchStreamResponse(freshUrl, rangeHeader)
        }
        if (!resp.isSuccessful) {
            val code = resp.code
            resp.close()
            return@runBlocking errorResponse(code, "Stream upstream error ($code)")
        }
        try {
            val body = resp.body
            val mime = (resp.header("Content-Type") ?: "audio/mp4").substringBefore(';').trim()
            val headers = LinkedHashMap<String, String>().apply {
                put("Access-Control-Allow-Origin", "*")
                put("Accept-Ranges", resp.header("Accept-Ranges") ?: "bytes")
                put("Content-Type", resp.header("Content-Type") ?: mime)
                resp.header("Content-Range")?.let { put("Content-Range", it) }
                resp.header("Content-Length")?.let { put("Content-Length", it) }
            }
            val statusCode = if (resp.code == 206) 206 else 200
            val reason = if (statusCode == 206) "Partial Content" else "OK"
            val wrappedStream = object : java.io.FilterInputStream(body.byteStream()) {
                private val closed = java.util.concurrent.atomic.AtomicBoolean(false)
                override fun close() {
                    if (closed.compareAndSet(false, true)) {
                        try {
                            super.close()
                        } finally {
                            resp.close()
                        }
                    }
                }
            }
            WebResourceResponse(mime, null, statusCode, reason, headers, wrappedStream)
        } catch (t: Throwable) {
            resp.close()
            throw t
        }
    }

    private fun jsonResponse(jsonStr: String): WebResourceResponse {
        val stream = ByteArrayInputStream(jsonStr.toByteArray(Charsets.UTF_8))
        val headers = mapOf(
            "Access-Control-Allow-Origin" to "*",
            "Content-Type" to "application/json; charset=utf-8"
        )
        return WebResourceResponse("application/json", "utf-8", 200, "OK", headers, stream)
    }

    private fun errorResponse(code: Int, message: String): WebResourceResponse {
        val json = JSONObject().apply { put("error", message) }
        val stream = ByteArrayInputStream(json.toString().toByteArray(Charsets.UTF_8))
        val headers = mapOf("Access-Control-Allow-Origin" to "*")
        return WebResourceResponse("application/json", "utf-8", code, message, headers, stream)
    }
}

fun cleanArtistsList(artists: List<Artist>?): List<Artist> {
    if (artists.isNullOrEmpty()) return emptyList()
    return artists.filter { artist ->
        val name = artist.name.trim()
        val lower = name.lowercase().replace('\u00a0', ' ')
        if (lower.isBlank()) false
        else if (lower in setOf("e", "and", "&", ",", "feat", "feat.", "ft", "ft.")) false
        else if (lower in setOf("brano", "canzone", "singolo", "album", "video", "song", "single", "track", "ep", "podcast", "episodio")) false
        else if (lower.contains("riproduzion") || lower.contains("visualizzazion") || lower.contains("ascolt") ||
            lower.contains("iscritt") || lower.contains("views") || lower.contains("plays") ||
            lower.contains("subscribers") || lower.contains("likes") || lower.contains("monthly audience")) false
        else if (lower.matches(Regex("""(?i).*\d[\d.,]*\s*(?:k|m|b|mln|mila|milioni|mrd)?\s*(?:riproduzioni?|visualizzazioni?|ascolti?|iscritti?|views?|plays?|subscribers?).*"""))) false
        else if (lower.matches(Regex("""(?i)\d[\d.,]*\s*(?:k|m|b|mln|mila|milioni|mrd)"""))) false
        else if (lower.matches(Regex("""\d{1,2}[:.]\d{2}(?:[:.]\d{2})?"""))) false
        else true
    }
}

fun SongItem.toJson(no: Int? = null, artistThumb: String? = null, thumbSize: Int = 544): JSONObject {
    val (hue, style) = SonoraColors.look(id)
    val validArtists = cleanArtistsList(artists)
    val artistName = validArtists.joinToString(", ") { it.name }.ifEmpty {
        artists.firstOrNull { it.name.isNotBlank() }?.name
            ?: if (SonoraLocaleManager.resolvedLang == "it") "Artista sconosciuto" else "Unknown artist"
    }
    val artistId = validArtists.firstOrNull { it.id != null }?.id ?: artists.firstOrNull { it.id != null }?.id
    val rawAlbName = album?.name?.trim().orEmpty()
    val leadArtistName = validArtists.firstOrNull()?.name ?: artists.firstOrNull { it.name.isNotBlank() }?.name.orEmpty()
    val cachedCanon = SonoraApiInterceptor.peekCachedCanonicalSongMeta(title, leadArtistName, rawAlbName)
    val cachedAlbThumb = cachedCanon?.coverUrl?.let { SonoraApiInterceptor.resizeCoverApiUrl(it, thumbSize) }
        ?: if (rawAlbName.isNotEmpty() && !SonoraApiInterceptor.isLikelyCompilationAlbum(rawAlbName, title, leadArtistName)) {
            SonoraApiInterceptor.peekCachedAlbumThumb(rawAlbName, leadArtistName, thumbSize)
        } else null
    val albumReplaced = cachedCanon != null && cachedCanon.albumName.isNotBlank() && (
        rawAlbName.isEmpty() ||
            SonoraApiInterceptor.isLikelyCompilationAlbum(rawAlbName, title, leadArtistName) ||
            SonoraApiInterceptor.normAlbumCacheKey(rawAlbName, leadArtistName) !=
            SonoraApiInterceptor.normAlbumCacheKey(cachedCanon.albumName, leadArtistName)
        )
    val resolvedAlbumName = if (albumReplaced) cachedCanon.albumName else album?.name
    val resolvedAlbumId = if ((albumReplaced && rawAlbName.isNotEmpty()) ||
        (rawAlbName.isNotEmpty() && SonoraApiInterceptor.isLikelyCompilationAlbum(rawAlbName, title, leadArtistName))
    ) {
        null
    } else {
        album?.id
    }
    val hqThumb = thumbnail.atSize(thumbSize)
    val thumb = cachedAlbThumb ?: "/api/cover?u=${URLEncoder.encode(hqThumb, "UTF-8")}&s=$thumbSize"
    return JSONObject().apply {
        put("kind", "track")
        put("id", id)
        put("title", title.ifEmpty { if (SonoraLocaleManager.resolvedLang == "it") "Senza titolo" else "Untitled" })
        put("artist", artistName)
        put("artistId", artistId ?: JSONObject.NULL)
        if (artistThumb != null) {
            put("artistThumb", artistThumb)
        }
        if (cachedCanon != null) {
            put("canonicalCover", true)
        }
        put("album", resolvedAlbumName ?: JSONObject.NULL)
        put("albumId", resolvedAlbumId ?: JSONObject.NULL)
        put("no", no ?: JSONObject.NULL)
        put("dur", duration ?: 210)
        put("ex", explicit)
        put("thumb", thumb)
        put("hue", hue)
        put("style", style)
    }
}

fun AlbumItem.toJson(withTracks: Boolean = false, songs: List<SongItem> = emptyList(), thumbSize: Int = 544, hqThumb: String? = null): JSONObject {
    val (hue, style) = SonoraColors.look(browseId)
    val validArtists = cleanArtistsList(artists)
    val artistName = validArtists.joinToString(", ") { it.name }
    val leadArtist = validArtists.firstOrNull()?.name ?: artists?.firstOrNull { it.name.isNotBlank() }?.name.orEmpty()
    val artistId = validArtists.firstOrNull { it.id != null }?.id ?: artists?.firstOrNull { it.id != null }?.id
    val ytThumb = thumbnail.atSize(thumbSize)
    val cachedAlb = hqThumb ?: SonoraApiInterceptor.peekCachedAlbumThumb(title, leadArtist.ifEmpty { artistName }, thumbSize)
    val thumb = cachedAlb ?: "/api/cover?u=${URLEncoder.encode(ytThumb, "UTF-8")}&s=$thumbSize"
    return JSONObject().apply {
        put("kind", "album")
        put("id", browseId)
        put("title", title.ifEmpty { "Album" })
        put("artist", artistName)
        put("artistId", artistId ?: JSONObject.NULL)
        put("year", year ?: JSONObject.NULL)
        put("type", "Album")
        put("thumb", thumb)
        put("playlistId", playlistId)
        put("hue", hue)
        put("style", style)
        if (withTracks) {
            val tracksArr = JSONArray()
            var totalDur = 0
            songs.forEachIndexed { i, s ->
                val trJson = s.toJson(i + 1)
                tracksArr.put(trJson)
                totalDur += s.duration ?: 0
            }
            put("tracks", tracksArr)
            put("trackCount", songs.size)
            put("duration", totalDur)
            put("description", "")
        }
    }
}

internal fun isBannerUrl(u: String?): Boolean {
    if (u.isNullOrBlank()) return false
    val bannerIndicators = listOf("w2160", "-h900", "w1920", "-h800", "w1440", "-h600", "w816", "-h340", "w540", "-h225")
    if (bannerIndicators.any { u.contains(it) }) return true
    val match = Regex("""[=\-]w(\d+)-h(\d+)""").find(u)
    if (match != null) {
        val w = match.groupValues[1].toIntOrNull() ?: 0
        val h = match.groupValues[2].toIntOrNull() ?: 1
        if (w != h && (w.toFloat() / h.coerceAtLeast(1) >= 1.5f)) return true
    }
    return false
}

fun ArtistItem.toJson(hqThumb: String? = null): JSONObject {
    val (hue, style) = SonoraColors.look(id)
    val resolved = hqThumb
        ?: SonoraApiInterceptor.peekCachedArtistThumb(title)
        ?: SonoraApiInterceptor.upgradeThumb(thumbnail, 544)
    return JSONObject().apply {
        put("kind", "artist")
        put("id", id)
        put("title", title)
        put("subscribers", JSONObject.NULL)
        put("thumb", resolved ?: JSONObject.NULL)
        put("hue", hue)
        put("style", style)
    }
}

fun PlaylistItem.toJson(withTracks: Boolean = false, songs: List<SongItem> = emptyList(), thumbSize: Int = 544): JSONObject {
    val (hue, style) = SonoraColors.look(id)
    val hqThumb = thumbnail?.atSize(thumbSize)
    val thumb = hqThumb?.let { "/api/cover?u=${URLEncoder.encode(it, "UTF-8")}&s=$thumbSize" }
    return JSONObject().apply {
        put("kind", "playlist")
        put("id", id)
        put("title", title)
        put("desc", description ?: songCountText ?: "")
        put("artist", author?.name ?: "Playlist")
        put("thumb", thumb ?: JSONObject.NULL)
        put("hue", hue)
        put("style", style)
        if (withTracks) {
            val tracksArr = JSONArray()
            var totalDur = 0
            songs.forEachIndexed { i, s ->
                val trJson = s.toJson(i + 1)
                tracksArr.put(trJson)
                totalDur += s.duration ?: 0
            }
            put("tracks", tracksArr)
            put("trackCount", songs.size)
            put("duration", totalDur)
        }
    }
}
