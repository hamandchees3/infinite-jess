# INFINITE JESS

*an entertainment¹* — a 90-second animated film for Jess Sorrell, from Sam.

## Watch online

**[Watch Infinite Jess](https://hamandchees3.github.io/infinite-jess/)** — turn
the sound on and click to play. Share this link to watch without downloading.
The film needs a browser with WebGL2 support.

## Watch offline

Open **`dist/InfiniteJess.html`** in Chrome, Safari, Edge or Firefox (it's one
self-contained file, safe to email or AirDrop), turn the sound on, and click.

Everything is made with code: WebGL2 shaders and plain JavaScript, no libraries,
no image, font or audio files. The score is synthesized note by note with the Web
Audio API; text uses only the fonts already on the computer.

## Controls

| | |
|---|---|
| click / space | play · pause |
| ← → | back / forward 5 s |
| R | watch again |
| F | full screen |
| E | save as video (MP4) |

## Video

Export `dist/InfiniteJess.mp4` as a regular video file (1920×1080, 60 fps,
H.264 + AAC, 99 s including the footnote), for phones, TVs and messages.
Generated MP4 files are kept locally and excluded from Git because of their size.

The film renders it itself, frame by frame, so nothing is dropped or out of sync.
Press **E** while watching in Chrome or Edge, or run `python3 tools/export.py`, which
does the same thing in headless Chrome and writes `dist/InfiniteJess.mp4`. The encoding
uses the browser's own H.264/AAC encoders (WebCodecs); the MP4 container is written by
`js/mp4.js`.

## The reel

| time | scene | style |
|---|---|---|
| 0:00 | A cartridge tunes in on an old CRT: *Year of Glad* | CRT: scanlines, static, rolling picture |
| 0:06 | Up through the clouds: **INFINITE JESS**, *an entertainment¹* | raymarched volumetric clouds |
| 0:15 | Jess in golden-hour light; her freckles lift off and become constellations (Uriel, Yuffie, a heart) | vector illustration → star map |
| 0:27 | Aerial silks: climb, invert, split, a spinning drop, the catch | verlet-simulated silks, spotlight in haze |
| 0:39 | "Attempting to walk my cat": Uriel flops; Yuffie gets the zoomies | paper cut-out, stop-motion, Baltimore rowhouses |
| 0:48 | Alice & Bob are cats: a heart encrypted onto a lattice with errors, decrypted by rounding | neon synthwave, 3D |
| 0:57 | Replicability: two samples, one shared die, the identical heart | chalkboard |
| 1:09 | The two of them at dusk; the trees grow and blossom | watercolor |
| 1:21 | A silk ribbon of light draws ∞, then her name | light trails |
| 1:30 | ¹ the footnote | typewriter |

## Making of

- `index.html` + `js/` is the source; `./build.sh` bundles it into `dist/InfiniteJess.html`.
- `js/core.js` WebGL2 helpers (shaders, render targets, instanced glow lines/points, text).
- `js/audio.js` the score and the cue sheet the picture is timed to.
- `js/film.js` timeline, transitions, bloom/grain post, transport.
- `js/export.js` + `js/mp4.js` frame-exact MP4 export; `tools/export.py` runs it headlessly.
- `js/scenes/*.js` one file per scene.
- Serving the folder locally (`python3 -m http.server`) and opening
  `index.html?debug&t=42` jumps to a moment and shows a frame-rate readout.

## Publishing

The public site uses GitHub Pages, serving `index.html` and `js/` from the root
of the `main` branch. In repository **Settings → Pages**, the source is
**Deploy from a branch**, with **main** and **/ (root)** selected.

After editing the source, run `./build.sh` to refresh the self-contained offline
version, then commit and push to `main`. GitHub Pages republishes automatically.
