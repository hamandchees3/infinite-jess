// 15–27 s · Jess in golden-hour light, as a flat vector illustration built from signed
// distance fields. She looks over, blinks, smiles. Her freckles begin to glow, night
// falls, and the freckles lift off to become stars that join into constellations:
// Uriel, Yuffie, and an aerialist on her silks.
(function () {
const IJ = window.IJ;
const C = IJ.CUES;
const START = 15;
const NF = 36;                      // freckles
const CENTER = [0.0, 0.1];          // face origin in p-space

// ---- freckles, in face coordinates (x right, y up; face is ~0.7 wide, ~1.0 tall)
const freckles = (() => {
  const R = IJ.rng(31415), out = [];
  const add = (x, y) => out.push([x, y, 0.0042 + R() * 0.0036]);
  // across the nose bridge
  for (let i = 0; i < 10; i++) add((R() - 0.5) * 0.11, -0.04 - R() * 0.1);
  // both cheeks, densest near the nose
  for (let s of [-1, 1]) for (let i = 0; i < 13; i++) {
    const u = Math.pow(R(), 0.8);
    add(s * (0.07 + u * 0.18), -0.05 - R() * 0.1 + u * 0.03);
  }
  return out.slice(0, NF);
})();

// ---- constellations in p-space: points + edges; groups revealed on the cue pings
const CONST = (() => {
  const U = [[-1.36, 0.58], [-1.22, 0.36], [-0.95, 0.36], [-0.81, 0.58], [-0.74, 0.2], [-0.9, -0.03], [-1.08, -0.1], [-1.26, -0.03], [-1.42, 0.2], [-1.18, 0.2], [-0.99, 0.2]];
  const Y = [[0.83, 0.54], [0.94, 0.33], [1.18, 0.33], [1.29, 0.54], [1.42, 0.14], [1.24, -0.08], [1.06, -0.12], [0.88, -0.08], [0.7, 0.14], [0.97, 0.17], [1.15, 0.17]];
  const A = [[0, 5], [7.19, 11.9], [15.28, 7.19], [14.42, -0.95], [5.66, -9.61], [0, -17], [-5.66, -9.61], [-14.42, -0.95], [-15.28, 7.19], [-7.19, 11.9]]
    .map(([x, y]) => [x * 0.02, 0.46 + (y + 2.5) * 0.02]);   // a heart, sampled from the classic parametric curve
  const pts = [...U, ...Y, ...A];
  const u = 0, y = U.length, a = U.length + Y.length;
  const e = (base, list) => list.map(([i, j]) => [base + i, base + j]);
  const groups = [
    e(u, [[8, 0], [0, 1], [1, 2], [2, 3], [3, 4]]),     // Uriel's ears
    e(u, [[4, 5], [5, 6], [6, 7], [7, 8]]),             // Uriel's face
    e(y, [[8, 0], [0, 1], [1, 2], [2, 3], [3, 4]]),     // Yuffie's ears
    e(y, [[4, 5], [5, 6], [6, 7], [7, 8]]),             // Yuffie's (puffy) cheeks
    e(a, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]),     // heart, right half
    e(a, [[5, 6], [6, 7], [7, 8], [8, 9], [9, 0]]),     // heart, left half
  ];
  const eyes = new Set([9, 10, 20, 21]);         // bright, unlined stars
  return { pts, groups, eyes };
})();

const FS = `
in vec2 vUv; out vec4 o;
uniform float uT, uL, uAng, uScale, uSmile, uGaze, uOpen, uGlow, uNight, uFreckOn, uSway;
uniform vec3 uFreck[${NF}];
uniform vec2 uCenter;

// ---------- shapes (face coordinates)
float faceRx(float y){
  if (y > .06) { float u = (y-.06)/.45; return .31*sqrt(max(0., 1.-u*u)); }
  if (y > -.12) return mix(.3, .312, (y+.12)/.18);
  float s = clamp((-.12 - y)/.385, 0., 1.);
  return .3*sqrt(max(0., 1. - pow(s, 2.8))) * (1. - .33*s*s);
}
float faceSD(vec2 f){ if (f.y > .51 || f.y < -.505) return .05; return abs(f.x) - faceRx(f.y); }
float hairlineY(float x){ return .41 - 2.3*(x-.015)*(x-.015); }
float wav(float y, float s){ return (.03*sin(y*6.2 + uT*1.0 + s*1.3) + .012*sin(y*13. + s*2.)) * smoothstep(.0, -.75, y); }
// one long side lock; u runs across it (0 inner edge, 1 outer edge)
float lockSD(vec2 f, float s, out float u){
  float y = f.y, w = wav(y, s);
  float xo = .405 + .09*smoothstep(.02, -.6, y) - .07*smoothstep(-.78, -1.08, y) + w;
  float xi = mix(.08, .15 + .06*smoothstep(-.55, -1., y), smoothstep(-.3, -.52, y)) + w*.8;
  float x = f.x*s;
  u = (x - xi)/max(xo - xi, .01);
  float d = max(x - xo, xi - x);
  float yb = -1.03 + .075*abs(sin((x - .28)*12. + s)) + .025*sin(x*7. + uT*.8);
  d = max(d, yb - y);
  return max(d, y - .02);
}
float hairBackSD(vec2 f){
  float u, d = sdEllipse(f - vec2(0., .13), vec2(.415, .445));
  d = smin(d, lockSD(f, -1., u), .07);
  d = smin(d, lockSD(f,  1., u), .07);
  d = min(d, sdBox(f - vec2(0., -.42), vec2(.25, .24)));     // behind the neck
  return d;
}
float shouldersSD(vec2 f){ return sdEllipse(f - vec2(0., -1.19), vec2(.98, .56)); }
float neckSD(vec2 f){ return sdRBox(f - vec2(0., -.52), vec2(.102, .15), .05); }

// ---------- colors
const vec3 SKIN = vec3(.98,.82,.7), SKIN_SH = vec3(.86,.6,.52), SKIN_HI = vec3(1.,.9,.79);
const vec3 HAIR = vec3(.8,.48,.26), HAIR_SH = vec3(.43,.21,.12), HAIR_HI = vec3(1.,.8,.52);
const vec3 TOP = vec3(.7,.3,.19), TOP_SH = vec3(.45,.17,.12);
const vec3 LIGHT_DIR = vec3(-.62,.42,.66);

vec3 hairShade(vec2 f, float d){
  float s = f.x < 0. ? -1. : 1.;
  float ul; lockSD(f, s, ul);
  float ur = atan(abs(f.x - .015), .62 - f.y)*2.2;            // strands radiate from the part
  float k = smoothstep(.12, -.28, f.y);
  float u = mix(ur, ul*2.2 + .6, k);
  // soft clumps with lighter centres, gently waving
  float cu = u*2.2 + .18*sin(f.y*4. + s + uT*.6);
  float cl = fract(cu);
  float clump = smoothstep(0., .45, cl)*smoothstep(1., .55, cl);
  float lit = sat(.62 - f.x*.85 + f.y*.25);                    // sun from the upper left
  vec3 c = mix(HAIR_SH, HAIR, .28 + .5*lit + .18*clump*lit);
  float n = gnoise(vec2(u*5., f.y*1.5));
  float streak = smoothstep(.93, 1., sin(u*26. + n*2.));
  c = mix(c, HAIR_HI, streak*.3*lit);
  c *= .96 + .04*sin(u*11. + n);
  // hair behind the neck sits in shadow
  c *= mix(1., .55, (1.-smoothstep(.2, .3, abs(f.x)))*smoothstep(-.25, -.4, f.y));
  // glossy bands: one on the crown, one where the locks turn
  float b1 = exp(-pow((length((f - vec2(.015,.12))/vec2(1.,1.05)) - .36)/.035, 2.))*smoothstep(-.05,.2,f.y);
  float b2 = exp(-pow((f.y + .42 + .06*sin(u*2. + s))/.07, 2.))*k;
  c = mix(c, HAIR_HI, (b1*.55 + b2*.35)*lit*(.5 + .5*clump));
  // golden rim where the sun catches the outer edge
  c += vec3(1.,.72,.38)*smoothstep(-.03, 0., d)*smoothstep(.15, -.3, f.x)*.65;
  return c;
}

vec3 night(vec2 p){
  vec3 c = mix(vec3(.02,.025,.07), vec3(.05,.06,.16), sat(p.y*.4 + .5));
  // faint band of the galaxy
  float band = exp(-pow((p.y - p.x*.35 - .1)*2.2, 2.)) * (.5 + .5*fbm(p*2.5 + 3.));
  c += vec3(.08,.07,.14)*band;
  // small twinkling stars
  vec2 g = p*42.; vec2 id = floor(g); vec2 fr = fract(g) - .5;
  float h = hash12(id);
  if (h > .86) {
    vec2 off = (hash22(id) - .5)*.6;
    float tw = .55 + .45*sin(uT*(2. + h*5.) + h*40.);
    c += vec3(.85,.9,1.) * smoothstep(.09, 0., length(fr - off)) * tw * (h - .86)*6.;
  }
  return c;
}

void main(){
  vec2 p = (2.*gl_FragCoord.xy - uRes)/uRes.y;
  vec2 f = rot(-uAng)*(p - uCenter)/uScale;
  float aa = 1.5/uRes.y/uScale;

  // ---- background: golden hour, soft bokeh
  vec3 bg = mix(vec3(1.,.8,.52), vec3(.55,.36,.42), sat(.5 - p.x*.22 - p.y*.35));
  bg = mix(bg, vec3(1.,.93,.75), .35*exp(-length(p - vec2(-1.3,.9))*1.2));
  for (int i = 0; i < 9; i++){
    float fi = float(i);
    vec2 c = vec2(hash11(fi*3.1)*3.6 - 1.8, hash11(fi*7.3)*2.2 - 1.1) + vec2(sin(uT*.2 + fi)*.08, uT*.015);
    float r = .09 + hash11(fi*1.7)*.14;
    float b = smoothstep(r, r - .015, length(p - c));
    bg = mix(bg, bg*1.18 + vec3(.06,.04,0.), b*.5);
  }
  vec3 col = bg;

  // ---- hair (back)
  float hb = hairBackSD(f);
  col = mix(col, hairShade(f, hb), fillAA(hb, aa*2.));

  // ---- shoulders + top (rust), neck
  float sh = shouldersSD(f);
  float neckOpen = sdEllipse(f - vec2(0., -.655), vec2(.165, .08));
  float top = max(sh, -neckOpen);
  float nk = neckSD(f);
  vec3 skinNeck = mix(SKIN_SH, SKIN, .55 + .3*sat(-f.x*2.));
  skinNeck *= mix(1., .72, smoothstep(-.53, -.43, f.y));     // shadow under the chin
  skinNeck *= 1. - .12*smoothstep(.04, .1, abs(f.x));
  col = mix(col, skinNeck, fillAA(min(nk, max(sh, neckOpen - .0)), aa*2.));
  vec3 topC = mix(TOP_SH, TOP, sat(.6 - f.x*.6 + (f.y + 1.)*.4));
  topC += .05*sin(f.x*40. + sin(f.y*9.)*2.)*smoothstep(-.8,-1.1,f.y);  // a few soft folds
  col = mix(col, topC, fillAA(top, aa*2.));

  // ---- face
  float fd = faceSD(f);
  vec3 n = normalize(vec3(f.x/.34, (f.y + .02)/.62, 1.));
  float diff = sat(dot(n, normalize(LIGHT_DIR)));
  vec3 skin = mix(SKIN_SH, SKIN, smoothstep(.25, .9, diff));
  skin = mix(skin, SKIN_HI, smoothstep(.85, 1., diff)*.6);
  // a patch of light drifting across, like sun through a car window
  float lpatch = smoothstep(.2, .8, sin(f.x*2.2 + f.y*1.6 - uT*.6)*.5 + .5);
  skin *= .97 + .05*lpatch;
  // blush
  for (int s = -1; s <= 1; s += 2) skin = mix(skin, vec3(.97,.6,.56), .28*exp(-pow(length((f - vec2(float(s)*.18, -.13))/vec2(.09,.055)), 2.)));
  // nose: shadow on the right of the bridge, soft tip, nostrils
  skin *= 1. - .14*exp(-pow((f.x - .035)/.012, 2.))*smoothstep(.04, -.02, f.y)*smoothstep(-.17, -.1, f.y);
  skin *= 1. - .08*exp(-pow(length((f - vec2(.01, -.182))/vec2(.05, .014)), 2.));
  skin = mix(skin, SKIN_HI, .4*exp(-pow(length((f - vec2(-.012, -.145))/vec2(.018, .018)), 2.)));
  {
    float nd = sdBezier(f, vec2(-.03, -.165), vec2(-.004, -.19), vec2(.034, -.162)) - .0022;
    skin = mix(skin, SKIN_SH*.82, fillAA(nd, aa)*.6);
    float nb = sdBezier(f, vec2(.022, -.02), vec2(.03, -.1), vec2(.036, -.15)) - .0016;
    skin = mix(skin, SKIN_SH*.9, fillAA(nb, aa)*.25);
  }
  // eye sockets
  for (int s = -1; s <= 1; s += 2) skin *= 1. - .06*exp(-pow(length((f - vec2(float(s)*.135, .06))/vec2(.09, .04)), 2.));
  // chin + jaw shading
  skin *= 1. - .1*smoothstep(-.35, -.5, f.y);

  // freckles
  float fa = 0.; float fg = 0.;
  for (int i = 0; i < ${NF}; i++){
    vec3 q = uFreck[i];
    float d = length(f - q.xy);
    float tw = .5 + .5*sin(uT*6. + float(i)*2.4);
    fa = max(fa, smoothstep(q.z, q.z*.35, d));
    fg += exp(-d*d/(q.z*q.z*9.))*(.6 + .4*tw);
  }
  skin = mix(skin, vec3(.72,.42,.3), fa*.55*uFreckOn);

  // brows
  for (int s = -1; s <= 1; s += 2){
    vec2 b = vec2(f.x*float(s), f.y);
    float xb = clamp((b.x - .065)/.16, 0., 1.);
    float yb = .122 + .026*sin(xb*2.6) - .01*xb;
    float th = mix(.013, .0045, xb);
    float bd = abs(b.y - yb) - th;
    bd = max(bd, max(.06 - b.x, b.x - .235));
    skin = mix(skin, vec3(.55,.33,.21), fillAA(bd, aa*1.5)*.85);
  }

  // eyes
  for (int s = -1; s <= 1; s += 2){
    vec2 e = f - vec2(float(s)*.135, .035);
    vec2 m = vec2(e.x*float(s), e.y);            // mirrored: +x is the outer corner
    float w = .067;
    float xn = clamp(m.x/w, -1., 1.);
    float inX = step(abs(m.x), w);
    float yu = mix(-.004, .035*(1. - xn*xn)*(1. + .18*xn) + .002, uOpen);
    float yl = -.02*(1. - xn*xn)*(.8 + .2*uOpen) - .002*uOpen;
    float eyeIn = inX * smoothstep(yl - aa, yl + aa, m.y) * smoothstep(yu + aa, yu - aa, m.y);
    vec3 ec = vec3(.96,.93,.9) * (1. - .25*smoothstep(yu - .02, yu, m.y));
    vec2 ic = vec2(uGaze, -.002);
    float ir = length(e - ic);
    float ang = atan(e.y - ic.y, e.x - ic.x);
    vec3 iris = mix(vec3(.42,.66,.64), vec3(.16,.32,.35), smoothstep(.008, .026, ir));
    iris *= .85 + .15*sin(ang*22. + ir*300.);
    iris = mix(iris, vec3(.03,.04,.05), smoothstep(.0115, .009, ir));
    ec = mix(ec, iris, smoothstep(.027, .025, ir));
    ec += smoothstep(.006, .003, length(e - ic - vec2(-.008, .009)))*.9;
    ec *= 1. - .35*smoothstep(yu - .015, yu, m.y);   // shadow of the upper lid
    skin = mix(skin, ec, eyeIn);
    // lash line: thicker toward the outer corner, with a small flick
    float lt = mix(.0028, .0065, sat(xn*.5 + .5));
    float ld = abs(m.y - yu) - lt;
    ld = max(ld, abs(m.x) - w*1.04);
    float flick = sdSeg(m, vec2(w*.95, yu + .002), vec2(w*1.2, yu + .014)) - .0025;
    ld = min(ld, mix(1., flick, uOpen));
    skin = mix(skin, vec3(.26,.15,.12), fillAA(ld, aa));
    // crease and lower lid
    float cr = abs(m.y - (yu*.9 + .02 + .006*uOpen)) - .0018;
    cr = max(cr, abs(m.x) - w*.85);
    skin = mix(skin, SKIN_SH*.92, fillAA(cr, aa)*.45*uOpen);
    float lo = max(abs(m.y - yl + .003) - .0015, abs(m.x) - w*.8);
    skin = mix(skin, SKIN_SH, fillAA(lo, aa)*.3);
  }

  // mouth: a soft closed smile
  {
    float mw = .08 + .01*uSmile;
    float xn = clamp(f.x/mw, -1., 1.);
    float ym = -.285 + uSmile*.02*xn*xn - .004*(1. - xn*xn);
    float up = .02*(1. - xn*xn) - .005*exp(-pow(f.x/.012, 2.));   // cupid's bow dip
    float lo = .029*(1. - pow(abs(xn), 1.7));
    float inX = step(abs(f.x), mw);
    float ul = inX*smoothstep(ym - aa, ym + aa, f.y)*smoothstep(ym + up + aa, ym + up - aa, f.y);
    float ll = inX*smoothstep(ym + aa, ym - aa, f.y)*smoothstep(ym - lo - aa, ym - lo + aa, f.y);
    skin = mix(skin, vec3(.82,.48,.46), ul*.9);
    vec3 lc = mix(vec3(.86,.54,.5), vec3(.97,.72,.66), exp(-pow(length((f - vec2(-.015, ym - lo*.45))/vec2(.03,.007)), 2.)));
    skin = mix(skin, lc, ll*.9);
    float line = abs(f.y - ym) - mix(.0028, .0012, abs(xn));
    line = max(line, abs(f.x) - mw*1.02);
    skin = mix(skin, vec3(.5,.25,.24), fillAA(line, aa));
    // smile creases at the corners
    for (int s = -1; s <= 1; s += 2){
      float cd = sdSeg(f, vec2(float(s)*mw*1.02, ym + .004), vec2(float(s)*(mw + .016), ym + .018*uSmile + .002)) - .0015;
      skin = mix(skin, SKIN_SH, fillAA(cd, aa)*.5*uSmile);
    }
  }

  // warm rim on the lit edge of the face
  skin += vec3(1.,.7,.4)*smoothstep(-.03, 0., fd)*step(f.x, 0.)*.25;
  float faceMask = fillAA(fd, aa*2.);
  col = mix(col, skin, faceMask);

  // ---- hair (front): the part, curtains framing the face, locks over the shoulders
  float hl = f.y - hairlineY(f.x);
  float cw = mix(.015, .085, smoothstep(-.28, .28, f.y));
  float curtain = abs(f.x) - (faceRx(f.y) - cw);
  float onFace = max(1. - smoothstep(-aa*2., aa*2., -hl), (1. - smoothstep(-aa*2., aa*2., -curtain))*smoothstep(-.3, -.22, f.y));
  float uu;
  float locks = max(max(min(lockSD(f, -1., uu), lockSD(f, 1., uu)), f.y + .3), -fd);
  float frontMask = max(faceMask*onFace, fillAA(locks, aa*2.));
  col = mix(col, hairShade(f, min(hb, locks)), frontMask);
  // shadow the hair casts on the face, and the part
  col *= 1. - .22*faceMask*(1. - frontMask)*smoothstep(.035, 0., min(-hl, -curtain + .0));
  col = mix(col, HAIR_SH, fillAA(sdSeg(f, vec2(.015, .4), vec2(.018, .58)) - .004, aa)*.55*step(hb, 0.));

  // ---- glowing freckles, then night
  vec3 day = col;
  vec3 glowC = vec3(1.,.83,.5);
  day += glowC*fg*.35*uGlow*faceMask + glowC*fa*uGlow*faceMask*.8;
  vec3 nightC = night(p);
  float sil = max(max(fillAA(hb, aa*2.), fillAA(top, aa*2.)), max(faceMask, fillAA(nk, aa*2.)));
  vec3 silC = vec3(.015,.018,.04) + vec3(.1,.12,.25)*smoothstep(-.03, 0., max(hb, fd))*.4;
  nightC = mix(nightC, silC, sil*smoothstep(1., .55, uNight*1.1));
  col = mix(day, nightC, uNight);
  o = vec4(col, 1.);
}`;

IJ.registerScene({
  name: 'portrait', start: START, end: 27, transition: { type: 'fade', dur: 1.6 },
  post(l) { return { bloom: IJ.lerp(0.25, 0.9, IJ.smooth(6, 8, l)), grain: 0.03, vignette: 0.4, thresh: IJ.lerp(0.8, 0.35, IJ.smooth(6, 8, l)) }; },
  init() {
    this.p = IJ.program(FS, null, 'portrait');
    this.freckData = new Float32Array(NF * 3);
    freckles.forEach((q, i) => this.freckData.set(q, i * 3));
    this.points = IJ.Points(200);
    this.lines = IJ.Lines(200);
    // each freckle is assigned a destination: constellation points first, then free stars
    const R = IJ.rng(99);
    this.dest = freckles.map((q, i) => i < CONST.pts.length ? CONST.pts[i] : [(R() - 0.5) * 3.2, 0.5 + R() * 0.45]);
    // shuffle the assignment so the lift looks like a scatter, not an ordered sweep
    this.order = freckles.map((_, i) => i).sort(() => R() - 0.5);
  },
  pose(l) {
    return {
      ang: -0.05 + 0.03 * Math.sin(l * 0.7),
      scale: 1 + 0.004 * Math.sin(l * 1.9) + 0.012 * IJ.smooth(0, 6, l),
    };
  },
  facePoint(q, pose) {
    const c = Math.cos(pose.ang), s = Math.sin(pose.ang);
    const x = q[0] * pose.scale, y = q[1] * pose.scale;
    return [CENTER[0] + c * x - s * y, CENTER[1] + s * x + c * y];
  },
  render(t, l) {
    const pose = this.pose(l);
    const blink = (at) => { const k = (l - at) / 0.16; return k > 0 && k < 1 ? Math.sin(k * Math.PI) : 0; };
    const open = 1 - Math.max(blink(1.5), blink(4.0), blink(5.6));
    const smile = IJ.key(l, [[0, 0.15], [2.5, 0.2], [3.3, 1]], IJ.ease.sine);
    const gaze = IJ.key(l, [[0, -0.02], [2.0, -0.02], [2.5, 0.001]], IJ.ease.inOut);
    const liftAt = C.freckleLift - START;
    const glow = IJ.smooth(C.freckleGlow - START, C.freckleGlow - START + 1.2, l);
    const nightK = IJ.smooth(liftAt - 0.2, liftAt + 1.5, l);
    this.p.draw({
      uT: t, uL: l, uAng: pose.ang, uScale: pose.scale, uSmile: smile, uGaze: gaze, uOpen: open,
      uGlow: glow, uNight: nightK, uFreckOn: l < liftAt ? 1 : 0, uFreck: this.freckData, uCenter: CENTER,
    });

    // ---- freckles as particles once they lift
    if (l < liftAt) return;
    const P = this.points, Ls = this.lines;
    P.clear(); Ls.clear();
    const liftPose = this.pose(liftAt);
    const pos = [];
    freckles.forEach((q, i) => {
      const k = this.order.indexOf(i);
      const u = IJ.clamp((l - liftAt - k * 0.025) / 1.35);
      const e = IJ.ease.inOut(u);
      const a = this.facePoint(q, liftPose), b = this.dest[i];
      // arc outward and upward
      const mx = (a[0] + b[0]) / 2 + (b[0] - a[0]) * 0.15, my = Math.max(a[1], b[1]) + 0.35;
      const x = (1 - e) * (1 - e) * a[0] + 2 * (1 - e) * e * mx + e * e * b[0];
      const y = (1 - e) * (1 - e) * a[1] + 2 * (1 - e) * e * my + e * e * b[1];
      pos.push([x, y]);
      const isEye = CONST.eyes.has(i);
      const tw = 0.8 + 0.2 * Math.sin(t * 4 + i * 1.7);
      const size = (isEye ? 0.011 : 0.0075) * (0.8 + 0.4 * e) * tw;
      const col = [IJ.lerp(1, 0.85, e), IJ.lerp(0.83, 0.9, e), IJ.lerp(0.5, 1, e)];
      P.add(x, y, 0, size, col[0], col[1], col[2], 1, 0.9 + (isEye ? 0.8 : 0), isEye ? 0.8 : 0.35 * e);
    });
    // ---- constellation lines, one group per ping, each edge drawn on over 0.45 s
    CONST.groups.forEach((g, gi) => {
      const at = C.constellations[gi] - START;
      g.forEach(([i, j], ei) => {
        const u = IJ.ease.out(IJ.clamp((l - at - ei * 0.06) / 0.45));
        if (u <= 0) return;
        const a = pos[i], b = pos[j];
        const pulse = 1 + 0.6 * Math.exp(-(l - at) * 3);
        Ls.add2(a[0], a[1], a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, [0.75 * pulse, 0.82 * pulse, 1, 0.55], 0.0022, 1.2);
      });
    });
    // the last chime: a shooting star
    const ss = C.constellations[6] - START;
    const su = (l - ss) / 0.9;
    if (su > 0 && su < 1) {
      const e = IJ.ease.out(su), fade = Math.sin(su * Math.PI);
      const x0 = -1.7 + 1.5 * e, y0 = 0.98 - 0.2 * e;
      Ls.add2(x0 - 0.35, y0 + 0.06, x0, y0, [1, 0.95, 0.85, 0.7 * fade], 0.003, 2);
      P.add(x0, y0, 0, 0.008, 1, 0.95, 0.85, fade, 1.2, 0.6);
    }
    Ls.draw();
    P.draw();
  },
});
})();
