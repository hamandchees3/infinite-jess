#!/usr/bin/env bash
# Bundle index.html + js/*.js into one self-contained file: dist/InfiniteJess.html
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
python3 - <<'EOF'
import re, pathlib
root = pathlib.Path('.')
html = (root / 'index.html').read_text(encoding='utf-8')
block = re.search(r'<!--SCRIPTS-->(.*?)<!--/SCRIPTS-->', html, re.S)
srcs = re.findall(r'<script src="([^"]+)"></script>', block.group(1))
parts = []
for src in srcs:
    js = (root / src).read_text(encoding='utf-8')
    if '</script' in js.lower():
        raise SystemExit(f'{src} contains a closing script tag')
    parts.append(f'<script>\n// ---- {src}\n{js}\n</script>')
out = html[:block.start()] + '\n'.join(parts) + html[block.end():]
# the dev helpers are not part of the film
out = re.sub(r'<script>if \(/\[\?&\]debug/.*?</script>\n?', '', out, flags=re.S)
(root / 'dist' / 'InfiniteJess.html').write_text(out, encoding='utf-8')
print(f'dist/InfiniteJess.html: {len(out)/1024:.0f} KB from {len(srcs)} scripts')
EOF
