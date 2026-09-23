# INFINITE JESS — design

A 90-second animated film for Jess Sorrell, made by Sam. WebGL2 + plain
JavaScript, no libraries, no image/font/audio files. Every pixel and every
sample of sound is computed.

## Direction (approved 2026-09-23)

- Loving, playful, literate. Infinite Jest is the frame: the title is a pun,
  there is one DFW-style footnote marker on the title that is resolved on the
  end card.
- **Show, don't tell.** No joke captions. The only words on screen are the
  CRT card ("YEAR OF GLAD"), the title, a little math notation that belongs
  to the chalkboard, and the closing footnote/sign-off.
- Every scene uses a different visual style.

## Cast

- **Jess** — wavy strawberry-blonde hair (center part), blue-green eyes,
  freckles, soft closed-mouth smile. Rust top (golden-hour photo); grey knit
  cardigan (park photo).
- **Sam** — dark cap, rose-gold round glasses, salt-and-pepper beard, black tee.
- **Uriel** — mackerel brown/grey tabby, handsome face, "M" on forehead,
  the affectionate one. The leash-walking adventure cat.
- **Yuffie** — black cat, slightly puffy cheeks, yellow-green eyes, sudden
  zoomies ("brain zaps").

## Timeline (80 BPM, one bar = 3 s, 30 bars)

| t (s) | Scene | Style | Beat |
|---|---|---|---|
| 0–6 | CRT | curved CRT, scanlines, static, chroma bleed | TV powers on, tunes in, card "YEAR OF GLAD", push into the screen |
| 6–15 | Sky | raymarched volumetric clouds (3D noise texture) | rise through clouds; "INFINITE JESS" + "an entertainment¹" |
| 15–27 | Portrait | flat vector illustration, golden hour | Jess blinks and smiles; light sweeps; freckles lift off into a night sky and connect into constellations (cat, heart) |
| 27–39 | Silks | theatrical silhouette, verlet cloth, haze, dust | climb, invert, straddle split, spinning drop, final pose |
| 39–48 | Cats | paper cut-out, stop-motion 12 fps, Baltimore rowhouses | Jess walks Uriel on a leash, Uriel flops; Yuffie watches from the window and gets the zoomies |
| 48–57 | Lattice | neon wireframe, synthwave grid, bloom | neon Uriel (Alice) sends a heart; it becomes noisy lattice points (LWE); rounding decrypts; points reform as a heart that reaches neon Yuffie (Bob) |
| 57–69 | Chalk | chalkboard, hand-drawn strokes | two independent samples, one shared die; both learners converge to the identical heart boundary; panels overlap exactly |
| 69–81 | Dusk | watercolor wash, paper texture, pigment edges | park at dusk (from the selfie), bare trees grow and blossom, the two of them from behind, her head on his shoulder |
| 81–90 | Finale | light ribbon (silk), particles | a silk ribbon draws ∞, then writes "Jess"; sign-off |
| 90+ | End card | typewriter | the footnote ¹ resolved; replay |

## Sound

Score synthesized with Web Audio and pre-rendered through an
OfflineAudioContext (so it is deterministic and sample-accurate); the audio
clock drives the picture. Key D major, 80 BPM, a recurring 6-note "Jess"
motif. Timbres per scene: CRT hum/static → FM electric piano + pad (sky) →
celesta twinkles (freckles) → strings + triplet arps (silks) → pizzicato,
a synthesized "mrrp", a zoomies whoosh (cats) → arpeggiator + blips (lattice)
→ plucks + chalk ticks (chalk) → full strings, piano melody (dusk) → bells,
resolution (finale). Generated convolution reverb.

## Architecture

- `index.html` loads classic scripts (works from `file://`), `dist/InfiniteJess.html`
  is a single self-contained file produced by `build.sh`.
- `js/core.js` — GL context, shader compilation (shared GLSL prelude: hash,
  noise, fbm, SDF helpers), FBOs, full-screen quad, text-to-texture via 2D
  canvas + system fonts, sprite/line/point renderers.
- `js/audio.js` — synth instruments, score, offline render, transport.
- `js/film.js` — timeline, transitions, post (bloom, grain, vignette),
  controls (click/space/arrows/R), `?t=` seek + `window.film.seek()` for debug.
- `js/scenes/*.js` — one file per scene, each `{ name, start, end, init(), render(t, local) }`
  drawing into the currently bound framebuffer.

## Verification

Seek to key moments in the browser pane and screenshot each scene; check
console for shader errors; check frame time; listen-check audio envelope by
rendering statistics (peak/RMS per section) since the agent cannot hear.
