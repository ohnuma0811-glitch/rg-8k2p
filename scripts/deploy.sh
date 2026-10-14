#!/usr/bin/env bash
# ゲームのファイル（index.html, style.css, src/, vendor/）だけを gh-pages ブランチに載せて公開する
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
msg="${1:-update}"
url="$(git remote get-url origin | sed -E 's#.*github\.com[:/]([^/]+)/([^/]+)$#https://\1.github.io/\2/#; s#\.git/$#/#')"
tmp="$(mktemp -d)"
git worktree add -q "$tmp" gh-pages
trap 'cd "$root"; git worktree remove --force "$tmp"' EXIT
rm -rf "$tmp/src" "$tmp/vendor" "$tmp/sounds" "$tmp/index.html" "$tmp/style.css" "$tmp/manifest.json" "$tmp/sw.js" "$tmp/icons"
cp -r index.html style.css manifest.json sw.js icons sounds src vendor "$tmp/"
# ブラウザが古いファイルを使い続けないよう、読み込むファイル名に版番号（main のコミット）を付ける
ver="$(git rev-parse --short HEAD)"
cd "$tmp"
sed -i -E "s#(src=\"src/main\.js)\"#\1?v=$ver\"#; s#(href=\"style\.css)\"#\1?v=$ver\"#" index.html
find src -name '*.js' -exec sed -i -E "s#(from '\.[^']+\.js)'#\1?v=$ver'#g" {} +
# 画面の左上に出す版番号
sed -i -E "s#^const VERSION = 'dev';#const VERSION = '$ver';#" src/main.js
grep -q "const VERSION = '$ver'" src/main.js
# 端末に取っておくファイルの入れ物の名前にも版番号を付ける
sed -i -E "s#ks-kart-dev#ks-kart-$ver#" sw.js
grep -q "ks-kart-$ver" sw.js
git add -A
if git diff --cached --quiet; then
  echo "変更なし"
  exit 0
fi
git commit -q -m "deploy: $msg" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin gh-pages
echo "公開しました: $url"
