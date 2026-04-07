# Forage Extension

A Chrome extension to save images to your Forage library via right-click.

## Setup

1. Add your icon files to this folder:
   - `icon16.png` (16×16)
   - `icon48.png` (48×48)
   - `icon128.png` (128×128)

2. Load in Chrome:
   - Go to `chrome://extensions`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select this folder

## How it works

1. Right-click any image on any webpage
2. Select **Save to Forage**
3. The extension popup opens with:
   - Image preview + favorite star
   - Source domain (e.g. "via tumblr.com")
   - Notes textarea
   - Tag pills loaded from your Supabase library
   - New tag input (press Enter to add)
4. Hit **Save to Forage**

## Notes on thumbnails

The extension attempts to generate a compressed WebP thumbnail via canvas.
Cross-origin images (most third-party sites) will block canvas access — in
that case the original image URL is stored as the thumbnail instead, which
is fine for URL-based images. File uploads are not supported in the extension
(use the main app for those).

## Files

- `manifest.json` — Extension config
- `background.js` — Service worker: registers context menu, stores URLs, opens popup
- `popup.html` — Popup markup
- `popup.css` — Styling (matches main Forage app design system)
- `popup.js` — All popup logic: loads tags, handles save, favorite, toast