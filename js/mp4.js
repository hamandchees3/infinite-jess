// INFINITE JESS — a small MP4 (ISO BMFF) muxer for the video export: H.264 video + AAC
// audio, interleaved one-second chunks, moov before mdat so it streams and scrubs well.
(function () {
'use strict';
const IJ = window.IJ;
const ascii = s => new Uint8Array([...s].map(c => c.charCodeAt(0)));
const u8 = n => new Uint8Array([n & 255]);
const u16 = n => new Uint8Array([(n >>> 8) & 255, n & 255]);
const u24 = n => new Uint8Array([(n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const u32 = n => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const zeros = n => new Uint8Array(n);
function cat(parts) {
  let len = 0; for (const p of parts) len += p.length;
  const out = new Uint8Array(len); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const box = (type, ...parts) => { const body = cat(parts); return cat([u32(body.length + 8), ascii(type), body]); };
const full = (type, version, flags, ...parts) => box(type, u8(version), u24(flags), ...parts);
const MATRIX = cat([u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000)]);
// MPEG-4 descriptor with a single-byte length
const desc = (tag, ...parts) => { const body = cat(parts); return cat([u8(tag), u8(body.length), body]); };

function runs(values) { // run-length encode for stts
  const out = [];
  for (const v of values) { const last = out[out.length - 1]; if (last && last[1] === v) last[0]++; else out.push([1, v]); }
  return out;
}

// video: { chunks: [{data, key}], avcC, width, height, fps }
// audio: { chunks: [{data}], asc, sampleRate, channels, priming }
IJ.muxMP4 = function (video, audio) {
  const VTS = video.fps * 1000;                    // video media timescale
  const vDur = video.chunks.length * 1000;         // in VTS
  const aDur = audio.chunks.length * 1024;         // in sampleRate
  const secs = Math.max(video.chunks.length / video.fps, (aDur - audio.priming) / audio.sampleRate);
  const movieDur = Math.round(secs * 1000);

  // interleave: one chunk of each track per second
  const chunks = [];                               // {track, samples:[i...]}
  const vPerChunk = video.fps, aPerChunk = Math.round(audio.sampleRate / 1024);
  const nSec = Math.ceil(Math.max(video.chunks.length / vPerChunk, audio.chunks.length / aPerChunk));
  for (let s = 0; s < nSec; s++) {
    const v = [], a = [];
    for (let i = s * vPerChunk; i < Math.min(video.chunks.length, (s + 1) * vPerChunk); i++) v.push(i);
    for (let i = s * aPerChunk; i < Math.min(audio.chunks.length, (s + 1) * aPerChunk); i++) a.push(i);
    if (v.length) chunks.push({ track: 0, samples: v });
    if (a.length) chunks.push({ track: 1, samples: a });
  }
  const trackChunks = t => chunks.filter(c => c.track === t);
  const stsc = cs => {
    const entries = [];
    cs.forEach((c, i) => { const last = entries[entries.length - 1]; if (!last || last[1] !== c.samples.length) entries.push([i + 1, c.samples.length]); });
    return full('stsc', 0, 0, u32(entries.length), ...entries.map(([f, n]) => cat([u32(f), u32(n), u32(1)])));
  };
  const stco = offsets => full('stco', 0, 0, u32(offsets.length), ...offsets.map(u32));
  const stsz = list => full('stsz', 0, 0, u32(0), u32(list.length), ...list.map(c => u32(c.data.length)));

  function build(offsets) {
    const vChunks = trackChunks(0), aChunks = trackChunks(1);
    const vOff = offsets.filter((_, i) => chunks[i].track === 0), aOff = offsets.filter((_, i) => chunks[i].track === 1);
    // ---- video track
    const avc1 = box('avc1', zeros(6), u16(1), u16(0), u16(0), zeros(12), u16(video.width), u16(video.height),
      u32(0x00480000), u32(0x00480000), u32(0), u16(1), cat([u8(11), ascii('INFINITEJESS'.slice(0, 11)), zeros(20)]),
      u16(0x0018), u16(0xffff), box('avcC', video.avcC),
      box('colr', ascii('nclx'), u16(1), u16(1), u16(1), u8(0)), box('pasp', u32(1), u32(1)));
    const keys = video.chunks.map((c, i) => c.key ? i + 1 : 0).filter(Boolean);
    const vstbl = box('stbl',
      full('stsd', 0, 0, u32(1), avc1),
      full('stts', 0, 0, u32(1), u32(video.chunks.length), u32(1000)),
      full('stss', 0, 0, u32(keys.length), ...keys.map(u32)),
      stsc(vChunks), stsz(video.chunks), stco(vOff));
    const vtrak = box('trak',
      full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(Math.round(video.chunks.length / video.fps * 1000)), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(video.width << 16), u32(video.height << 16)),
      box('mdia',
        full('mdhd', 0, 0, u32(0), u32(0), u32(VTS), u32(vDur), u16(0x55c4), u16(0)),
        full('hdlr', 0, 0, u32(0), ascii('vide'), zeros(12), ascii('VideoHandler'), u8(0)),
        box('minf', full('vmhd', 0, 1, zeros(8)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), vstbl)));
    // ---- audio track
    const esds = full('esds', 0, 0, desc(0x03, u16(2), u8(0),
      desc(0x04, u8(0x40), u8(0x15), u24(0), u32(256000), u32(256000), desc(0x05, audio.asc)),
      desc(0x06, u8(0x02))));
    const mp4a = box('mp4a', zeros(6), u16(1), zeros(8), u16(audio.channels), u16(16), u16(0), u16(0), u32(audio.sampleRate << 16), esds);
    const astbl = box('stbl',
      full('stsd', 0, 0, u32(1), mp4a),
      full('stts', 0, 0, u32(1), u32(audio.chunks.length), u32(1024)),
      stsc(aChunks), stsz(audio.chunks), stco(aOff));
    const aShown = Math.round((aDur - audio.priming) / audio.sampleRate * 1000);
    const atrak = box('trak',
      full('tkhd', 0, 3, u32(0), u32(0), u32(2), u32(0), u32(aShown), zeros(8), u16(0), u16(1), u16(0x0100), u16(0), MATRIX, u32(0), u32(0)),
      // the encoder's priming samples are skipped with an edit list, keeping picture and sound in sync
      box('edts', full('elst', 0, 0, u32(1), u32(aShown), u32(audio.priming), u32(0x00010000))),
      box('mdia',
        full('mdhd', 0, 0, u32(0), u32(0), u32(audio.sampleRate), u32(aDur), u16(0x55c4), u16(0)),
        full('hdlr', 0, 0, u32(0), ascii('soun'), zeros(12), ascii('SoundHandler'), u8(0)),
        box('minf', full('smhd', 0, 0, u16(0), u16(0)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), astbl)));
    const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(movieDur), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(3));
    return box('moov', mvhd, vtrak, atrak);
  }

  const ftyp = box('ftyp', ascii('isom'), u32(0x200), ascii('isom'), ascii('iso2'), ascii('avc1'), ascii('mp41'));
  const sizes = chunks.map(c => c.samples.reduce((s, i) => s + (c.track === 0 ? video.chunks[i] : audio.chunks[i]).data.length, 0));
  const moovLen = build(chunks.map(() => 0)).length;
  const dataStart = ftyp.length + moovLen + 8;
  const offsets = []; let o = dataStart;
  for (const s of sizes) { offsets.push(o); o += s; }
  const moov = build(offsets);
  const mdatLen = o - dataStart + 8;
  const parts = [ftyp, moov, cat([u32(mdatLen), ascii('mdat')])];
  for (const c of chunks) for (const i of c.samples) parts.push((c.track === 0 ? video.chunks[i] : audio.chunks[i]).data);
  return new Blob(parts, { type: 'video/mp4' });
};
})();
