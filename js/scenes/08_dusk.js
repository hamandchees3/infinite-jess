// 69–81 s · The two of them at dusk in the park (from the selfie), painted in watercolor.
// The wash spreads across the paper, bare trees grow branch by branch and burst into
// blossom, a car drifts by on the road, and her head rests on his shoulder.
(function () {
const IJ = window.IJ;
const C = IJ.CUES;
const START = 69;

const BASE_FS = `
in vec2 vUv; out vec4 o;
uniform float uT, uL, uDusk, uLean, uTilt, uCar;
float fillS(float d){ return 1. - smoothstep(-.003, .003, d); }
void main(){
  vec2 p = (2.*gl_FragCoord.xy - uRes)/uRes.y;
  // sky: lavender to peach to gold at the horizon; deepens as dusk falls
  vec3 top = mix(vec3(.58,.62,.84), vec3(.3,.3,.55), uDusk);
  vec3 mid = mix(vec3(.99,.74,.72), vec3(.85,.52,.6), uDusk);
  vec3 low = mix(vec3(1.,.84,.6), vec3(.98,.62,.46), uDusk);
  float y = p.y;
  vec3 col = y > .25 ? mix(mid, top, smoothstep(.25, 1., y)) : mix(low, mid, smoothstep(-.1, .25, y));
  // wet-in-wet clouds
  float cl = fbm(p*vec2(1.6, 4.) + vec2(uT*.02, 0.));
  col = mix(col, mix(vec3(1.,.8,.82), vec3(.75,.5,.62), uDusk), smoothstep(.55, .75, cl)*.45*smoothstep(0., .5, y));
  // the low sun
  vec2 sp = p - vec2(.62, -.02 - uDusk*.08);
  col = mix(col, vec3(1.,.9,.7), (1. - smoothstep(.07, .075, length(sp)))*.9);
  col += vec3(1.,.7,.45)*.25*exp(-length(sp)*3.);
  // distant treeline
  float tl = -.1 + .07*fbm(vec2(p.x*7., 1.)) + .025*fbm(vec2(p.x*28., 2.));
  col = mix(col, mix(vec3(.55,.5,.68), vec3(.4,.35,.52), uDusk), fillS(p.y - tl));
  // road with a passing car
  col = mix(col, vec3(.62,.6,.66), fillS(abs(p.y + .2) - .045));
  {
    vec2 c = p - vec2(mix(-2.1, 2.1, uCar), -.19);
    float car = min(sdRBox(c, vec2(.09, .025), .012), sdRBox(c - vec2(-.01, .03), vec2(.05, .02), .015));
    col = mix(col, vec3(.35,.38,.5), fillS(car));
    col += vec3(1.,.95,.8)*.6*exp(-length((c - vec2(.1, 0.))*vec2(.6, 2.))*14.)*uDusk;
    col += vec3(1.,.2,.15)*.5*exp(-length(c + vec2(.09, 0.))*40.);
  }
  // grass: a middle band and the foreground hill they sit on
  float g1 = -.25 - .02*sin(p.x*2.);
  col = mix(col, mix(vec3(.55,.66,.42), vec3(.4,.48,.38), uDusk), fillS(p.y - g1));
  float g2 = -.52 + .12*cos(p.x*.9 + .3);
  vec3 grass = mix(vec3(.42,.56,.33), vec3(.3,.38,.3), uDusk);
  grass *= .92 + .08*fbm(p*vec2(8., 30.));
  col = mix(col, grass, fillS(p.y - g2));
  // mulch ring under the left tree
  col = mix(col, vec3(.45,.32,.27), fillS(sdEllipse(p - vec2(-1.22, -.42), vec2(.2, .03))));

  // --- the two of them, from behind, sitting close ---------------------------------
  vec2 c = (p - vec2(.1, -.62))/1.3;
  // Sam: broad back in a black tee, head tipping toward her, dark cap
  float back = sdRBox(c - vec2(.15, -.34), vec2(.2, .32), .12);
  back = smin(back, sdEllipse(c - vec2(.15, -.06), vec2(.225, .09)), .06);
  vec2 sh = rot(-uTilt)*(c - vec2(.15, .02));
  float neck = sdRBox(sh - vec2(0., .01), vec2(.05, .05), .03);
  float head = sdEllipse(sh - vec2(0., .12), vec2(.078, .092));
  float ear = min(sdEllipse(sh - vec2(-.078, .1), vec2(.013, .028)), sdEllipse(sh - vec2(.078, .1), vec2(.013, .028)));
  float cap = max(sdEllipse(sh - vec2(0., .158), vec2(.087, .08)), -(sh.y - .108));
  col = mix(col, vec3(.13,.12,.15)*(.9 + .1*smoothstep(.1, -.3, c.x - .15)), fillS(back));
  col = mix(col, vec3(.8,.6,.5), fillS(min(neck, ear)));
  col = mix(col, vec3(.5,.46,.44), fillS(head));
  col = mix(col, vec3(.74,.7,.66), fillS(head)*step(.55, fract(sh.x*80. + sh.y*30.))*.3);  // salt and pepper
  col = mix(col, vec3(.22,.19,.25), fillS(cap));
  col = mix(col, vec3(.12,.1,.14), fillS(abs(sh.y - .108) - .009)*fillS(abs(sh.x) - .085));
  col = mix(col, vec3(.66,.58,.52), fillS(sdSeg(sh, vec2(-.018,.117), vec2(.018,.117)) - .006));
  // Jess: grey knit cardigan
  float jb = sdRBox(c - vec2(-.13, -.36), vec2(.155, .3), .12);
  jb = smin(jb, sdEllipse(c - vec2(-.13, -.1), vec2(.16, .075)), .06);
  vec3 knit = vec3(.63,.67,.7) * (.9 + .1*step(.5, fract(c.x*70. + step(.5, fract(c.y*48.))*.5)));
  col = mix(col, knit, fillS(jb));
  // her arm around his back, hand resting at his side
  float arm = sdCapsule(c, vec2(-.03, -.16), vec2(.27, -.24), .036, .03);
  col = mix(col, knit*.95, fillS(arm));
  col = mix(col, vec3(.86,.64,.54), fillS(sdEllipse(c - vec2(.3, -.245), vec2(.03, .024))));
  col = mix(col, knit*.8, fillS(abs(sdCapsule(c, vec2(-.03, -.16), vec2(.27, -.24), .036, .03)) - .002)*.5);
  // her head on his shoulder
  vec2 jh = rot(-uLean)*(c - vec2(-.1, -.03));
  float hcap = sdEllipse(jh - vec2(0., .1), vec2(.088, .1));
  // the long fall of hair down her back, gently waving
  float hy = c.y;
  float k = clamp((.06 - hy)/.62, 0., 1.);
  float cx = mix(-.05, -.15, k) + .012*sin(hy*16. + uT*.8);
  float hw = mix(.085, .135, k) + .01*sin(hy*27. + 1.) ;
  float fall = abs(c.x - cx) - hw;
  float yb = -.58 + .03*abs(sin(c.x*30.));
  fall = max(fall, max(yb - hy, hy - .08));
  float hair = smin(hcap, fall, .05);
  float strands = .5 + .5*sin((c.x - cx)*110. + sin(hy*9. + c.x*20.)*2.5);
  vec3 hairC = mix(vec3(.42,.19,.11), vec3(.7,.36,.2), .55 + .45*sat((c.x - cx)/hw*-.7 + .3));
  hairC = mix(hairC, vec3(.88,.55,.33), pow(strands, 5.)*.3);
  col = mix(col, hairC, fillS(hair));
  // warm rim of last light on the edges facing the sun (right)
  float edge = min(hair, min(back, cap));
  float rim = (1. - smoothstep(-.001, .002, edge)) * smoothstep(-.02, -.004, edge) * step(0., c.x - .05);
  col += vec3(1.,.72,.45)*rim*.3*(1. - uDusk*.5);
  o = vec4(col, 1.);
}`;

const WC_FS = `
in vec2 vUv; out vec4 o;
uniform sampler2D uScene; uniform float uReveal, uT, uFade;
vec3 tap(vec2 uv){ return texture(uScene, uv).rgb; }
void main(){
  vec2 asp = vec2(uRes.x/uRes.y, 1.);
  vec2 uv = vUv;
  // hand-painted wobble
  vec2 w = vec2(fbm3(uv*asp*7.), fbm3(uv*asp*7. + 9.)) - .5;
  uv += w*.006;
  vec3 c = tap(uv);
  // pigment pools at the edges of each wash
  vec2 px = 1.5/uRes;
  vec3 gx = tap(uv + vec2(px.x, 0.)) - tap(uv - vec2(px.x, 0.));
  vec3 gy = tap(uv + vec2(0., px.y)) - tap(uv - vec2(0., px.y));
  float edge = sat((length(gx) + length(gy))*1.4);
  c *= 1. - .35*edge;
  // uneven pigment: blooms and backruns
  float blot = fbm3(uv*asp*vec2(5., 4.) + 3.1);
  c = mix(c, c*c*1.15, .3*smoothstep(.45, .75, blot));
  // granulation, heavier in the darks
  float gr = vnoise(uv*asp*260.)*.6 + vnoise(uv*asp*120.)*.4;
  c *= 1. - (.1 + .15*(1. - luma(c)))*(gr - .45);
  // cold-press paper
  float paperN = vnoise(uv*asp*90.)*.6 + fbm3(uv*asp*18.)*.4;
  vec3 paper = vec3(.985,.97,.935)*(.93 + .07*paperN);
  // the wash spreads from the middle, with a darker wet edge
  float r = length((vUv - vec2(.5, .45))*asp) + (fbm3(uv*asp*4.) - .5)*.35;
  float front = uReveal*1.6;
  float m = 1. - smoothstep(front - .06, front, r);
  float wet = smoothstep(.06, 0., abs(r - front + .03))*step(uReveal, .999);
  vec3 painted = c*paper;
  painted *= 1. - .25*wet;
  vec3 col = mix(paper, painted, m);
  o = vec4(col*uFade, 1.);
}`;

IJ.registerScene({
  name: 'dusk', start: START, end: 81, transition: { type: 'dissolve', dur: 1.8 },
  post: { bloom: 0.1, grain: 0.02, vignette: 0.3, thresh: 0.95 },
  init() {
    this.base = IJ.program(BASE_FS, null, 'duskbase');
    this.wc = IJ.program(WC_FS, null, 'watercolor');
    this.lines = IJ.Lines(3200);
    this.pts = IJ.Points(2400);
    // grow three bare trees: recursive branching with a little randomness
    const R = IJ.rng(2718);
    this.segs = []; this.tips = [];
    const grow = (x, y, a, len, w, depth, maxD, t0, scale) => {
      const x1 = x + Math.sin(a) * len, y1 = y + Math.cos(a) * len;
      this.segs.push({ x, y, x1, y1, w, t0, dur: 0.35 + 0.15 * R(), depth });
      if (depth >= maxD) { this.tips.push({ x: x1, y: y1, t0: t0 + 0.3, s: scale, r: R() }); return; }
      const n = depth < 2 ? 2 : (R() < 0.3 ? 3 : 2);
      for (let k = 0; k < n; k++) {
        const spread = (0.35 + 0.35 * R()) * (k === 0 ? -1 : 1) * (n === 3 && k === 2 ? 0.1 : 1);
        const na = a + spread + (R() - 0.5) * 0.25 - Math.sin(a) * 0.08;
        grow(x1, y1, na, len * (0.7 + 0.12 * R()), w * 0.66, depth + 1, maxD, t0 + 0.42 + 0.1 * R(), scale);
      }
    };
    grow(-1.22, -0.42, -0.05, 0.34, 0.03, 0, 8, 0, 1);
    grow(1.4, -0.36, 0.08, 0.3, 0.026, 0, 8, 0.4, 1);
    grow(0.72, -0.24, 0.02, 0.12, 0.01, 0, 6, 0.8, 0.55);
    grow(-0.55, -0.24, -0.04, 0.1, 0.009, 0, 6, 1.0, 0.5);
    this.tipMin = Math.min(...this.tips.map(t => t.t0));
    this.petals = Array.from({ length: 70 }, () => ({ x: R() * 3.6 - 1.8, y: R() * 1.4 - 0.2, s: R() * 6.28, v: 0.03 + R() * 0.04 }));
  },
  resize(W, H) {
    if (this.rt) this.rt.dispose();
    this.rt = IJ.fbo(W, H);
  },
  render(t, l) {
    const target = IJ.target;
    if (!this.rt) this.resize(IJ.W, IJ.H);
    const dusk = IJ.smooth(6, 12, l);
    this.rt.bind();
    this.base.draw({
      uT: t, uL: l, uDusk: dusk,
      uLean: IJ.lerp(0.42, 0.55, IJ.smooth(2, 5, l)) + 0.015 * Math.sin(l * 0.9),
      uTilt: IJ.lerp(0, 0.14, IJ.smooth(C.blossom - START + 0.4, C.blossom - START + 2.4, l)),
      uCar: IJ.clamp((l - 3.0) / 5.5),
    });
    // trees, drawn branch by branch
    const L = this.lines, P = this.pts;
    L.clear(); P.clear();
    const gt = l - (C.treesGrow - START);
    const ink = [0.27, 0.18, 0.24];
    for (const s of this.segs) {
      const u = IJ.clamp((gt - s.t0) / s.dur);
      if (u <= 0) continue;
      const e = IJ.ease.out(u);
      L.add2(s.x, s.y, s.x + (s.x1 - s.x) * e, s.y + (s.y1 - s.y) * e, [ink[0], ink[1], ink[2], 0.92], Math.max(0.0016, s.w * 0.5), 0.15);
    }
    L.draw(null, { blend: 'premult' });
    // blossoms burst open in a wave from each trunk
    const bt = l - (C.blossom - START);
    if (bt > 0) {
      for (const tp of this.tips) {
        const u = IJ.clamp((bt - Math.max(0, tp.t0 - this.tipMin) * 0.45) / 0.4);   // the first open on the cue
        if (u <= 0) continue;
        const sz = 0.012 * tp.s * IJ.ease.outBack(u) * (0.7 + 0.6 * tp.r);
        const pink = tp.r > 0.3 ? [0.98, 0.68, 0.78] : [1, 0.9, 0.92];
        P.add(tp.x, tp.y, 0, sz, pink[0], pink[1], pink[2], 0.9, 0.3, 0);
      }
      // petals on the breeze
      const pa = IJ.smooth(0.8, 2, bt);
      for (const q of this.petals) {
        const x = ((q.x + bt * 0.12 + Math.sin(bt * 1.3 + q.s) * 0.05 + 1.8) % 3.6) - 1.8;
        const y = q.y - bt * q.v + Math.sin(bt * 2 + q.s) * 0.02;
        P.add(x, y, 0, 0.006, 0.98, 0.72, 0.8, 0.85 * pa, 0.2, 0);
      }
      P.draw(null, { blend: 'premult' });
    }
    target.bind();
    const reveal = IJ.ease.out(IJ.clamp((l - (C.duskWash - START) + 0.8) / 2.6));
    this.wc.draw({ uScene: this.rt.tex, uReveal: reveal, uT: t, uFade: 1 });
  },
});
})();
