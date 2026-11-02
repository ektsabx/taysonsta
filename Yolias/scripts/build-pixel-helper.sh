#!/usr/bin/env bash
# Packs the Yolias Pixel Helper Chrome extension (D-274) for download from
# Events Manager (public/downloads) and for the Chrome Web Store upload.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/downloads
rm -f public/downloads/yolias-pixel-helper.zip
(cd extension/pixel-helper && zip -qr ../../public/downloads/yolias-pixel-helper.zip manifest.json background.js content.js popup.html popup.css popup.js icons)
echo "public/downloads/yolias-pixel-helper.zip ($(du -h public/downloads/yolias-pixel-helper.zip | cut -f1))"
