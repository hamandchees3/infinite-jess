// INFINITE JESS — export the film to an MP4, frame by frame (never dropping a frame), with
// the same mix you hear when it plays. Uses the browser's own encoders (WebCodecs).
(function () {
'use strict';
const IJ = window.IJ;
const SECONDS = 99;          // the film, the typed footnote, and a fade to black

async function pick(list, test) { for (const c of list) { try { if ((await test(c)).supported) return c; } catch (e) { /* try the next */ } } return null; }

IJ.exportVideo = async function ({ fps = 60, width = 1920, height = 1080, bitrate = 20e6, onProgress = () => {}, log = () => {} } = {}) {
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') throw new Error('This browser has no WebCodecs video/audio encoders (try Chrome or Edge).');
  const film = IJ.film, SR = IJ.audio.SR;
  // ---- codecs
  const vcfg = await pick(['avc1.640032', 'avc1.64002A', 'avc1.4D4032', 'avc1.42E032'].flatMap(codec => ['prefer-hardware', 'no-preference'].map(hw => ({
    codec, width, height, bitrate, framerate: fps, hardwareAcceleration: hw, avc: { format: 'avc' }, latencyMode: 'quality',
  }))), c => VideoEncoder.isConfigSupported(c));
  if (!vcfg) throw new Error('No H.264 encoder available at ' + width + 'x' + height);
  const acfg = { codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate: 256000 };
  if (!(await AudioEncoder.isConfigSupported(acfg)).supported) throw new Error('No AAC encoder available');
  log(`video ${vcfg.codec} (${vcfg.hardwareAcceleration}) ${(bitrate / 1e6).toFixed(1)} Mbps, audio AAC ${SR} Hz`);

  // ---- the mix: every chunk of the score, through the same compressor used for playback
  if (!IJ.audio.all) await IJ.audio.render();
  await IJ.audio.all;
  const [L, R] = IJ.audio.mixdown();
  const total = Math.ceil(SECONDS * SR);
  const oac = new OfflineAudioContext(2, total, SR);
  const src = oac.createBuffer(2, total, SR);
  src.copyToChannel(L.subarray(0, Math.min(L.length, total)), 0);
  src.copyToChannel(R.subarray(0, Math.min(R.length, total)), 1);
  const node = oac.createBufferSource(); node.buffer = src;
  const comp = oac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.008; comp.release.value = 0.3;
  const gain = oac.createGain(); gain.gain.value = 1.45;
  gain.gain.setValueAtTime(1.45, SECONDS - 1.6); gain.gain.linearRampToValueAtTime(0, SECONDS - 0.2);
  node.connect(comp); comp.connect(gain); gain.connect(oac.destination); node.start(0);
  const mixed = await oac.startRendering();
  onProgress(0.02, 'sound mixed');

  // ---- encode the sound
  const aChunks = []; let asc = null, aErr = null;
  const aenc = new AudioEncoder({
    output: (chunk, meta) => {
      if (meta && meta.decoderConfig && meta.decoderConfig.description) asc = new Uint8Array(meta.decoderConfig.description);
      const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); aChunks.push({ data: d });
    },
    error: e => { aErr = e; },
  });
  aenc.configure(acfg);
  const BL = 4096, cl = mixed.getChannelData(0), cr = mixed.getChannelData(1);
  for (let off = 0; off < total; off += BL) {
    const n = Math.min(BL, total - off), data = new Float32Array(n * 2);
    data.set(cl.subarray(off, off + n), 0); data.set(cr.subarray(off, off + n), n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(off / SR * 1e6), data });
    aenc.encode(ad); ad.close();
  }
  await aenc.flush();
  if (aErr) throw aErr;
  if (!asc) asc = new Uint8Array([0x12, 0x10]);        // AAC-LC, 44.1 kHz, stereo
  // AAC encoders prepend "priming" samples; measure them so the edit list can skip them
  const extra = aChunks.length * 1024 - total;
  const priming = extra >= 1024 && extra <= 4096 ? (extra >= 2112 ? 2112 : 1024) : 0;
  log(`audio: ${aChunks.length} AAC frames, priming ${priming}`);

  // ---- render and encode every frame
  const vChunks = []; let avcC = null, vErr = null;
  const venc = new VideoEncoder({
    output: (chunk, meta) => {
      if (meta && meta.decoderConfig && meta.decoderConfig.description) avcC = new Uint8Array(meta.decoderConfig.description);
      const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d);
      vChunks.push({ data: d, key: chunk.type === 'key', ts: chunk.timestamp });
    },
    error: e => { vErr = e; },
  });
  venc.configure(vcfg);
  const wasPlaying = film.playing; if (wasPlaying) film.pause();
  IJ.exporting = true; IJ.exportFadeOut = SECONDS - 1.4;
  film.setSize(width, height);
  const canvas = document.getElementById('film');
  const N = Math.round(SECONDS * fps), t0 = performance.now();
  try {
    for (let i = 0; i < N; i++) {
      film.render(i / fps);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      venc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      if (vErr) throw vErr;
      while (venc.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 2));
      if (i % 20 === 0) {
        const k = i / N, el = (performance.now() - t0) / 1000;
        onProgress(0.02 + 0.96 * k, `frame ${i} / ${N}` + (k > 0.02 ? ` · ${Math.round(el / k - el)} s left` : ''));
        await new Promise(r => setTimeout(r, 0));
      }
    }
    await venc.flush();
    if (vErr) throw vErr;
  } finally {
    IJ.exporting = false; IJ.exportFadeOut = null;
    film.setSize(null);
  }
  // frames must come back in order (no B-frame reordering) for this simple muxer
  for (let i = 1; i < vChunks.length; i++) if (vChunks[i].ts < vChunks[i - 1].ts) throw new Error('encoder reordered frames');
  log(`video: ${vChunks.length} frames in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  const blob = IJ.muxMP4(
    { chunks: vChunks, avcC, width, height, fps },
    { chunks: aChunks, asc, sampleRate: SR, channels: 2, priming },
  );
  onProgress(1, 'done');
  return blob;
};

// ---- the user-facing export: press E, get InfiniteJess.mp4
function overlay() {
  let el = document.getElementById('export');
  if (!el) {
    el = document.createElement('div'); el.id = 'export';
    el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);padding:10px 18px;border-radius:8px;background:rgba(0,0,0,.72);color:#efe7da;font:13px/1.4 "Avenir Next","Helvetica Neue",sans-serif;letter-spacing:.04em;z-index:9';
    document.body.appendChild(el);
  }
  return el;
}
IJ.exportToDownload = async function () {
  const el = overlay();
  try {
    const blob = await IJ.exportVideo({ onProgress: (k, msg) => { el.textContent = `exporting video · ${Math.round(k * 100)}% · ${msg}`; } });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'InfiniteJess.mp4';
    document.body.appendChild(a); a.click(); a.remove();
    el.textContent = `saved InfiniteJess.mp4 (${(blob.size / 1048576).toFixed(0)} MB)`;
  } catch (e) {
    el.textContent = 'export failed: ' + e.message;
    console.error(e);
  }
  setTimeout(() => el.remove(), 6000);
};

// ---- the headless tool (tools/export.py): ?export=auto posts the file back to it
if (/[?&]export=auto/.test(location.search)) {
  const post = (path, body) => fetch(path, { method: 'POST', body });
  let last = -1;
  const q = new URLSearchParams(location.search);
  const name = (q.get('name') || 'InfiniteJess.mp4').replace(/[^\w.-]/g, '');
  window.addEventListener('load', () => setTimeout(async () => {
    try {
      const blob = await IJ.exportVideo({
        bitrate: (+q.get('mbps') || 20) * 1e6,
        onProgress: (k, msg) => { if (k - last >= 0.025 || k === 1) { last = k; post('/__log', `${(k * 100).toFixed(1)}% ${msg}`); } },
        log: m => post('/__log', m),
      });
      await post('/__result/' + name, blob);
    } catch (e) {
      await post('/__error', String((e && e.stack) || e));
    }
  }, 300));
}
})();
