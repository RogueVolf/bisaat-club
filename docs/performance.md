# Performance on iPhone

Most visitors open the site from Instagram on an iPhone. This page records what was changed for that,
what each change measured, and what still needs checking on a real phone.

## How to measure

```
npm run build && npm start -p 3100
npm run measure:iphone -- http://localhost:3100            # frame, load and dark-mode tables
npm run measure:iphone -- http://localhost:3100 --capture <dir>   # at-rest canvas + page pixels
npm run measure:iphone -- --diff <beforeDir> <afterDir>      # pixel diff of two captures
```

`scripts/measure-iphone.ts` runs Playwright WebKit with the `iPhone 15 Pro`, `iPhone SE` and
`iPhone SE (3rd gen)` descriptors, portrait and landscape, against the real CSP (nothing is stripped;
`--strip-uir` exists only for builds older than the CSP fix below). Playwright's descriptors use
Safari's visible viewport: iPhone 15 Pro is 393×659 @3, iPhone SE 320×568 @2, SE 3rd gen 375×667 @2.

**This is emulation.** Headless WebKit on a Mac renders with the Mac's GPU, so frame times say how
builds compare, not how fast a phone is. See "Still to check on a real iPhone" at the end.

`window.__bisaatFirstFrame` is a single `performance.now()` number set once, on the first room frame.
It carries no data and stays in production so the measurement can read it.

## Results (WebKit 27.2, emulated)

Baseline is commit `93a0330` (run with `--strip-uir`, since that build's CSP killed the page in WebKit
over http). After is the end of this pass. First frame = ms from navigation start to the first room
frame (in brackets: after DOMContentLoaded). A draw is low-res when the backing is below
`round(viewW × min(dpr, 2))`. Tap blank = longest time the canvas backing was reallocated (which
clears it) without a draw following, for a press and release with no movement. Held-press black =
share of pure-black pixels in `#view` while a press is held still.

### Frames

| Device | First frame ms (after DCL) before → after | Walk median / p95 ms before → after | Drag median / p95 ms before → after | Walk draws low/full | Drag draws low/full before → after | Idle app rAF/s before → after | Tap blank ms before → after | Held-press black % before → after |
|---|---|---|---|---|---|---|---|---|
| iPhone 15 Pro 393×659@3 | 122 (86) → 107 (69) | 17 / 19 → 17 / 19 | 17 / 19 → 16 / 19 | 91/1 → 91/1 | 61/1 → 62/1 | 60 → 0 | 167 → 0 | 78.4 → 0 |
| iPhone 15 Pro landscape 734×343@3 | 100 (55) → 76 (53) | 17 / 19 → 16 / 19 | 17 / 19 → 17 / 19 | 91/1 → 90/1 | 61/1 → 62/1 | 60 → 0 | 168 → 0 | 81.5 → 0 |
| iPhone SE 320×568@2 | 82 (54) → 79 (55) | 17 / 19 → 17 / 19 | 17 / 18 → 16 / 19 | 91/1 → 91/1 | 61/1 → 62/1 | 61 → 0 | 167 → 0 | 72.7 → 0 |
| iPhone SE landscape 568×320@2 | 78 (52) → 93 (53) | 17 / 19 → 17 / 19 | 17 / 19 → 17 / 18 | 91/1 → 91/1 | 61/1 → 62/1 | 60 → 0 | 168 → 0 | 74.7 → 0 |
| iPhone SE 3rd gen 375×667@2 | 95 (57) → 79 (52) | 17 / 19 → 17 / 19 | 17 / 19 → 17 / 19 | 91/1 → 91/1 | 62/1 → 62/1 | 59 → 0 | 167 → 0 | 78.1 → 0 |
| iPhone SE 3rd gen landscape 667×375@2 | 86 (55) → 82 (56) | 17 / 19 → 16 / 19 | 17 / 19 → 16 / 19 | 90/1 → 91/1 | 62/1 → 62/1 | 60 → 0 | 165 → 0 | 81.2 → 0 |

All rows, before and after: no document scroll, 0 console errors, 0 CSP violations. After: a WebGL
context lose/restore (`WEBGL_lose_context`) redraws the room with 0% black pixels on every device.
First-frame times vary by ±20 ms between runs; the first row of a run is the noisiest.

### Homepage transfer (encoded body + headers, fresh cache)

| | Doc KB | JS KB | CSS KB | Font KB | Image KB | Total KB |
|---|---|---|---|---|---|---|
| Before | 7.4 (6.3 gzip body) | 148.7 | 2.5 | 61.4 | 40.6 | ≈261 |
| After (all devices) | 7.7 (6.6 gzip body) | 149.4 | 2.5 | 61.4 | 40.6 | 261.6 |
| Tried and reverted: header logo srcset, @3x / @2x phones | 7.8 | 149.4 | 2.5 | 61.4 | 48.6 / 46.3 | 269.7 / 267.4 |

The baseline browser figure for the document was wrong under `--strip-uir` (the route rewrite hid
it), so the before row uses the step-2 build's document figure, which had no document changes; the
direct gzip fetch (6.3 KB) agrees. The document grew 0.3 KB, from the mode script.

### Dark mode before first paint (iPhone 15 Pro)

Settle = ms from navigation start until the sheet reaches its final colour.

| Case | First painted sheet before → after | Settle ms before → after | Colour changes before → after |
|---|---|---|---|
| dark scheme, `/` | cream → ink | 793 → 34 | 36 → 0 |
| light scheme, `/#lib-night` | cream → ink | 672 → 33 | 35 → 0 |
| dark scheme, `/#lib-day` | cream → cream | 43 → 33 | 0 → 0 |
| light scheme, `/` | cream → cream | 39 → 35 | 0 → 0 |

A screenshot taken at DOMContentLoaded already shows the ink sheet in the dark cases. No CSP violations.

### At rest: pixel diff (raw RGBA via sharp)

Canvas pixels are read back right after the draw; page screenshots are full-viewport with the clock
frozen. Captures: 390×844 @3 for `#door`, `#lib`, `#lib-night` and dark-scheme `/`; 390×844 @2;
1280×800 `/` and `#lib-night`; 568×320 @2.

- **Canvas: 0 px differ in all 8 captures**, baseline vs after. Hotspot DOM (hidden, class, transform),
  title, mode and backing size are identical too.
- **Page: 0 px differ in all 8 screenshots**, including the header logo box. (With the reverted
  header-logo srcset, the logo box differed at its anti-aliased edges: 11,937 px at 390×844 @3, max
  channel difference 53/255.)
- Two baseline captures of the same build are identical, so the method has no noise.

## Changes and their measured effect

| Change | Why | Measured effect |
|---|---|---|
| CSP `upgrade-insecure-requests` only when the request arrived over HTTPS (`nextUrl.protocol` or `x-forwarded-proto`) | Safari applies it to `http://localhost` and LAN addresses, so every asset was rewritten to https and the page died (canvas stayed 300×150, 11 failed requests) | Page works in WebKit over http with the real CSP; HTTPS production unchanged |
| On-demand frame loop (`needsFrame`): rAF only while dirty, walking, dragging, fading or waiting to sharpen | The reference spins rAF forever | Idle app frames 60/s → 0/s |
| Stop on `visibilitychange` hidden, redraw on return | No work in background tabs | Not measurable headless (Playwright cannot hide a page) |
| `webglcontextlost` → `preventDefault`, nothing new drawn; `webglcontextrestored` → rebuild GL state from the same geometry and redraw | iOS drops contexts in the background | Lose/restore redraws the room (0% black) |
| Low res starts only on a moving frame that draws; any backing-size change marks the frame dirty | A press without movement reallocated (cleared) the canvas and drew nothing until the sharpen | Tap blank 167 ms → 0; held press 78% black → 0 |
| Hotspot hidden / class / transform written only when changed (`spotWrites`) | Fewer style writes per frame | Same DOM at rest (diff above) |
| Passive `pointermove`/`pointerup`/`pointercancel` | Lets Safari scroll-handling skip waiting on JS | Invisible |
| iOS CSS: `overscroll-behavior:none` on html/body; no tap highlight on `.spot, #mode, #next, #book, #find`; no callout or selection on `#view` | No rubber-band, grey flash or long-press menu | 0 px difference at 1280×800, 390×844 and 568×320 |
| `Cache-Control: public, max-age=86400` on `/brand/*` | Was `max-age=0`; files are not content-hashed, so no `immutable` | Repeat visits skip revalidation for a day |
| Mode set before first paint (nonce'd inline `<head>` script, same rules as the controller) | Dark-mode phones and `#…-night` links painted cream, then faded 0.6 s | Settle 793 → 34 ms, 0 colour changes |
| Zones sorted by `order` locally; spots without a position are not rendered and are hidden | Task 7 review | Unit tests |

### Steps measured and skipped

- **Header logo srcset (step 5): tried and reverted.** A resized 1x/2x/3x header logo (3.3 / 5.6 /
  7.9 KB) cut the header's own image from 40.3 to 7.7 KB. But the WebGL sign texture loads the full
  `/brand/logo.png` anyway, and the header gets that file from cache when they share it. Splitting them
  added 6–8 KB to total transfer and changed the logo's edge pixels (up to 53/255), which broke
  still-frame identity. The header uses `/brand/logo.png` again.

- **Adaptive moving resolution (step 3):** iPhone 15 Pro walk and drag p95 are 19 ms (≤ 20 ms), so it
  was not added. The reference ×0.55 moving factor is unchanged. Resize cost does not show up either.
- **Deferring `buildRoom()` (step 5):** first frame is 52–57 ms after DOMContentLoaded on the SE
  descriptors (threshold 300 ms), so it was not deferred.
- **Client bundle:** the homepage chunks contain no `zod`, `mongodb` or `server-only` code. The app's
  own chunk (walk-through, renderer, geometry, shader) is 10.8 KB gzip. The rest is the Next/React
  runtime. Nothing to move.
- **Safari toolbar collapse:** growing the visible viewport by 80 px (as when the toolbar collapses)
  resizes `#view`, and the ResizeObserver resizes the backing to match (iPhone 15 Pro 786×754 → 786×914;
  SE 640×568 → 640×728). The canvas CSS size equals `#view`, so nothing stretches, and the document
  never scrolls.
- **Safe areas:** `viewport-fit=cover` is in the viewport meta and all four `env(safe-area-inset-*)`
  rules from the reference are unchanged.

## Still to check on a real iPhone

- Frame times and thermal behaviour on real GPUs, especially the SE (A13/A15) during a long drag.
  Re-check whether the adaptive moving resolution is needed.
- Instagram's in-app browser (WKWebView): first paint, the dark-mode script, and safe areas with its
  own toolbar.
- Context loss after backgrounding the app for a while: the room should come back without a reload.
- That the toolbar collapse and expand while dragging cause no stretch or flash.
- That a tap on the room no longer flickers, and that there is no grey tap highlight or long-press callout.
- Loading over plain `http://<lan-ip>:3100` from the phone now works (it did not before the CSP fix).
