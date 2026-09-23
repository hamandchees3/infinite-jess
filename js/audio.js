// INFINITE JESS — the score. Every sound is synthesized with Web Audio nodes and
// rendered once through an OfflineAudioContext; the film then plays that buffer and
// uses its clock as the master clock. D major, 80 BPM, one bar = 3 s.
(function () {
'use strict';
const IJ = window.IJ;
const SR = 44100, LEN = 95;
const BEAT = 0.75, BAR = 3;
const T = (bar, beat = 0) => bar * BAR + beat * BEAT;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const NOTE = {};
['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((n, i) => { for (let o = 0; o < 9; o++) NOTE[n + o] = 12 * (o + 1) + i; });
const n = s => NOTE[s];

// Shared cue sheet: the picture is timed to these moments.
const CUES = IJ.CUES = {
  crtOn: 0.65, staticStart: 1.1, tune: 2.3, card: 3.0, push: 5.1,
  titleIn: 7.6,
  freckleGlow: 19.6, freckleLift: 21.2, constellations: [22.4, 22.9, 23.4, 23.9, 24.4, 24.9, 25.4],
  silksInvert: 30.4, silksDrop: 33.3, silksCatch: 35.3,
  catFlop: 42.3, catMrrp: 42.85, yuffieZap: 44.1, zoomies: 44.35, zoomEnd: 45.9, headbump: 46.5,
  heartLaunch: 49.4, encrypt: 50.6, decrypt: 52.6, heartForm: 54.2, heartArrive: 55.8,
  chalkAxes: 57.4, chalkDots: 58.9, dieRoll: 61.2, learn: 62.4, merge: 66.2, bell: 67.1,
  duskWash: 69.0, treesGrow: 71.0, blossom: 75.3,
  ribbonInf: 81.6, ribbonJess: 84.4, signoff: 87.3,
};

const CH = {
  D: [38, 50, 54, 57, 62], Dmaj9: [50, 57, 61, 64, 66], DF: [42, 50, 57, 61, 64],
  Bm7: [47, 54, 57, 62, 66], Bm9: [47, 54, 57, 61, 62], Bm: [47, 54, 59, 62, 66],
  Gmaj7: [43, 50, 54, 59, 62], Gmaj9: [43, 50, 57, 59, 66], G: [43, 50, 55, 59, 62],
  Fsm7: [42, 49, 52, 57, 61], Em9: [40, 47, 54, 55, 59], Em7: [40, 47, 50, 55, 59],
  A: [45, 52, 57, 61, 64], Asus4: [45, 52, 57, 62, 64], A7: [45, 52, 55, 61, 64], AC: [49, 52, 57, 61, 64],
  Dadd9: [38, 50, 57, 62, 64, 66],
};

// ------------------------------------------------------------ synthesis ---
function buildScore(ctx, W0 = 0, W1 = 1e9) {
  // Only events that START inside [W0, W1) are scheduled, shifted by -W0 (chunked rendering).
  const win = fn => (t, ...a) => { if (t < W0 || t >= W1) return; return fn(t - W0, ...a); };
  // noise source material
  const noiseBuf = ctx.createBuffer(1, SR * 3, SR);
  { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const R = IJ.rng(20260923);

  // ---- master chain
  const master = ctx.createGain(); master.gain.value = 0.9;
  master.connect(ctx.destination);

  // generated room: stereo decaying noise, progressively darker
  const verb = ctx.createConvolver();
  {
    const len = SR * 2.8, ir = ctx.createBuffer(2, len, SR);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const k = 0.85 - 0.75 * t; // damping rises over time
        lp = lp + k * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - t, 3.2) * (i < SR * 0.012 ? i / (SR * 0.012) : 1);
      }
    }
    verb.buffer = ir;
  }
  const verbOut = ctx.createGain(); verbOut.gain.value = 0.55;
  verb.connect(verbOut); verbOut.connect(master);

  // ping-pong delay (dotted eighth)
  const dl = ctx.createDelay(2), dr = ctx.createDelay(2), fb = ctx.createGain(), dIn = ctx.createGain();
  dl.delayTime.value = BEAT * 0.75; dr.delayTime.value = BEAT * 0.75; fb.gain.value = 0.42;
  const pl = ctx.createStereoPanner(), pr = ctx.createStereoPanner(); pl.pan.value = -0.7; pr.pan.value = 0.7;
  const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3200;
  dIn.connect(dl); dl.connect(pl); pl.connect(master); dl.connect(dr); dr.connect(pr); pr.connect(master); dr.connect(dlp); dlp.connect(fb); fb.connect(dl);
  pl.connect(verb); // a little of the echoes in the room

  function bus(gain, send = 0.2, pan = 0, delaySend = 0, lfo = null) {
    const g = ctx.createGain(); g.gain.value = gain;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    if (lfo) { const d = ctx.createDelay(0.1); d.delayTime.value = 0.02; lfo.connect(d.delayTime); g.connect(d); d.connect(p); }
    else g.connect(p);
    p.connect(master);
    if (send) { const s = ctx.createGain(); s.gain.value = send; p.connect(s); s.connect(verb); }
    if (delaySend) { const s = ctx.createGain(); s.gain.value = delaySend; p.connect(s); s.connect(dIn); }
    return g;
  }

  // vibrato (strings, lead) and tape wow (cartridge) as delay-time modulation
  const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
  const vibG = ctx.createGain(); vibG.gain.value = 0.00013; vib.connect(vibG); vib.start(0);
  const wow = ctx.createOscillator(); wow.frequency.value = 0.9;
  const wowG = ctx.createGain(); wowG.gain.value = 0.0016; wow.connect(wowG); wow.start(0);

  const osc = (type, f, t0, t1) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(t0); o.stop(t1); return o; };
  const gainNode = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const noiseSrc = (t0, t1, rate = 1) => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rate;
    s.start(t0, R() * 2.5); s.stop(t1); return s;
  };

  // ---- instruments
  function _epiano(t, m, dur, vel, dst) {
    const f = mtof(m), end = t + dur + 1.6;
    const c = osc('sine', f, t, end), md = osc('sine', f, t, end);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * (0.6 + 1.6 * vel), t); mg.gain.setTargetAtTime(f * 0.12, t, 0.3);
    md.connect(mg); mg.connect(c.frequency);
    const tine = osc('sine', f * 4.01, t, t + 0.6), tg = ctx.createGain();
    tg.gain.setValueAtTime(vel * 0.03, t); tg.gain.setTargetAtTime(0, t, 0.05);
    const g = ctx.createGain();
    const tc = 0.9 * Math.max(0.35, 1.4 - (m - 48) / 40);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.2, t + 0.004);
    g.gain.setTargetAtTime(vel * 0.05, t + 0.004, tc); g.gain.setTargetAtTime(0, t + dur, 0.18);
    c.connect(g); tine.connect(tg); tg.connect(dst); g.connect(dst);
  }
  function _pad(t, m, dur, vel, dst, o = {}) {
    const f = mtof(m), att = o.att || 1.4, rel = o.rel || 2.2, end = t + dur + rel * 1.6;
    const lp = filt('lowpass', o.cut || 1300, 0.6);
    if (o.sweep) { lp.frequency.setValueAtTime(o.cut * 0.4, t); lp.frequency.linearRampToValueAtTime(o.cut, t + dur * 0.7); }
    for (const d of [-9, 8]) { const x = osc('sawtooth', f, t, end); x.detune.value = d; x.connect(lp); }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.037, t + att);
    g.gain.setValueAtTime(vel * 0.037, t + dur); g.gain.setTargetAtTime(0, t + dur, rel / 3);
    lp.connect(g); g.connect(dst);
  }
  function _chime(t, m, vel, dst, partials = [[1, 1, 0.9], [3.0, 0.28, 0.25], [5.8, 0.12, 0.12]], wobble = false) {
    const f = mtof(m);
    for (const [r, a, tc] of partials) {
      if (f * r > 16000) continue;
      const x = osc('sine', f * r, t, t + tc * 7 + 0.1), g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * a * 0.16, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, tc);
      x.connect(g); g.connect(dst);
    }
  }
  const _celesta = (t, m, vel, dst) => _chime(t, m, vel, dst, [[1, 1, 0.7], [4.0, 0.25, 0.12], [10.1, 0.06, 0.04]]);
  const _musicbox = (t, m, vel, dst) => _chime(t, m, vel, dst, [[1, 1, 0.8], [3.0, 0.3, 0.3], [5.9, 0.15, 0.1]], true);
  function _bell(t, m, vel, dst, dur = 3) {
    const f = mtof(m), end = t + dur * 2;
    const c = osc('sine', f, t, end), md = osc('sine', f * 3.5, t, end), mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 2.2 * vel, t); mg.gain.setTargetAtTime(f * 0.1, t, dur * 0.25);
    md.connect(mg); mg.connect(c.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.13, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, dur * 0.35);
    c.connect(g); g.connect(dst);
  }
  function _marimba(t, m, vel, dst) {
    const f = mtof(m);
    const a = osc('sine', f, t, t + 1.2), b = osc('sine', f * 3.93, t, t + 0.2);
    const ga = ctx.createGain(), gb = ctx.createGain();
    ga.gain.setValueAtTime(0, t); ga.gain.linearRampToValueAtTime(vel * 0.22, t + 0.002); ga.gain.setTargetAtTime(0, t + 0.002, 0.22);
    gb.gain.setValueAtTime(vel * 0.08, t); gb.gain.setTargetAtTime(0, t, 0.025);
    a.connect(ga); b.connect(gb); ga.connect(dst); gb.connect(dst);
  }
  function _pizz(t, m, vel, dst) {
    const f = mtof(m);
    const x = osc('triangle', f, t, t + 0.8), y = osc('sawtooth', f, t, t + 0.8);
    const lp = filt('lowpass', 3000, 2); lp.frequency.setValueAtTime(3200, t); lp.frequency.setTargetAtTime(350, t, 0.05);
    const yg = gainNode(0.35);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.3, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, 0.13);
    x.connect(lp); y.connect(yg); yg.connect(lp); lp.connect(g); g.connect(dst);
  }
  function _bass(t, m, dur, vel, dst) {
    const f = mtof(m), end = t + dur + 1;
    const x = osc('sine', f, t, end), y = osc('triangle', f, t, end), lp = filt('lowpass', 500);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.3, t + 0.01);
    g.gain.setTargetAtTime(vel * 0.16, t + 0.01, 0.6); g.gain.setTargetAtTime(0, t + dur, 0.12);
    const yg = gainNode(0.5); x.connect(g); y.connect(yg); yg.connect(lp); lp.connect(g); g.connect(dst);
  }
  function _arp(t, m, vel, dst, len = 0.16) {
    const f = mtof(m);
    const x = osc('sawtooth', f, t, t + len + 0.4), y = osc('square', f * 0.5, t, t + len + 0.4);
    const lp = filt('lowpass', 4000, 7); lp.frequency.setValueAtTime(4200, t); lp.frequency.setTargetAtTime(420, t, 0.06);
    const yg = gainNode(0.3);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.14, t + 0.003); g.gain.setTargetAtTime(0, t + len * 0.5, 0.06);
    x.connect(lp); y.connect(yg); yg.connect(lp); lp.connect(g); g.connect(dst);
  }
  function _lead(t, m, dur, vel, dst) {
    const f = mtof(m), end = t + dur + 1;
    const x = osc('square', f, t, end);
    const x2 = osc('sawtooth', f * 1.003, t, end);
    const lp = filt('lowpass', 2400, 1.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.07, t + 0.03);
    g.gain.setValueAtTime(vel * 0.07, t + dur); g.gain.setTargetAtTime(0, t + dur, 0.12);
    x.connect(lp); x2.connect(lp); lp.connect(g); g.connect(dst);
  }
  // ---- noise and effects
  function _noiseHit(t, dur, o, dst) {
    const s = noiseSrc(t, t + dur + (o.rel || 0.3) * 5, o.rate || 1);
    const f = filt(o.type || 'bandpass', o.f0 || 1000, o.q || 1);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    const g = ctx.createGain(); const pk = o.gain || 0.2;
    g.gain.setValueAtTime(0, t);
    if (o.swell) { g.gain.linearRampToValueAtTime(pk * 0.02, t + 0.01); g.gain.exponentialRampToValueAtTime(pk, t + dur); g.gain.setTargetAtTime(0, t + dur, o.rel || 0.05); }
    else { g.gain.linearRampToValueAtTime(pk, t + (o.att || 0.005)); g.gain.setTargetAtTime(0, t + (o.att || 0.005), o.rel || dur / 3); }
    let node = g;
    if (o.pan != null) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p); node = p; }
    if (o.panTo != null) { const p = ctx.createStereoPanner(); p.pan.setValueAtTime(o.pan || 0, t); p.pan.linearRampToValueAtTime(o.panTo, t + dur); g.connect(p); node = p; }
    s.connect(f); f.connect(g); node.connect(dst);
    return g;
  }
  const _whoosh = (t, dur, f0, f1, gain, dst, pan, panTo) => _noiseHit(t, dur, { f0, f1, q: 1.4, gain, swell: true, rel: 0.12, pan, panTo }, dst);
  function _sweep(t, dur, f0, f1, gain, dst, type = 'sine') {
    const x = osc(type, f0, t, t + dur + 0.3); x.frequency.setValueAtTime(f0, t); x.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.02); g.gain.setValueAtTime(gain, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
    x.connect(g); g.connect(dst); return x;
  }
  function _boom(t, vel, dst) {
    const x = osc('sine', 80, t, t + 2.5); x.frequency.setValueAtTime(90, t); x.frequency.exponentialRampToValueAtTime(38, t + 0.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.006); g.gain.setTargetAtTime(0, t + 0.006, 0.45);
    x.connect(g); g.connect(dst);
    _noiseHit(t, 0.4, { type: 'lowpass', f0: 300, gain: vel * 0.25, rel: 0.12 }, dst);
  }
  function _mrrp(t, pitch, dur, vel, dst) {
    const x = osc('sawtooth', 420 * pitch, t, t + dur + 0.2);
    x.frequency.setValueAtTime(380 * pitch, t);
    x.frequency.linearRampToValueAtTime(640 * pitch, t + dur * 0.4);
    x.frequency.linearRampToValueAtTime(470 * pitch, t + dur);
    const am = ctx.createGain(); am.gain.value = 0.65;
    const trill = osc('sine', 27, t, t + dur), tg = ctx.createGain();
    tg.gain.setValueAtTime(0.45, t); tg.gain.linearRampToValueAtTime(0.0, t + dur * 0.55);
    trill.connect(tg); tg.connect(am.gain);
    const sum = ctx.createGain();
    const fs = [[700, 5, 1], [1500, 7, 0.6], [2900, 9, 0.25]];
    x.connect(am);
    for (const [ff, q, a] of fs) {
      const b = filt('bandpass', ff, q);
      b.frequency.setValueAtTime(ff * 0.8, t); b.frequency.linearRampToValueAtTime(ff * 1.25, t + dur * 0.45); b.frequency.linearRampToValueAtTime(ff, t + dur);
      const bg = gainNode(a * 1.6); am.connect(b); b.connect(bg); bg.connect(sum);
    }
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.04);
    g.gain.setValueAtTime(vel, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
    sum.connect(g); g.connect(dst);
  }
  function _slide(t, f0, f1, dur, vel, dst) {
    const x = osc('sine', f0, t, t + dur + 0.1); x.frequency.setValueAtTime(f0, t); x.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.03); g.gain.setValueAtTime(vel, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur);
    x.connect(g); g.connect(dst);
  }
  function _tap(t, vel, dst, f = 2600) {
    _noiseHit(t, 0.02, { type: 'bandpass', f0: f, q: 1.2, gain: vel * 0.35, rel: 0.012 }, dst);
    const x = osc('sine', 1100 + R() * 300, t, t + 0.06), g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.06, t); g.gain.setTargetAtTime(0, t, 0.01); x.connect(g); g.connect(dst);
  }
  function _scratch(t, dur, vel, dst) {
    const s = noiseSrc(t, t + dur + 0.1);
    const f = filt('bandpass', 3400, 1.8);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    for (let k = 0; k < dur; k += 0.022) g.gain.setValueAtTime(vel * (0.25 + 0.75 * R()) * 0.16, t + k);
    g.gain.setValueAtTime(0, t + dur);
    s.connect(f); f.connect(g); g.connect(dst);
  }
  function _blip(t, f, vel, dst, len = 0.05) {
    const x = osc('sine', f, t, t + len + 0.1); x.frequency.setValueAtTime(f, t); x.frequency.exponentialRampToValueAtTime(f * 1.5, t + len);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.1, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, len * 0.4);
    x.connect(g); g.connect(dst);
  }
  function _crunch(t, dur, vel, dst) {
    const x = osc('square', 200, t, t + dur), g = ctx.createGain();
    for (let k = 0; k < dur; k += 0.03) { x.frequency.setValueAtTime(80 + R() * 1400, t + k); g.gain.setValueAtTime(R() < 0.7 ? vel * 0.06 : 0, t + k); }
    g.gain.setValueAtTime(0, t + dur);
    x.connect(g); g.connect(dst);
    _noiseHit(t, dur, { type: 'highpass', f0: 2500, gain: vel * 0.12, rel: dur / 2 }, dst);
  }
  function _shimmer(t, dur, count, vel, dst, lo = 74, hi = 98) {
    const pent = [2, 4, 6, 9, 11]; // D major pentatonic degrees
    for (let i = 0; i < count; i++) {
      let m; do { m = lo + Math.floor(R() * (hi - lo)); } while (!pent.includes(((m % 12) + 12) % 12));
      _celesta(t + R() * dur, m, vel * (0.5 + 0.5 * R()), dst);
    }
  }

  // windowed public versions
  const epiano = win(_epiano), pad = win(_pad), chime = win(_chime), bell = win(_bell), marimba = win(_marimba), pizz = win(_pizz), bass = win(_bass), arp = win(_arp), lead = win(_lead), noiseHit = win(_noiseHit), sweep = win(_sweep), boom = win(_boom), mrrp = win(_mrrp), slide = win(_slide), tap = win(_tap), scratch = win(_scratch), blip = win(_blip), crunch = win(_crunch), shimmer = win(_shimmer), celesta = win(_celesta), musicbox = win(_musicbox), whoosh = win(_whoosh);

  // ---- buses
  const B = {
    ep: bus(0.9, 0.35, -0.1, 0.12),
    pad: bus(0.9, 0.45, 0.05),
    str: bus(0.8, 0.5, 0.1, 0, vibG),
    cel: bus(0.8, 0.55, 0.25, 0.18),
    box: bus(0.9, 0.3, 0, 0, wowG),
    bell: bus(0.8, 0.6, 0),
    mar: bus(0.9, 0.35, -0.15, 0.1),
    pizz: bus(0.9, 0.25, 0.1),
    bass: bus(1.0, 0.05, 0),
    arp: bus(0.75, 0.25, 0, 0.45),
    lead: bus(0.8, 0.45, 0, 0.25, vibG),
    fx: bus(0.9, 0.3, 0),
    fxDry: bus(0.9, 0.08, 0),
  };
  // lo-fi cartridge bus for the CRT section
  const lofi = ctx.createGain(); lofi.gain.value = 1;
  { const lp = filt('lowpass', 2600, 0.9), hp = filt('highpass', 220, 0.7); lofi.connect(hp); hp.connect(lp); lp.connect(B.box); }

  const chordPad = (bar, chord, beats = 4, vel = 1, o = {}) => chord.forEach(m => pad(T(bar), m, beats * BEAT, vel, o.dst || B.pad, o));
  const upper = (chord, lo = 62) => {
    const u = [];
    for (const m of chord) { let x = m; while (x < lo) x += 12; if (!u.includes(x)) u.push(x); }
    return u.sort((a, b) => a - b);
  };
  const melody = (bar, notes, fn) => { let b = 0; for (const [nm, d, v] of notes) { if (nm) fn(T(bar, b), n(nm), d * BEAT, v == null ? 0.7 : v); b += d; } };

  // ================================================================ SCORE ===
  // --- 0–6 s: the cartridge. Hum, power-on, static, tuning, a lo-fi music box.
  if (W0 === 0) {
    const hum = ctx.createGain(); hum.gain.setValueAtTime(0, 0); hum.gain.linearRampToValueAtTime(0.05, 0.25);
    hum.gain.setValueAtTime(0.05, 5.4); hum.gain.linearRampToValueAtTime(0, 6.2);
    for (const [f, a] of [[60, 1], [120, 0.5], [180, 0.25], [240, 0.12]]) { const x = osc('sine', f, 0, 6.5), g = gainNode(a); x.connect(g); g.connect(hum); }
    hum.connect(B.fxDry);
    // power-on thunk + degauss
    boom(CUES.crtOn, 0.5, B.fxDry);
    noiseHit(CUES.crtOn, 0.05, { type: 'highpass', f0: 3000, gain: 0.25, rel: 0.02 }, B.fxDry);
    sweep(CUES.crtOn + 0.05, 0.9, 50, 38, 0.12, B.fxDry, 'sawtooth');
    // static with crackle
    {
      const s = noiseSrc(CUES.staticStart, 3.6), hp = filt('highpass', 700), g = ctx.createGain();
      g.gain.setValueAtTime(0, CUES.staticStart); g.gain.linearRampToValueAtTime(0.17, CUES.staticStart + 0.15);
      for (let k = CUES.staticStart + 0.15; k < 3.0; k += 0.03) g.gain.setValueAtTime(0.1 + 0.08 * R(), k);
      g.gain.linearRampToValueAtTime(0, 3.25);
      s.connect(hp); hp.connect(g); g.connect(B.fxDry);
    }
    // tuning: band-passed noise sweep + heterodyne whistle
    noiseHit(CUES.tune, 0.8, { f0: 400, f1: 3200, q: 4, gain: 0.25, swell: true, rel: 0.1 }, B.fxDry);
    sweep(CUES.tune + 0.1, 0.75, 2400, 700, 0.03, B.fxDry);
    // music box from the tape: the Jess motif
    const mb = [['F#5', 0.5], ['A5', 0.5], ['D6', 1], ['C#6', 0.5], ['B5', 0.5], ['A5', 1]];
    let b = 0; for (const [nm, d] of mb) { musicbox(T(1, b) + 0.05, n(nm), 0.9, lofi); b += d; }
    [50, 57, 62].forEach(m => pad(T(1), m, 3, 0.7, lofi, { att: 0.5, rel: 0.8, cut: 900 }));
    // the push into the screen
    whoosh(CUES.push, 0.95, 300, 5000, 0.35, B.fx);
    noiseHit(5.95, 1.5, { type: 'highpass', f0: 6000, gain: 0.1, rel: 0.5 }, B.fx);
  }

  // --- 6–15 s: sky and title. Dmaj9 – Bm7 – Gmaj7, e-piano arpeggios, motif at the title.
  {
    boom(6.0, 0.35, B.fx);
    const bars = [[2, CH.Dmaj9], [3, CH.Bm7], [4, CH.Gmaj7]];
    for (const [bar, ch] of bars) {
      chordPad(bar, ch, 4, 1, { cut: 1500, sweep: bar === 2 });
      bass(T(bar), ch[0] - 12 >= 28 ? ch[0] - 12 : ch[0], 4 * BEAT, 0.55, B.bass);
      const u = upper(ch, 62), pat = [0, 1, 2, 3, 4, 3, 2, 1];
      for (let i = 0; i < 8; i++) epiano(T(bar, i * 0.5), u[pat[i] % u.length], 0.45, 0.35 + 0.1 * (i % 2 === 0), B.ep);
    }
    noiseHit(CUES.titleIn - 1.2, 1.2, { type: 'highpass', f0: 5000, gain: 0.08, swell: true, rel: 0.4 }, B.fx);
    melody(3, [['F#5', 1, 0.75], ['A5', 0.5, 0.7], ['D6', 1.5, 0.8], ['C#6', 0.5, 0.65], ['B5', 0.5, 0.6]], (t, m, d, v) => { epiano(t, m + 12, d, v * 0.7, B.ep); bell(t, m, v * 0.5, B.bell, 2); });
    melody(4, [['A5', 2, 0.7], ['F#5', 1, 0.55], ['E5', 1, 0.5]], (t, m, d, v) => epiano(t, m + 12, d, v * 0.7, B.ep));
  }

  // --- 15–27 s: portrait, then freckles become stars.
  {
    const bars = [[5, CH.DF], [6, CH.Gmaj9], [7, CH.Fsm7], [8, CH.Bm9]];
    for (const [bar, ch] of bars) {
      chordPad(bar, ch, 4, bar >= 7 ? 1.1 : 0.9, { cut: bar >= 7 ? 1900 : 1200 });
      bass(T(bar), ch[0] >= 40 ? ch[0] - 12 : ch[0], 4 * BEAT, 0.45, B.bass);
      const u = upper(ch, 60);
      for (let i = 0; i < 4; i++) epiano(T(bar, i), u[(i * 2) % u.length], 0.9, 0.3, B.ep);
    }
    melody(5, [['A5', 1.5, 0.5], ['F#5', 0.5, 0.4], ['E5', 1, 0.45], ['D5', 1, 0.4]], (t, m, d, v) => celesta(t, m + 12, v, B.cel));
    melody(6, [['B5', 1.5, 0.5], ['A5', 0.5, 0.4], ['F#5', 2, 0.45]], (t, m, d, v) => celesta(t, m + 12, v, B.cel));
    // freckles glow: a scatter of twinkles
    shimmer(CUES.freckleGlow, 1.6, 14, 0.5, B.cel, 81, 100);
    whoosh(CUES.freckleLift - 0.3, 1.3, 800, 6000, 0.12, B.fx);
    // each constellation line: a rising bell
    const pings = ['D6', 'F#6', 'A6', 'B6', 'D7', 'E7', 'F#7'];
    CUES.constellations.forEach((c, i) => { bell(c, n(pings[i]), 0.45, B.bell, 2.2); });
    shimmer(25.5, 1.4, 10, 0.35, B.cel, 86, 102);
  }

  // --- 27–39 s: aerial silks. G – Em9 – A(sus) – D, strings, triplet arps, the drop.
  {
    const bars = [[9, CH.G], [10, CH.Em9], [11, CH.Asus4], [12, CH.D]];
    for (const [bar, ch] of bars) {
      ch.forEach(m => pad(T(bar), m, 4 * BEAT, 1.0, B.str, { att: 0.5, rel: 1.4, cut: 2600, vib: true }));
      bass(T(bar), (ch[0] > 40 ? ch[0] - 12 : ch[0]), 2 * BEAT, 0.6, B.bass);
      bass(T(bar, 2), (ch[0] > 40 ? ch[0] - 12 : ch[0]) + (bar === 11 ? 0 : 7), 2 * BEAT, 0.5, B.bass);
      const u = upper(ch, 62);
      const seq = [0, 1, 2, 3, 2, 1];
      for (let i = 0; i < 12; i++) {
        const tt = T(bar, i / 3);
        if (bar === 11 && tt > CUES.silksDrop && tt < CUES.silksCatch) continue; // silence the arps in free-fall
        epiano(tt, u[seq[i % 6] % u.length] + (i >= 6 ? 12 : 0), 0.3, 0.28, B.ep);
      }
    }
    melody(9, [['D5', 3], ['E5', 1]], (t, m, d, v) => pad(t, m + 12, d, 1.4, B.str, { att: 0.4, rel: 0.8, cut: 3000, vib: true }));
    melody(10, [['G5', 2], ['F#5', 1], ['E5', 1]], (t, m, d, v) => pad(t, m + 12, d, 1.4, B.str, { att: 0.3, rel: 0.8, cut: 3000, vib: true }));
    // invert: a soft airy swish
    whoosh(CUES.silksInvert - 0.4, 0.9, 600, 2400, 0.15, B.fx, -0.4, 0.4);
    // build into the drop (reverse cymbal), the fall, the catch
    noiseHit(CUES.silksDrop - 1.6, 1.6, { type: 'highpass', f0: 4500, gain: 0.14, swell: true, rel: 0.04 }, B.fx);
    whoosh(CUES.silksDrop, CUES.silksCatch - CUES.silksDrop, 2500, 350, 0.22, B.fx, 0.5, -0.5);
    sweep(CUES.silksDrop, CUES.silksCatch - CUES.silksDrop, 1400, 300, 0.04, B.fx, 'triangle');
    boom(CUES.silksCatch, 0.7, B.fx);
    [74, 78, 81, 86].forEach(m => bell(CUES.silksCatch, m, 0.4, B.bell, 3));
    CH.D.forEach(m => pad(CUES.silksCatch, m + 12, 3.5, 1.2, B.str, { att: 0.05, rel: 1.8, cut: 3600, vib: true }));
    melody(12, [[null, 1], ['F#5', 1, 0.6], ['A5', 0.5, 0.6], ['D6', 1.5, 0.7]], (t, m, d, v) => epiano(t, m, d, v, B.ep));
  }

  // --- 39–48 s: the adventure cat. Pizzicato oom-pah, a flop, a mrrp, the zoomies.
  {
    const plan = [[13, 0, CH.D], [13, 2, CH.D], [14, 0, CH.G], [14, 2, CH.A7], [15, 0, CH.D], [15, 2, CH.A7]];
    for (const [bar, beat, ch] of plan) {
      const root = ch[0] > 40 ? ch[0] - 12 : ch[0];
      for (let k = 0; k < 2; k++) {
        const tt = T(bar, beat + k);
        if (Math.abs(tt - CUES.catFlop - 0.35) < 0.5) continue; // comic pause for the flop
        pizz(tt, k === 0 ? root + 12 : root + 19, 0.8, B.pizz);
        const u = upper(ch, 62).slice(0, 3);
        u.forEach(m => pizz(tt + BEAT / 2, m, 0.35, B.pizz));
      }
    }
    // walking theme on marimba
    melody(13, [['D5', 0.5, 0.6], ['F#5', 0.5, 0.55], ['A5', 0.5, 0.6], ['F#5', 0.5, 0.5], ['D6', 1, 0.65]], (t, m, d, v) => marimba(t, m, v, B.mar));
    // the flop: a slide-whistle droop, a thump, then a put-upon mrrp
    slide(CUES.catFlop - 0.35, 1100, 380, 0.55, 0.06, B.fx);
    boom(CUES.catFlop + 0.2, 0.18, B.fx);
    mrrp(CUES.catMrrp, 1.0, 0.42, 0.35, B.fx);
    melody(14, [[null, 2], ['C#6', 0.5, 0.55], ['A5', 0.5, 0.5], ['E5', 1, 0.5]], (t, m, d, v) => marimba(t, m, v, B.mar));
    // Yuffie: the zap, then the zoomies, back and forth
    blip(CUES.yuffieZap, 2200, 1.4, B.fx, 0.08);
    shimmer(CUES.yuffieZap, 0.25, 6, 0.6, B.cel, 88, 104);
    const zs = [CUES.zoomies, CUES.zoomies + 0.42, CUES.zoomies + 0.84, CUES.zoomies + 1.2];
    zs.forEach((z, i) => whoosh(z, 0.34, 700, 3600, 0.22, B.fxDry, i % 2 ? 0.8 : -0.8, i % 2 ? -0.8 : 0.8));
    for (let i = 0; i < 14; i++) tap(CUES.zoomies + i * 0.1, 0.35, B.fxDry, 1800);
    // the head-bump: Uriel is the affectionate one
    mrrp(CUES.headbump, 1.18, 0.3, 0.3, B.fx);
    melody(15, [['F#5', 0.5, 0.6], ['A5', 0.5, 0.6], ['D6', 1, 0.7], ['A5', 0.5, 0.5], ['C#6', 0.5, 0.5], ['E6', 1, 0.6]], (t, m, d, v) => marimba(t, m, v, B.mar));
  }

  // --- 48–57 s: Alice & Bob on the lattice. Arpeggiator, blips, crunch, decrypt, heart.
  {
    crunch(47.7, 0.5, 1, B.fxDry);
    const bars = [[16, CH.Bm], [17, CH.G], [18, CH.Asus4]];
    for (const [bar, ch] of bars) {
      chordPad(bar, ch, 4, 0.9, { cut: 1800 });
      const u = upper(ch, 57), pat = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 2, 1, 3, 4, 3];
      for (let i = 0; i < 16; i++) {
        let m = u[pat[i] % u.length] + (i % 8 === 7 ? 12 : 0);
        if (bar === 18 && i >= 8) { const ua = upper(CH.A, 57); m = ua[pat[i] % ua.length] + (i % 8 === 7 ? 12 : 0); }
        arp(T(bar, i / 4), m, 0.8, B.arp);
      }
      for (let i = 0; i < 8; i++) bass(T(bar, i / 2), (ch[0] > 40 ? ch[0] - 12 : ch[0]) + (i % 2 ? 12 : 0), 0.3, 0.55, B.bass);
    }
    blip(CUES.heartLaunch, 900, 1.2, B.fx, 0.25);
    crunch(CUES.encrypt, 0.6, 0.9, B.fx);
    for (let i = 0; i < 12; i++) blip(CUES.encrypt + 0.6 + i * 0.12, 1500 + R() * 2000, 0.5, B.fx);
    // decrypt: a falling cascade of snaps
    for (let i = 0; i < 16; i++) blip(CUES.decrypt + i * 0.07, 3200 - i * 140, 0.8, B.fx, 0.03);
    shimmer(CUES.heartForm, 1.2, 12, 0.5, B.cel, 86, 100);
    melody(18, [['F#5', 0.5, 0.7], ['A5', 0.5, 0.7], ['D6', 1, 0.8], ['C#6', 0.5, 0.7], ['B5', 0.5, 0.65], ['A5', 1, 0.7]], (t, m, d, v) => lead(t, m, d * 0.9, v, B.lead));
    bell(CUES.heartArrive, n('A6'), 0.5, B.bell, 2);
  }

  // --- 57–69 s: chalkboard. Marimba, chalk scratches and taps, a die, a bell.
  {
    const bars = [[19, CH.D], [20, CH.AC], [21, CH.Bm7], [22, CH.Gmaj7]];
    for (const [bar, ch] of bars) {
      chordPad(bar, ch, 4, 0.7, { cut: 1100 });
      bass(T(bar), ch[0] > 40 ? ch[0] - 12 : ch[0], 4 * BEAT, 0.4, B.bass);
      const u = upper(ch, 62);
      for (let i = 0; i < 8; i++) marimba(T(bar, i * 0.5), u[[0, 2, 1, 3, 2, 4, 3, 1][i] % u.length], 0.32, B.mar);
    }
    scratch(CUES.chalkAxes, 0.35, 1, B.fxDry); scratch(CUES.chalkAxes + 0.45, 0.35, 1, B.fxDry);
    scratch(CUES.chalkAxes + 0.9, 0.3, 0.9, B.fxDry); scratch(CUES.chalkAxes + 1.25, 0.3, 0.9, B.fxDry);
    for (let i = 0; i < 26; i++) tap(CUES.chalkDots + i * 0.085 + R() * 0.03, 0.6, B.fxDry);
    for (let i = 0; i < 9; i++) tap(CUES.dieRoll + i * (0.05 + i * 0.012), 0.8 - i * 0.06, B.fxDry, 1400);
    for (let k = 0; k < 4; k++) scratch(CUES.learn + k * 0.95, 0.8, 0.7, B.fxDry);
    whoosh(CUES.merge - 0.3, 0.8, 500, 1800, 0.08, B.fx);
    [n('D6'), n('F#6'), n('A6'), n('D7')].forEach((m, i) => bell(CUES.bell + i * 0.06, m, 0.45, B.bell, 3));
    melody(22, [[null, 2], ['A5', 0.5, 0.5], ['B5', 0.5, 0.5], ['C#6', 1, 0.55]], (t, m, d, v) => marimba(t, m, v, B.mar));
  }

  // --- 69–81 s: dusk, watercolor. The full theme: strings, piano, bass.
  {
    whoosh(CUES.duskWash - 0.4, 1.8, 300, 1500, 0.08, B.fx);
    const bars = [[23, CH.D], [24, CH.Fsm7], [25, CH.Bm7], [26, CH.Gmaj7]];
    for (const [bar, ch] of bars) {
      ch.forEach(m => pad(T(bar), m, 4 * BEAT, 0.9, B.str, { att: 0.9, rel: 1.6, cut: 2200, vib: true }));
      chordPad(bar, ch, 4, 0.6, { cut: 1000 });
      bass(T(bar), ch[0] > 40 ? ch[0] - 12 : ch[0], 3 * BEAT, 0.5, B.bass);
      bass(T(bar, 3), (ch[0] > 40 ? ch[0] - 12 : ch[0]) + 7, BEAT, 0.4, B.bass);
      const u = upper(ch, 55);
      for (let i = 0; i < 8; i++) epiano(T(bar, i * 0.5), u[[0, 2, 4, 2, 1, 3, 4, 3][i] % u.length], 0.5, 0.22, B.ep);
    }
    const mel = (bar, notes) => melody(bar, notes, (t, m, d, v) => { epiano(t, m, d, v, B.ep); epiano(t, m + 12, d, v * 0.35, B.ep); });
    mel(23, [['F#5', 1, 0.75], ['A5', 0.5, 0.7], ['D6', 1.5, 0.8], ['C#6', 0.5, 0.65], ['B5', 0.5, 0.6]]);
    mel(24, [['A5', 2, 0.7], ['F#5', 1, 0.6], ['E5', 1, 0.55]]);
    mel(25, [['F#5', 1, 0.7], ['A5', 0.5, 0.65], ['D6', 1.5, 0.8], ['E6', 0.5, 0.7], ['D6', 0.5, 0.65]]);
    mel(26, [['B5', 2, 0.7], ['A5', 1, 0.6], ['F#5', 1, 0.55]]);
    shimmer(CUES.treesGrow, 3.5, 10, 0.25, B.cel, 79, 98);
    shimmer(CUES.blossom, 2.5, 26, 0.45, B.cel, 81, 102);
  }

  // --- 81–90 s: finale. Em9 – A7sus4 – D. The motif, slowly, on piano and bells.
  {
    whoosh(CUES.ribbonInf - 0.2, 2.2, 400, 2600, 0.07, B.fx, -0.5, 0.5);
    const bars = [[27, CH.Em9], [28, CH.A7], [29, CH.Dadd9]];
    for (const [bar, ch] of bars) {
      const len = bar === 29 ? 7 : 4;
      ch.forEach(m => pad(T(bar), m, len * BEAT, 1.0, B.str, { att: 0.7, rel: 3, cut: 2400, vib: true }));
      chordPad(bar, ch, len, 0.8, { cut: 1400, rel: 3.5 });
      bass(T(bar), ch[0] > 40 ? ch[0] - 12 : ch[0], len * BEAT, 0.5, B.bass);
    }
    const fin = [[27, [['F#5', 1, 0.7], ['A5', 1, 0.7], ['D6', 2, 0.8]]], [28, [['C#6', 1, 0.7], ['B5', 1, 0.65], ['A5', 2, 0.7]]], [29, [['D6', 4, 0.8]]]];
    for (const [bar, notes] of fin) melody(bar, notes, (t, m, d, v) => { epiano(t, m, d, v, B.ep); bell(t, m, v * 0.6, B.bell, 3); });
    shimmer(CUES.ribbonJess, 2.8, 22, 0.35, B.cel, 86, 104);
    [n('D5'), n('F#5'), n('A5'), n('D6'), n('E6'), n('A6')].forEach((m, i) => bell(CUES.signoff + i * 0.09, m, 0.4, B.bell, 4.5));
  }
}

// ------------------------------------------------------------- transport ---
// The score is rendered in scene-aligned chunks (each with a tail for reverb and
// releases), so playback can begin as soon as the first chunk exists while the rest
// render in parallel. At playback the chunks overlap-add into one compressor.
const CHUNKS = [[0, 12], [12, 27], [27, 39], [39, 48], [48, 57], [57, 69], [69, 81], [81, 95]];
const TAIL = 5;
const chunks = CHUNKS.map(([a, b]) => ({ a, b, buf: null }));
let actx = null, bus = null, sources = [], startAt = 0, isPlaying = false;

function renderChunk(c) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const len = Math.min(LEN, c.b + TAIL) - c.a;
  const ctx = new OAC(2, Math.ceil(SR * len), SR);
  buildScore(ctx, c.a, c.b);
  return ctx.startRendering().then(b => { c.buf = b; if (isPlaying) scheduleChunk(c); return b; });
}
function scheduleChunk(c) {
  if (!actx || !c.buf) return;
  const at = startAt + c.a;                      // context time where this chunk's t=0 sounds
  const off = Math.max(0, actx.currentTime + 0.02 - at);
  if (off >= c.buf.duration) return;
  const s = actx.createBufferSource();
  s.buffer = c.buf; s.connect(bus);
  s.start(at + off, off);
  sources.push(s);
}

IJ.audio = {
  // Resolves when the first chunk is ready; IJ.audio.all resolves when every chunk is.
  render() {
    const t0 = performance.now();
    let first;
    try { first = renderChunk(chunks[0]); } catch (e) { return Promise.reject(e); }
    this.all = first.then(() => Promise.all(chunks.slice(1).map(renderChunk))).then(() => { this.renderMs = performance.now() - t0; });
    return first.then(() => { this.firstMs = performance.now() - t0; });
  },
  unlock() {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = actx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.008; comp.release.value = 0.3;
      bus = actx.createGain(); bus.gain.value = 1;
      const out = actx.createGain(); out.gain.value = 0.95;
      bus.connect(comp); comp.connect(out); out.connect(actx.destination);
    }
    if (actx.state === 'suspended') actx.resume();
  },
  play(offset) {
    this.unlock();
    this.stop();
    startAt = actx.currentTime + 0.05 - offset;
    isPlaying = true;
    for (const c of chunks) scheduleChunk(c);
  },
  stop() {
    for (const s of sources) { try { s.stop(); } catch (e) { /* not started */ } s.disconnect(); }
    sources = []; isPlaying = false;
  },
  time() { return actx ? actx.currentTime - startAt - (actx.outputLatency || 0) : 0; },
  playing() { return isPlaying && this.time() < LEN - 0.1; },
  duration() { return LEN; },
  // For offline inspection: all chunks summed into [left, right].
  mixdown() {
    const L = new Float32Array(SR * LEN), Rr = new Float32Array(SR * LEN);
    for (const c of chunks) if (c.buf) {
      const o = Math.round(c.a * SR), l = c.buf.getChannelData(0), r = c.buf.getChannelData(1);
      for (let i = 0; i < l.length && o + i < L.length; i++) { L[o + i] += l[i]; Rr[o + i] += r[i]; }
    }
    return [L, Rr];
  },
  SR,
};
})();
