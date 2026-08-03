#!/bin/bash
# ============================================================================
#  Prepare photographs for the /besties polaroids.
#
#  A photo straight off a phone is 3-6 MB. These land inside a chat that has to
#  open over mobile data from a WhatsApp link, and the polaroid frame is ~220pt
#  wide — so anything past ~900px is bytes nobody sees. This crops to the frame's
#  aspect, resizes, and re-encodes.
#
#  Usage:  tools/besties-photos.sh ~/Desktop/party-pics/*.jpg
#          tools/besties-photos.sh ~/Desktop/one.HEIC
#
#  Writes besties/photos/<name>.jpg and prints the content.json line for each.
#  Uses sips, which ships with macOS — no install, no dependencies.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/besties/photos"
WIDTH=900          # the frame is ~220pt wide; 900 covers 3x screens and the lightbox
QUALITY=68         # grain and a flash bloom sit on top, which hides compression well

mkdir -p "$OUT"

if [ $# -eq 0 ]; then
  echo "usage: tools/besties-photos.sh <image> [image…]" >&2
  exit 1
fi

echo
for src in "$@"; do
  [ -f "$src" ] || { echo "  skipped (not a file): $src" >&2; continue; }

  base="$(basename "${src%.*}")"
  slug="$(echo "$base" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
  dest="$OUT/$slug.jpg"

  # sips reads HEIC, PNG, JPEG and TIFF; --resampleWidth keeps the aspect ratio
  sips -s format jpeg -s formatOptions "$QUALITY" --resampleWidth "$WIDTH" \
       "$src" --out "$dest" >/dev/null 2>&1

  before="$(du -k "$src"  | cut -f1)"
  after="$( du -k "$dest" | cut -f1)"
  printf '  %-28s %5sKB → %4sKB\n' "$slug.jpg" "$before" "$after"
done

echo
echo "  Paste into besties/content.json, in the chat array where you want it:"
echo
for src in "$@"; do
  [ -f "$src" ] || continue
  base="$(basename "${src%.*}")"
  slug="$(echo "$base" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
  echo "    { \"t\": \"photo\", \"src\": \"photos/$slug.jpg\", \"cap\": \"…\", \"alt\": \"…\", \"wait\": 900 },"
done
echo
echo "  Then: node tools/besties-seal.mjs seal"
echo
