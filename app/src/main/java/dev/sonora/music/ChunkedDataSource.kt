package dev.sonora.music

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.HttpDataSource
import androidx.media3.datasource.TransferListener

/**
 * A YouTube stream fetched a piece at a time, read as one.
 * Adapted from Square (dev.lelonio.square.backend.youtube.ChunkedDataSource).
 *
 * YouTube throttles long requests or cuts them with 403 / stalls unless chunked.
 * Here each piece is a request of its own (512 KB), too short to be throttled,
 * and the next is requested as soon as one runs out.
 */
@UnstableApi
class ChunkedDataSource(private val upstream: DataSource) : DataSource {

    class Factory(private val upstream: DataSource.Factory) : DataSource.Factory {
        override fun createDataSource(): ChunkedDataSource = ChunkedDataSource(upstream.createDataSource())
    }

    private var spec: DataSpec? = null
    private var chunked = false
    private var position = 0L
    private var remaining = C.LENGTH_UNSET.toLong()
    private var pieceLeft = 0L
    private var opened = false

    override fun addTransferListener(transferListener: TransferListener) =
        upstream.addTransferListener(transferListener)

    override fun open(dataSpec: DataSpec): Long {
        spec = dataSpec
        chunked = dataSpec.uri.scheme == "https" && dataSpec.uri.host.orEmpty().endsWith("googlevideo.com")
        if (!chunked) {
            opened = true
            return upstream.open(dataSpec)
        }
        position = dataSpec.position
        remaining = dataSpec.length
        val first = openPiece()
        val total = upstream.responseHeaders.entries
            .firstOrNull { it.key.equals("content-range", ignoreCase = true) }
            ?.value?.firstOrNull()
            ?.substringAfter('/')?.toLongOrNull()
        return when {
            remaining != C.LENGTH_UNSET.toLong() -> remaining
            total != null -> {
                remaining = total - dataSpec.position
                remaining
            }
            else -> if (first < CHUNK_BYTES) first else C.LENGTH_UNSET.toLong()
        }
    }

    private fun openPiece(): Long {
        val wanted = if (remaining == C.LENGTH_UNSET.toLong()) CHUNK_BYTES else minOf(CHUNK_BYTES, remaining)
        val piece = spec!!.buildUpon().setPosition(position).setLength(wanted).build()
        val length = upstream.open(piece)
        opened = true
        pieceLeft = if (length == C.LENGTH_UNSET.toLong()) wanted else length
        return pieceLeft
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (length == 0) return 0
        if (!chunked) return upstream.read(buffer, offset, length)
        while (true) {
            if (remaining == 0L) return C.RESULT_END_OF_INPUT
            if (!opened) {
                val next = try {
                    openPiece()
                } catch (e: HttpDataSource.InvalidResponseCodeException) {
                    if (e.responseCode == 416) return C.RESULT_END_OF_INPUT
                    throw e
                }
                if (next == 0L) return C.RESULT_END_OF_INPUT
            }
            val read = upstream.read(buffer, offset, minOf(length.toLong(), pieceLeft).toInt())
            if (read == C.RESULT_END_OF_INPUT) {
                if (pieceLeft > 0) {
                    upstream.close()
                    opened = false
                    val re = try { openPiece() } catch (_: Exception) { 0L }
                    if (re > 0) continue
                    return C.RESULT_END_OF_INPUT
                }
                upstream.close()
                opened = false
                continue
            }
            position += read
            pieceLeft -= read
            if (remaining != C.LENGTH_UNSET.toLong()) remaining -= read
            if (pieceLeft == 0L) {
                upstream.close()
                opened = false
            }
            return read
        }
    }

    override fun getUri(): Uri? = upstream.uri ?: spec?.uri

    override fun getResponseHeaders(): Map<String, List<String>> = upstream.responseHeaders

    override fun close() {
        if (opened) upstream.close()
        opened = false
        spec = null
    }

    companion object {
        const val CHUNK_BYTES = 512L * 1024
    }
}
