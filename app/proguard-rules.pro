# Sonora Android — R8 / ProGuard rules

# Preserve generic signatures, annotations, and inner/enclosing class metadata
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod, Exceptions, RuntimeVisibleAnnotations, RuntimeInvisibleAnnotations

# WebView @JavascriptInterface bridge (exact method names & signatures required by JS)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class dev.sonora.music.MainActivity$SonoraNativeBridge { *; }
-keepclassmembers class dev.sonora.music.MainActivity$SonoraNativeBridge { *; }

# Keep Android components declared in AndroidManifest.xml
-keep public class dev.sonora.music.MainActivity { *; }
-keep public class dev.sonora.music.SonoraPlaybackService { *; }
-keep public class dev.sonora.music.SonoraUpdateService { *; }
-keep public class dev.sonora.music.SonoraInstallReceiver { *; }

# kotlinx.serialization (InnerTube models & Ktor JSON)
-keep,includedescriptorclasses class com.metrolist.innertube.models.** { *; }
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class **$$serializer { *; }
-keepclassmembers class * {
    @kotlinx.serialization.Serializable <fields>;
}
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1> {
    static <1>$Companion Companion;
}
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1>$Companion {
    kotlinx.serialization.KSerializer serializer(...);
}

# Ktor Client & ServiceLoader providers
-keep class io.ktor.** { *; }
-keep class kotlinx.coroutines.** { *; }
-dontwarn io.ktor.**
-dontwarn kotlinx.atomicfu.**
-dontwarn org.slf4j.**
-dontwarn java.lang.management.**

# NewPipe Extractor & Mozilla Rhino JS engine (reflection & dynamic script evaluation)
-keep class org.schabi.newpipe.extractor.** { *; }
-keep class org.mozilla.javascript.** { *; }
-keep class org.mozilla.classfile.** { *; }
-keep class com.grack.nanojson.** { *; }
-keep class org.jsoup.** { *; }
-dontwarn org.schabi.newpipe.extractor.**
-dontwarn org.mozilla.javascript.**
-dontwarn org.mozilla.classfile.**
-dontwarn java.awt.**
-dontwarn javax.swing.**
-dontwarn javax.script.**
-dontwarn org.w3c.dom.**
-dontwarn org.jspecify.annotations.**

# OkHttp / Okio / Brotli
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-keep class org.brotli.** { *; }

# Media3 / ExoPlayer safety
-keep class androidx.media3.datasource.okhttp.** { *; }
-dontwarn androidx.media3.**
