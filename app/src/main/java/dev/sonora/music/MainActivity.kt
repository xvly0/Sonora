package dev.sonora.music

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.graphics.Rect
import android.media.ExifInterface
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.util.Base64
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsAnimationCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

class MainActivity : AppCompatActivity() {

    companion object {
        private val bgIoExecutor = java.util.concurrent.Executors.newSingleThreadExecutor { r ->
            Thread(r, "SonoraMainBgIo").apply { isDaemon = true }
        }
    }

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private val nativeBridge = SonoraNativeBridge()
    private var isServiceBound = false
    private var initialServiceStartScheduled = false
    private var isImeAnimating = false
    @Volatile
    private var isUiResumed = false
    private var lastTopInsetDp = Float.NaN
    private var lastImeDp = Float.NaN
    private var lastAnimImeDp = Float.NaN
    private var lastAnimImePushMs = 0L
    private var lastResumePushElapsedMs = 0L
    private val playbackStateLock = Any()
    private var lastPbPlaying = false
    private var lastPbBuffering = false
    private var lastPbPosSec = Double.NaN
    private var lastPbDurSec = Double.NaN
    private var lastPbTrackId: String? = null
    private var lastPbQuotedTrackId: String = "\"\""
    private var lastPbPushElapsedMs = 0L
    private var servicePlaybackListener: SonoraPlaybackService.Companion.PlaybackListener? = null
    private val pendingServiceActions = mutableListOf<(SonoraPlaybackService) -> Unit>()
    @Volatile
    private var pendingVolumeNorm: Boolean = true
    @Volatile
    private var pendingRepeatMode: Int = 0
    private val pendingFavStates = ConcurrentHashMap<String, Boolean>()
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    @Volatile
    private var pendingInstallUpdate: SonoraUpdater.State.Available? = null
    private var updateListener: ((String) -> Unit)? = null
    @Volatile
    private var pendingBackupJson: String? = null
    @Volatile
    private var isNetworkOnline: Boolean = true
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    private val backupExportLauncher = registerForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        val payload = pendingBackupJson
        pendingBackupJson = null
        if (uri == null || payload == null) {
            deliverBackupExportResult(false, "cancelled")
            return@registerForActivityResult
        }
        bgIoExecutor.execute {
            val ok = try {
                contentResolver.openOutputStream(uri, "wt")?.use { out ->
                    out.write(payload.toByteArray(Charsets.UTF_8))
                    out.flush()
                } != null
            } catch (e: Exception) {
                android.util.Log.e("SonoraBackup", "Export failed", e)
                false
            }
            deliverBackupExportResult(ok, if (ok) "ok" else "write_error")
        }
    }

    private val backupImportLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri == null) {
            deliverBackupImportResult(null, "cancelled")
            return@registerForActivityResult
        }
        bgIoExecutor.execute {
            val maxBytes = 20L * 1024L * 1024L
            val content = try {
                contentResolver.openInputStream(uri)?.use { input ->
                    val buf = java.io.ByteArrayOutputStream()
                    val chunk = ByteArray(16384)
                    var total = 0L
                    while (true) {
                        val n = input.read(chunk)
                        if (n <= 0) break
                        total += n
                        if (total > maxBytes) throw java.io.IOException("Backup file too large")
                        buf.write(chunk, 0, n)
                    }
                    buf.toString(Charsets.UTF_8.name())
                }
            } catch (e: Exception) {
                android.util.Log.e("SonoraBackup", "Import read failed", e)
                null
            }
            if (content == null) {
                deliverBackupImportResult(null, "read_error")
            } else {
                deliverBackupImportResult(content, "ok")
            }
        }
    }

    private val updatePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        val update = pendingInstallUpdate ?: return@registerForActivityResult
        pendingInstallUpdate = null
        val updater = SonoraUpdater.getInstance(this)
        if (updater.canInstall()) {
            updater.install(update, manual = true)
        } else {
            updateListener?.invoke(updater.stateJson(manual = true))
        }
    }

    private val pickMediaLauncher = registerForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        handlePickedImageUri(uri)
    }

    private val legacyImagePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uri = if (result.resultCode == Activity.RESULT_OK) result.data?.data else null
        handlePickedImageUri(uri)
    }

    private val webFileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val cb = fileChooserCallback
        fileChooserCallback = null
        if (cb != null) {
            val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            cb.onReceiveValue(uris)
        }
    }

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            isServiceBound = true
            SonoraPlaybackService.instance?.let { syncPendingPreferencesIfNeeded(it) }
            flushPendingServiceActions()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            isServiceBound = false
            lastSyncedService = null
        }
    }

    @Volatile
    private var lastSyncedService: SonoraPlaybackService? = null

    private fun syncPendingPreferencesIfNeeded(service: SonoraPlaybackService) {
        if (lastSyncedService === service) return
        lastSyncedService = service
        service.setVolumeNorm(pendingVolumeNorm)
        service.setRepeatModeState(pendingRepeatMode)
        for ((trackId, isFav) in pendingFavStates) {
            service.setTrackFavorite(trackId, isFav)
        }
    }

    private fun startAndBindPlaybackService() {
        val serviceIntent = Intent(this, SonoraPlaybackService::class.java).apply {
            action = androidx.media3.session.MediaSessionService.SERVICE_INTERFACE
        }
        try {
            startService(serviceIntent)
        } catch (e: Exception) {
            android.util.Log.e("SonoraService", "startService failed", e)
        }
        if (!isServiceBound) {
            try {
                isServiceBound = bindService(serviceIntent, serviceConnection, Context.BIND_AUTO_CREATE)
            } catch (e: Exception) {
                android.util.Log.e("SonoraService", "bindService failed", e)
            }
        }
    }

    private fun ensureService(action: (SonoraPlaybackService) -> Unit) {
        val current = SonoraPlaybackService.instance
        if (current != null) {
            try {
                syncPendingPreferencesIfNeeded(current)
                action(current)
            } catch (e: Exception) {
                android.util.Log.e("SonoraService", "ensureService execution failed", e)
            }
        } else {
            pendingServiceActions.add(action)
            initialServiceStartScheduled = false
            startAndBindPlaybackService()
        }
    }

    private fun flushPendingServiceActions() {
        val current = SonoraPlaybackService.instance ?: return
        syncPendingPreferencesIfNeeded(current)
        if (pendingServiceActions.isEmpty()) return
        val actions = ArrayList(pendingServiceActions)
        pendingServiceActions.clear()
        for (action in actions) {
            try {
                action(current)
            } catch (e: Exception) {
                android.util.Log.e("SonoraService", "Pending service action failed", e)
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.apply {
            clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS)
            addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
            statusBarColor = Color.TRANSPARENT
            navigationBarColor = Color.TRANSPARENT
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    101
                )
            }
        }

        // Configure YouTube cache/locale before attaching; service startup is deferred until after WebView boot.
        SonoraLocaleManager.attach(this)
        setupNetworkMonitor()
        com.metrolist.innertube.YouTube.cacheDir = java.io.File(cacheDir, "innertube")
        com.metrolist.innertube.YouTube.locale = SonoraLocaleManager.youtubeLocale()
        SonoraApiInterceptor.attach(this)
        SonoraDownloadManager.attach(this)
        AppleCatalog.attach(this)
        dev.sonora.music.lyrics.LyricsLibrary.attach(this)

        val isDebuggable = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        WebView.setWebContentsDebuggingEnabled(isDebuggable)

        webView = WebView(this)
        setContentView(webView)

        assetLoader = WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            allowContentAccess = true
            loadWithOverviewMode = true
            useWideViewPort = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        webView.setBackgroundColor(Color.parseColor("#111111"))

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                if (isDebuggable) {
                    android.util.Log.d("SonoraConsole", "${consoleMessage.message()} (line ${consoleMessage.lineNumber()} of ${consoleMessage.sourceId()})")
                }
                return true
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback
                return try {
                    val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "image/*"
                    }
                    webFileChooserLauncher.launch(intent)
                    true
                } catch (_: Exception) {
                    fileChooserCallback = null
                    false
                }
            }
        }

        webView.addJavascriptInterface(nativeBridge, "SonoraNative")

        ViewCompat.setOnApplyWindowInsetsListener(window.decorView) { _, insets ->
            val statusBarPx = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            val density = resources.displayMetrics.density
            val statusBarDp = if (density > 0) statusBarPx / density else 38f
            val topInsetDp = statusBarDp + 4f
            nativeBridge.safeTopInset = topInsetDp

            if (!isImeAnimating) {
                val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())
                val imePx = imeInsets.bottom
                val imeDp = if (density > 0) imePx / density else 0f
                nativeBridge.currentKeyboardHeightDp = imeDp

                if (topInsetDp != lastTopInsetDp || imeDp != lastImeDp) {
                    lastTopInsetDp = topInsetDp
                    lastImeDp = imeDp
                    webView.evaluateJavascript(
                        "window.SAFE_TOP = $topInsetDp; if (typeof window.updateKeyboardInset === 'function') window.updateKeyboardInset($imeDp); if (typeof layout === 'function') { layout(); redraw(); }",
                        null
                    )
                }
            } else if (topInsetDp != lastTopInsetDp) {
                lastTopInsetDp = topInsetDp
                webView.evaluateJavascript(
                    "window.SAFE_TOP = $topInsetDp; if (typeof layout === 'function') { layout(); redraw(); }",
                    null
                )
            }
            insets
        }

        ViewCompat.setWindowInsetsAnimationCallback(
            window.decorView,
            object : WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_STOP) {
                override fun onPrepare(animation: WindowInsetsAnimationCompat) {
                    if ((animation.typeMask and WindowInsetsCompat.Type.ime()) != 0) {
                        isImeAnimating = true
                    }
                    super.onPrepare(animation)
                }

                override fun onStart(
                    animation: WindowInsetsAnimationCompat,
                    bounds: WindowInsetsAnimationCompat.BoundsCompat
                ): WindowInsetsAnimationCompat.BoundsCompat {
                    if ((animation.typeMask and WindowInsetsCompat.Type.ime()) != 0) {
                        isImeAnimating = true
                    }
                    return super.onStart(animation, bounds)
                }

                override fun onProgress(
                    insets: WindowInsetsCompat,
                    runningAnimations: MutableList<WindowInsetsAnimationCompat>
                ): WindowInsetsCompat {
                    val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())
                    val density = resources.displayMetrics.density
                    val imeDp = if (density > 0) imeInsets.bottom / density else 0f
                    nativeBridge.currentKeyboardHeightDp = imeDp
                    val now = android.os.SystemClock.elapsedRealtime()
                    val deltaOk = lastAnimImeDp.isNaN() || kotlin.math.abs(imeDp - lastAnimImeDp) >= 0.5f
                    if (deltaOk && (lastAnimImePushMs == 0L || now - lastAnimImePushMs >= 8L)) {
                        lastAnimImeDp = imeDp
                        lastAnimImePushMs = now
                        webView.evaluateJavascript(
                            "if (typeof window.updateKeyboardInset === 'function') window.updateKeyboardInset($imeDp, true);",
                            null
                        )
                    }
                    return insets
                }

                override fun onEnd(animation: WindowInsetsAnimationCompat) {
                    if ((animation.typeMask and WindowInsetsCompat.Type.ime()) != 0) {
                        isImeAnimating = false
                        val imeInsets = ViewCompat.getRootWindowInsets(window.decorView)?.getInsets(WindowInsetsCompat.Type.ime())
                        val imePx = imeInsets?.bottom ?: 0
                        val density = resources.displayMetrics.density
                        val imeDp = if (density > 0) imePx / density else 0f
                        nativeBridge.currentKeyboardHeightDp = imeDp
                        lastImeDp = imeDp
                        lastAnimImeDp = imeDp
                        lastAnimImePushMs = 0L
                        webView.evaluateJavascript(
                            "if (typeof window.updateKeyboardInset === 'function') window.updateKeyboardInset($imeDp);",
                            null
                        )
                    }
                    super.onEnd(animation)
                }
            }
        )

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val url = request.url

                val assetResp = assetLoader.shouldInterceptRequest(url)
                if (assetResp != null) return assetResp

                if (url.path?.startsWith("/api/") == true) {
                    return SonoraApiInterceptor.handle(url, request.requestHeaders ?: emptyMap())
                }

                if (url.path == "/favicon.ico") {
                    return WebResourceResponse(
                        "image/x-icon",
                        "UTF-8",
                        204,
                        "No Content",
                        emptyMap(),
                        java.io.ByteArrayInputStream(ByteArray(0))
                    )
                }

                return super.shouldInterceptRequest(view, request)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                synchronized(playbackStateLock) {
                    lastPbTrackId = null
                }
                SonoraPlaybackService.instance?.syncPlaybackState()
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                android.util.Log.e("SonoraWebError", "Error on ${request.url}: ${error.description} (code ${error.errorCode})")
            }

            override fun onRenderProcessGone(
                view: WebView,
                detail: RenderProcessGoneDetail
            ): Boolean {
                android.util.Log.w("SonoraWeb", "Render process gone (crashed=${detail.didCrash()}), recreating activity...")
                recreate()
                return true
            }
        }

        val listener = object : SonoraPlaybackService.Companion.PlaybackListener {
            override fun onPlaybackState(isPlaying: Boolean, positionMs: Long, durationMs: Long, isBuffering: Boolean, trackId: String) {
                if (!isUiResumed) return
                val posSec = positionMs / 1000.0
                val durSec = durationMs / 1000.0
                val now = android.os.SystemClock.elapsedRealtime()
                val qTrack: String
                synchronized(playbackStateLock) {
                    val sameMeta = lastPbTrackId == trackId &&
                        lastPbPlaying == isPlaying &&
                        lastPbBuffering == isBuffering &&
                        lastPbDurSec == durSec
                    if (sameMeta) {
                        if (lastPbPosSec == posSec) return
                        val elapsedSec = (now - lastPbPushElapsedMs) / 1000.0
                        val expectedPos = if (isPlaying && !isBuffering) lastPbPosSec + elapsedSec else lastPbPosSec
                        val isSeekJump = lastPbPosSec.isNaN() || kotlin.math.abs(posSec - expectedPos) > 0.35
                        if (!isSeekJump && now - lastPbPushElapsedMs < 450L) return
                    }
                    if (lastPbTrackId != trackId) {
                        lastPbQuotedTrackId = JSONObject.quote(trackId)
                    }
                    lastPbTrackId = trackId
                    lastPbPlaying = isPlaying
                    lastPbBuffering = isBuffering
                    lastPbPosSec = posSec
                    lastPbDurSec = durSec
                    lastPbPushElapsedMs = now
                    qTrack = lastPbQuotedTrackId
                }
                runOnUiThread {
                    if (!isUiResumed) return@runOnUiThread
                    webView.evaluateJavascript(
                        "window.onSonoraPlaybackState&&window.onSonoraPlaybackState($isPlaying,$posSec,$durSec,$isBuffering,$qTrack)",
                        null
                    )
                }
            }

            override fun onTrackEnded() {
                runOnUiThread {
                    webView.evaluateJavascript("if (window.SonoraNext) window.SonoraNext();", null)
                }
            }

            override fun onNextClicked() {
                runOnUiThread {
                    webView.evaluateJavascript("if (window.SonoraNext) window.SonoraNext(false);", null)
                }
            }

            override fun onPrevClicked() {
                runOnUiThread {
                    webView.evaluateJavascript("if (window.SonoraPrev) window.SonoraPrev();", null)
                }
            }

            override fun onPlaybackError(trackId: String, errorMsg: String) {
                runOnUiThread {
                    val qTrack = JSONObject.quote(trackId)
                    val qMsg = JSONObject.quote(errorMsg)
                    webView.evaluateJavascript(
                        "if (window.onSonoraPlaybackError) window.onSonoraPlaybackError($qTrack, $qMsg);",
                        null
                    )
                }
            }

            override fun onStreamQuality(trackId: String, label: String) {
                runOnUiThread {
                    val qTrack = JSONObject.quote(trackId)
                    val qLabel = JSONObject.quote(label)
                    webView.evaluateJavascript(
                        "if (window.onSonoraStreamQuality) window.onSonoraStreamQuality($qTrack, $qLabel);",
                        null
                    )
                }
            }

            override fun onGaplessTransition(trackId: String) {
                runOnUiThread {
                    val qTrack = JSONObject.quote(trackId)
                    webView.evaluateJavascript(
                        "if (window.onSonoraGaplessTrack) window.onSonoraGaplessTrack($qTrack);",
                        null
                    )
                }
            }

            override fun onAutoCrossfade(fromTrackId: String) {
                runOnUiThread {
                    val qTrack = JSONObject.quote(fromTrackId)
                    webView.evaluateJavascript(
                        "if (window.onSonoraAutoCrossfade) window.onSonoraAutoCrossfade($qTrack);",
                        null
                    )
                }
            }

            override fun onSleepTimerState(active: Boolean, mode: String, remainingSec: Long) {
                runOnUiThread {
                    val qMode = JSONObject.quote(mode)
                    webView.evaluateJavascript(
                        "if (window.onSonoraSleepTimer) window.onSonoraSleepTimer($active, $qMode, $remainingSec);",
                        null
                    )
                }
            }

            override fun onAudioOutputsChanged() {
                runOnUiThread {
                    webView.evaluateJavascript(
                        "if (window.onSonoraAudioOutputsChanged) window.onSonoraAudioOutputsChanged();",
                        null
                    )
                }
            }

            override fun onToggleFavorite(trackId: String, isFav: Boolean) {
                val clean = trackId.removePrefix("yt:").trim()
                if (clean.isNotEmpty()) {
                    pendingFavStates[clean] = isFav
                }
                runOnUiThread {
                    if (::webView.isInitialized) {
                        val qId = JSONObject.quote(trackId)
                        webView.evaluateJavascript(
                            "if (window.onSonoraToggleFavorite) window.onSonoraToggleFavorite($qId, $isFav);",
                            null
                        )
                    }
                }
            }

            override fun onCycleRepeat(repeatMode: Int) {
                val normalized = repeatMode.coerceIn(0, 2)
                pendingRepeatMode = normalized
                runOnUiThread {
                    if (::webView.isInitialized) {
                        webView.evaluateJavascript(
                            "window.onSonoraCycleRepeat && window.onSonoraCycleRepeat($normalized);",
                            null
                        )
                    }
                }
            }
        }
        servicePlaybackListener = listener
        SonoraPlaybackService.playbackListener = listener

        val ul: (String) -> Unit = { json ->
            runOnUiThread {
                if (::webView.isInitialized && !isDestroyed) {
                    webView.evaluateJavascript(
                        "if (window.onSonoraUpdateState) window.onSonoraUpdateState($json);",
                        null
                    )
                }
            }
        }
        updateListener = ul
        SonoraUpdater.getInstance(this).listener = ul

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    "if (window.onSonoraBackPressed) window.onSonoraBackPressed(); else false;"
                ) { result ->
                    val handled = result == "true" || result == "\"true\""
                    if (!handled) {
                        moveTaskToBack(true) // minimize to background instead of destroying music playback
                    }
                }
            }
        })

        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")

        if (SonoraPlaybackService.instance != null) {
            startAndBindPlaybackService()
        } else {
            initialServiceStartScheduled = true
            // Defer ExoPlayer/MediaSession cold-create until initial Home render + covers settle;
            // user Play/prefetch still binds immediately via ensureService().
            webView.postDelayed({
                initialServiceStartScheduled = false
                if (!isFinishing && !isDestroyed && !isServiceBound) {
                    startAndBindPlaybackService()
                }
            }, 2500L)
        }
    }

    private fun postResumeWebViewRefresh(js: String) {
        if (!::webView.isInitialized) return
        webView.post {
            if (::webView.isInitialized) {
                webView.invalidate()
                webView.evaluateJavascript(js, null)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        isUiResumed = true
        val localeChanged = SonoraLocaleManager.syncSystemLocaleIfAuto()
        synchronized(playbackStateLock) {
            lastPbTrackId = null
        }
        if (::webView.isInitialized) {
            webView.onResume()
            if (localeChanged) {
                val cfgJson = SonoraLocaleManager.toJson(includeChanged = true).toString()
                postResumeWebViewRefresh("if (window.onSonoraLocaleChanged) window.onSonoraLocaleChanged($cfgJson);")
            }
            lastResumePushElapsedMs = android.os.SystemClock.elapsedRealtime()
            postResumeWebViewRefresh("if (window.onSonoraResume) window.onSonoraResume(); else if (typeof redraw === 'function') redraw();")
        }
        if (SonoraPlaybackService.instance != null || isServiceBound || !initialServiceStartScheduled) {
            startAndBindPlaybackService()
        }
        flushPendingServiceActions()
        SonoraPlaybackService.instance?.syncPlaybackState()
    }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        if (SonoraLocaleManager.syncSystemLocaleIfAuto() && ::webView.isInitialized) {
            val cfgJson = SonoraLocaleManager.toJson(includeChanged = true).toString()
            postResumeWebViewRefresh("if (window.onSonoraLocaleChanged) window.onSonoraLocaleChanged($cfgJson);")
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && isUiResumed) {
            val now = android.os.SystemClock.elapsedRealtime()
            if (now - lastResumePushElapsedMs >= 250L) {
                lastResumePushElapsedMs = now
                postResumeWebViewRefresh("if (window.onSonoraResume) window.onSonoraResume();")
            }
        }
    }

    override fun onPause() {
        isUiResumed = false
        if (::webView.isInitialized) {
            webView.onPause()
        }
        super.onPause()
    }

    override fun onDestroy() {
        isUiResumed = false
        networkCallback?.let { cb ->
            runCatching { connectivityManager?.unregisterNetworkCallback(cb) }
        }
        networkCallback = null
        connectivityManager = null
        if (SonoraPlaybackService.playbackListener === servicePlaybackListener) {
            SonoraPlaybackService.playbackListener = null
        }
        servicePlaybackListener = null
        val upd = SonoraUpdater.getInstance(this)
        if (upd.listener === updateListener) {
            upd.listener = null
        }
        updateListener = null
        if (isServiceBound) {
            try {
                unbindService(serviceConnection)
            } catch (e: Exception) {
                // ignore
            }
            isServiceBound = false
        }
        super.onDestroy()
    }

    private fun handlePickedImageUri(uri: Uri?) {
        if (uri == null) {
            deliverPickedImage(null)
            return
        }
        Thread {
            val dataUrl = try {
                decodeUriToDataUrl(uri)
            } catch (e: Exception) {
                android.util.Log.e("SonoraImagePicker", "Failed to decode image", e)
                null
            }
            deliverPickedImage(dataUrl)
        }.start()
    }

    private fun deliverPickedImage(dataUrl: String?) {
        val arg = if (dataUrl != null) JSONObject.quote(dataUrl) else "null"
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript(
                    "if (window.onSonoraImagePicked) window.onSonoraImagePicked($arg);",
                    null
                )
            }
        }
    }

    private fun deliverBackupExportResult(ok: Boolean, status: String) {
        val qStatus = JSONObject.quote(status)
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript(
                    "if (window.onSonoraBackupExportResult) window.onSonoraBackupExportResult($ok, $qStatus);",
                    null
                )
            }
        }
    }

    private fun deliverBackupImportResult(rawJson: String?, status: String) {
        val qData = if (rawJson != null) JSONObject.quote(rawJson) else "null"
        val qStatus = JSONObject.quote(status)
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript(
                    "if (window.onSonoraBackupImportData) window.onSonoraBackupImportData($qData, $qStatus);",
                    null
                )
            }
        }
    }

    private fun computeNetworkOnline(cm: ConnectivityManager?): Boolean {
        if (cm == null) return true
        return try {
            val net = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(net) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) ||
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))
        } catch (_: Exception) {
            true
        }
    }

    private fun pushNetworkState(online: Boolean) {
        val changed = isNetworkOnline != online
        isNetworkOnline = online
        if (!changed) return
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript(
                    "if (window.onSonoraNetworkChange) window.onSonoraNetworkChange($online);",
                    null
                )
            }
        }
    }

    private fun setupNetworkMonitor() {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        connectivityManager = cm
        isNetworkOnline = computeNetworkOnline(cm)
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                pushNetworkState(true)
            }

            override fun onLost(network: Network) {
                // Re-query activeNetwork because another transport (e.g. cellular/Wi-Fi) may still be up
                pushNetworkState(computeNetworkOnline(cm))
            }

            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                val ok = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                    (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) ||
                        caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                        caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                        caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))
                pushNetworkState(ok || computeNetworkOnline(cm))
            }
        }
        networkCallback = cb
        runCatching { cm.registerDefaultNetworkCallback(cb) }
    }

    private fun decodeUriToDataUrl(uri: Uri): String? {
        val maxSide = 512
        val rawBmp: Bitmap? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val source = ImageDecoder.createSource(contentResolver, uri)
            ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
                val w = info.size.width
                val h = info.size.height
                if (w > maxSide || h > maxSide) {
                    if (w >= h) {
                        decoder.setTargetSize(maxSide, maxOf(1, (h * maxSide.toFloat() / w).toInt()))
                    } else {
                        decoder.setTargetSize(maxOf(1, (w * maxSide.toFloat() / h).toInt()), maxSide)
                    }
                }
                decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            }
        } else {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            var sample = 1
            while (bounds.outWidth / sample > maxSide * 2 || bounds.outHeight / sample > maxSide * 2) {
                sample *= 2
            }
            val opts = BitmapFactory.Options().apply { inSampleSize = sample }
            var bmp = contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
                ?: return null
            val orient = contentResolver.openInputStream(uri)?.use {
                ExifInterface(it).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL
                )
            } ?: ExifInterface.ORIENTATION_NORMAL
            val deg = when (orient) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
            if (deg != 0f) {
                val m = Matrix().apply { postRotate(deg) }
                val rot = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
                if (rot != bmp) bmp.recycle()
                bmp = rot
            }
            if (bmp.width > maxSide || bmp.height > maxSide) {
                val sc = maxSide.toFloat() / maxOf(bmp.width, bmp.height)
                val nw = maxOf(1, (bmp.width * sc).toInt())
                val nh = maxOf(1, (bmp.height * sc).toInt())
                val scaled = Bitmap.createScaledBitmap(bmp, nw, nh, true)
                if (scaled != bmp) bmp.recycle()
                bmp = scaled
            }
            bmp
        }
        val bmp = rawBmp ?: return null
        return try {
            val out = java.io.ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, 86, out)
            val b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
            "data:image/jpeg;base64,$b64"
        } finally {
            bmp.recycle()
        }
    }

    inner class SonoraNativeBridge {
        var safeTopInset: Float = 44f
        var currentKeyboardHeightDp: Float = 0f

        @JavascriptInterface
        fun pickImage() {
            runOnUiThread {
                try {
                    pickMediaLauncher.launch(
                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                    )
                } catch (_: Exception) {
                    val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "image/*"
                    }
                    legacyImagePickerLauncher.launch(
                        Intent.createChooser(
                            intent,
                            SonoraLocaleManager.getString(this@MainActivity, R.string.pick_cover_title)
                        )
                    )
                }
            }
        }

        @JavascriptInterface
        fun share(text: String, title: String) {
            runOnUiThread {
                val sendIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                    if (title.isNotEmpty()) {
                        putExtra(Intent.EXTRA_TITLE, title)
                        putExtra(Intent.EXTRA_SUBJECT, title)
                    }
                }
                val chooser = Intent.createChooser(
                    sendIntent,
                    title.ifEmpty { SonoraLocaleManager.getString(this@MainActivity, R.string.share_title) }
                )
                startActivity(chooser)
            }
        }

        @JavascriptInterface
        fun getTopInset(): Float = safeTopInset

        @JavascriptInterface
        fun getKeyboardHeight(): Float = currentKeyboardHeightDp

        @JavascriptInterface
        fun prefetch(id: String) {
            val running = SonoraPlaybackService.instance
            if (running != null) {
                running.prefetch(id)
                return
            }
            runOnUiThread {
                ensureService { service ->
                    service.prefetch(id)
                }
            }
        }

        @JavascriptInterface
        fun play(id: String, title: String, artist: String, thumb: String, dur: Long) {
            playWithAuto(id, title, artist, thumb, dur, false)
        }

        @JavascriptInterface
        fun playWithAuto(id: String, title: String, artist: String, thumb: String, dur: Long, isAuto: Boolean) {
            runOnUiThread {
                ensureService { service ->
                    service.playTrack(id, title, artist, thumb, dur, isAuto)
                }
            }
        }

        @JavascriptInterface
        fun setNextTrack(id: String, title: String, artist: String, thumb: String) {
            runOnUiThread {
                ensureService { service ->
                    service.setNextTrack(id, title, artist, thumb)
                }
            }
        }

        @JavascriptInterface
        fun updateTrackArtwork(id: String, thumb: String) {
            runOnUiThread {
                ensureService { service ->
                    service.updateTrackArtwork(id, thumb)
                }
            }
        }

        @JavascriptInterface
        fun setVolume(vol: Double) {
            val v = vol.toFloat().coerceIn(0f, 1f)
            runOnUiThread {
                ensureService { service ->
                    service.setVolume(v)
                }
            }
        }

        @JavascriptInterface
        fun setEqGains(gainsJson: String) {
            runCatching {
                val arr = JSONArray(gainsJson)
                val gains = FloatArray(SonoraEqualizer.FREQUENCIES.size) { i ->
                    if (i < arr.length()) arr.optDouble(i, 0.0).toFloat() else 0f
                }
                SonoraEqualizer.update(gains)
            }
        }

        @JavascriptInterface
        fun setFadeConfig(crossfadeSec: Int, skipFade: Boolean) {
            runOnUiThread {
                ensureService { service ->
                    service.setFadeConfig(crossfadeSec, skipFade)
                }
            }
        }

        @JavascriptInterface
        fun setVolumeNorm(enabled: Boolean) {
            pendingVolumeNorm = enabled
            SonoraPlaybackService.instance?.setVolumeNorm(enabled)
        }

        @JavascriptInterface
        fun setRepeatMode(mode: Int) {
            val normalized = mode.coerceIn(0, 2)
            pendingRepeatMode = normalized
            SonoraPlaybackService.instance?.setRepeatModeState(normalized)
        }

        @JavascriptInterface
        fun setTrackFavorite(trackId: String, isFav: Boolean) {
            val clean = trackId.removePrefix("yt:").trim()
            if (clean.isNotEmpty()) {
                if (pendingFavStates.size > 512) {
                    pendingFavStates.clear()
                }
                pendingFavStates[clean] = isFav
            }
            SonoraPlaybackService.instance?.setTrackFavorite(trackId, isFav)
        }

        @JavascriptInterface
        fun setSleepTimer(mode: String, minutes: Int) {
            runOnUiThread {
                ensureService { service ->
                    service.setSleepTimer(mode, minutes)
                }
            }
        }

        @JavascriptInterface
        fun getSleepTimer(): String {
            return SonoraPlaybackService.instance?.getSleepTimerJson()
                ?: "{\"active\":false,\"mode\":\"off\",\"remainingSec\":0}"
        }

        @JavascriptInterface
        fun getAudioOutputs(): String {
            return SonoraPlaybackService.instance?.getAudioOutputsJson() ?: run {
                val mgr = getSystemService(Context.AUDIO_SERVICE) as? android.media.AudioManager
                val arr = JSONArray()
                mgr?.getDevices(android.media.AudioManager.GET_DEVICES_OUTPUTS)?.forEach { d ->
                    if (d.type == android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER ||
                        d.type == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
                        d.type == android.media.AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                        d.type == android.media.AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                        d.type == android.media.AudioDeviceInfo.TYPE_USB_HEADSET) {
                        val kind = when (d.type) {
                            android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "speaker"
                            android.media.AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "bluetooth"
                            android.media.AudioDeviceInfo.TYPE_USB_HEADSET -> "usb"
                            else -> "wired"
                        }
                        arr.put(JSONObject().apply {
                            put("id", d.id)
                            put("kind", kind)
                            put("type", d.type)
                            put(
                                "name",
                                if (kind == "speaker") {
                                    SonoraLocaleManager.getString(this@MainActivity, R.string.audio_output_speaker)
                                } else {
                                    d.productName?.toString()
                                        ?: SonoraLocaleManager.getString(this@MainActivity, R.string.audio_output_default)
                                }
                            )
                            put("selected", false)
                        })
                    }
                }
                JSONObject().apply {
                    put("auto", true)
                    put("outputs", arr)
                }.toString()
            }
        }

        @JavascriptInterface
        fun setAudioOutput(deviceId: Int): Boolean {
            return SonoraPlaybackService.instance?.setAudioOutput(deviceId) ?: false
        }

        @JavascriptInterface
        fun openSystemOutputSwitcher() {
            runOnUiThread {
                runCatching {
                    val intent = Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(intent)
                }
            }
        }

        private val cacheStatsLock = Any()
        private val cacheStatsRefreshing = java.util.concurrent.atomic.AtomicBoolean(false)

        @Volatile
        private var cachedCacheStatsJson: String? = null

        @Volatile
        private var cachedCacheStatsAtMs: Long = 0L

        private fun computeCacheStatsJson(): String {
            val mediaBytes = SonoraPlaybackService.getMediaCacheSizeBytes(this@MainActivity)
            val downloadsBytes = SonoraDownloadManager.getDownloadsSizeBytes(this@MainActivity)
            val downloadsCount = SonoraDownloadManager.getCompletedDownloadCount(this@MainActivity)
            val httpCoverBytes = SonoraApiInterceptor.getCoverAndHttpCacheBytes()
            val lyricsBytes = dev.sonora.music.lyrics.LyricsLibrary.getDiskCacheSizeBytes()
            val lyricsCount = dev.sonora.music.lyrics.LyricsLibrary.getCachedEntryCount()
            val coverCount = CoverCache.count()
            return JSONObject().apply {
                put("mediaBytes", mediaBytes)
                put("downloadsBytes", downloadsBytes)
                put("downloadsCount", downloadsCount)
                put("httpCoverBytes", httpCoverBytes)
                put("lyricsBytes", lyricsBytes)
                put("totalBytes", mediaBytes + httpCoverBytes + lyricsBytes)
                put("lyricsCount", lyricsCount)
                put("coverCount", coverCount)
            }.toString()
        }

        private fun refreshCacheStatsAsync() {
            if (!cacheStatsRefreshing.compareAndSet(false, true)) return
            bgIoExecutor.execute {
                try {
                    val json = computeCacheStatsJson()
                    synchronized(cacheStatsLock) {
                        cachedCacheStatsJson = json
                        cachedCacheStatsAtMs = android.os.SystemClock.elapsedRealtime()
                    }
                } catch (_: Exception) {
                } finally {
                    cacheStatsRefreshing.set(false)
                }
            }
        }

        @JavascriptInterface
        fun getCacheStats(): String {
            val now = android.os.SystemClock.elapsedRealtime()
            val cached = cachedCacheStatsJson
            if (cached != null) {
                if (now - cachedCacheStatsAtMs >= 5_000L) {
                    refreshCacheStatsAsync()
                }
                return cached
            }
            // Cold call: trigger async refresh and compute once cleanly (sub-caches are now O(1) indexed).
            synchronized(cacheStatsLock) {
                cachedCacheStatsJson?.let { return it }
                val json = computeCacheStatsJson()
                cachedCacheStatsJson = json
                cachedCacheStatsAtMs = android.os.SystemClock.elapsedRealtime()
                return json
            }
        }

        @JavascriptInterface
        fun getDownloadsStatus(): String {
            return SonoraDownloadManager.getDownloadsStatusJson(this@MainActivity)
        }

        @JavascriptInterface
        fun isTrackDownloaded(id: String): Boolean {
            return SonoraDownloadManager.isTrackDownloaded(this@MainActivity, id)
        }

        @JavascriptInterface
        fun isTrackCached(id: String): Boolean {
            return SonoraPlaybackService.isTrackCached(this@MainActivity, id)
        }

        @JavascriptInterface
        fun enqueueDownload(id: String): Boolean {
            val clean = SonoraDownloadManager.normalizeTrackId(id)
            if (clean.isEmpty() || clean.startsWith("local_")) return false
            SonoraDownloadManager.enqueue(this@MainActivity, clean)
            cachedCacheStatsAtMs = 0L
            refreshCacheStatsAsync()
            return true
        }

        @JavascriptInterface
        fun deleteDownloadedTrack(id: String): Boolean {
            val removed = SonoraPlaybackService.deleteDownloadedTrack(this@MainActivity, id)
            cachedCacheStatsAtMs = 0L
            refreshCacheStatsAsync()
            return removed
        }

        @JavascriptInterface
        fun clearCache(): Boolean {
            return runCatching {
                SonoraApiInterceptor.clearCaches()
                StreamCache.clear()
                synchronized(cacheStatsLock) {
                    cachedCacheStatsJson = "{\"mediaBytes\":0,\"downloadsBytes\":${SonoraDownloadManager.getDownloadsSizeBytes(this@MainActivity)},\"downloadsCount\":${SonoraDownloadManager.getCompletedDownloadCount(this@MainActivity)},\"httpCoverBytes\":0,\"lyricsBytes\":0,\"totalBytes\":0,\"lyricsCount\":0,\"coverCount\":0}"
                    cachedCacheStatsAtMs = 0L
                }
                val appCtx = applicationContext
                val rootCacheDir = cacheDir
                bgIoExecutor.execute {
                    runCatching {
                        SonoraPlaybackService.clearAudioDiskCache(appCtx)
                    }
                    listOf(
                        java.io.File(rootCacheDir, "innertube_http_cache"),
                        java.io.File(rootCacheDir, "innertube/innertube_http_cache"),
                        java.io.File(rootCacheDir, "apple_http_cache"),
                        java.io.File(rootCacheDir, "apple_catalog_v1"),
                        java.io.File(rootCacheDir, "lyrics_v4"),
                        java.io.File(rootCacheDir, "sonora_lyrics_cache"),
                    ).forEach { dir ->
                        runCatching {
                            if (dir.exists()) dir.deleteRecursively()
                        }
                    }
                    refreshCacheStatsAsync()
                }
                true
            }.getOrDefault(false)
        }

        @JavascriptInterface
        fun togglePlay() {
            runOnUiThread {
                ensureService { service ->
                    service.togglePlay()
                }
            }
        }

        @JavascriptInterface
        fun stopPlayback() {
            synchronized(playbackStateLock) {
                lastPbTrackId = ""
                lastPbPlaying = false
                lastPbBuffering = false
                lastPbPosSec = -1.0
                lastPbDurSec = -1.0
            }
            SonoraPlaybackService.instance?.stopPlaybackAndClear()
        }

        @JavascriptInterface
        fun seekTo(seconds: Double) {
            val ms = (seconds * 1000).toLong()
            runOnUiThread {
                ensureService { service ->
                    service.seekTo(ms)
                }
            }
        }

        @JavascriptInterface
        fun getPlaybackSnapshot(): String {
            return SonoraPlaybackService.instance?.getPlaybackSnapshotJson() ?: "{\"active\":false}"
        }

        @JavascriptInterface
        fun isNative(): Boolean = true

        @JavascriptInterface
        fun getUpdateState(): String = SonoraUpdater.getInstance(this@MainActivity).stateJson()

        @JavascriptInterface
        fun checkForUpdates(manual: Boolean) {
            SonoraUpdater.getInstance(this@MainActivity).checkAsync(manual)
        }

        @JavascriptInterface
        fun installUpdate() {
            runOnUiThread {
                val updater = SonoraUpdater.getInstance(this@MainActivity)
                val update = updater.currentAvailable()
                if (update == null) {
                    updater.checkAsync(true)
                    return@runOnUiThread
                }
                if (updater.canInstall()) {
                    updater.install(update, manual = true)
                } else {
                    pendingInstallUpdate = update
                    updater.install(update, manual = true)
                    updatePermissionLauncher.launch(updater.permissionIntent())
                }
            }
        }

        @JavascriptInterface
        fun dismissUpdate() {
            SonoraUpdater.getInstance(this@MainActivity).dismiss()
        }

        @JavascriptInterface
        fun getLocaleConfig(): String = SonoraLocaleManager.toJson().toString()

        @JavascriptInterface
        fun setLocaleConfig(lang: String?, country: String?): String {
            val changed = SonoraLocaleManager.updateConfig(lang, country)
            return SonoraLocaleManager.toJson(includeChanged = changed).toString()
        }

        @Suppress("DEPRECATION")
        @JavascriptInterface
        fun haptic(kind: String) {
            if (!::webView.isInitialized) return
            val flag = when (kind.lowercase()) {
                "pickup" -> HapticFeedbackConstants.LONG_PRESS
                "tick" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    HapticFeedbackConstants.SEGMENT_FREQUENT_TICK
                } else {
                    HapticFeedbackConstants.CLOCK_TICK
                }
                "threshold" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    HapticFeedbackConstants.CONFIRM
                } else {
                    HapticFeedbackConstants.LONG_PRESS
                }
                "drop" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    HapticFeedbackConstants.GESTURE_END
                } else {
                    HapticFeedbackConstants.CLOCK_TICK
                }
                else -> HapticFeedbackConstants.CLOCK_TICK
            }
            webView.post {
                webView.performHapticFeedback(flag, HapticFeedbackConstants.FLAG_IGNORE_VIEW_SETTING)
            }
        }

        @JavascriptInterface
        fun isOnline(): Boolean = isNetworkOnline

        @JavascriptInterface
        fun exportBackup(jsonData: String, suggestedName: String?): Boolean {
            if (jsonData.isBlank()) return false
            val fileName = suggestedName?.trim()?.takeIf { it.isNotEmpty() } ?: "sonora-backup.sonora.json"
            pendingBackupJson = jsonData
            runOnUiThread {
                try {
                    backupExportLauncher.launch(fileName)
                } catch (e: Exception) {
                    pendingBackupJson = null
                    android.util.Log.e("SonoraBackup", "Failed to open SAF create document", e)
                    deliverBackupExportResult(false, "launch_error")
                }
            }
            return true
        }

        @JavascriptInterface
        fun importBackup(): Boolean {
            runOnUiThread {
                try {
                    backupImportLauncher.launch(arrayOf("application/json", "application/octet-stream", "*/*"))
                } catch (e: Exception) {
                    android.util.Log.e("SonoraBackup", "Failed to open SAF open document", e)
                    deliverBackupImportResult(null, "launch_error")
                }
            }
            return true
        }

        @JavascriptInterface
        fun log(msg: String) {
            android.util.Log.d("SonoraWeb", msg)
        }
    }
}
