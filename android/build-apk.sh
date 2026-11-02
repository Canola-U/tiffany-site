#!/usr/bin/env bash
# Build a framework-only Android APK using Google's Android SDK build tools.
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
sdk_dir="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
if [[ -z "$sdk_dir" ]]; then echo 'Set ANDROID_SDK_ROOT to your Android SDK directory.' >&2; exit 1; fi
tools_dir="$sdk_dir/build-tools/35.0.0"
platform_jar="$sdk_dir/platforms/android-35/android.jar"
for binary in aapt2 d8 zipalign apksigner; do [[ -x "$tools_dir/$binary" ]] || { echo "Missing build-tools/35.0.0/$binary" >&2; exit 1; }; done
[[ -f "$platform_jar" ]] || { echo 'Install platforms;android-35.' >&2; exit 1; }
build_dir="$project_dir/build-cli"
mkdir -p "$build_dir/classes" "$build_dir/dex"
"$tools_dir/aapt2" compile --dir "$project_dir/app/src/main/res" -o "$build_dir/resources.zip"
"$tools_dir/aapt2" link -o "$build_dir/base.apk" -I "$platform_jar" --manifest "$project_dir/app/src/main/AndroidManifest.xml" --java "$build_dir/generated" --version-code 1 --version-name 1.0.0 "$build_dir/resources.zip"
find "$project_dir/app/src/main/java" "$build_dir/generated" -name '*.java' -print > "$build_dir/sources.txt"
if command -v javac >/dev/null; then
    javac -encoding UTF-8 -source 8 -target 8 -bootclasspath "$platform_jar:$tools_dir/core-lambda-stubs.jar" -d "$build_dir/classes" @"$build_dir/sources.txt"
else
    : "${ECJ_JAR:?Install a JDK or set ECJ_JAR to a verified Eclipse Java compiler jar}"
    java -jar "$ECJ_JAR" -encoding UTF-8 -source 8 -target 8 -bootclasspath "$platform_jar:$tools_dir/core-lambda-stubs.jar" -d "$build_dir/classes" @"$build_dir/sources.txt"
fi
python3 "$project_dir/tools/pack-classes.py" "$build_dir/classes" "$build_dir/classes.jar"
"$tools_dir/d8" --lib "$platform_jar" --min-api 26 --output "$build_dir/dex" "$build_dir/classes.jar"
cp "$build_dir/base.apk" "$build_dir/unsigned.apk"
python3 "$project_dir/tools/add-dex.py" "$build_dir/unsigned.apk" "$build_dir/dex"
"$tools_dir/zipalign" -f -p 4 "$build_dir/unsigned.apk" "$build_dir/aligned.apk"
# Debug signing is for personal sideload testing only. Do not publish it as a production release.
key_path="$project_dir/.signing/debug.keystore"
mkdir -p "$(dirname "$key_path")"
if [[ ! -f "$key_path" ]]; then
    keytool -genkeypair -keystore "$key_path" -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Android Debug,O=TiffanyRoom,C=KR' >/dev/null
fi
"$tools_dir/apksigner" sign --ks "$key_path" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$build_dir/tiffany-room-android.apk" "$build_dir/aligned.apk"
"$tools_dir/apksigner" verify --verbose "$build_dir/tiffany-room-android.apk"
echo "Built: $build_dir/tiffany-room-android.apk"
