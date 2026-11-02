#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
build_dir="$project_dir/build-cli/test"
mkdir -p "$build_dir"
sources=("$project_dir/app/src/main/java/com/tiffanyroom/app/UpdatePlanner.java" "$project_dir/test/com/tiffanyroom/app/UpdatePlannerTest.java")
if command -v javac >/dev/null; then
    javac -d "$build_dir" "${sources[@]}"
else
    : "${ECJ_JAR:?Install a JDK or set ECJ_JAR}"
    java -jar "$ECJ_JAR" -source 8 -target 8 -d "$build_dir" "${sources[@]}"
fi
java -cp "$build_dir" com.tiffanyroom.app.UpdatePlannerTest
