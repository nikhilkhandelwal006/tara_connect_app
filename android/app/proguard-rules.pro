# Add project specific ProGuard rules here.

# -----------------------------------------------
# Capacitor / WebView bridge — MUST keep these
# -----------------------------------------------
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorPlugin *;
}

# Keep WebView JavaScript interface
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String);
    public boolean *(android.webkit.WebView, java.lang.String);
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# -----------------------------------------------
# AndroidX / AppCompat
# -----------------------------------------------
-keep class androidx.** { *; }
-keep interface androidx.** { *; }

# -----------------------------------------------
# OkHttp (used internally by some plugins)
# -----------------------------------------------
-dontwarn okhttp3.**
-dontwarn okio.**

# -----------------------------------------------
# Preserve source file & line numbers for crash reports
# -----------------------------------------------
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# -----------------------------------------------
# Suppress common warnings from third-party libs
# -----------------------------------------------
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
