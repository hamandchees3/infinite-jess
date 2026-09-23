// 48–57 s · Alice and Bob are cats. Neon Uriel sends a heart; it is encrypted onto a
// lattice (each point hidden at a lattice point plus a small error vector, as in Learning
// With Errors). Neon Yuffie holds the key: rounding to the nearest lattice point strips the
// errors away, the points reassemble, and the heart arrives.
(function () {
const IJ = window.IJ;
const C = IJ.CUES;
const START = 48;
const NH = 48;               // points on the heart
const SPACING = 0.36;

const BG_FS = `
in vec2 vUv; out vec4 o;
uniform float uHorizon, uT, uOn;
void main(){
  vec2 p = (2.*gl_FragCoord.xy - uRes)/uRes.y;
  float h = p.y - uHorizon;
  vec3 c = mix(vec3(.02,.0,.05), vec3(.0,.0,.01), sat(h*.8));
  c += vec3(.55,.1,.45)*exp(-abs(h)*7.)*.35;                         // horizon glow
  // a striped retro sun sinking behind the lattice
  vec2 s = p - vec2(0., uHorizon + .28);
  float sun = 1. - smoothstep(.44, .45, length(s));
  float stripes = step(.0, sin((s.y + uT*.03)*55.) + (s.y + .1)*6.);
  vec3 sunC = mix(vec3(1.,.25,.55), vec3(1.,.75,.3), sat(s.y*1.3 + .5));
  c += sunC*sun*stripes*step(0., h)*.33*uOn;
  // stars
  vec2 g = p*60.; vec2 id = floor(g);
  float r = hash12(id);
  if (r > .985 && h > 0.) c += vec3(.7,.8,1.)*smoothstep(.25, 0., length(fract(g) - .5))*(.4 + .6*sin(uT*3. + r*50.));
  o = vec4(c, 1.);
}`;

// neon line art for the two cats, in a local 2D frame (unit ~ head width)
function catArt(puffy, tabby) {
  const segs = [];
  const poly = (pts, closed = false) => { for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) segs.push([pts[i], pts[(i + 1) % pts.length]]); };
  const cw = puffy ? 0.62 : 0.5;
  // head outline: ears, crown, cheeks, chin
  const head = [];
  head.push([-cw, -0.05]);
  head.push([-cw + 0.02, 0.25]);
  head.push([-0.42, 0.72]);            // left ear tip
  head.push([-0.2, 0.42]);
  head.push([0.2, 0.42]);
  head.push([0.42, 0.72]);             // right ear tip
  head.push([cw - 0.02, 0.25]);
  head.push([cw, -0.05]);
  for (let k = 0; k <= 8; k++) {       // round, puffy jowls down to the chin
    const a = -0.1 - k / 8 * (Math.PI - 0.2);
    head.push([Math.cos(a) * cw * (puffy ? 1.05 : 0.95), -0.05 + Math.sin(a) * (puffy ? 0.46 : 0.42)]);
  }
  poly(head, true);
  // inner ears
  poly([[-0.34, 0.5], [-0.39, 0.64], [-0.26, 0.47]]);
  poly([[0.34, 0.5], [0.39, 0.64], [0.26, 0.47]]);
  // eyes (almonds) — pupils drawn separately so they can change
  for (const s of [-1, 1]) {
    const ex = s * (puffy ? 0.22 : 0.19), ey = 0.08, w = puffy ? 0.13 : 0.11, h = puffy ? 0.09 : 0.065;
    const eye = [];
    for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI * 2; eye.push([ex + Math.cos(a) * w, ey + Math.sin(a) * h * (1 - 0.3 * Math.abs(Math.cos(a)))]); }
    poly(eye, true);
  }
  // nose + mouth
  poly([[-0.05, -0.08], [0.05, -0.08], [0, -0.13]], true);
  poly([[0, -0.13], [0, -0.18], [-0.07, -0.22]]);
  poly([[0, -0.18], [0.07, -0.22]]);
  // whiskers
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) segs.push([[s * 0.16, -0.14 - k * 0.03], [s * (0.62 + (puffy ? 0.1 : 0)), -0.1 - k * 0.07]]);
  // Uriel's mackerel "M"
  if (tabby) {
    poly([[-0.14, 0.2], [-0.1, 0.32], [0, 0.24], [0.1, 0.32], [0.14, 0.2]]);
    for (const s of [-1, 1]) poly([[s * 0.36, 0.12], [s * 0.46, 0.14]]);
    for (const s of [-1, 1]) poly([[s * 0.35, -0.02], [s * 0.47, -0.03]]);
  }
  return segs;
}

IJ.registerScene({
  name: 'lattice', start: START, end: 57, transition: { type: 'glitch', dur: 0.8 },
  post: { bloom: 1.0, grain: 0.03, vignette: 0.45, thresh: 0.3 },
  init() {
    this.bg = IJ.program(BG_FS, null, 'synthbg');
    this.lines = IJ.Lines(1400);
    this.pts = IJ.Points(700);
    this.uriel = catArt(false, true);
    this.yuffie = catArt(true, false);
    // lattice with a skewed basis
    const B = [[1, 0.18, 0.05], [0.28, 1, 0.12], [0.1, 0.22, 1]];
    this.basis = B.map(b => b.map(v => v * SPACING));
    this.lat = [];
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) for (let k = -3; k <= 3; k++) {
      const v = [0, 1, 2].map(d => i * this.basis[0][d] + j * this.basis[1][d] + k * this.basis[2][d]);
      if (Math.hypot(...v) < 1.25) this.lat.push({ v, r: Math.hypot(...v) });
    }
    // heart points and their ciphertexts: a lattice point plus a small error
    const R = IJ.rng(1234);
    this.heart = [];
    for (let i = 0; i < NH; i++) {
      const a = i / NH * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(a), 3) / 17, y = (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17 + 0.15;
      this.heart.push([x, y]);
    }
    const pool = this.lat.map((p, i) => i).sort(() => R() - 0.5);
    this.cipher = this.heart.map((h, i) => {
      const L = this.lat[pool[i]].v;
      const e = [R() - 0.5, R() - 0.5, R() - 0.5].map(v => v * SPACING * 0.62);
      return { L, e, order: R() };
    });
    const ord = this.cipher.map((c, i) => [c.order, i]).sort((a, b) => a[0] - b[0]);
    ord.forEach(([_, i], rank) => { this.cipher[i].rank = rank; });
  },
  render(t, l) {
    const gl = IJ.gl;
    const L = this.lines, P = this.pts;
    L.clear(); P.clear();
    // camera: a slow orbit
    const ang = IJ.lerp(-0.32, 0.3, IJ.ease.sine(IJ.clamp(l / 9)));
    const dist = IJ.key(l, [[0, 7.2], [6, 6.4], [9, 6.9]], IJ.ease.sine);
    const eye = [Math.sin(ang) * dist, 1.25, Math.cos(ang) * dist];
    const proj = IJ.M4.persp(0.72, IJ.aspect(), 0.1, 60);
    const view = IJ.M4.lookAt(eye, [0, 0.35, 0]);
    const mvp = IJ.M4.mul(proj, view);
    const far = IJ.M4.mul(mvp, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1000, 1]));
    const horizon = far[13] / far[15];
    const on = IJ.smooth(0.3, 1.2, l);
    this.bg.draw({ uHorizon: horizon, uT: t, uOn: on });

    // neon flicker when the tubes ignite
    const ignite = (t0) => { const k = l - t0; if (k < 0) return 0; if (k > 0.45) return 1; return (Math.sin(k * 90) > 0.2 || k > 0.3) ? 0.3 + k * 1.5 : 0.05; };

    // synthwave grid floor, scrolling
    const gy = -1.25, sp = 0.6, scroll = (l * 0.9) % sp;
    for (let i = -14; i <= 14; i++) {
      const x = i * sp;
      if (Math.abs(x) < 7.5) L.add(x, gy, -14, x, gy, 1.6, 0.75, 0.2, 0.85, 0.35 * on, 0.008, 1.2);
    }
    for (let k = 0; k < 27; k++) {
      const z = -14 + k * sp + scroll;
      if (z > 1.6) continue;
      const fade = IJ.smooth(-14, -6, z) * on;
      L.add(-7.5, gy, z, 7.5, gy, z, 0.75, 0.2, 0.85, 0.35 * fade, 0.008, 1.2);
    }

    // the two cats
    const drawCat = (segs, cx, cy, s, col, glow, pupil, heartEyes) => {
      for (const [a, b] of segs) L.add(cx + a[0] * s, cy + a[1] * s, 0, cx + b[0] * s, cy + b[1] * s, 0, col[0], col[1], col[2], glow, 0.012, 2.2);
      for (const sgn of [-1, 1]) {
        const ex = cx + sgn * 0.21 * s, ey = cy + 0.08 * s;
        if (heartEyes > 0) {
          for (const sc of [1, 0.66, 0.33]) for (let k = 0; k < 16; k++) {
            const a0 = k / 16 * Math.PI * 2, a1 = (k + 1) / 16 * Math.PI * 2;
            const H = a => [16 * Math.pow(Math.sin(a), 3) / 17 * 0.1 * s, ((13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17 + 0.2) * 0.1 * s];
            const p0 = H(a0).map(v => v * sc), p1 = H(a1).map(v => v * sc);
            L.add(ex + p0[0], ey + p0[1], 0.01, ex + p1[0], ey + p1[1], 0.01, 1, 0.3, 0.55, 0.8 * heartEyes, 0.011, 0.6);
          }
        } else {
          L.add(ex, ey - 0.055 * s * pupil, 0, ex, ey + 0.055 * s * pupil, 0, col[0], col[1], col[2], glow, 0.013 + 0.02 * (1 - pupil), 1.8);
        }
      }
    };
    const U = [-2.35, 0.55], Y = [2.35, 0.55];
    const arrive = C.heartArrive - START;
    const joy = l > arrive ? Math.exp(-(l - arrive) * 1.5) : 0;
    drawCat(this.uriel, U[0], U[1], 1.25, [1, 0.6, 0.18], ignite(0.4) * (1 + joy * 0.4), 1, 0);
    const yPupil = l > C.decrypt - START - 0.3 ? 0.35 : 1;
    drawCat(this.yuffie, Y[0], Y[1], 1.25, [0.72, 0.4, 1], ignite(0.7) * (1 + joy * 0.5), yPupil, IJ.smooth(arrive - 0.1, arrive + 0.2, l));

    // the lattice, turning
    const th = l * 0.35;
    const ct = Math.cos(th), st = Math.sin(th);
    const rotY = v => [v[0] * ct + v[2] * st, v[1], -v[0] * st + v[2] * ct];
    const center = [0, 0.35, 0];
    const W = v => { const r = rotY(v); return [r[0] + center[0], r[1] + center[1], r[2] + center[2]]; };
    const latOn = IJ.smooth(0.6, 1.8, l);
    const fadeLat = 1 - 0.6 * IJ.smooth(C.heartForm - START, C.heartForm - START + 1, l);
    for (const q of this.lat) {
      const grow = IJ.clamp((latOn * 1.4 - q.r / 1.25) * 3);
      if (grow <= 0) continue;
      const w = W(q.v);
      P.add(w[0], w[1], w[2], 0.022 * grow, 0.35, 0.85, 1, 0.55 * fadeLat, 0.6, 0);
    }
    // faint edges along the basis directions, so the lattice reads as a lattice
    if (!this.edges) {
      this.edges = [];
      const key = v => v.map(x => Math.round(x * 1000)).join(',');
      const idx = new Map(this.lat.map((q, i) => [key(q.v), i]));
      this.lat.forEach((q, i) => this.basis.forEach(b => {
        const j = idx.get(key(q.v.map((x, d) => x + b[d])));
        if (j !== undefined) this.edges.push([i, j]);
      }));
    }
    for (const [i, j] of this.edges) {
      const a = this.lat[i], b = this.lat[j];
      const g = IJ.clamp((latOn * 1.4 - Math.max(a.r, b.r) / 1.25) * 3) * fadeLat;
      if (g <= 0) continue;
      const wa = W(a.v), wb = W(b.v);
      L.add(wa[0], wa[1], wa[2], wb[0], wb[1], wb[2], 0.3, 0.75, 1, 0.13 * g, 0.004, 1);
    }
    // basis vectors
    const origin = W([0, 0, 0]);
    this.basis.forEach((b, i) => {
      const e = W(b), g = latOn * fadeLat;
      L.add(origin[0], origin[1], origin[2], e[0], e[1], e[2], 0.4, 1, 0.9, g, 0.014, 2.5);
    });

    // the heart's journey
    const launch = C.heartLaunch - START, enc = C.encrypt - START, dec = C.decrypt - START, form = C.heartForm - START;
    const heartAt = (k, c, s) => this.heart.map(h => [c[0] + h[0] * s, c[1] + h[1] * s, c[2]]);
    let pos = null, lineAlpha = 0, errA = 0;
    const pink = [1, 0.32, 0.62];
    if (l >= launch && l < enc) {
      const u = IJ.ease.inOut((l - launch) / (enc - launch));
      const c = [IJ.lerp(U[0] + 0.7, center[0], u), center[1] + 0.2 + Math.sin(u * Math.PI) * 0.9 - 0.2 * u, 0];
      pos = heartAt(0, c, IJ.lerp(0.18, 0.55, u));
      lineAlpha = 1;
    } else if (l >= enc) {
      pos = this.cipher.map((cph, i) => {
        const Lw = W(cph.L);
        const snapT = dec + cph.rank / NH * 1.1;
        const eK = l < snapT ? 1 : Math.max(0, 1 - (l - snapT) / 0.12);
        const jit = 1 + 0.25 * Math.sin(t * 7 + i);
        const ew = rotY(cph.e);
        let p = [Lw[0] + ew[0] * eK * jit, Lw[1] + ew[1] * eK * jit, Lw[2] + ew[2] * eK * jit];
        // explode from the heart into the lattice
        const u0 = IJ.ease.out(IJ.clamp((l - enc) / 0.6));
        const h0 = [center[0] + this.heart[i][0] * 0.55, center[1] + this.heart[i][1] * 0.55, 0];
        p = p.map((v, d) => IJ.lerp(h0[d], v, u0));
        // error vectors (red), only while they exist
        if (eK > 0.01 && u0 > 0.9) {
          L.add(Lw[0], Lw[1], Lw[2], p[0], p[1], p[2], 1, 0.2, 0.25, 0.8 * eK, 0.008, 1.5);
          errA = 1;
        }
        // reassemble as a heart, then fly to Yuffie
        const u1 = IJ.ease.inOut(IJ.clamp((l - form - i * 0.006) / 0.9));
        const bigC = [center[0], center[1] + 0.1, 0.4];
        const hb = [bigC[0] + this.heart[i][0] * 0.95, bigC[1] + this.heart[i][1] * 0.95, bigC[2]];
        p = p.map((v, d) => IJ.lerp(v, hb[d], u1));
        const u2 = IJ.ease.inOut(IJ.clamp((l - arrive + 0.7) / 0.7));
        const yc = [Y[0], Y[1] + 0.1, 0.05];
        const hy = [yc[0] + this.heart[i][0] * 0.25, yc[1] + this.heart[i][1] * 0.25, yc[2]];
        return p.map((v, d) => IJ.lerp(v, hy[d], u2));
      });
      lineAlpha = IJ.smooth(form + 0.4, form + 1.0, l) * (1 - IJ.smooth(arrive, arrive + 0.4, l));
    }
    if (pos) {
      const snapped = l > dec;
      pos.forEach((p, i) => {
        const cph = this.cipher[i];
        const isSnapped = snapped && l > dec + cph.rank / NH * 1.1 + 0.1;
        const col = l < enc ? pink : (isSnapped ? (l > form ? pink : [1, 1, 1]) : [1, 0.55, 0.6]);
        const fade = 1 - IJ.smooth(arrive - 0.25, arrive + 0.05, l);
        P.add(p[0], p[1], p[2], 0.03, col[0], col[1], col[2], fade, 1.2, isSnapped && l < form ? 0.6 : 0);
        if (lineAlpha > 0) {
          const q = pos[(i + 1) % NH];
          L.add(p[0], p[1], p[2], q[0], q[1], q[2], pink[0], pink[1], pink[2], lineAlpha * fade, 0.012, 2);
        }
      });
    }
    L.draw(mvp, { persp: true, projY: proj[5] });
    P.draw(mvp, { persp: true, projY: proj[5] });
  },
});
})();
