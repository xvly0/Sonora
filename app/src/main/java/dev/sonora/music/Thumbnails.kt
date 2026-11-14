package dev.sonora.music

fun String.atSize(width: Int, height: Int = width): String {
    if (this.isBlank()) return this

    if (this.contains("googleusercontent.com")) {
        if (this.contains("-c-k-c0x00ffffff-no-rj") || this.contains("=s")) {
            return this.replace(Regex("=(?:s\\d+|[wsh]\\d+)[^/?#]*$"), "=s$width-c-k-c0x00ffffff-no-rj")
        }
        return if (this.contains("=")) {
            this.replace(Regex("=(?:[wsh]\\d+[^/?#]*)$"), "=w$width-h$height-p-l90-rj")
        } else {
            "$this=w$width-h$height-p-l90-rj"
        }
    }

    if (this.contains("ggpht.com")) {
        return if (this.contains("=")) {
            this.replace(Regex("=(?:s\\d+|[wsh]\\d+)[^/?#]*$"), "=s$width-c-k-c0x00ffffff-no-rj")
        } else {
            "$this-s$width"
        }
    }

    val ytMatch = Regex("https://i\\.ytimg\\.com/vi/([^/]+)/.*").matchEntire(this)
    if (ytMatch != null) {
        val id = ytMatch.groupValues[1]
        return "https://i.ytimg.com/vi/$id/sddefault.jpg"
    }

    // iTunes / Apple Music mzstatic template
    if (this.contains("mzstatic.com") && this.contains("{w}x{h}")) {
        return this.replace("{w}", "$width").replace("{h}", "$height").replace("{f}", "webp")
    }

    return this
}
