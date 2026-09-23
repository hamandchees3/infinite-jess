// 27–39 s · Aerial silks. A theatrical spotlight in haze; two red silks simulated as
// verlet ropes pinned to her hands, hips and feet; her body is a 3D-projected skeleton
// drawn as smooth SDF capsules (so she can really spin). Climb, invert, split, a
// spinning drop, the catch, an arabesque.
(function () {
const IJ = window.IJ;
const C = IJ.CUES;
const START = 27;
const RIG = [0, 1.32];
const FLOOR = -0.93;
const SEG = 0.05, NODES = 60;
const L = { torso: 0.19, neck: 0.055, head: 0.047, upper: 0.13, fore: 0.12, thigh: 0.185, shin: 0.18, foot: 0.06 };

// ---------------------------------------------------------------- poses ---
// Each limb: [a, b] — a is the angle from the body's "down" axis toward its facing
// direction, b swings it out to the side (lateral, toward the viewer for +).
const P = (an, af, ln, lf, bend = 0) => ({ an, af, ln, lf, bend });
const POSE = {
  hang:  P([[2.95, 0], [3.08, 0]], [[3.0, 0], [3.12, 0]], [[0.14, 0], [0.02, 0]], [[-0.06, 0], [-0.1, 0]]),
  tuck:  P([[2.35, 0], [3.35, 0]], [[2.45, 0], [3.3, 0]], [[1.4, 0], [0.12, 0]], [[1.3, 0], [0.06, 0]], 0.08),
  stand: P([[3.02, 0], [3.1, 0]], [[3.05, 0], [3.12, 0]], [[0.06, 0], [0.0, 0]], [[0.0, 0], [-0.03, 0]]),
  ball:  P([[1.3, 0], [0.6, 0]], [[1.1, 0], [0.5, 0]], [[2.5, 0], [-0.4, 0]], [[2.4, 0], [-0.5, 0]], 0.35),
  split: P([[2.25, 0.2], [2.65, 0.2]], [[0.2, 0], [0.12, 0]], [[1.62, 0], [1.6, 0]], [[-1.62, 0], [-1.64, 0]], -0.22),
  star:  P([[1.55, 1.5], [1.6, 1.5]], [[1.55, -1.5], [1.6, -1.5]], [[0.12, 0.35], [0.05, 0.35]], [[0.12, -0.35], [0.05, -0.35]]),
  arab:  P([[2.5, 0], [2.58, 0]], [[3.82, 0], [3.86, 0]], [[-1.95, 0], [-1.95, 0]], [[0.55, 0], [-0.75, 0]], -0.28),
};
// timeline of [time, pose, root x, root y, phi (roll), yaw (spin)]
const TL = [
  [0.0, 'hang', 0, -0.4, 0, 0],
  [0.5, 'tuck', 0, -0.4, 0, 0],
  [1.1, 'stand', 0, -0.24, 0, 0],
  [1.6, 'tuck', 0, -0.24, 0, 0],
  [2.25, 'stand', 0, -0.08, 0, 0],
  [2.9, 'hang', 0, -0.04, 0, 0],
  [3.35, 'ball', 0, 0.0, 0.5, 0],
  [4.25, 'ball', 0, 0.1, Math.PI, 0],
  [4.75, 'split', 0, 0.12, Math.PI, 0.15],
  [5.6, 'split', 0, 0.12, Math.PI, 0.55],
  [6.05, 'split', 0, 0.14, Math.PI, 0.1],
  [6.3, 'star', 0, 0.2, 2 * Math.PI, 0],
];
const DROP0 = C.silksDrop - START, CATCH = C.silksCatch - START;

function lerpPose(a, b, u) {
  const L2 = (x, y) => x.map((v, i) => [IJ.lerp(v[0], y[i][0], u), IJ.lerp(v[1], y[i][1], u)]);
  return { an: L2(a.an, b.an), af: L2(a.af, b.af), ln: L2(a.ln, b.ln), lf: L2(a.lf, b.lf), bend: IJ.lerp(a.bend, b.bend, u) };
}
function performer(l) {
  let pose, x, y, phi, yaw;
  if (l < DROP0) {
    let i = 0; while (i < TL.length - 2 && l >= TL[i + 1][0]) i++;
    const A = TL[i], B = TL[Math.min(i + 1, TL.length - 1)];
    const u = B[0] > A[0] ? IJ.ease.inOut(IJ.clamp((l - A[0]) / (B[0] - A[0]))) : 1;
    pose = lerpPose(POSE[A[1]], POSE[B[1]], u);
    x = IJ.lerp(A[2], B[2], u); y = IJ.lerp(A[3], B[3], u); phi = IJ.lerp(A[4], B[4], u); yaw = IJ.lerp(A[5], B[5], u);
  } else if (l < CATCH) {
    // free-fall while spinning; the silk unrolls from her hips
    const u = (l - DROP0) / (CATCH - DROP0);
    pose = POSE.star;
    x = 0; y = 0.2 - 0.72 * u * u; phi = 2 * Math.PI; yaw = 6 * Math.PI * IJ.ease.out(u);
  } else {
    const k = l - CATCH;
    const u = IJ.ease.inOut(IJ.clamp(k / 0.9));
    pose = lerpPose(POSE.star, POSE.arab, u);
    x = 0.03 * Math.sin(k * 1.1) * u;
    y = -0.52 - 0.075 * Math.exp(-k * 4.5) * Math.sin(k * 16) + 0.02 * u;
    phi = 2 * Math.PI - 0.72 * u + 0.04 * Math.sin(k * 1.3) * u;
    yaw = 6 * Math.PI + 0.25 * Math.sin(k * 0.8) * u;
  }
  return skeleton(pose, x, y, phi, yaw);
}
// forward kinematics in a body frame (x: facing, y: up, z: toward the viewer), then spin
// about the body's vertical axis (yaw), roll in the picture plane (phi), and translate.
function skeleton(pose, rx, ry, phi, yaw) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(phi), sp = Math.sin(phi);
  const W = v => {
    const x = v[0] * cy + v[2] * sy, z = -v[0] * sy + v[2] * cy;
    return [rx + x * cp - v[1] * sp, ry + x * sp + v[1] * cp, z];
  };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const dir = ([a, b], len) => [Math.sin(a) * Math.cos(b) * len, -Math.cos(a) * len, Math.sin(a) * Math.sin(b) * len];
  const bend = pose.bend;
  const hip = [0, 0, 0];
  const chest = [Math.sin(bend) * L.torso, Math.cos(bend) * L.torso, 0];
  const neck = add(chest, [Math.sin(bend * 1.6) * L.neck, Math.cos(bend * 1.6) * L.neck, 0]);
  const head = add(neck, [Math.sin(bend * 2) * 0.05 + 0.008, Math.cos(bend * 2) * 0.05, 0]);
  const shN = add(chest, [0, -0.012, 0.05]), shF = add(chest, [0, -0.012, -0.05]);
  const hpN = [0, 0, 0.045], hpF = [0, 0, -0.045];
  const limb = (root, seg, l1, l2) => { const m = add(root, dir(seg[0], l1)); return [m, add(m, dir(seg[1], l2))]; };
  const [elN, wrN] = limb(shN, pose.an, L.upper, L.fore);
  const [elF, wrF] = limb(shF, pose.af, L.upper, L.fore);
  const [knN, anN] = limb(hpN, pose.ln, L.thigh, L.shin);
  const [knF, anF] = limb(hpF, pose.lf, L.thigh, L.shin);
  const toeN = add(anN, dir([pose.ln[1][0] + 0.3, pose.ln[1][1]], L.foot));
  const toeF = add(anF, dir([pose.lf[1][0] + 0.3, pose.lf[1][1]], L.foot));
  const facing = W([1, 0, 0]).map((v, i) => v - W([0, 0, 0])[i]);
  const j = { hip, chest, neck, head, shN, shF, elN, wrN, elF, wrF, hpN, hpF, knN, anN, knF, anF, toeN, toeF };
  const out = {};
  for (const k in j) out[k] = W(j[k]);
  out.facing = facing; out.phi = phi; out.yaw = yaw;
  return out;
}

// --------------------------------------------------------------- ropes ---
function Rope(n) { return { p: new Float32Array(n * 2), q: new Float32Array(n * 2), pin: new Uint8Array(n), n }; }
function resetRope(r, x0, top = RIG[1]) {
  for (let i = 0; i < r.n; i++) {
    let x = x0, y = top - i * SEG;
    if (y < FLOOR) { x = x0 + (FLOOR - y) * (x0 < 0 ? -1 : 1); y = FLOOR; }   // the rest lies on the floor
    r.p[i * 2] = x; r.p[i * 2 + 1] = y; r.q[i * 2] = x; r.q[i * 2 + 1] = y; r.pin[i] = 0;
  }
}
// place nodes along rig -> anchors (taut), let the rest hang
function stepRope(r, rig, anchors, dt, wind) {
  const pts = [rig, ...anchors];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const taut = Math.min(cum[cum.length - 1], (r.n - 6) * SEG);
  for (let i = 0; i < r.n; i++) {
    const s = i * SEG;
    if (s <= taut) {
      let k = 1; while (k < cum.length - 1 && s > cum[k]) k++;
      const u = (s - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
      const x = IJ.lerp(pts[k - 1][0], pts[k][0], u), y = IJ.lerp(pts[k - 1][1], pts[k][1], u);
      r.q[i * 2] = r.pin[i] ? r.p[i * 2] : x; r.q[i * 2 + 1] = r.pin[i] ? r.p[i * 2 + 1] : y;
      r.p[i * 2] = x; r.p[i * 2 + 1] = y; r.pin[i] = 1;
    } else {
      if (r.pin[i]) { r.q[i * 2] = r.p[i * 2]; r.q[i * 2 + 1] = r.p[i * 2 + 1]; }
      r.pin[i] = 0;
      const x = r.p[i * 2], y = r.p[i * 2 + 1];
      const vx = (x - r.q[i * 2]) * 0.988, vy = (y - r.q[i * 2 + 1]) * 0.988;
      r.q[i * 2] = x; r.q[i * 2 + 1] = y;
      r.p[i * 2] = x + vx + wind * dt * dt; r.p[i * 2 + 1] = y + vy - 4.2 * dt * dt;
    }
  }
  for (let it = 0; it < 16; it++) {
    for (let i = 0; i < r.n - 1; i++) {
      const a = i * 2, b = a + 2;
      const dx = r.p[b] - r.p[a], dy = r.p[b + 1] - r.p[a + 1];
      const d = Math.hypot(dx, dy) || 1e-6, diff = (d - SEG) / d;
      const wa = r.pin[i] ? 0 : 0.5, wb = r.pin[i + 1] ? 0 : 0.5;
      const k = (wa && wb) ? 1 : (wa || wb ? 2 : 0);
      r.p[a] += dx * diff * wa * k; r.p[a + 1] += dy * diff * wa * k;
      r.p[b] -= dx * diff * wb * k; r.p[b + 1] -= dy * diff * wb * k;
    }
    // bending stiffness: keep i and i+2 from folding onto each other (fabric, not string)
    for (let i = 0; i < r.n - 2; i++) {
      if (r.pin[i] && r.pin[i + 2]) continue;
      const a = i * 2, c = a + 4;
      const dx = r.p[c] - r.p[a], dy = r.p[c + 1] - r.p[a + 1];
      const d = Math.hypot(dx, dy) || 1e-6, rest = SEG * 1.96;
      if (d >= rest) continue;
      const diff = (d - rest) / d * 0.5;
      const wa = r.pin[i] ? 0 : 1, wc = r.pin[i + 2] ? 0 : 1, sum = wa + wc;
      r.p[a] += dx * diff * wa / sum; r.p[a + 1] += dy * diff * wa / sum;
      r.p[c] -= dx * diff * wc / sum; r.p[c + 1] -= dy * diff * wc / sum;
    }
    for (let i = 0; i < r.n; i++) if (!r.pin[i] && r.p[i * 2 + 1] < FLOOR) { r.p[i * 2 + 1] = FLOOR; r.q[i * 2] = IJ.lerp(r.q[i * 2], r.p[i * 2], 0.5); }
  }
}

// ------------------------------------------------------------- shaders ---
const STAGE_FS = `
in vec2 vUv; out vec4 o;
uniform vec3 uCam; uniform float uT, uGlow;
void main(){
  vec2 p = (2.*gl_FragCoord.xy - uRes)/uRes.y;
  vec2 w = p/uCam.z + uCam.xy;                     // world position
  // velvet curtain in the dark
  float folds = .5 + .5*sin(w.x*9. + sin(w.x*3.)*1.5);
  vec3 c = mix(vec3(.018,.01,.02), vec3(.06,.012,.025), folds*folds) * (1. - .5*smoothstep(0., 1.8, abs(w.x)));
  c *= .6 + .4*smoothstep(-1., 1.2, w.y);
  // floor with a pool of light
  if (w.y < ${FLOOR.toFixed(3)}) {
    float d = length((w - vec2(0., ${FLOOR.toFixed(3)} - .08))*vec2(1., 3.2));
    c = vec3(.025,.02,.025) + vec3(1.,.8,.6)*.5*exp(-d*d*2.2)*uGlow;
    c *= .7 + .3*vnoise(w*vec2(30., 90.));
  }
  o = vec4(c, 1.);
}`;

const BEAM_FS = `
in vec2 vUv; out vec4 o;
uniform vec3 uCam; uniform float uT, uGlow;
void main(){
  vec2 p = (2.*gl_FragCoord.xy - uRes)/uRes.y;
  vec2 w = p/uCam.z + uCam.xy;
  vec2 src = vec2(0., 1.9);
  vec2 d = w - src;
  float ang = abs(atan(d.x, -d.y));
  float cone = smoothstep(.36, .2, ang) * step(d.y, 0.);
  float haze = .55 + .45*fbm(w*vec2(2.2, 1.6) + vec2(uT*.07, uT*.03));
  float fall = exp(-length(d)*.35);
  vec3 c = vec3(1.,.82,.62) * cone * haze * fall * .3 * uGlow;
  c *= smoothstep(${FLOOR.toFixed(3)} - .05, ${FLOOR.toFixed(3)} + .25, w.y) * .7 + .3;
  o = vec4(c, 1.);
}`;

const SILK_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec2 aUV; layout(location=2) in vec3 aX;
uniform float uAspect;
out vec2 vUv; out vec3 vX;
void main(){ vUv = aUV; vX = aX; gl_Position = vec4(aP.x/uAspect, aP.y, 0., 1.); }`;
const SILK_FS = `
in vec2 vUv; in vec3 vX; out vec4 o;
uniform float uShade, uGlow;
void main(){
  float tw = vX.x;
  float facing = abs(cos(tw));
  float fold = .5 + .5*sin(vUv.x*4.7 + tw*2.3);
  vec3 base = vec3(.74,.05,.08);
  vec3 c = base * (.3 + .7*facing) * (.55 + .45*fold);
  float spot = exp(-pow(vX.y/(.28 + max(0., 1.5 - vX.z)*.2), 2.));
  c *= (.2 + .95*spot*uGlow) * uShade;
  c += vec3(1.,.55,.45)*pow(fold*facing, 10.)*.22*spot*uGlow;
  c *= 1. - .4*pow(abs(vUv.x), 3.);
  o = vec4(c, 1.);
}`;

const BODY_FS = `
in vec2 vUv; out vec4 o;
uniform vec2 uJ[20]; uniform float uZ[20];
uniform vec4 uBox; uniform vec2 uFace; uniform float uPx, uGlow;
uniform vec2 uHair[8];
// joint indices
#define HIP 0
#define CHEST 1
#define NECK 2
#define HEAD 3
#define SHN 4
#define SHF 5
#define ELN 6
#define WRN 7
#define ELF 8
#define WRF 9
#define HPN 10
#define HPF 11
#define KNN 12
#define ANN 13
#define KNF 14
#define ANF 15
#define TON 16
#define TOF 17
float mat; float depth;
float cap(vec2 p, int a, int b, float ra, float rb, float m, float d0, inout float best){
  float d = sdCapsule(p, uJ[a], uJ[b], ra, rb);
  if (d < best) { mat = m; depth = (uZ[a] + uZ[b])*.5; }
  best = smin(best, d, .03);
  return d;
}
float body(vec2 p){
  float best = 1e3; mat = 0.; depth = 0.;
  // torso with a waist: hip -> waist -> chest
  vec2 waist = mix(uJ[HIP], uJ[CHEST], .45);
  { float d = sdCapsule(p, uJ[HIP], waist, .057, .043); if (d < best) { mat = 1.; depth = uZ[HIP]; } best = smin(best, d, .03); }
  { float d = sdCapsule(p, waist, uJ[CHEST], .043, .053); if (d < best) { mat = 1.; depth = uZ[CHEST]; } best = smin(best, d, .03); }
  cap(p, CHEST, NECK, .03, .021, 0., 0., best);
  cap(p, SHN, ELN, .027, .02, 0., 0., best);
  cap(p, ELN, WRN, .02, .015, 0., 0., best);
  cap(p, SHF, ELF, .027, .02, 0., 0., best);
  cap(p, ELF, WRF, .02, .015, 0., 0., best);
  cap(p, HPN, KNN, .054, .034, 1., 0., best);
  cap(p, KNN, ANN, .034, .021, 1., 0., best);
  cap(p, HPF, KNF, .054, .034, 1., 0., best);
  cap(p, KNF, ANF, .034, .021, 1., 0., best);
  cap(p, ANN, TON, .019, .01, 0., 0., best);
  cap(p, ANF, TOF, .019, .01, 0., 0., best);
  float hd = length(p - uJ[HEAD]) - .053;
  if (hd < best) { mat = 0.; depth = uZ[HEAD]; }
  best = smin(best, hd, .025);
  // ponytail
  for (int i = 0; i < 7; i++) {
    float d = sdCapsule(p, uHair[i], uHair[i+1], mix(.026, .008, float(i)/7.), mix(.024, .006, float(i+1)/7.));
    if (d < best) { mat = 2.; depth = 0.; }
    best = smin(best, d, .02);
  }
  return best;
}
void main(){
  vec2 p = (2.*gl_FragCoord.xy - uRes)/uRes.y;
  if (p.x < uBox.x || p.y < uBox.y || p.x > uBox.z || p.y > uBox.w) discard;
  float d = body(p);
  float m = mat, dz = depth;
  if (d > uPx*2.) discard;
  vec2 e = vec2(uPx*.7, 0.);
  vec2 g = vec2(body(p + e.xy) - body(p - e.xy), body(p + e.yx) - body(p - e.yx));
  vec2 gd = normalize(g + 1e-6);
  float h = sat(-d/.03);
  vec3 n = normalize(vec3(gd*(1. - h*.7), .35 + h*.8));      // gently rounded
  vec3 L = normalize(vec3(.1, 1., .35));
  float diff = sat(dot(n, L));
  float rim = pow(1. - n.z, 2.) * sat(n.y + .35);
  vec3 skin = vec3(.95,.68,.56), suit = vec3(.08,.38,.42), hair = vec3(.72,.33,.16);
  // hair cap on the back/top of the head
  vec2 hq = p - uJ[HEAD];
  if (m < .5 && length(hq) < .056 && dot(hq, uFace) < .008 && dot(hq, vec2(-uFace.y, uFace.x)*sign(uFace.x + 1e-4)) > -.03) m = 2.;
  if (m < .5 && length(hq) < .056 && dot(normalize(hq), normalize(uJ[HEAD] - uJ[NECK])) > .55) m = 2.;
  vec3 base = m > 1.5 ? hair : (m > .5 ? suit : skin);
  float far = smoothstep(.02, -.04, dz);
  vec3 c = base * (.16 + .6*diff*uGlow) * mix(1., .6, far);
  c += vec3(1.,.8,.6) * rim * 1.5 * uGlow;
  c += base * .3 * sat(n.y) * uGlow;
  float a = fillAA(d, uPx);
  o = vec4(c*a, a);
}`;

// ---------------------------------------------------------------- scene ---
IJ.registerScene({
  name: 'silks', start: START, end: 39, transition: { type: 'fade', dur: 1.2 },
  post(l) { return { bloom: 0.55, grain: 0.045, vignette: 0.55, thresh: 0.55 }; },
  init() {
    this.stage = IJ.program(STAGE_FS, null, 'stage');
    this.beam = IJ.program(BEAM_FS, null, 'beam');
    this.silk = IJ.program(SILK_FS, SILK_VS, 'silk');
    this.body = IJ.program(BODY_FS, null, 'body');
    this.mesh = IJ.Mesh(NODES * 2 * 2 + 8);
    this.motes = IJ.Points(160);
    this.ropes = [Rope(NODES), Rope(NODES)];
    this.hair = Rope(8);
    this.simT = null;
  },
  anchors(l, sk) {
    // strand 0 sits behind her, strand 1 in front
    const mixP = (a, b, u) => [IJ.lerp(a[0], b[0], u), IJ.lerp(a[1], b[1], u)];
    const two = (a, b) => [a, b];
    const climb = [two(sk.wrF, sk.anF), two(sk.wrN, sk.anN)];
    const hips = [two(sk.wrF, sk.hip), two([sk.hip[0] + 0.01, sk.hip[1]], [sk.hip[0] + 0.01, sk.hip[1]])];
    const drop = [two(sk.hip, sk.hip), two(sk.hip, sk.hip)];
    const fin = [two(sk.wrF, sk.hip), two(sk.hip, sk.hip)];
    const blend = (A, B, u) => A.map((s, i) => [mixP(s[0], B[i][0], u), mixP(s[1], B[i][1], u)]);
    let r = climb;
    r = blend(r, hips, IJ.smooth(3.2, 3.9, l));
    r = blend(r, drop, IJ.smooth(6.0, 6.35, l));
    r = blend(r, fin, IJ.smooth(CATCH, CATCH + 0.6, l));
    return r.map(s => s.map(p => [p[0], p[1]]));
  },
  simulate(l) {
    const dt = 1 / 180;
    // deterministic: any jump re-simulates from before the scene starts (~25 ms)
    if (this.simT === null || l < this.simT - 1e-6 || l - this.simT > 1.0) {
      resetRope(this.ropes[0], -0.012); resetRope(this.ropes[1], 0.012);
      const sk = performer(0);
      resetRope(this.hair, sk.head[0], sk.head[1]);
      this.simT = -1.2;
    }
    while (this.simT < l) {
      this.simT += dt;
      const ts = Math.max(0, this.simT);
      const sk = performer(ts);
      const an = this.anchors(ts, sk);
      const wind = 0.25 * Math.sin(ts * 0.7);
      stepRope(this.ropes[0], [RIG[0] - 0.012, RIG[1]], an[0], dt, wind);
      stepRope(this.ropes[1], [RIG[0] + 0.012, RIG[1]], an[1], dt, wind);
      // ponytail: pinned at the back of the head
      const f = sk.facing, hl = Math.hypot(f[0], f[1]) || 1;
      const back = [sk.head[0] - f[0] / hl * 0.04, sk.head[1] - f[1] / hl * 0.04 + 0.01];
      const h = this.hair;
      h.pin[0] = 1; h.p[0] = back[0]; h.p[1] = back[1];
      for (let i = 1; i < h.n; i++) {
        const x = h.p[i * 2], y = h.p[i * 2 + 1];
        const vx = (x - h.q[i * 2]) * 0.96, vy = (y - h.q[i * 2 + 1]) * 0.96;
        h.q[i * 2] = x; h.q[i * 2 + 1] = y;
        h.p[i * 2] = x + vx; h.p[i * 2 + 1] = y + vy - 2.2 * dt * dt;
      }
      for (let it = 0; it < 6; it++) for (let i = 0; i < h.n - 1; i++) {
        const a = i * 2, b = a + 2, dx = h.p[b] - h.p[a], dy = h.p[b + 1] - h.p[a + 1];
        const d = Math.hypot(dx, dy) || 1e-6, diff = (d - 0.028) / d;
        if (i === 0) { h.p[b] -= dx * diff; h.p[b + 1] -= dy * diff; }
        else { h.p[a] += dx * diff * 0.5; h.p[a + 1] += dy * diff * 0.5; h.p[b] -= dx * diff * 0.5; h.p[b + 1] -= dy * diff * 0.5; }
      }
    }
  },
  camera(l) {
    const lag = performer(Math.max(0, l - 0.35));
    const y = lag.hip[1] + IJ.key(l, [[0, 0.12], [3.2, 0.05], [4.5, -0.12], [6.2, -0.1], [8.3, 0.12], [12, 0.12]], IJ.ease.sine);
    const z = IJ.key(l, [[0, 1.55], [3, 1.7], [5.5, 1.8], [6.3, 1.45], [8.3, 1.5], [12, 1.72]], IJ.ease.sine);
    return [0.02, y, z];
  },
  render(t, l) {
    const gl = IJ.gl;
    this.simulate(l);
    const cam = this.camera(l);
    const S = pt => [(pt[0] - cam[0]) * cam[2], (pt[1] - cam[1]) * cam[2]];
    const glow = IJ.smooth(0, 1.5, l) * (1 + 0.35 * Math.exp(-Math.max(0, l - CATCH) * 1.5) * (l > CATCH ? 1 : 0));
    this.stage.draw({ uCam: cam, uT: t, uGlow: glow });

    // silks
    const drawRope = (r, shade) => {
      const M = this.mesh; M.clear();
      for (let i = 0; i < r.n; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(r.n - 1, i + 1);
        let tx = r.p[i1 * 2] - r.p[i0 * 2], ty = r.p[i1 * 2 + 1] - r.p[i0 * 2 + 1];
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const tw = i * 0.33 + t * 0.9 + shade * 2;
        const w = 0.026 * (0.45 + 0.55 * Math.abs(Math.cos(tw))) * cam[2];
        const [sx, sy] = S([r.p[i * 2], r.p[i * 2 + 1]]);
        M.v(sx - ty * w, sy + tx * w, 0, -1, i / r.n, tw, r.p[i * 2], r.p[i * 2 + 1]);
        M.v(sx + ty * w, sy - tx * w, 0, 1, i / r.n, tw, r.p[i * 2], r.p[i * 2 + 1]);
      }
      M.upload();
      IJ.blend(null);
      this.silk.use().set({ uAspect: IJ.aspect(), uShade: shade, uGlow: glow });
      M.draw(gl.TRIANGLE_STRIP);
    };
    drawRope(this.ropes[0], 0.75);
    drawRope(this.ropes[1], 1.0);

    // her
    const sk = performer(l);
    const order = ['hip', 'chest', 'neck', 'head', 'shN', 'shF', 'elN', 'wrN', 'elF', 'wrF', 'hpN', 'hpF', 'knN', 'anN', 'knF', 'anF', 'toeN', 'toeF'];
    const J = new Float32Array(40), Z = new Float32Array(20);
    let x0 = 9, y0 = 9, x1 = -9, y1 = -9;
    order.forEach((k, i) => {
      const s = S(sk[k]); J[i * 2] = s[0]; J[i * 2 + 1] = s[1]; Z[i] = sk[k][2];
      x0 = Math.min(x0, s[0]); y0 = Math.min(y0, s[1]); x1 = Math.max(x1, s[0]); y1 = Math.max(y1, s[1]);
    });
    const H = new Float32Array(16);
    for (let i = 0; i < 8; i++) {
      const s = S([this.hair.p[i * 2], this.hair.p[i * 2 + 1]]); H[i * 2] = s[0]; H[i * 2 + 1] = s[1];
      x0 = Math.min(x0, s[0]); y0 = Math.min(y0, s[1]); x1 = Math.max(x1, s[0]); y1 = Math.max(y1, s[1]);
    }
    const fl = Math.hypot(sk.facing[0], sk.facing[1]) || 1;
    IJ.blend('premult');
    this.body.draw({ uJ: J, uZ: Z, uHair: H, uBox: [x0 - 0.1, y0 - 0.1, x1 + 0.1, y1 + 0.1], uFace: [sk.facing[0] / fl, sk.facing[1] / fl], uPx: 2 / IJ.curH, uGlow: glow });

    // light in the haze, and dust drifting through it
    IJ.blend('add');
    this.beam.draw({ uCam: cam, uT: t, uGlow: glow });
    const M = this.motes; M.clear();
    const R = IJ.rng(4242);
    for (let i = 0; i < 150; i++) {
      const bx = (R() - 0.5) * 1.6, by = R() * 2.6 - 1.0, sp = 0.02 + R() * 0.05, ph = R() * 6.28;
      const wx = bx + 0.08 * Math.sin(t * 0.3 + ph), wy = ((by - t * sp + 10) % 2.6) - 1.0;
      const inCone = Math.max(0, 1 - Math.abs(wx) / (0.25 + (1.9 - wy) * 0.2));
      if (inCone <= 0) continue;
      const [sx, sy] = S([wx, wy]);
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + ph * 3);
      M.add(sx, sy, 0, 0.0025 + R() * 0.002, 1, 0.85, 0.65, inCone * tw * 0.8 * glow, 0.8, 0);
    }
    M.draw();
  },
});
})();
