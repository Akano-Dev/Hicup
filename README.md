# Hicup

A private, personal vertical-video player. Hicup gives you the smooth full-screen
scrolling experience of a short-form feed, using **only the videos you add
yourself** — no accounts, no recommendations, no algorithm, no network.

Everything lives in your browser: video files, thumbnails, watch history and
settings never leave the device.

## Getting started

**Just double-click `Hicup.bat`.** It installs and builds on first run, then
opens the app in your browser.

The server runs detached in the background, so it keeps going after you close
that window, your terminal, or VS Code — Hicup stays available at
<http://localhost:5180> until you stop it or restart the machine.

```
Hicup.bat            start and open in your browser (default)
Hicup.bat stop       stop the background server
Hicup.bat restart    stop, then start again
Hicup.bat status     check whether it is running
Hicup.bat rebuild    rebuild from source, then restart
Hicup.bat autostart  launch Hicup whenever Windows starts
Hicup.bat autostop   undo autostart
```

Set `HICUP_PORT` to serve on a different port. Set `HICUP_HOST=0.0.0.0` to reach
Hicup from your phone on the same network — off by default, since this is a
private library rather than a web service.

For development instead, `npm install && npm run dev` gives the usual Vite server
with hot reload.

Open the app, drag video files anywhere onto the window (or use **Add videos**),
and press **Start watching**. With no library yet, the home screen can also
generate three short demo clips locally — canvas + `MediaRecorder`, no downloads.

## What it does

- **Vertical feed** — one video per viewport, snap scrolling, swipe on touch,
  wheel and arrow keys on desktop. Only the active video plays; neighbours are
  preloaded and everything else stays unmounted.
- **Auto-scroll** — optionally advance when a video finishes, stopping at the end
  of the list rather than looping forever. Off by default; toggle it in Settings
  or from the feed's ⋯ menu. It overrides looping, since a looping video never
  finishes.
- **Library** — import, retitle, describe, categorise, tag, favourite and delete.
  Search spans titles, descriptions, tags, categories and filenames.
- **Watch state** — playback position, completion and history are saved as you
  watch, and restored when you come back. *Continue watching* surfaces anything
  meaningfully unfinished.
- **Collections and queue** — your own ordered playlists, plus a temporary
  "tonight's list" that plays straight into the feed.
- **Watch sessions** — choose a length before you start; a quiet timer counts
  down and a calm summary closes it out. No streaks, points or rewards.
- **Shuffle** — over all videos, a category, a collection, favourites or the
  queue. Your content only.

## Keyboard shortcuts

| Key | Action | | Key | Action |
|---|---|---|---|---|
| `Space` | Play / pause | | `L` | Favourite |
| `↑` `↓` | Previous / next video | | `Q` | Add to queue |
| `←` `→` | Seek 5 seconds | | `S` | Shuffle remaining |
| `M` | Mute / unmute | | `?` | Shortcut help |
| `F` | Fullscreen | | `Esc` | Exit fullscreen / leave feed |

## Architecture

```
src/
├── components/      UI — feed/, library/, session/, ui/ primitives
├── pages/           Home, Feed, Library, Favorites, History, Collections, Queue, Settings
├── hooks/           useVideoPlayback, useMediaUrl, useLaunchFeed
├── services/        storage/ (adapter + IndexedDB), library (queries), video/probe, transfer, demo
├── store/           zustand: library, settings, feed, queue, session
├── types/           domain models
└── utils/           formatting, motion, class helper
```

**Storage.** Video bytes are Blobs in IndexedDB; metadata, collections, history
and sessions sit in sibling stores; only small preferences use `localStorage`.
All access goes through the [`StorageAdapter`](src/services/storage/types.ts)
interface, so a served media directory or a sync backend can be added later
without touching UI code. There is deliberately **no backend** — it would add
deployment friction and buy nothing for a single-user local app.

**Playback.** [`useVideoPlayback`](src/hooks/useVideoPlayback.ts) owns one
`<video>` element: it resolves the source URL, handles resume positions, respects
browser autoplay policy (falling back to muted rather than fighting it), counts
only genuine forward playback toward watch time, and flushes progress every five
seconds and on every deactivation.

**Performance.** The feed renders lightweight placeholders for the whole
playlist but mounts media only for the active slide and its immediate
neighbours, so scroll physics stay native while memory stays flat. Object URLs
are pooled with an LRU that revokes evictions. Library grids render in batches of
60 as you scroll, and thumbnails are lazy-loaded.

## Testing

```bash
npm test     # 53 unit tests — storage, queries, watch state, sessions, import/export
npm run e2e  # 39 browser checks in real Chrome (needs `npm run dev` on port 5199)
```

The end-to-end suite drives a real browser through the whole product loop:
generating video files, importing them, editing metadata, playing the feed,
verifying that exactly one video plays at a time, that keyboard and wheel
navigation advance slides, that progress persists to IndexedDB and resumes on a
cold start, and that the mobile layout has no horizontal overflow. It uses
`puppeteer-core` against your installed Chrome — no browser download. Adjust
`CHROME` at the top of [scripts/e2e.mjs](scripts/e2e.mjs) if yours lives
elsewhere.

## Changing the app icon

`public/logo.png` (in-app mark) and `public/favicon.png` (browser tab) are
square crops of a source image. To swap in a different one:

```bash
node scripts/make-logo.mjs "C:/path/to/your-image.jpg"
Hicup.bat rebuild
```

It centre-crops to a square — so nothing is squashed — and writes both sizes.

## Notes and limits

- Playback is limited to what your browser can decode — MP4 (H.264), WebM, and
  MOV where supported. Unsupported files import but show a clear message rather
  than failing silently.
- Captions appear as a toggle only when a file carries embedded subtitle tracks;
  sidecar `.vtt` files aren't supported.
- Exports describe your library — titles, tags, collections, history, settings —
  not the video files themselves, which would defeat the point of keeping them
  local.
- Storage is per-browser-profile. Clearing site data removes the library, and
  the background server must be running for the page to load at all.
- `Hicup.bat` serves the built app in `dist/`. After changing source code, run
  `Hicup.bat rebuild` for it to show up.
