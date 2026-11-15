package dev.sonora.music

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class SonoraUpdateService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var running = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val url = intent?.getStringExtra(EXTRA_URL).orEmpty()
        val version = intent?.getStringExtra(EXTRA_VERSION).orEmpty()
        val bytes = intent?.getLongExtra(EXTRA_BYTES, 0L) ?: 0L
        val notes = intent?.getStringExtra(EXTRA_NOTES).orEmpty()

        if (running) return START_NOT_STICKY

        createChannel()
        val initialNotif = buildNotification(version, null)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, initialNotif, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(NOTIFICATION_ID, initialNotif)
        }

        if (url.isEmpty()) {
            stopSelf()
            return START_NOT_STICKY
        }

        running = true
        val updater = SonoraUpdater.getInstance(applicationContext)
        val available = SonoraUpdater.State.Available(version, url, bytes, notes)
        scope.launch {
            updater.fetchAndInstall(available) { progress ->
                notifyProgress(version, progress)
            }
            stopSelf()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun notifyProgress(version: String, progress: Float?) {
        manager().notify(NOTIFICATION_ID, buildNotification(version, progress))
    }

    private fun buildNotification(version: String, progress: Float?): Notification {
        val percent = progress?.let { (it * 100f).toInt().coerceIn(0, 100) }
        val title = SonoraLocaleManager.getString(this, R.string.update_downloading)
        val text = listOfNotNull(
            version.takeIf { it.isNotEmpty() },
            percent?.let { "$it%" }
        ).joinToString(" · ")

        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .setProgress(100, percent ?: 0, percent == null)
            .build()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channelName = SonoraLocaleManager.getString(this, R.string.update_channel)
        val channel = NotificationChannel(
            CHANNEL_ID,
            channelName,
            NotificationManager.IMPORTANCE_LOW
        )
        manager().createNotificationChannel(channel)
    }

    private fun manager(): NotificationManager =
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    companion object {
        private const val CHANNEL_ID = "sonora_update"
        private const val NOTIFICATION_ID = 4201
        private const val EXTRA_URL = "url"
        private const val EXTRA_VERSION = "version"
        private const val EXTRA_BYTES = "bytes"
        private const val EXTRA_NOTES = "notes"

        fun start(context: Context, update: SonoraUpdater.State.Available) {
            val intent = Intent(context, SonoraUpdateService::class.java)
                .putExtra(EXTRA_URL, update.url)
                .putExtra(EXTRA_VERSION, update.version)
                .putExtra(EXTRA_BYTES, update.bytes)
                .putExtra(EXTRA_NOTES, update.notes)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }
}
