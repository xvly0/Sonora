package dev.sonora.music

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class SonoraUpdater private constructor(context: Context) {

    private val app = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val client: OkHttpClient by lazy {
        SonoraHttpPool.baseClient.newBuilder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()
    }
    private val cachedVersionName: String by lazy {
        try {
            val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                app.packageManager.getPackageInfo(
                    app.packageName,
                    PackageManager.PackageInfoFlags.of(0)
                )
            } else {
                @Suppress("DEPRECATION")
                app.packageManager.getPackageInfo(app.packageName, 0)
            }
            info.versionName.orEmpty()
        } catch (_: Exception) {
            ""
        }
    }

    @Volatile
    private var _state: State = State.Idle
    val state: State get() = _state

    @Volatile
    private var lastManualCheck: Boolean = false

    @Volatile
    private var lastOffered: State.Available? = null

    @Volatile
    private var lastReportedPercent: Int = -1

    @Volatile
    var listener: ((String) -> Unit)? = null

    sealed interface State {
        data object Idle : State
        data object Checking : State
        data object UpToDate : State
        data class Available(
            val version: String,
            val url: String,
            val bytes: Long,
            val notes: String = ""
        ) : State
        data class Downloading(val progress: Float?, val available: Available) : State
        data class Installing(val available: Available) : State
        data class Failed(val reason: String, val available: Available? = null) : State
    }

    fun installedVersionName(): String = cachedVersionName

    fun currentAvailable(): State.Available? {
        return when (val s = _state) {
            is State.Available -> s
            is State.Downloading -> s.available
            is State.Installing -> s.available
            is State.Failed -> s.available ?: lastOffered
            else -> lastOffered
        }
    }

    fun stateJson(manual: Boolean = lastManualCheck): String {
        val obj = JSONObject()
        val s = _state
        obj.put("manual", manual)
        obj.put("installedVersion", installedVersionName())
        when (s) {
            is State.Idle -> obj.put("state", "idle")
            is State.Checking -> obj.put("state", "checking")
            is State.UpToDate -> obj.put("state", "up_to_date")
            is State.Available -> {
                obj.put("state", "available")
                putAvailable(obj, s)
            }
            is State.Downloading -> {
                obj.put("state", "downloading")
                obj.put("progress", s.progress?.toDouble() ?: JSONObject.NULL)
                putAvailable(obj, s.available)
            }
            is State.Installing -> {
                obj.put("state", "installing")
                putAvailable(obj, s.available)
            }
            is State.Failed -> {
                obj.put("state", "failed")
                obj.put("reason", s.reason)
                s.available?.let { putAvailable(obj, it) }
            }
        }
        return obj.toString()
    }

    private fun putAvailable(obj: JSONObject, avail: State.Available) {
        obj.put("version", avail.version)
        obj.put("url", avail.url)
        obj.put("bytes", avail.bytes)
        obj.put("notes", avail.notes)
    }

    private fun setState(newState: State, manual: Boolean = lastManualCheck, notify: Boolean = true) {
        lastManualCheck = manual
        _state = newState
        if (notify) {
            listener?.invoke(stateJson(manual))
        }
    }

    fun checkAsync(manual: Boolean = false) {
        val cur = _state
        if (cur is State.Checking || cur is State.Downloading) return
        scope.launch {
            check(manual)
        }
    }

    suspend fun check(manual: Boolean = false): State {
        val cur = _state
        if (cur is State.Downloading) return cur

        setState(State.Checking, manual)
        val result = runCatching { withContext(Dispatchers.IO) { latestRelease() } }
            .getOrElse { err ->
                Log.w(TAG, "Update check failed: ${err.message}")
                setState(State.Failed(err.message ?: "network", null), manual)
                return _state
            }

        val installed = installedVersionName()
        if (result == null || !isNewer(result.version, installed)) {
            setState(State.UpToDate, manual)
            return _state
        }

        val avail = State.Available(result.version, result.url, result.bytes, result.notes)
        lastOffered = avail
        setState(avail, manual)
        return avail
    }

    fun install(update: State.Available, manual: Boolean = true): Boolean {
        lastOffered = update
        if (!canInstall()) {
            setState(State.Failed(REASON_PERMISSION, update), manual)
            return false
        }
        setState(State.Downloading(null, update), manual)
        SonoraUpdateService.start(app, update)
        return true
    }

    suspend fun fetchAndInstall(
        update: State.Available,
        onProgress: (Float?) -> Unit
    ) {
        setState(State.Downloading(null, update), lastManualCheck)
        onProgress(null)

        val apk = runCatching {
            withContext(Dispatchers.IO) { download(update, onProgress) }
        }.getOrElse { err ->
            Log.w(TAG, "Update download failed: ${err.message}")
            setState(State.Failed(err.message ?: "download", update), lastManualCheck)
            return
        }

        runCatching { withContext(Dispatchers.IO) { commit(apk) } }
            .onSuccess {
                setState(State.Installing(update), lastManualCheck)
            }
            .onFailure { err ->
                Log.w(TAG, "Update install failed: ${err.message}")
                apk.delete()
                setState(State.Failed(err.message ?: "install", update), lastManualCheck)
            }
    }

    fun canInstall(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            app.packageManager.canRequestPackageInstalls()
    }

    fun permissionIntent(): Intent {
        return Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
            .setData(Uri.parse("package:${app.packageName}"))
    }

    fun dismiss() {
        val cur = _state
        if (cur is State.Downloading || cur is State.Installing) return
        setState(State.Idle, false)
    }

    fun installAbandoned() {
        if (_state !is State.Installing) return
        setState(lastOffered ?: State.Idle, lastManualCheck)
    }

    private data class Release(
        val version: String,
        val url: String,
        val bytes: Long,
        val notes: String
    )

    private fun latestRelease(): Release? {
        val latestReq = Request.Builder()
            .url("https://api.github.com/repos/$REPO/releases/latest")
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "Sonora-Android")
            .build()

        client.newCall(latestReq).execute().use { response ->
            if (response.isSuccessful) {
                val raw = response.body?.string().orEmpty()
                val obj = runCatching { JSONObject(raw) }.getOrNull()
                if (obj != null) {
                    parseRelease(obj)?.let { return it }
                }
            } else if (response.code != 404) {
                error("HTTP ${response.code}")
            }
        }

        // Fall back to /releases so pre-release tags (e.g. v1.0.0-beta) are also discovered.
        val listReq = Request.Builder()
            .url("https://api.github.com/repos/$REPO/releases?per_page=8")
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "Sonora-Android")
            .build()

        client.newCall(listReq).execute().use { response ->
            if (!response.isSuccessful) error("HTTP ${response.code}")
            val arr = JSONArray(response.body?.string().orEmpty())
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                if (obj.optBoolean("draft", false)) continue
                parseRelease(obj)?.let { return it }
            }
        }
        return null
    }

    private fun parseRelease(obj: JSONObject): Release? {
        val tag = obj.optString("tag_name")
            .trim()
            .removePrefix("v")
            .removePrefix("V")
        if (tag.isEmpty()) return null

        val assetsArr = obj.optJSONArray("assets") ?: return null
        val apks = ArrayList<JSONObject>()
        for (i in 0 until assetsArr.length()) {
            val asset = assetsArr.optJSONObject(i) ?: continue
            val name = asset.optString("name")
            if (name.endsWith(".apk", ignoreCase = true)) {
                apks.add(asset)
            }
        }
        if (apks.isEmpty()) return null

        fun findAsset(pred: (String) -> Boolean): JSONObject? =
            apks.firstOrNull { pred(it.optString("name")) }

        val picked = Build.SUPPORTED_ABIS.firstNotNullOfOrNull { abi ->
            findAsset { it.contains(abi, ignoreCase = true) }
        }
            ?: findAsset { it.equals("Sonora.apk", ignoreCase = true) }
            ?: findAsset { it.contains("universal", ignoreCase = true) }
            ?: apks.firstOrNull()
            ?: return null

        val url = picked.optString("browser_download_url")
        if (url.isEmpty()) return null
        val size = picked.optLong("size", 0L)
        val notes = obj.optString("body").trim()
        return Release(tag, url, size, notes)
    }

    private fun download(update: State.Available, onProgress: (Float?) -> Unit): File {
        val target = File(app.cacheDir, "update.apk")
        target.delete()
        lastReportedPercent = -1

        val request = Request.Builder()
            .url(update.url)
            .header("User-Agent", "Sonora-Android")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) error("HTTP ${response.code}")
            val body = response.body ?: error("empty body")
            val total = body.contentLength().takeIf { it > 0 } ?: update.bytes
            var written = 0L

            body.byteStream().use { input ->
                target.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        output.write(buffer, 0, read)
                        written += read
                        if (total > 0) {
                            val progress = (written.toFloat() / total.toFloat()).coerceIn(0f, 1f)
                            val pct = (progress * 100f).toInt().coerceIn(0, 100)
                            if (pct != lastReportedPercent) {
                                lastReportedPercent = pct
                                setState(State.Downloading(progress, update), lastManualCheck)
                                onProgress(progress)
                            }
                        }
                    }
                }
            }
        }
        return target
    }

    private fun commit(apk: File) {
        val installer = app.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        val sessionId = installer.createSession(params)
        installer.openSession(sessionId).use { session ->
            session.openWrite("sonora", 0, apk.length()).use { output ->
                apk.inputStream().use { it.copyTo(output) }
                session.fsync(output)
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val callback = PendingIntent.getBroadcast(
                app,
                0,
                Intent(app, SonoraInstallReceiver::class.java).setPackage(app.packageName),
                flags
            )
            session.commit(callback.intentSender)
        }
        apk.delete()
    }

    companion object {
        private const val TAG = "SonoraUpdater"
        const val REPO = "xvly0/Sonora"
        const val REASON_PERMISSION = "permission"

        @Volatile
        private var instance: SonoraUpdater? = null

        fun getInstance(context: Context): SonoraUpdater {
            return instance ?: synchronized(this) {
                instance ?: SonoraUpdater(context).also { instance = it }
            }
        }

        fun isNewer(candidate: String, installed: String): Boolean {
            val cleanCand = candidate.trim().removePrefix("v").removePrefix("V")
            val cleanInst = installed.trim().removePrefix("v").removePrefix("V")
            if (cleanCand.isEmpty()) return false
            if (cleanInst.isEmpty()) return true

            val candParts = cleanCand.split('-', limit = 2)
            val instParts = cleanInst.split('-', limit = 2)

            val leftNums = candParts[0].split('.').map { it.takeWhile(Char::isDigit).toIntOrNull() ?: 0 }
            val rightNums = instParts[0].split('.').map { it.takeWhile(Char::isDigit).toIntOrNull() ?: 0 }
            for (i in 0 until maxOf(leftNums.size, rightNums.size)) {
                val l = leftNums.getOrElse(i) { 0 }
                val r = rightNums.getOrElse(i) { 0 }
                if (l != r) return l > r
            }

            val candPre = candParts.getOrNull(1).orEmpty()
            val instPre = instParts.getOrNull(1).orEmpty()
            if (candPre == instPre) return false
            if (candPre.isEmpty()) return true
            if (instPre.isEmpty()) return false

            val candTokens = candPre.split('.')
            val instTokens = instPre.split('.')
            for (i in 0 until maxOf(candTokens.size, instTokens.size)) {
                val l = candTokens.getOrNull(i) ?: return false
                val r = instTokens.getOrNull(i) ?: return true
                val ln = l.toIntOrNull()
                val rn = r.toIntOrNull()
                val cmp = if (ln != null && rn != null) ln.compareTo(rn) else l.compareTo(r, ignoreCase = true)
                if (cmp != 0) return cmp > 0
            }
            return false
        }
    }
}
