#!/usr/bin/env python3
"""Render INFINITE JESS to dist/InfiniteJess.mp4 (1920x1080, 60 fps, H.264 + AAC).

The film exports itself: this script serves the project to a headless Chrome, which
renders every frame, encodes it with the browser's WebCodecs encoders, muxes the MP4 in
JavaScript (js/mp4.js) and posts it back here. Needs Google Chrome; no other tools.

    python3 tools/export.py                      # master: 20 Mbps -> dist/InfiniteJess.mp4
    python3 tools/export.py --mbps 6 --name InfiniteJess-share.mp4   # smaller, for messages
"""
import argparse, http.server, os, pathlib, shutil, subprocess, sys, tempfile, threading, time, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'dist'
PORT = int(os.environ.get('PORT', 8799))
state = {'done': threading.Event(), 'ok': False}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(n)
        if self.path == '/__log':
            print('  ' + body.decode('utf-8', 'replace'), flush=True)
        elif self.path.startswith('/__result/'):
            OUT.mkdir(exist_ok=True)
            dest = OUT / os.path.basename(self.path)
            dest.write_bytes(body)
            print(f'wrote {dest} ({len(body) / 1048576:.1f} MB)', flush=True)
            state['ok'] = True
            state['done'].set()
        elif self.path == '/__error':
            print('export failed:\n' + body.decode('utf-8', 'replace'), flush=True)
            state['done'].set()
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'ok')


def find_chrome():
    cands = [os.environ.get('CHROME'),
             '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
             '/Applications/Chromium.app/Contents/MacOS/Chromium',
             '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
             shutil.which('google-chrome'), shutil.which('chromium'), shutil.which('chrome')]
    for c in cands:
        if c and os.path.exists(c):
            return c
    sys.exit('Could not find Chrome. Set CHROME=/path/to/chrome and try again.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mbps', type=float, default=20)
    ap.add_argument('--name', default='InfiniteJess.mp4')
    opt = ap.parse_args()
    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    profile = tempfile.mkdtemp(prefix='ij-export-')
    url = f'http://127.0.0.1:{PORT}/index.html?export=auto&mbps={opt.mbps}&name={urllib.parse.quote(opt.name)}'
    args = [find_chrome(), '--headless=new', f'--user-data-dir={profile}', '--window-size=1920,1080',
            '--force-device-scale-factor=1', '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--no-first-run']
    if sys.platform == 'darwin':
        args.append('--use-angle=metal')
    print(f'rendering {url} in headless Chrome ...', flush=True)
    t0 = time.time()
    chrome = subprocess.Popen(args + [url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not state['done'].wait(timeout=60 * 45):
            print('timed out')
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=10)
        except subprocess.TimeoutExpired:
            chrome.kill()
        server.shutdown()
        shutil.rmtree(profile, ignore_errors=True)
    print(f'{"done" if state["ok"] else "failed"} in {time.time() - t0:.0f} s')
    sys.exit(0 if state['ok'] else 1)


if __name__ == '__main__':
    main()
