package dev.sonora.music

import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import java.util.concurrent.TimeUnit

class NewPipeDownloader(private val http: OkHttpClient) : Downloader() {

    override fun execute(request: Request): Response {
        val builder = okhttp3.Request.Builder()
            .method(
                request.httpMethod(),
                request.dataToSend()?.toRequestBody(),
            )
            .url(request.url())
            .addHeader("User-Agent", USER_AGENT)

        request.headers().forEach { (name, values) ->
            builder.removeHeader(name)
            values.forEach { builder.addHeader(name, it) }
        }

        http.newCall(builder.build()).execute().use { response ->
            if (response.code == HTTP_TOO_MANY_REQUESTS) {
                throw ReCaptchaException("reCaptcha challenge requested", request.url())
            }
            val body = response.body?.string()
            return Response(
                response.code,
                response.message,
                response.headers.toMultimap(),
                body,
                response.request.url.toString(),
            )
        }
    }

    companion object {
        private const val HTTP_TOO_MANY_REQUESTS = 429
        private const val USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

        private val sharedHttpClient = OkHttpClient.Builder()
            .connectionPool(okhttp3.ConnectionPool(8, 5, TimeUnit.MINUTES))
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(25, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()

        private val instance = NewPipeDownloader(sharedHttpClient)

        fun create(): NewPipeDownloader = instance
    }
}
