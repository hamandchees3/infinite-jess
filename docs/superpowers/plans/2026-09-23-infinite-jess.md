# INFINITE JESS Implementation Plan

> **For agentic workers:** executed inline (user: "go until it's done"). Steps use checkbox syntax.

**Goal:** A 90-second procedural WebGL2 film + synthesized score, playable from `index.html`.

**Architecture:** Classic-script modules on a `window.IJ` namespace. `core.js` (GL + text + renderers) → `audio.js` (offline-rendered score) → `scenes/*.js` (each draws into the bound FBO) → `film.js` (timeline, transitions, post, controls). The audio clock is the master clock.

**Tech Stack:** WebGL2, GLSL ES 3.00, Web Audio API (OfflineAudioContext), Canvas2D (system fonts only, for text textures). No libraries.

**Spec:** `docs/superpowers/specs/2026-09-23-infinite-jess-design.md`

## Global Constraints

- No libraries, no image/font/audio files; no network requests.
- Must run from `file://` (no ES modules) and as a single-file build.
- 16:9, letterboxed; internal render ≤ 1920×1080; 60 fps target on a laptop GPU.
- Show, don't tell: only the words listed in the spec appear on screen.
- Film length exactly 90 s; scene windows as in the spec timeline.

---

### Task 1: Core engine + film shell
**Files:** `index.html`, `js/core.js`, `js/film.js`
**Produces:** `IJ.gl`, `IJ.program(fs, vs?)`, `IJ.fbo(w,h,opts)`, `IJ.quad(prog)`, `IJ.textTexture(text, opts) → {tex,w,h,aspect}`, `IJ.drawSprite(tex, x,y,w,h, alpha, opts)`, `IJ.lines` (instanced glow segments), `IJ.points` (instanced glow points), `IJ.registerScene(scene)`, `film.seek(t)`, `film.time`.
- [ ] GL context, GLSL prelude, FBOs (RGBA16F when renderable), bloom, grain/vignette post.
- [ ] Timeline with overlapping scene windows + transitions (fade, white, black).
- [ ] Controls: click to start, space, ←/→, R; `?t=` seek; `?still` for screenshots.
- [ ] Verify: blank test scene renders, console clean.

### Task 2: Audio score
**Files:** `js/audio.js`
**Produces:** `IJ.audio.render() → Promise<AudioBuffer>`, `IJ.audio.play(offset)`, `IJ.audio.pause()`, `IJ.audio.time()`.
- [ ] Instruments: FM e-piano, pad, strings, celesta, pizz, arp, bass, bells, noise/hum, whoosh, chalk tick, mrrp.
- [ ] Score for 30 bars following the spec; generated reverb.
- [ ] Verify: offline render in the browser; per-section RMS/peak printed; no clipping (peak < 1).

### Tasks 3–11: Scenes (one file each, `js/scenes/NN_name.js`)
Each: `IJ.registerScene({name, start, end, init(), render(t, local, dur)})`.
Verify each by seeking to 3+ moments and screenshotting; iterate until it reads well.
- [ ] 3 `01_crt.js`  - [ ] 4 `02_sky.js`  - [ ] 5 `03_portrait.js`
- [ ] 6 `04_silks.js`  - [ ] 7 `05_cats.js`  - [ ] 8 `06_lattice.js`
- [ ] 9 `07_chalk.js`  - [ ] 10 `08_dusk.js`  - [ ] 11 `09_finale.js` (+ end card)

### Task 12: Build + polish
**Files:** `build.sh`, `dist/InfiniteJess.html`, `README.md`
- [ ] Inline all scripts into one HTML; verify it plays.
- [ ] Full watch-through by stepping every 1 s; fix pops, timing, transitions.
- [ ] Performance check (frame time per scene).
- [ ] Commit.
