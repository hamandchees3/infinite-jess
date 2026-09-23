// Dev-only helpers (loaded with ?debug): contact sheets of frames for review.
window.sheet = function (times, name, cols = 3, W = 640, H = 360) {
  const c = document.getElementById('film');
  let sh = document.getElementById('sheet');
  if (!sh) {
    sh = document.createElement('canvas'); sh.id = 'sheet';
    sh.style.cssText = 'position:fixed;left:0;top:0;z-index:10;background:#222;width:100vw;height:auto';
    sh.onclick = () => sh.remove();
    document.body.appendChild(sh);
  }
  const rows = Math.ceil(times.length / cols);
  sh.width = W * cols; sh.height = H * rows;
  const x = sh.getContext('2d');
  const t0 = performance.now();
  times.forEach((t, i) => {
    window.film.render(t);
    const gx = (i % cols) * W, gy = Math.floor(i / cols) * H;
    x.drawImage(c, gx, gy, W, H);
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(gx, gy, 46, 16);
    x.fillStyle = '#7f7'; x.font = '12px monospace'; x.fillText(t.toFixed(2), gx + 4, gy + 12);
  });
  const ms = (performance.now() - t0).toFixed(0);
  if (name) sh.toBlob(b => fetch('/__save/' + name + '.png', { method: 'POST', body: b }));
  return `${times.length} frames in ${ms} ms`;
};
// Save a single full-resolution frame to disk (dev server only).
window.snap = function (t, name) {
  window.film.render(t);
  document.getElementById('film').toBlob(b => fetch('/__save/' + name + '.png', { method: 'POST', body: b }));
  return name;
};
window.one = function (t) { const s = document.getElementById('sheet'); if (s) s.remove(); window.film.seek(t); return t; };
// average GPU-bound frame time at t (forces a pixel readback to wait for the GPU)
window.bench = function (t, n = 20) {
  const gl = window.IJ.gl, px = new Uint8Array(4);
  window.film.render(t); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) { window.film.render(t + i / 60); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
  return ((performance.now() - t0) / n).toFixed(1) + ' ms/frame';
};
// capture errors from this page load (the pane's console keeps old entries)
window.__errs = [];
(function () { const ce = console.error; console.error = (...a) => { window.__errs.push(a.map(x => (x && x.stack) || String(x)).join(' ').slice(0, 600)); ce.apply(console, a); }; })();
window.addEventListener('error', e => window.__errs.push(String(e.message)));
