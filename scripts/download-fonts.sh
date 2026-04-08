#!/usr/bin/env bash
# Download self-hosted woff2 font files from the Google Fonts CSS API.
# Usage: bash scripts/download-fonts.sh
# The script writes files into the fonts/ directory at the repo root.

set -euo pipefail

FONTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/fonts"
mkdir -p "$FONTS_DIR"

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

download_font() {
  local css_url="$1"
  local out_name="$2"
  echo "Downloading $out_name ..."
  # Fetch the CSS (woff2 response) and extract the src url
  local woff2_url
  woff2_url=$(curl -sS -A "$UA" "$css_url" | grep -oP 'url\(\K[^)]+\.woff2')
  if [ -z "$woff2_url" ]; then
    echo "  ERROR: could not extract woff2 URL for $out_name"
    return 1
  fi
  curl -sS -o "$FONTS_DIR/$out_name" "$woff2_url"
  echo "  -> $FONTS_DIR/$out_name"
}

# DM Sans
download_font "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400&display=swap" "dm-sans-v15-latin-regular.woff2"
download_font "https://fonts.googleapis.com/css2?family=DM+Sans:wght@500&display=swap" "dm-sans-v15-latin-500.woff2"
download_font "https://fonts.googleapis.com/css2?family=DM+Sans:wght@600&display=swap" "dm-sans-v15-latin-600.woff2"
download_font "https://fonts.googleapis.com/css2?family=DM+Sans:wght@700&display=swap" "dm-sans-v15-latin-700.woff2"
download_font "https://fonts.googleapis.com/css2?family=DM+Sans:ital@1&display=swap" "dm-sans-v15-latin-italic.woff2"

# Instrument Serif
download_font "https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap" "instrument-serif-v1-latin-regular.woff2"
download_font "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&display=swap" "instrument-serif-v1-latin-italic.woff2"

# JetBrains Mono
download_font "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&display=swap" "jetbrains-mono-v18-latin-regular.woff2"
download_font "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500&display=swap" "jetbrains-mono-v18-latin-500.woff2"

echo ""
echo "Done. $(ls -1 "$FONTS_DIR"/*.woff2 2>/dev/null | wc -l) font files in $FONTS_DIR"
