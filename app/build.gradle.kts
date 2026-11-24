import java.io.File
import java.io.FileInputStream
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
}

val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        FileInputStream(keystorePropertiesFile).use { load(it) }
    }
}

android {
    namespace = "dev.sonora.music"
    compileSdk = 35

    defaultConfig {
        applicationId = "dev.sonora.music"
        minSdk = 26
        targetSdk = 35
        versionCode = 4
        versionName = "1.0.2-beta"
    }

    signingConfigs {
        val storePath = keystoreProperties.getProperty("storeFile") ?: System.getenv("KEYSTORE_FILE")
        if (!storePath.isNullOrBlank()) {
            create("release") {
                storeFile = File(storePath).let { if (it.isAbsolute) it else rootProject.file(storePath) }
                storePassword = keystoreProperties.getProperty("storePassword") ?: System.getenv("KEYSTORE_PASSWORD")
                keyAlias = keystoreProperties.getProperty("keyAlias") ?: System.getenv("KEY_ALIAS")
                keyPassword = keystoreProperties.getProperty("keyPassword") ?: System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs_nio:2.1.5")
    implementation(project(":innertube"))

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.0")
    implementation("com.google.android.material:material:1.12.0")

    // Media3 ExoPlayer for native background audio
    implementation("androidx.media3:media3-exoplayer:1.5.0")
    implementation("androidx.media3:media3-session:1.5.0")
    implementation("androidx.media3:media3-ui:1.5.0")
    implementation("androidx.media3:media3-datasource-okhttp:1.5.0")
    implementation("androidx.media3:media3-datasource:1.5.0")

    // Coroutines & Serialization
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    // Networking
    implementation(libs.okhttp)
    implementation(libs.newpipe.extractor)

    testImplementation("junit:junit:4.13.2")
}
