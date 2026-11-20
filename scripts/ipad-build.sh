#!/usr/bin/env bash
# Build a signed iOS app, install it on the iPad, and open it.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
unset CARGO_TARGET_DIR

device="${HARVY_IPAD:-00008130-0004516138EB8D3A}"
bundle_id="com.harvy.writer"

"$root/node_modules/.bin/tauri" ios build --export-method debugging

ipa="$root/src-tauri/gen/apple/build/arm64/Harvy.ipa"
if [[ ! -f "$ipa" ]]; then
  echo "The build finished, but the install package was not found." >&2
  exit 1
fi

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
unzip -q "$ipa" -d "$stage"
app="$(find "$stage/Payload" -maxdepth 1 -type d -name '*.app' -print -quit)"
if [[ -z "$app" ]]; then
  echo "The install package did not contain an app." >&2
  exit 1
fi

xcrun devicectl device install app --device "$device" "$app"
xcrun devicectl device process launch --terminate-existing --device "$device" "$bundle_id"
