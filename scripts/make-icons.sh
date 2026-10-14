#!/usr/bin/env bash
# ホーム画面のアイコン（icons/*.png）を作る。画面なしの Chrome で HTML を写真に撮る（1回だけ使う）
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
chrome="/c/Program Files/Google/Chrome/Application/chrome.exe"
tmp="$(mktemp -d)"
node scripts/icon-page.mjs > "$tmp/icon.html"
mkdir -p icons
for pair in "icon-192:192" "icon-512:512" "apple-touch-icon:180"; do
  name="${pair%%:*}"
  size="${pair##*:}"
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
    --user-data-dir="$(cygpath -w "$tmp/profile")" --window-size="$size,$size" \
    --screenshot="$(cygpath -w "$root/icons/$name.png")" "file:///$(cygpath -m "$tmp/icon.html")" 2>/dev/null
done
rm -rf "$tmp"
ls -la icons
