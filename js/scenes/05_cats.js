// 39–48 s · "Attempting to walk my cat." Paper cut-out on a Baltimore rowhouse block
// (marble stoops), animated on twos like stop-motion. Uriel, the handsome mackerel tabby,
// walks on his leash for exactly three seconds and then flops. Up in the window, Yuffie
// (black, puffy cheeks) gets a zap and the zoomies. Then Uriel makes up for it.
(function () {
const IJ = window.IJ;
const C = IJ.CUES;
const START = 39;

const FS = `
in vec2 vUv; out vec4 o;
uniform float uT, uF;                         // time, stop-motion frame index
uniform vec2 uJess; uniform float uWalk, uStep, uLean, uArm, uLook;
uniform vec2 uCat; uniform float uCatWalk, uFlop, uWiggle, uBump, uTail, uFace;
uniform vec2 uYuf; uniform float uStretch, uWide, uPuff, uZap, uEar;
uniform vec4 uHeart;                          // x, y, scale, alpha
uniform vec2 uHand, uCollar; uniform float uSag;
uniform vec3 uCam;                            // center x, y, zoom

vec3 COL; float SH;                           // composite + accumulated shadow
float PT, TORN;                               // paper grain + torn-edge offset, once per pixel
float paperTex(vec2 p){ return .93 + .07*fbm(p*55. + uF*.0); }
float torn(vec2 p){ return TORN; }
// place one paper piece: shadow first, then the piece itself
void piece(float dShadow, float d, vec3 c){
  float s = 1. - smoothstep(-.004, .014, dShadow);
  COL *= 1. - .32*s;
  float a = 1. - smoothstep(-.0015, .0015, d);
  COL = mix(COL, c*PT, a);
}
#define SHOFF vec2(-.011, .013)
#define PIECE(expr, color) { vec2 q = p; float d1 = expr; q = p + SHOFF; float d0 = expr; piece(d0 + torn(p), d1 + torn(p), color); }
#define P q

vec2 tr(vec2 p, vec2 at, float a){ return rot(-a)*(p - at); }
float tri(vec2 p, vec2 a, vec2 b, vec2 c){
  vec2 e0=b-a, e1=c-b, e2=a-c, v0=p-a, v1=p-b, v2=p-c;
  vec2 pq0=v0-e0*clamp(dot(v0,e0)/dot(e0,e0),0.,1.), pq1=v1-e1*clamp(dot(v1,e1)/dot(e1,e1),0.,1.), pq2=v2-e2*clamp(dot(v2,e2)/dot(e2,e2),0.,1.);
  float s = sign(e0.x*e2.y - e0.y*e2.x);
  vec2 d = min(min(vec2(dot(pq0,pq0), s*(v0.x*e0.y-v0.y*e0.x)), vec2(dot(pq1,pq1), s*(v1.x*e1.y-v1.y*e1.x))), vec2(dot(pq2,pq2), s*(v2.x*e2.y-v2.y*e2.x)));
  return -sqrt(d.x)*sign(d.y);
}

// ---------------------------------------------------------------- houses
float house(vec2 p, float x0, float w, float h){ return sdBox(p - vec2(x0 + w*.5, -.35 + h*.5), vec2(w*.5, h*.5)); }
void rowhouse(vec2 p, float x0, float w, float h, vec3 wall, float door){
  PIECE(house(P, x0, w, h), wall);
  // brick courses, pressed into the paper
  if (house(p, x0, w, h) < 0.) COL *= .97 + .03*step(.5, fract(p.y*38.)) ;
  PIECE(sdBox(P - vec2(x0 + w*.5, -.35 + h + .015), vec2(w*.5 + .02, .022)), vec3(.94,.92,.87));     // cornice
  for (int k = 0; k < 3; k++){
    float fx = x0 + w*(.22 + .28*float(k));
    PIECE(sdBox(P - vec2(fx, -.35 + h - .2), vec2(.052, .085)), vec3(.94,.92,.87));
    PIECE(sdBox(P - vec2(fx, -.35 + h - .2), vec2(.038, .071)), vec3(.13,.17,.24));
  }
  // door and three marble steps
  float dx = x0 + w*door;
  PIECE(sdBox(P - vec2(dx, -.14), vec2(.06, .13)), vec3(.94,.92,.87));
  PIECE(sdBox(P - vec2(dx, -.15), vec2(.045, .115)), wall*.55);
  for (int k = 0; k < 3; k++) PIECE(sdBox(P - vec2(dx, -.305 - float(k)*.025), vec2(.07 + float(k)*.022, .0125)), vec3(.93,.92,.9));
}

// ----------------------------------------------------------------- Jess
float jessBody(vec2 p, out int part){
  vec2 q = tr(p, uJess, uLean);
  float best = 1e3; part = 0;
  // legs (jeans), back one first
  float sw = uStep;
  for (int k = 0; k < 2; k++){
    float s = k == 0 ? -1. : 1.;
    float a = s*sw*.42;
    vec2 knee = vec2(sin(a), -cos(a))*.19;
    float kb = max(0., -s*sw)*.5;
    vec2 foot = knee + vec2(sin(a - kb), -cos(a - kb))*.19;
    float d = min(sdCapsule(q, vec2(0.), knee, .045, .037), sdCapsule(q, knee, foot, .037, .03));
    if (d < best) { best = d; part = 1; }
    float sh = sdRBox(q - foot - vec2(.03, -.02), vec2(.05, .022), .018);
    if (sh < best) { best = sh; part = 2; }
  }
  // torso
  float t = sdCapsule(q, vec2(0., .02), vec2(.01, .27), .075, .07);
  if (t < best) { best = t; part = 3; }
  // arms: one holds the leash
  vec2 sh = vec2(.012, .27);
  vec2 el = sh + vec2(sin(uArm), -cos(uArm))*.14;
  vec2 hd = el + vec2(sin(uArm + .5), -cos(uArm + .5))*.13;
  float ar = min(sdCapsule(q, sh, el, .03, .026), sdCapsule(q, el, hd, .026, .022));
  if (ar < best) { best = ar; part = 3; }
  float hand = length(q - hd) - .026;
  if (hand < best) { best = hand; part = 4; }
  // neck + head (profile), hair
  vec2 hc = vec2(.02, .415) + vec2(uLook*.02, 0.);
  float head = min(length(q - hc) - .07, sdCapsule(q, vec2(.01,.3), hc, .028, .03));
  head = min(head, length(q - hc - vec2(.066, -.012)) - .014);          // nose
  if (head < best) { best = head; part = 4; }
  return best;
}
float jessHair(vec2 p){
  vec2 q = tr(p, uJess, uLean);
  vec2 hc = vec2(.02, .415) + vec2(uLook*.02, 0.);
  float d = sdEllipse(q - hc - vec2(-.02, .015), vec2(.082, .078));
  float wave = .008*sin(q.y*40. + uT*2.);
  d = smin(d, sdCapsule(q, hc + vec2(-.03, 0.), vec2(-.06 + wave, .2), .06, .045), .03);
  d = max(d, -(sdCircle(q - hc - vec2(.045, -.03), .058)));              // leave her face clear
  return d;
}

// ---------------------------------------------------------------- Uriel
float uriel(vec2 p, out int part){
  float fl = uFlop;
  vec2 q = tr(p, uCat, -fl*.18);
  q.x *= uFace;
  part = 0;
  q.y -= -fl*.05;
  float body = sdEllipse(q, vec2(.14, .062 + fl*.01));
  float best = body;
  // head: nods down to rest on the ground when flopped; nuzzles on the bump
  vec2 hc = vec2(.155 + uBump*.02, .045 - fl*.035);
  float head = length(q - hc) - .052;
  head = min(head, tri(q, hc + vec2(-.042, .02), hc + vec2(-.012, .045), hc + vec2(-.03, .085 - fl*.01)));
  head = min(head, tri(q, hc + vec2(.0, .045), hc + vec2(.03, .025), hc + vec2(.022, .09 - fl*.01)));
  head = min(head, sdEllipse(q - hc - vec2(.045, -.012), vec2(.022, .018)));  // muzzle
  if (head < best) { best = head; part = 1; }
  // four legs: walking, or up in the air, paddling
  for (int k = 0; k < 4; k++){
    float fx = k < 2 ? .085 : -.085;
    float ph = uCatWalk + float(k)*1.57;
    float a = mix(.35*sin(ph), PI*.72 + .25*sin(uWiggle*9. + float(k)*1.3), fl);
    vec2 root = vec2(fx + float(k&1)*.02, -.02 + fl*.03);
    vec2 foot = root + vec2(sin(a), -cos(a))*.085;
    float d = sdCapsule(q, root, foot, .02, .016);
    if (d < best) { best = d; part = 2; }
  }
  // tail, swishing
  vec2 t0 = vec2(-.13, .01);
  vec2 t1 = t0 + vec2(-.06, .07 + .02*sin(uTail));
  vec2 t2 = t1 + vec2(-.05 + .04*sin(uTail*1.3), .06 - fl*.08);
  float tail = min(sdCapsule(q, t0, t1, .016, .014), sdCapsule(q, t1, t2, .014, .012));
  if (tail < best) { best = tail; part = 3; }
  return best;
}
vec3 urielColor(vec2 p, int part){
  vec2 q = tr(p, uCat, -uFlop*.18);
  q.x *= uFace;
  vec3 base = vec3(.56,.47,.38), dark = vec3(.3,.24,.19), cream = vec3(.93,.88,.8);
  // mackerel stripes: narrow, parallel, curving over the body
  float st = smoothstep(.2, .45, sin(q.x*75. + sin(q.y*25.)*1.2));
  vec3 c = mix(base, dark, st*.85);
  if (part == 1) {
    vec2 hc = vec2(.155 + uBump*.02, .045 - uFlop*.035);
    vec2 h = q - hc;
    c = mix(base, dark, smoothstep(.3,.6, sin(h.x*120.))*step(.015, h.y)*.8);     // the "M" on his brow
    c = mix(c, cream, smoothstep(.02, .0, sdEllipse(h - vec2(.045, -.018), vec2(.024, .02))));
    float eye = length(h - vec2(.022, .012)) - mix(.009, .002, uFlop*.0);
    c = mix(c, vec3(.55,.62,.25), 1. - smoothstep(-.001, .001, eye));
    c = mix(c, vec3(.05), 1. - smoothstep(-.001, .001, sdBox(h - vec2(.022, .012), vec2(.0022, .008))));
  }
  if (part == 3) c = mix(base, dark, smoothstep(.2,.5, sin(length(q)*120.)));
  if (part == 2) c = mix(base, cream, .35);
  // belly shows when he rolls over
  c = mix(c, cream, uFlop*smoothstep(-.01, -.04, q.y)*step(float(part), .5));
  // his blue harness
  float hn = abs(q.x - .09) - .012;
  c = mix(c, vec3(.2,.45,.8), (1. - smoothstep(-.001, .001, hn))*step(float(part), .5));
  return c;
}

// ---------------------------------------------------------------- Yuffie
float yuffie(vec2 p, out int part){
  vec2 q = p - uYuf;
  q.x /= 1. + uStretch*2.2;                                   // zoomies smear
  q.y /= 1. - uStretch*.35;
  float pf = 1. + uPuff*.12;
  part = 0;
  float body = sdEllipse(q - vec2(0., -.07), vec2(.075, .085)*pf);
  vec2 hc = vec2(0., .055);
  float head = length(q - hc) - .052*pf;
  head = smin(head, length(q - hc - vec2(-.036, -.018)) - .04*pf, .02);     // puffy cheeks
  head = smin(head, length(q - hc - vec2( .036, -.018)) - .04*pf, .02);
  float earL = tri(q, hc + vec2(-.05, .02), hc + vec2(-.012, .045), hc + vec2(-.042, .09 + uEar*.0));
  vec2 er = hc + vec2(.042, .09);
  er = mix(er, hc + vec2(.075, .06), uEar);                   // one ear knocked sideways
  float earR = tri(q, hc + vec2(.05, .02), hc + vec2(.012, .045), er);
  head = min(head, min(earL, earR));
  float tail = sdBezier(q, vec2(.06, -.14), vec2(.13, -.15), vec2(.1, -.06)) - .014;
  float best = min(min(body, head), tail);
  float face = length(q - hc) - .07;
  if (face < 0. && head <= best + .001) part = 1;
  return best;
}
vec3 yuffieColor(vec2 p, int part){
  vec2 q = p - uYuf; q.x /= 1. + uStretch*2.2;
  vec3 c = vec3(.1,.095,.12);
  if (part == 1 && uStretch < .2){
    vec2 hc = vec2(0., .055);
    for (int s = -1; s <= 1; s += 2){
      vec2 e = q - hc - vec2(float(s)*.022, .008);
      float eye = sdEllipse(e, vec2(.013, .015)*(1. + uWide*.35));
      c = mix(c, vec3(.78,.84,.28), 1. - smoothstep(-.001, .001, eye));
      float pw = mix(.0028, .011, uWide);                     // pupils blow wide on the zap
      float pupil = sdEllipse(e - vec2(uLook*.004, 0.), vec2(pw, .012));
      c = mix(c, vec3(.02), 1. - smoothstep(-.001, .001, pupil));
      c += .8*(1. - smoothstep(.0, .003, length(e - vec2(-.004, .006))));
    }
    c = mix(c, vec3(.85,.5,.55), 1. - smoothstep(-.001,.001, tri(q, hc + vec2(-.008,-.012), hc + vec2(.008,-.012), hc + vec2(0.,-.022))));
    // whiskers
    for (int s = -1; s <= 1; s += 2) for (int k = 0; k < 2; k++){
      float w = sdSeg(q, hc + vec2(float(s)*.03, -.02 - float(k)*.008), hc + vec2(float(s)*.09, -.012 - float(k)*.02));
      c = mix(c, vec3(.75), (1. - smoothstep(.0008, .0018, w))*.7);
    }
  }
  return c;
}

void main(){
  vec2 p = (2.*gl_FragCoord.xy - uRes)/uRes.y/uCam.z + uCam.xy;
  // stop-motion: each frame the whole set shifts a hair
  p += (hash22(vec2(uF, 3.1)) - .5)*.003;
  PT = paperTex(gl_FragCoord.xy/uRes.y*vec2(1.3,1.));
  TORN = (vnoise(p*95.) - .5)*.005 + (vnoise(p*23.) - .5)*.005;
  COL = mix(vec3(.84,.9,.9), vec3(.62,.76,.84), sat(p.y*.6 + .3));
  COL *= .93 + .07*fbm(p*1.7*55.);
  // sun with paper rays, turning slowly
  {
    vec2 s = p - vec2(.42, .5);
    float ang = atan(s.y, s.x) + uF*.02;
    float rays = length(s) - (.16 + .05*abs(fract(ang*12./TAU)*2. - 1.));
    { vec2 q = p; float d = rays; piece(length(p + SHOFF - vec2(.42,.5)) - .19, d, vec3(.98,.78,.4)); }
    { float d = length(s) - .12; piece(1., d, vec3(.99,.9,.6)); }
  }
  // clouds
  for (int k = 0; k < 2; k++){
    vec2 c0 = vec2(-.9 + float(k)*1.1 + uF*.002, .75 - float(k)*.08);
    PIECE(min(min(length(P - c0) - .09, length(P - c0 - vec2(.1, -.02)) - .07), sdRBox(P - c0 - vec2(.03,-.05), vec2(.16,.035), .03)), vec3(.97,.97,.95));
  }
  // far rooftops
  PIECE(sdBox(P - vec2(0., -.05), vec2(2., .12)) + .03*step(.5, fract(P.x*2.3))*0., vec3(.72,.74,.78));
  // the block
  rowhouse(p, -1.9, .72, .88, vec3(.68,.33,.25), .75);
  rowhouse(p, -1.18, .72, .96, vec3(.34,.56,.55), .78);
  rowhouse(p, -.46, .72, .9, vec3(.82,.63,.3), .25);
  rowhouse(p, .26, .72, 1., vec3(.62,.3,.28), .72);
  rowhouse(p, .98, .72, .92, vec3(.44,.47,.62), .3);
  // Yuffie's window (first floor of the teal house): interior, her, then the frame
  {
    vec2 wc = vec2(-.82, .16);
    PIECE(sdBox(P - wc, vec2(.2, .17)), vec3(.94,.92,.87));
    float glass = sdBox(p - wc, vec2(.175, .15));
    if (glass < 0.) {
      COL = mix(vec3(.2,.2,.26), vec3(.32,.3,.3), sat((p.y - wc.y)*3. + .5));
      // curtains, swaying after the zoomies
      float sway = .015*sin(uT*9.)*uPuff;
      COL = mix(COL, vec3(.86,.55,.5)*paperTex(p*2.), 1. - smoothstep(-.002, .002, abs(p.x - wc.x) - (.12 - sway) ));
      COL = mix(vec3(.2,.2,.26)*(.95+.05*paperTex(p*3.)), COL, smoothstep(.1, .13, abs(p.x - wc.x)));
      int part; float y = yuffie(p, part);
      int ps; float ys = yuffie(p + SHOFF*.6, ps);
      COL *= 1. - .3*(1. - smoothstep(-.004, .012, ys));
      COL = mix(COL, yuffieColor(p, part), 1. - smoothstep(-.0015, .0015, y));
      // speed lines while she tears across
      float sl = step(.55, hash12(vec2(floor(p.y*60.), floor(uT*24.)))) * (1. - smoothstep(0., .004, abs(fract(p.y*60.) - .5) - .1));
      COL = mix(COL, vec3(.95), sl*uStretch*.6*step(abs(p.y - uYuf.y), .08));
      // reflection
      COL += .06*smoothstep(.02, .0, abs(p.x - wc.x + p.y - wc.y + .05));
    }
    PIECE(sdBox(P - wc - vec2(0., -.16), vec2(.22, .018)), vec3(.94,.92,.87));   // sill
    COL = mix(COL, vec3(.94,.92,.87), 1. - smoothstep(-.001, .002, sdBox(p - wc, vec2(.006, .15))));
  }
  // zap: a little lightning star above her head
  if (uZap > 0.){
    vec2 z = p - uYuf - vec2(.07, .16);
    float bolt = min(sdSeg(z, vec2(-.02, .04), vec2(.005, .0)), min(sdSeg(z, vec2(.005, .0), vec2(-.008, -.004)), sdSeg(z, vec2(-.008, -.004), vec2(.018, -.045)))) - .007;
    COL = mix(COL, vec3(1.,.86,.25), (1. - smoothstep(-.001, .002, bolt))*uZap);
  }
  // sidewalk, curb, street
  PIECE(sdBox(P - vec2(0., -.52), vec2(2., .17)), vec3(.76,.73,.69));
  if (p.y < -.35 && p.y > -.69) COL *= .96 + .04*step(.97, fract(p.x*3.3));
  PIECE(sdBox(P - vec2(0., -.71), vec2(2., .025)), vec3(.88,.87,.84));
  PIECE(sdBox(P - vec2(0., -.9), vec2(2., .17)), vec3(.36,.35,.36));
  PIECE(sdBox(P - vec2(fract(uF*.0) , -.9), vec2(2., .006)) + step(.5, fract(P.x*2.))*.1, vec3(.92,.84,.4));

  // Jess: hair behind, then body
  { vec2 q = p; float d1 = jessHair(q); q = p + SHOFF; float d0 = jessHair(q); piece(d0, d1 + torn(p), vec3(.72,.36,.2)); }
  {
    int part; float d1 = jessBody(p, part);
    int ps; float d0 = jessBody(p + SHOFF, ps);
    vec3 c = part == 1 ? vec3(.26,.38,.6) : part == 2 ? vec3(.22,.17,.17) : part == 3 ? vec3(.66,.55,.78) : vec3(.97,.78,.66);
    piece(d0, d1 + torn(p), c);
    // her eye and smile
    vec2 q = tr(p, uJess, uLean);
    vec2 hc = vec2(.02, .415) + vec2(uLook*.02, 0.);
    COL = mix(COL, vec3(.15), 1. - smoothstep(.006, .009, length(q - hc - vec2(.035, .012))));
    COL = mix(COL, vec3(.6,.3,.28), 1. - smoothstep(.002, .004, sdBezier(q, hc + vec2(.03, -.03), hc + vec2(.045, -.04), hc + vec2(.058, -.028))));
  }
  // the leash
  {
    vec2 a = uHand, b = uCollar, m = (a + b)*.5 - vec2(0., uSag);
    float d = sdBezier(p, a, m, b) - .0045;
    float ds = sdBezier(p + SHOFF*.5, a, m, b) - .0045;
    piece(ds, d, vec3(.85,.25,.22));
  }
  // Uriel
  {
    int part; float d1 = uriel(p, part);
    int ps; float d0 = uriel(p + SHOFF, ps);
    piece(d0, d1 + torn(p)*.6, urielColor(p, part));
  }
  // a heart for the head-bump
  if (uHeart.w > 0.){
    vec2 h = (p - uHeart.xy)/uHeart.z;
    float d = sdHeart(h*vec2(1., 1.) + vec2(0., .5)) * uHeart.z;
    float ds = sdHeart((p + SHOFF - uHeart.xy)/uHeart.z + vec2(0., .5)) * uHeart.z;
    vec3 before = COL;
    piece(ds, d, vec3(.93,.36,.45));
    COL = mix(before, COL, uHeart.w);
  }
  o = vec4(COL, 1.);
}`;

IJ.registerScene({
  name: 'cats', start: START, end: 48, transition: { type: 'iris', dur: 1.2 },
  post: { bloom: 0.12, grain: 0.035, vignette: 0.3, thresh: 0.9 },
  init() { this.p = IJ.program(FS, null, 'cats'); },
  render(t) {
    const F = Math.floor(t * 12);          // on twos-ish: 12 drawings a second
    const tq = F / 12;
    const l = tq - START;
    const flopAt = C.catFlop - START, upAt = C.headbump - START - 0.7, bumpAt = C.headbump - START;
    // Jess walks in, stops when he flops
    const walkEnd = flopAt + 0.1;
    const jx = IJ.key(l, [[0, -1.2], [walkEnd, -0.42], [upAt, -0.42], [bumpAt, -0.36]], IJ.ease.linear);
    const walking = l < walkEnd ? 1 : IJ.clamp(1 - (l - walkEnd) * 3);
    const step = Math.sin(l * 6.2) * walking;
    const jy = -0.2 + Math.abs(Math.cos(l * 6.2)) * 0.012 * walking;
    const lean = IJ.key(l, [[0, 0.04], [flopAt, 0.04], [flopAt + 0.5, 0.16], [upAt, 0.16], [bumpAt + 0.4, 0.08]], IJ.ease.sine);
    const tug = (l > flopAt + 0.9 && l < flopAt + 1.2) || (l > flopAt + 1.7 && l < flopAt + 2.0) ? 0.18 : 0;
    const arm = 0.55 + tug;
    // Uriel trots ahead, flops, paddles, gets up, head-bumps her shin
    const cx = IJ.key(l, [[0, -0.55], [flopAt, 0.2], [upAt, 0.2], [bumpAt, -0.2]], IJ.ease.linear);
    const flop = IJ.clamp((l - flopAt) / 0.3) * (1 - IJ.clamp((l - upAt) / 0.3));
    const cy = -0.49 - flop * 0.02;
    const bump = l > bumpAt ? Math.sin(Math.min(1, (l - bumpAt) / 0.6) * Math.PI) : 0;
    // Yuffie: watches, zaps, zoomies back and forth, sits as if nothing happened
    const zapAt = C.yuffieZap - START, zs = C.zoomies - START, ze = C.zoomEnd - START;
    let yx = -0.82, stretch = 0;
    if (l > zs && l < ze) {
      const u = (l - zs) / (ze - zs);
      yx = -0.82 + 0.34 * Math.sin(u * Math.PI * 4);
      stretch = 0.6 + 0.4 * Math.abs(Math.cos(u * Math.PI * 4));
    }
    const wide = IJ.clamp((l - zapAt) / 0.1) * (1 - IJ.clamp((l - ze - 0.8) / 0.6));
    const puff = l > ze ? Math.exp(-(l - ze) * 2) : (l > zapAt ? 1 : 0);
    const zap = l > zapAt && l < zapAt + 0.45 ? 1 : 0;
    const ear = l > ze ? 1 : 0;
    // where the leash attaches
    const handLocal = (() => {
      const sh = [0.012, 0.27], a = arm;
      const el = [sh[0] + Math.sin(a) * 0.14, sh[1] - Math.cos(a) * 0.14];
      const hd = [el[0] + Math.sin(a + 0.5) * 0.13, el[1] - Math.cos(a + 0.5) * 0.13];
      const c = Math.cos(-lean), s = Math.sin(-lean);   // she leans forward (clockwise)
      return [jx + c * hd[0] - s * hd[1], jy + s * hd[0] + c * hd[1]];
    })();
    const face = l > upAt + 0.15 ? -1 : 1;
    const collar = [cx + face * 0.1 * Math.cos(flop * 0.18), cy + 0.05 - flop * 0.07];
    const dist = Math.hypot(collar[0] - handLocal[0], collar[1] - handLocal[1]);
    const sag = Math.max(0.01, 0.62 - dist) * 0.5 + (tug ? 0 : 0.03);
    const heartK = l > bumpAt + 0.2 ? IJ.clamp((l - bumpAt - 0.2) / 0.4) : 0;
    this.p.draw({
      uT: tq, uF: F,
      uJess: [jx, jy], uWalk: l, uStep: step, uLean: -lean, uArm: arm, uLook: l > flopAt ? -1 : 0,
      uCat: [cx, cy], uCatWalk: (l < flopAt ? l : (l > upAt && l < bumpAt ? l : flopAt)) * 9, uFace: face, uFlop: flop, uWiggle: l, uBump: bump, uTail: l * 3,
      uYuf: [yx, 0.1], uStretch: stretch, uWide: wide, uPuff: puff, uZap: zap, uEar: ear,
      uHeart: [-0.12, -0.12 + heartK * 0.1, 0.1 * IJ.ease.outBack(heartK), heartK > 0 ? 1 - IJ.clamp((l - bumpAt - 1.3) / 0.4) : 0],
      uHand: handLocal, uCollar: collar, uSag: sag,
      uCam: [IJ.lerp(-0.5, -0.4, IJ.smooth(0, 9, l)), -0.2, IJ.lerp(1.5, 1.62, IJ.smooth(0, 9, l))],
    });
  },
});
})();
