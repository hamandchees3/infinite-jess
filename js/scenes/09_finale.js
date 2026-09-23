// 81–90 s · Finale. A ribbon of light — the red silk, one more time — draws an infinity
// sign, then writes her name and finishes with a small heart.
// 90 s+ · End card: the footnote from the title, typed out.
(function () {
const IJ = window.IJ;
const C = IJ.CUES;
const START = 81;
const TRAIL = 260;

const BG_FS = `
in vec2 vUv; out vec4 o;
uniform float uT, uL, uGlow;
void main(){
  vec2 p = (2.*gl_FragCoord.xy - uRes)/uRes.y;
  vec3 c = mix(vec3(.05,.035,.09), vec3(.01,.01,.03), sat(p.y*.5 + .5));
  c += vec3(.25,.08,.12)*exp(-length(p*vec2(.6, 1.2))*1.6)*.35*uGlow;
  vec2 g = p*38.; vec2 id = floor(g);
  float h = hash12(id);
  if (h > .9) c += vec3(.8,.85,1.)*smoothstep(.12, 0., length(fract(g) - .5 - (hash22(id) - .5)*.6))*(.35 + .65*sin(uT*(1.5 + h*4.) + h*30.))*(h - .9)*6.;
  o = vec4(c, 1.);
}`;

const RIB_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec2 aUV; layout(location=2) in vec3 aX;
uniform float uAspect;
out vec2 vUv; out vec3 vX;
void main(){ vUv = aUV; vX = aX; gl_Position = vec4(aP.x/uAspect, aP.y, 0., 1.); }`;
const RIB_FS = `
in vec2 vUv; in vec3 vX; out vec4 o;
void main(){
  float tw = vX.x, s = vX.y, a = vX.z;             // twist, position along the trail (0 tail .. 1 head), alpha
  float facing = abs(cos(tw));
  float across = 1. - abs(vUv.x);
  float sheen = pow(across, 3.)*(.4 + .6*facing);
  vec3 silk = mix(vec3(.75,.06,.1), vec3(1.,.45,.3), sheen);
  silk = mix(silk, vec3(1.,.85,.55), smoothstep(.85, 1., s)*.8);   // the head burns gold
  float edge = smoothstep(0., .35, across);
  float k = edge*(.35 + .65*facing)*a;
  o = vec4(silk*k*1.4, k);
}`;

function lemniscate(u) {                    // one loop of ∞, starting at the crossing
  const t = u * Math.PI * 2 - Math.PI / 2;
  const d = 1 + Math.sin(t) * Math.sin(t);
  return [Math.cos(t) / d, Math.sin(t) * Math.cos(t) / d];
}
// a loopy, handwriting-like path across the word (the script itself is revealed as it passes)
const WORD = (() => {
  const B = (p0, p1, p2, p3, n = 24) => { const out = []; for (let i = 0; i < n; i++) { const t = i / n, m = 1 - t; out.push([m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0], m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1]]); } return out; };
  const segs = [
    [[-1.05, 0.1], [-0.95, 0.42], [-0.75, 0.58], [-0.6, 0.5]],       // J: entry up to the cap
    [[-0.6, 0.5], [-0.5, 0.42], [-0.55, 0.1], [-0.66, -0.2]],        // stem down
    [[-0.66, -0.2], [-0.74, -0.5], [-0.95, -0.45], [-0.82, -0.25]],  // descender loop
    [[-0.82, -0.25], [-0.7, -0.08], [-0.45, -0.02], [-0.3, 0.0]],    // into e
    [[-0.3, 0.0], [-0.15, 0.08], [-0.15, 0.2], [-0.24, 0.18]],       // e loop
    [[-0.24, 0.18], [-0.34, 0.14], [-0.3, -0.06], [-0.08, -0.02]],
    [[-0.08, -0.02], [0.02, 0.1], [0.08, 0.2], [0.12, 0.2]],         // s
    [[0.12, 0.2], [0.26, 0.1], [0.24, -0.08], [0.1, -0.04]],
    [[0.1, -0.04], [0.22, 0.02], [0.3, 0.1], [0.4, 0.2]],            // s
    [[0.4, 0.2], [0.56, 0.1], [0.52, -0.08], [0.38, -0.04]],
    [[0.38, -0.04], [0.55, 0.0], [0.72, 0.08], [0.82, 0.2]],         // exit flourish
  ];
  const pts = [];
  segs.forEach(s => pts.push(...B(...s)));
  return pts;
})();
const WORD_BOX = [-1.05, -0.5, 0.82, 0.58];   // x0, y0, x1, y1 of the path above
// the ink bounds of a text texture, in texture pixels
function inkBox(tex) {
  const c = tex.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
    if (d[(y * c.width + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return { x0, y0, x1, y1 };
}
function samplePath(pts, u) {
  const f = IJ.clamp(u) * (pts.length - 1), i = Math.floor(f), k = f - i;
  const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)];
  return [IJ.lerp(a[0], b[0], k), IJ.lerp(a[1], b[1], k)];
}

IJ.registerScene({
  name: 'finale', start: START, end: 90, transition: { type: 'fade', dur: 2.0 },
  post: { bloom: 0.9, grain: 0.03, vignette: 0.5, thresh: 0.35 },
  init() {
    this.bg = IJ.program(BG_FS, null, 'finalebg');
    this.rib = IJ.program(RIB_FS, RIB_VS, 'ribbon');
    this.mesh = IJ.Mesh(TRAIL * 2 * 3 + 16);
    this.sparks = IJ.Points(500);
    this.word = IJ.text('Jess', { font: 'script', size: 260, pad: 0.45 });
    // fit: the glyphs' ink ~0.8 tall; the ribbon path mapped onto the ink box; a heart after it
    const ink = inkBox(this.word), T = this.word;
    const inkH = (ink.y1 - ink.y0) / T.h, inkW = (ink.x1 - ink.x0) / T.w;
    const h = 0.82 / inkH, w = h * T.aspect;
    const total = inkW * w + 0.55;
    const cx = -total / 2 + (0.5 - ink.x0 / T.w) * w;     // sprite centre so word+heart is centred
    const cy = 0.02;
    const X = u => cx + (u / T.w - 0.5) * w, Y = v => cy - (v / T.h - 0.5) * h;
    const g = [X(ink.x0), Y(ink.y1), X(ink.x1), Y(ink.y0)];
    this.layout = { h, cx, cy };
    this.path = WORD.map(([x, y]) => [
      g[0] + (x - WORD_BOX[0]) / (WORD_BOX[2] - WORD_BOX[0]) * (g[2] - g[0]),
      g[1] + (y - WORD_BOX[1]) / (WORD_BOX[3] - WORD_BOX[1]) * (g[3] - g[1]),
    ]);
    const hc = [g[2] + 0.3, g[1] + (g[3] - g[1]) * 0.6];
    const last = this.path[this.path.length - 1];
    for (let i = 1; i <= 8; i++) this.path.push([IJ.lerp(last[0], hc[0], i / 8), IJ.lerp(last[1], hc[1] + 0.12, i / 8)]);
    for (let i = 0; i <= 60; i++) {
      const a = i / 60 * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(a), 3) / 17, y = (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17;
      this.path.push([hc[0] + x * 0.2, hc[1] + y * 0.2]);
    }
    this.heartPath = this.path.slice(this.path.length - 61);
    this.heartC = hc;
    this.wordEnd = WORD.length / this.path.length;
  },
  // draw a ribbon along points [[x,y], ...] with per-point alpha
  ribbon(pts, width, alphaFn, t) {
    const M = this.mesh, n = pts.length;
    if (n < 2) return;
    const start = M.count;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const s = i / (n - 1);
      const tw = i * 0.22 + t * 2.2;
      const taper = Math.min(1, s * 6) * (1 - Math.pow(Math.max(0, s - 0.9) / 0.1, 2) * 0.6);
      const w = width * taper * (0.35 + 0.65 * Math.abs(Math.cos(tw)));
      const al = alphaFn(s);
      M.v(pts[i][0] - ty * w, pts[i][1] + tx * w, 0, -1, s, tw, s, al);
      M.v(pts[i][0] + ty * w, pts[i][1] - tx * w, 0, 1, s, tw, s, al);
    }
    return [start, n * 2];
  },
  render(t, l) {
    const gl = IJ.gl;
    const glow = IJ.smooth(0, 1.5, l);
    this.bg.draw({ uT: t, uL: l, uGlow: glow });
    const M = this.mesh; M.clear();
    const S = this.sparks; S.clear();
    const draws = [];
    const R = IJ.rng(Math.floor(t * 30));
    const spark = (p, n, amt) => { for (let i = 0; i < n; i++) S.add(p[0] + (R() - 0.5) * 0.06, p[1] + (R() - 0.5) * 0.06, 0, 0.004 + R() * 0.006, 1, 0.8, 0.5, amt * R(), 1, R() > 0.8 ? 0.6 : 0); };

    // ---- ∞, drawn in perspective, then fading as the name is written
    const i0 = C.ribbonInf - START, j0 = C.ribbonJess - START, s0 = C.signoff - START;
    const infU = IJ.ease.inOut(IJ.clamp((l - i0) / 2.4));
    const infFade = 1 - IJ.smooth(j0 + 0.2, j0 + 1.6, l);
    if (infU > 0 && infFade > 0) {
      const tilt = 0.45 + 0.1 * Math.sin(l * 0.6), spin = l * 0.25;
      const proj = (u) => {
        const [x, y] = lemniscate(u);
        let X = x * 0.95, Y = y * 0.95, Z = 0;
        const cs = Math.cos(spin), sn = Math.sin(spin);
        [X, Z] = [X * cs - Z * sn * 0.2, X * sn * 0.2 + Z * cs];
        [Y, Z] = [Y * Math.cos(tilt) - Z * Math.sin(tilt), Y * Math.sin(tilt) + Z * Math.cos(tilt)];
        const f = 3 / (3 + Z + X * 0.25);
        return [X * f * 0.95, 0.05 + Y * f * 0.95];
      };
      const pts = [];
      for (let i = 0; i <= TRAIL; i++) pts.push(proj(infU * i / TRAIL));
      draws.push(this.ribbon(pts, 0.03, s => 0.9 * infFade, t));
      if (infU < 1) spark(pts[pts.length - 1], 6, 1);
    }
    // ---- her name: the ribbon sweeps across; the script is revealed in its wake
    const wU = IJ.clamp((l - j0 - 0.3) / 2.6);
    let head = null;
    if (wU > 0) {
      const pts = [];
      const tailU = Math.max(0, wU - 0.3);
      for (let i = 0; i <= TRAIL; i++) pts.push(samplePath(this.path, IJ.lerp(tailU, wU, i / TRAIL)));
      head = pts[pts.length - 1];
      const fadeRib = 1 - IJ.smooth(s0 + 0.2, s0 + 1.4, l);
      draws.push(this.ribbon(pts, 0.024, s => (0.25 + 0.75 * s) * fadeRib, t));
      if (wU < 1) spark(head, 5, 0.6);
    }
    const heartDone = IJ.smooth(this.wordEnd + (1 - this.wordEnd) * 0.95, 1, wU);
    if (heartDone > 0) draws.push(this.ribbon(this.heartPath, 0.02, s => 0.85 * heartDone * (0.85 + 0.15 * Math.sin(l * 4)), t));
    M.upload();
    IJ.blend('add');
    this.rib.use().set({ uAspect: IJ.aspect() });
    for (const d of draws) if (d) M.draw(gl.TRIANGLE_STRIP, d[0], d[1]);

    // the script itself, revealed left to right behind the ribbon's head
    if (wU > 0) {
      const { h, cx, cy } = this.layout, w = h * this.word.aspect;
      const hx = head ? head[0] : 9;
      const wipe = wU >= this.wordEnd ? 1 : IJ.clamp((hx - (cx - w / 2)) / w + 0.03);
      const done = IJ.smooth(s0 - 0.2, s0 + 0.6, l);
      const reveal = Math.max(wipe, done);
      IJ.sprite(this.word, { x: cx, y: cy, h, alpha: 0.85, color: [1, 0.55, 0.45], blur: 2.5, wipe: reveal, soft: 0.06, blend: 'add' });
      IJ.sprite(this.word, { x: cx, y: cy, h, alpha: 1, color: [1, 0.9, 0.78], wipe: reveal, soft: 0.04 });
      if (done > 0) IJ.sprite(this.word, { x: cx, y: cy, h, alpha: 0.5 * done * (0.8 + 0.2 * Math.sin(l * 3)), color: [1, 0.7, 0.4], blur: 4, blend: 'add' });
    }
    // a burst on the final chord
    if (l > s0 && l < s0 + 2.5) {
      const k = (l - s0) / 2.5;
      const RR = IJ.rng(77);
      for (let i = 0; i < 120; i++) {
        const a = RR() * Math.PI * 2, sp = 0.35 + RR() * 0.9;
        const x = this.heartC[0] + Math.cos(a) * sp * k, y = this.heartC[1] + Math.sin(a) * sp * k - 0.15 * k * k;
        S.add(x, y, 0, 0.004 + RR() * 0.005, 1, 0.75 + RR() * 0.25, 0.55, (1 - k) * 0.7 * Math.min(1, k * 8), 0.8, RR() > 0.7 ? 0.5 : 0);
      }
    }
    S.draw();
  },
});

// ------------------------------------------------------------------ end card ---
const NOTE = C.endnote.lines;

IJ.registerScene({
  name: 'endcard', start: 90, end: 1e9, transition: { type: 'black', dur: 2.0 },
  post: { bloom: 0.3, grain: 0.035, vignette: 0.5, thresh: 0.6 },
  init() {
    this.bg = IJ.program(`
in vec2 vUv; out vec4 o; uniform float uT;
void main(){
  vec2 p = (2.*gl_FragCoord.xy - uRes)/uRes.y;
  vec3 c = vec3(.07,.065,.06) + .02*fbm(p*3.) - .012*fbm(p*40.);
  c *= 1. - .3*length(p*vec2(.5,.8));
  o = vec4(c, 1.);
}`, null, 'endbg');
    this.lines = NOTE.map(s => IJ.text(s, { font: "'Courier New', Courier, monospace", size: 72, pad: 0.2 }));
    this.sig = IJ.text('Love, Sam', { font: 'script', size: 150, pad: 0.4 });
    this.hint = IJ.text('R · watch again', { font: 'sans', size: 44, spacing: 0.2 });
  },
  render(t, l) {
    this.bg.draw({ uT: t });
    const E = C.endnote;
    let clock = t - E.start;
    const h = 0.12, left = -1.62;
    this.lines.forEach((tx, i) => {
      const n = NOTE[i].length;
      const shown = IJ.clamp(Math.floor(clock * E.cps) / n);
      clock -= n / E.cps + E.gap;
      if (shown <= 0) return;
      // character-quantized wipe (monospaced), text left-aligned
      const w = h * tx.aspect, padFrac = (0.2 * 72) / tx.w;
      const wipe = padFrac + shown * (1 - 2 * padFrac);
      IJ.sprite(tx, { x: left + w / 2, y: 0.36 - i * 0.2, h, alpha: 0.94, color: [0.93, 0.9, 0.84], wipe, soft: 0.001 });
    });
    const sigA = IJ.smooth(0.2, 1.2, clock);
    if (sigA > 0) IJ.sprite(this.sig, { x: 0.85, y: -0.36, h: 0.36, alpha: sigA, color: [1, 0.82, 0.74], wipe: IJ.clamp(clock / 1.2), soft: 0.1 });
    const hintA = IJ.smooth(2.5, 3.5, clock) * 0.35;
    if (hintA > 0) IJ.sprite(this.hint, { x: 0, y: -0.82, h: 0.05, alpha: hintA, color: [0.9, 0.88, 0.84] });
  },
});
})();
