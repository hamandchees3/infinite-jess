// 57–69 s · Replicability, on a chalkboard. Two independent samples from the same
// distribution; one shared roll of the die. Both learners take the very same steps and
// arrive at the very same boundary — a heart. Slide the boards together: they coincide.
(function () {
const IJ = window.IJ;
const C = IJ.CUES;
const START = 57;
const ND = 44;               // samples per panel
const HS = 0.5;              // heart scale inside a panel

const FS = `
in vec2 vUv; out vec4 o;
uniform vec2 uPanL, uPanR; uniform float uAxes, uNDots, uIter, uDraw, uPrevA, uFill, uArrows, uDieA, uGlow, uZoom;
uniform vec4 uDie;           // x, y, angle, face
uniform vec3 uPts[${ND * 2}];

float grain(vec2 p){ return smoothstep(.2, .75, vnoise(p*430.)*.55 + vnoise(p*vec2(70., 700.))*.45); }
float chalk(float d, float w, vec2 p){ return (1. - smoothstep(w*.45, w, abs(d))) * (.5 + .5*grain(p)); }
// the learner's boundary at iteration k (identical wobble in both panels: shared randomness)
float boundary(vec2 q, float k){
  vec2 hq = q/${HS.toFixed(2)} + vec2(0., .55);
  float heart = sdHeart(hq)*${HS.toFixed(2)};
  float circ = length(q - vec2(0., .02)) - .33;
  float m = k >= 3. ? 1. : (k >= 2. ? .75 : (k >= 1. ? .4 : 0.));
  float wob = (k >= 3. ? 0. : (k >= 2. ? .012 : (k >= 1. ? .03 : .015)));
  float a = atan(q.y, q.x);
  return mix(circ, heart, m) + wob*sin(a*5. + k*1.7) + wob*.6*sin(a*9. - k);
}
float angleParam(vec2 q){ return fract((atan(q.x, q.y - .05) + PI)/TAU + .5); }   // 0..1 around, starting at the top

vec3 panel(vec3 col, vec2 p, vec2 c, float idx){
  vec2 q = p - c;
  vec3 W = vec3(.93,.94,.9);
  // axes, drawn on: y axis first, then x axis, with little arrowheads
  float ax = uAxes*2.;
  float ya = clamp(ax, 0., 1.), xa = clamp(ax - 1., 0., 1.);
  float yl = sdSeg(q, vec2(-.6, -.6), vec2(-.6, mix(-.6, .62, ya)));
  float xl = sdSeg(q, vec2(-.6, -.6), vec2(mix(-.6, .62, xa), -.6));
  float d = min(yl, xl);
  if (ya >= 1.) d = min(d, min(sdSeg(q, vec2(-.6,.62), vec2(-.63,.57)), sdSeg(q, vec2(-.6,.62), vec2(-.57,.57))));
  if (xa >= 1.) d = min(d, min(sdSeg(q, vec2(.62,-.6), vec2(.57,-.63)), sdSeg(q, vec2(.62,-.6), vec2(.57,-.57))));
  col = mix(col, W, chalk(d, .007, p)*.9);
  // samples: + inside, o outside
  for (int i = 0; i < ${ND}; i++){
    if (float(i) >= uNDots) break;
    vec3 s = uPts[int(idx)*${ND} + i];
    vec2 r = q - s.xy;
    float m = s.z > .5 ? min(sdSeg(r, vec2(-.018,0.), vec2(.018,0.)), sdSeg(r, vec2(0.,-.018), vec2(0.,.018))) : abs(length(r) - .014);
    col = mix(col, s.z > .5 ? vec3(.97,.9,.55) : W*.9, chalk(m, .0055, p + float(i)));
  }
  // the previous guess, being erased; the current one, being drawn
  float t = angleParam(q);
  if (uPrevA > 0.) {
    float bp = boundary(q, uIter - 1.);
    col = mix(col, W*.8, chalk(bp, .008, p)*uPrevA*.8);
  }
  float bc = boundary(q, uIter);
  float drawn = step(t, uDraw);
  vec3 pink = vec3(.98,.6,.72);
  col = mix(col, uIter >= 3. ? pink : W, chalk(bc, .009, p)*drawn);
  // the heart filled in with hatching, once the two boards agree
  if (uFill > 0.) {
    float hatch = step(.55, fract((q.x + q.y)*70.)) * grain(p*1.3);
    float inside = 1. - smoothstep(-.004, .004, bc);
    col = mix(col, pink, inside*hatch*uFill*.55);
    col += pink*.25*uGlow*exp(-abs(bc)*40.)*uFill;
  }
  return col;
}

void main(){
  vec2 p = (2.*gl_FragCoord.xy - uRes)/uRes.y / uZoom;
  // slate: green-black, chalk dust, old eraser swipes
  vec3 col = vec3(.12,.17,.15) + .025*fbm(p*3.) - .02*fbm(p*9. + 4.);
  float swipe = fbm(vec2(p.x*1.2, p.y*9.) + 7.);
  col += vec3(.06,.07,.065)*smoothstep(.55, .8, swipe)*.7;
  col += .012*(vnoise(p*600.) - .5);
  // the two panels
  col = panel(col, p, uPanL, 0.);
  col = panel(col, p, uPanR, 1.);
  // the shared die, and arrows from it to both learners
  if (uDieA > 0.) {
    vec2 q = rot(-uDie.z)*(p - uDie.xy);
    float box = abs(sdRBox(q, vec2(.075), .018));
    vec3 Y = vec3(.97,.92,.6);
    col = mix(col, Y, chalk(box, .007, p)*uDieA);
    float f = uDie.w; float pip = 1e3;
    vec2 P1 = vec2(0.), P2 = vec2(.035), P3 = vec2(-.035);
    if (f == 1. || f == 3. || f == 5.) pip = min(pip, length(q - P1));
    if (f >= 2.) { pip = min(pip, length(q - vec2(.035,.035))); pip = min(pip, length(q + vec2(.035,.035))); }
    if (f >= 4.) { pip = min(pip, length(q - vec2(.035,-.035))); pip = min(pip, length(q + vec2(.035,-.035))); }
    if (f == 6.) { pip = min(pip, length(q - vec2(.035,0.))); pip = min(pip, length(q + vec2(.035,0.))); }
    col = mix(col, Y, (1. - smoothstep(.009, .013, pip))*uDieA*(.6 + .4*grain(p)));
    // arrows: shared randomness goes to both
    for (int s = -1; s <= 1; s += 2){
      vec2 a = uDie.xy + vec2(float(s)*.12, 0.), b = uDie.xy + vec2(float(s)*.3, 0.);
      vec2 e = mix(a, b, uArrows);
      float d = sdSeg(p, a, e);
      if (uArrows > .95) d = min(d, min(sdSeg(p, b, b + vec2(-float(s)*.03, .025)), sdSeg(p, b, b + vec2(-float(s)*.03, -.025))));
      col = mix(col, Y, chalk(d, .006, p)*uDieA);
    }
  }
  // the frame
  float frame = max(abs(p.x) - 1.72, abs(p.y) - .94);
  vec3 wood = vec3(.38,.24,.14)*(.8 + .2*sin(p.x*60. + fbm(p*8.)*6.));
  col = mix(col, wood, smoothstep(-.002, .002, frame));
  col *= 1. - .3*smoothstep(-.06, 0., frame)*step(frame, 0.);
  o = vec4(col, 1.);
}`;

IJ.registerScene({
  name: 'chalk', start: START, end: 69, transition: { type: 'fade', dur: 1.0 },
  post: { bloom: 0.2, grain: 0.04, vignette: 0.45, thresh: 0.7 },
  init() {
    this.p = IJ.program(FS, null, 'chalk');
    // two independent samples from the same distribution D (uniform on the panel);
    // labels come from the heart concept
    const heartSD = (x, y) => {
      let px = Math.abs(x / HS), py = y / HS + 0.55;
      let d;
      if (py + px > 1) d = Math.hypot(px - 0.25, py - 0.75) - Math.SQRT2 / 4;
      else { const m = 0.5 * Math.max(px + py, 0); d = Math.sqrt(Math.min(px * px + (py - 1) * (py - 1), (px - m) * (px - m) + (py - m) * (py - m))) * Math.sign(px - py); }
      return d;
    };
    this.pts = new Float32Array(ND * 2 * 3);
    [7, 99].forEach((seed, panel) => {
      const R = IJ.rng(seed);
      for (let i = 0; i < ND; i++) {
        let x, y;
        // a bit more mass near the boundary, like any interesting distribution
        do { x = (R() - 0.5) * 1.05; y = (R() - 0.5) * 1.05; } while (Math.abs(heartSD(x, y)) > 0.25 && R() < 0.5);
        const o = (panel * ND + i) * 3;
        this.pts[o] = x; this.pts[o + 1] = y; this.pts[o + 2] = heartSD(x, y) < 0 ? 1 : 0;
      }
    });
    this.s1 = IJ.text('S₁ ~ D', { font: 'chalk', size: 96 });
    this.s2 = IJ.text('S₂ ~ D', { font: 'chalk', size: 96 });
    this.r = IJ.text('r', { font: 'chalk', size: 96 });
    this.eq = IJ.text('A(S₁; r) = A(S₂; r)', { font: 'chalk', size: 96 });
  },
  render(t, l) {
    const at = x => x - START;
    // panels slide together at the merge
    const mk = IJ.ease.inOut(IJ.clamp((l - at(C.merge)) / 0.85));
    const pl = [IJ.lerp(-0.84, 0, mk), 0.1], pr = [IJ.lerp(0.84, 0, mk), 0.1];
    const axes = IJ.clamp((l - at(C.chalkAxes)) / 1.4);
    const ndots = IJ.clamp((l - at(C.chalkDots)) / 2.2) * ND;
    // die: tumbles, lands on four
    const d0 = at(C.dieRoll);
    const dk = IJ.clamp((l - d0) / 0.9);
    const dieA = IJ.smooth(d0 - 0.15, d0 + 0.05, l) * (1 - IJ.smooth(at(C.merge) - 0.4, at(C.merge), l));
    const face = dk < 1 ? 1 + Math.floor((l * 17) % 6) : 4;
    const die = [0, -0.25 + 0.12 * Math.abs(Math.sin(dk * Math.PI * 3)) * (1 - dk), (1 - IJ.ease.out(dk)) * 7, face];
    const arrows = IJ.clamp((l - d0 - 0.9) / 0.4);
    // learning: four passes, erase and redraw
    const L0 = at(C.learn), step = 0.95;
    const k = Math.max(0, Math.min(3, Math.floor((l - L0) / step)));
    const started = l >= L0;
    const draw = started ? IJ.clamp((l - L0 - k * step) / 0.75) : 0;
    const prevA = k > 0 ? 1 - IJ.clamp((l - L0 - k * step) / 0.4) : 0;
    const fill = IJ.smooth(at(C.bell) - 0.1, at(C.bell) + 0.4, l);
    const zoom = IJ.lerp(1, 1.1, IJ.ease.sine(IJ.clamp(l / 12)));
    this.p.draw({
      uPanL: pl, uPanR: pr, uAxes: axes, uNDots: ndots, uIter: started ? k : 0, uDraw: started ? draw : 0, uPrevA: prevA,
      uFill: fill, uArrows: arrows, uDie: die, uDieA: dieA, uGlow: 1, uZoom: zoom, uPts: this.pts,
    });
    // chalk labels
    const la = IJ.smooth(at(C.chalkAxes) + 0.8, at(C.chalkAxes) + 1.3, l) * (1 - mk);
    const z = zoom, chalkC = [0.93, 0.94, 0.9];
    if (la > 0) {
      IJ.sprite(this.s1, { x: pl[0] * z, y: -0.62 * z, h: 0.2 * z, alpha: la * 0.92, color: chalkC, wipe: IJ.clamp((l - at(C.chalkAxes) - 0.8) / 0.6) });
      IJ.sprite(this.s2, { x: pr[0] * z, y: -0.62 * z, h: 0.2 * z, alpha: la * 0.92, color: chalkC, wipe: IJ.clamp((l - at(C.chalkAxes) - 0.8) / 0.6) });
    }
    if (dieA > 0 && arrows > 0.5) IJ.sprite(this.r, { x: 0.13 * z, y: (die[1] - 0.13) * z, h: 0.17 * z, alpha: dieA * 0.9, color: [0.97, 0.92, 0.6] });
    const ea = IJ.clamp((l - at(C.bell) - 0.25) / 1.1);
    if (ea > 0) IJ.sprite(this.eq, { x: 0, y: -0.7 * z, h: 0.2 * z, alpha: 0.95, color: chalkC, wipe: ea, soft: 0.08 });
  },
});
})();
