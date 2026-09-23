// INFINITE JESS — the projector: timeline, transitions, post, transport, controls.
(function () {
'use strict';
const IJ = window.IJ;
const FILM_LEN = 90;
const params = new URLSearchParams(location.search);

let gl, canvas, W = 0, H = 0;
let resScale = 1;                 // lowered automatically on slower GPUs
let rtA, rtB, rtComp, bloomH, bloomQ1, bloomQ2, bloomE1, bloomE2;
let progComp, progBright, progBlur, progFinal;

// --------------------------------------------------------------- shaders ---
const COMP_FS = `
in vec2 vUv; out vec4 o;
uniform sampler2D uA, uB; uniform float uP; uniform int uType;
vec3 sampleA(vec2 uv){ return texture(uA, uv).rgb; }
void main(){
  vec2 uv = vUv; float p = clamp(uP, 0., 1.);
  vec3 a, b = texture(uB, uv).rgb, c;
  if (uType == 0) { a = sampleA(uv); c = mix(a, b, smoothstep(0.,1.,p)); }
  else if (uType == 1 || uType == 2) {
    vec3 mid = uType == 1 ? vec3(1.,.98,.94)*1.4 : vec3(0.);
    a = sampleA(uv);
    c = p < .5 ? mix(a, mid, smoothstep(0.,1.,p*2.)) : mix(mid, b, smoothstep(0.,1.,p*2.-1.));
  } else if (uType == 3) {
    a = sampleA(uv);
    float n = fbm(uv*vec2(uRes.x/uRes.y,1.)*3.5) * .8 + fbm(uv*18.)*.2;
    float e = p*1.25 - .12;
    float m = smoothstep(e-.08, e+.02, n);
    float edge = smoothstep(.12, 0., abs(n - e + .03));
    c = mix(b, a, m) * (1. - .35*edge*(1.-abs(p-.5)*2.));
  } else if (uType == 4) {
    float blocks = floor(uv.y*24.) + floor(uTime*20.)*7.;
    float r = hash11(blocks);
    float g = sin(p*PI);
    vec2 off = vec2((r-.5)*.25*g*step(.55, r), 0.);
    float sw = step(r*.8+.1, p);
    vec2 uv2 = uv + off;
    a = vec3(texture(uA, uv2+vec2(.012*g,0)).r, texture(uA, uv2).g, texture(uA, uv2-vec2(.012*g,0)).b);
    vec3 bb = vec3(texture(uB, uv2+vec2(.012*g,0)).r, texture(uB, uv2).g, texture(uB, uv2-vec2(.012*g,0)).b);
    c = mix(a, bb, sw);
    c += g*.15*step(.93, hash12(floor(uv*vec2(60.,40.)) + floor(uTime*30.)));
  } else if (uType == 5) {
    vec2 q = (uv-.5)*vec2(uRes.x/uRes.y,1.);
    float r = p < .5 ? mix(1.2, 0., smoothstep(0.,1.,p*2.)) : mix(0., 1.2, smoothstep(0.,1.,p*2.-1.));
    float inside = 1. - smoothstep(r-.004, r+.004, length(q));
    a = sampleA(uv);
    c = (p < .5 ? a : b) * inside;
  } else {
    // zoom-through: A pushes in with radial smear, B emerges
    vec2 d = uv - .5; vec3 acc = vec3(0.);
    float z = 1. + p*p*6.;
    for (int i=0;i<10;i++){ float k = float(i)/10.; acc += texture(uA, .5 + d/(z*(1.+k*p*.35))).rgb; }
    a = acc/10.;
    c = mix(a, b, smoothstep(.45, 1., p));
  }
  o = vec4(c, 1.);
}`;

const BRIGHT_FS = `
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThresh;
void main(){
  vec3 c = vec3(0.);
  c += texture(uTex, vUv + uTexel*vec2(-.5,-.5)).rgb; c += texture(uTex, vUv + uTexel*vec2(.5,-.5)).rgb;
  c += texture(uTex, vUv + uTexel*vec2(-.5,.5)).rgb;  c += texture(uTex, vUv + uTexel*vec2(.5,.5)).rgb;
  c *= .25;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThresh, uThresh + .35, l);
  o = vec4(c*k, 1.);
}`;

const BLUR_FS = `
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uDir;
void main(){
  vec3 c = texture(uTex, vUv).rgb * .2270270270;
  c += texture(uTex, vUv + uDir*1.3846153846).rgb * .3162162162;
  c += texture(uTex, vUv - uDir*1.3846153846).rgb * .3162162162;
  c += texture(uTex, vUv + uDir*3.2307692308).rgb * .0702702703;
  c += texture(uTex, vUv - uDir*3.2307692308).rgb * .0702702703;
  o = vec4(c, 1.);
}`;

const FINAL_FS = `
in vec2 vUv; out vec4 o;
uniform sampler2D uScene, uB1, uB2; uniform float uBloom, uGrain, uVig, uFade, uSeed;
void main(){
  vec3 c = texture(uScene, vUv).rgb;
  vec3 b = texture(uB1, vUv).rgb*.7 + texture(uB2, vUv).rgb*.9;
  c += b*uBloom;
  float k = .82; vec3 over = max(c-k, 0.);
  c = min(c, vec3(k)) + (1.-k)*(1.-exp(-over/(1.-k)));
  vec2 q = (vUv-.5)*vec2(uRes.x/uRes.y, 1.);
  c *= mix(1., smoothstep(1.25, .25, length(q)), uVig);
  float g = hash12(vUv*uRes + uSeed*113.1) + hash12(vUv*uRes*1.37 - uSeed*71.7) - 1.;
  c += g*uGrain*(.6 + .4*luma(c));
  c += (hash12(vUv*uRes + 3.7) - .5)/255.;
  o = vec4(max(c,0.)*uFade, 1.);
}`;

// ------------------------------------------------------------- sizing ---
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  let cw = vw, ch = vw * 9 / 16;
  if (ch > vh) { ch = vh; cw = vh * 16 / 9; }
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cap = +params.get('res') || 1920;
  const w = Math.round(Math.min(cw * dpr, cap) * resScale), h = Math.round(w * 9 / 16);
  if (w === W && h === H) return;
  W = w; H = h;
  canvas.width = W; canvas.height = H;
  IJ.W = W; IJ.H = H;
  for (const r of [rtA, rtB, rtComp, bloomH, bloomQ1, bloomQ2, bloomE1, bloomE2]) if (r) r.dispose();
  rtA = IJ.fbo(W, H, { depth: true });
  rtB = IJ.fbo(W, H, { depth: true });
  rtComp = IJ.fbo(W, H);
  bloomH = IJ.fbo(W >> 1, H >> 1);
  bloomQ1 = IJ.fbo(W >> 2, H >> 2); bloomQ2 = IJ.fbo(W >> 2, H >> 2);
  bloomE1 = IJ.fbo(W >> 3, H >> 3); bloomE2 = IJ.fbo(W >> 3, H >> 3);
  for (const s of IJ.scenes) if (s.resize) s.resize(W, H);
  if (!playing) renderFrame(filmTime);
}

// --------------------------------------------------------- scene lookup ---
function sceneState(t) {
  const S = IJ.scenes;
  for (let i = 0; i < S.length - 1; i++) {
    const next = S[i + 1], tr = next.transition;
    if (tr) {
      const at = next.start, a = at - tr.dur / 2, b = at + tr.dur / 2;
      if (t >= a && t < b) return { A: S[i], B: next, p: (t - a) / tr.dur, type: tr.type };
    }
  }
  for (let i = S.length - 1; i >= 0; i--) if (t >= S[i].start) return { A: S[i] };
  return { A: S[0] };
}
const TYPES = { fade: 0, white: 1, black: 2, dissolve: 3, glitch: 4, iris: 5, zoom: 6 };

function postOf(s, local) {
  const d = { bloom: 0.25, grain: 0.035, vignette: 0.35, thresh: 0.75 };
  const p = typeof s.post === 'function' ? s.post(local) : s.post;
  return Object.assign(d, p || {});
}

function drawScene(s, t, rt) {
  rt.bind();
  IJ.target = rt;
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  IJ.blend(null);
  const local = t - s.start;
  s.render(t, local, s.end - s.start);
  gl.disable(gl.DEPTH_TEST);
  IJ.blend(null);
}

let frameSeed = 0;
function renderFrame(t) {
  if (!W) return;
  IJ.time = t;
  const st = sceneState(t);
  let src = rtA;
  drawScene(st.A, t, rtA);
  let post = postOf(st.A, t - st.A.start);
  if (st.B) {
    drawScene(st.B, t, rtB);
    rtComp.bind();
    progComp.draw({ uA: rtA.tex, uB: rtB.tex, uP: st.p, uType: TYPES[st.type] || 0 });
    src = rtComp;
    const pb = postOf(st.B, t - st.B.start), k = st.p;
    post = { bloom: IJ.lerp(post.bloom, pb.bloom, k), grain: IJ.lerp(post.grain, pb.grain, k), vignette: IJ.lerp(post.vignette, pb.vignette, k), thresh: IJ.lerp(post.thresh, pb.thresh, k) };
  }
  // bloom chain
  bloomH.bind(); progBright.draw({ uTex: src.tex, uTexel: [1 / W, 1 / H], uThresh: post.thresh });
  bloomQ1.bind(); progBlur.draw({ uTex: bloomH.tex, uDir: [2 / W, 0] });
  bloomQ2.bind(); progBlur.draw({ uTex: bloomQ1.tex, uDir: [0, 4 / H] });
  bloomQ1.bind(); progBlur.draw({ uTex: bloomQ2.tex, uDir: [4 / W, 0] });
  bloomQ2.bind(); progBlur.draw({ uTex: bloomQ1.tex, uDir: [0, 4 / H] });
  bloomE1.bind(); progBlur.draw({ uTex: bloomQ2.tex, uDir: [8 / W, 0] });
  bloomE2.bind(); progBlur.draw({ uTex: bloomE1.tex, uDir: [0, 8 / H] });
  bloomE1.bind(); progBlur.draw({ uTex: bloomE2.tex, uDir: [12 / W, 0] });
  bloomE2.bind(); progBlur.draw({ uTex: bloomE1.tex, uDir: [0, 12 / H] });
  // final
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, H); IJ.curW = W; IJ.curH = H;
  let fade = 1;
  if (t < 0.05) fade = 0;
  progFinal.draw({ uScene: src.tex, uB1: bloomQ2.tex, uB2: bloomE2.tex, uBloom: post.bloom, uGrain: post.grain, uVig: post.vignette, uFade: fade, uSeed: (frameSeed++ % 97) });
}

// ------------------------------------------------------------ transport ---
let playing = false, filmTime = 0, wallStart = 0, wallOffset = 0, audioReady = false;
const audio = () => IJ.audio;

function now() {
  if (!playing) return filmTime;
  if (audioReady && audio().playing()) {
    const t = audio().time();
    if (t < audio().duration() - 0.05) return t;
  }
  return wallOffset + (performance.now() - wallStart) / 1000;
}
function play(from) {
  if (from != null) filmTime = from;
  if (filmTime >= FILM_LEN + 20) filmTime = 0;
  playing = true;
  wallStart = performance.now(); wallOffset = filmTime;
  if (audioReady && filmTime < audio().duration()) audio().play(filmTime);
  document.body.classList.add('playing');
}
function pause() {
  filmTime = now();
  playing = false;
  if (audioReady) audio().stop();
  document.body.classList.remove('playing');
}
function seek(t) {
  const was = playing;
  if (playing) pause();
  filmTime = Math.max(0, t);
  if (was) play(); else renderFrame(filmTime);
}

let lastT = -1, fpsAcc = 0, fpsN = 0, fpsShown = 0, lastWall = performance.now();
function loop() {
  requestAnimationFrame(loop);
  if (!playing) return;
  const t = now();
  // keep wall clock aligned to the audio clock when it is available
  if (audioReady && audio().playing()) { wallOffset = t; wallStart = performance.now(); }
  filmTime = t;
  renderFrame(t);
  const w = performance.now(), dt = w - lastWall; fpsAcc += dt; fpsN++; lastWall = w;
  if (fpsN >= 30) { fpsShown = 1000 / (fpsAcc / fpsN); fpsAcc = 0; fpsN = 0; }
  adapt(dt);
  updateUI(t);
  lastT = t;
}

// Keep the film smooth on slower machines: if frames run long for a while, render
// fewer pixels (bloom and grain hide the difference); recover when there's headroom.
let ema = 16.7, slowFor = 0, fastFor = 0, lastAdapt = 0;
function adapt(dt) {
  if (dt > 250) return;                               // tab switch / seek, not a real frame
  ema = ema * 0.94 + dt * 0.06;
  const now = performance.now();
  slowFor = ema > 23 ? slowFor + dt : 0;
  fastFor = ema < 14 ? fastFor + dt : 0;
  if (now - lastAdapt < 2500) return;
  if (slowFor > 1200 && resScale > 0.55) { resScale = Math.max(0.55, resScale * 0.84); lastAdapt = now; slowFor = 0; resize(); ema = 16.7; }
  else if (fastFor > 5000 && resScale < 1) { resScale = Math.min(1, resScale * 1.12); lastAdapt = now; fastFor = 0; resize(); ema = 16.7; }
}

// ------------------------------------------------------------------- UI ---
let barEl, progEl, dbgEl;
function updateUI(t) {
  if (progEl) progEl.style.width = (Math.min(1, t / FILM_LEN) * 100).toFixed(2) + '%';
  if (dbgEl) dbgEl.textContent = `t=${t.toFixed(2)}  ${sceneState(t).A.name}  ${fpsShown.toFixed(0)} fps  ${W}x${H}`;
}

function start() {
  canvas = document.getElementById('film');
  gl = IJ.initGL(canvas);
  progComp = IJ.program(COMP_FS, null, 'comp');
  progBright = IJ.program(BRIGHT_FS, null, 'bright');
  progBlur = IJ.program(BLUR_FS, null, 'blur');
  progFinal = IJ.program(FINAL_FS, null, 'final');
  IJ.scenes.sort((a, b) => a.start - b.start);
  for (const s of IJ.scenes) if (s.init) s.init(gl);
  resize();
  window.addEventListener('resize', resize);

  barEl = document.getElementById('bar'); progEl = document.getElementById('prog');
  if (params.has('debug')) { dbgEl = document.getElementById('dbg'); dbgEl.style.display = 'block'; }

  const t0 = params.has('t') ? +params.get('t') : 0;
  filmTime = t0;
  renderFrame(t0);
  updateUI(t0);
  requestAnimationFrame(loop);

  const overlay = document.getElementById('overlay');
  const status = document.getElementById('status');
  const begin = () => {
    if (overlay.classList.contains('gone')) return;
    overlay.classList.add('gone');
    if (IJ.audio) IJ.audio.unlock();
    play(filmTime);
  };
  if (params.has('still')) overlay.classList.add('gone');

  // Render the score offline (it's all synthesis), then enable the play button.
  const ready = () => { document.body.classList.add('ready'); status.textContent = 'sound on · click anywhere'; };
  if (IJ.audio && !params.has('mute')) {
    IJ.audio.render().then(() => { audioReady = true; ready(); })
      .catch(e => { console.warn('audio unavailable', e); ready(); });
  } else ready();

  overlay.addEventListener('click', () => { if (document.body.classList.contains('ready')) begin(); });
  canvas.addEventListener('click', () => {
    if (!overlay.classList.contains('gone')) return;
    if (filmTime >= FILM_LEN + 1.5) { seek(0); play(0); return; }
    playing ? pause() : play();
  });
  barEl.addEventListener('click', e => {
    const r = barEl.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * FILM_LEN);
    updateUI(filmTime);
  });
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); if (!overlay.classList.contains('gone')) { if (document.body.classList.contains('ready')) begin(); return; } playing ? pause() : play(); }
    else if (e.code === 'ArrowRight') { seek(now() + 5); updateUI(filmTime); }
    else if (e.code === 'ArrowLeft') { seek(now() - 5); updateUI(filmTime); }
    else if (e.code === 'KeyR') { seek(0); if (!playing) play(0); }
    else if (e.code === 'KeyF') { (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}); }
  });
  let hideTimer = 0;
  window.addEventListener('mousemove', () => {
    document.body.classList.add('mouse');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => document.body.classList.remove('mouse'), 1800);
  });
}

IJ.film = { start, seek, play, pause, render: renderFrame, get time() { return filmTime; }, get playing() { return playing; }, LENGTH: FILM_LEN, sceneState };
window.film = IJ.film;
window.addEventListener('DOMContentLoaded', () => {
  try { start(); }
  catch (e) {
    console.error(e);
    const s = document.getElementById('status');
    if (s) s.textContent = 'This film needs WebGL2 — ' + e.message;
  }
});
})();
