package dev.sonora.music

private val GUSER_S_REGEX = Regex("=(?:s\\d+|[wsh]\\d+)[^/?#]*$")
private val GUSER_WH_REGEX = Regex("=(?:[wsh]\\d+[^/?#]*)$")
private val YT_VI_REGEX = Regex("https://i\\.ytimg\\.com/vi/([^/]+)/.*")

fun String.atSize(width: Int, height: Int = width): String {
    if (this.isBlank()) return this

    if (this.contains("googleusercontent.com")) {
        if (this.contains("-c-k-c0x00ffffff-no-rj") || this.contains("=s")) {
            return this.replace(GUSER_S_REGEX, "=s$width-c-k-c0x00ffffff-no-rj")
        }
        return if (this.contains("=")) {
            this.replace(GUSER_WH_REGEX, "=w$width-h$height-p-l90-rj")
        } else {
            "$this=w$width-h$height-p-l90-rj"
        }
    }

    if (this.contains("ggpht.com")) {
        return if (this.contains("=")) {
            this.replace(GUSER_S_REGEX, "=s$width-c-k-c0x00ffffff-no-rj")
        } else {
            "$this-s$width"
        }
    }

    val ytMatch = YT_VI_REGEX.matchEntire(this)
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
