"""Pin the Print / Export color band-bx data URI to the 25 Nov pack raster.

QA M2 (2026-11-25): the color URI in index.html must decode to assets/brand-brentronix/print-horizontal-light-h75.png.
The one-color white URI and the shared ML block are left alone.
"""
import base64, hashlib, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK_COLOR = ROOT / 'assets' / 'brand-brentronix' / 'print-horizontal-light-h75.png'
PACK_WHITE = ROOT / 'assets' / 'brand-brentronix' / 'print-horizontal-1color-white-h75.png'
HTML = ROOT / 'index.html'
BX_RE = re.compile(r"const bx = '<img class=\"band-bx\" src=\"data:image/png;base64,([A-Za-z0-9+/=\s]+)\"")
ML_RE = re.compile(r'<!--ML-BEGIN-->.*?<!--ML-END-->', re.S)
WANT_COLOR = '78638f354d1fb3f0ba449848ed92304aa6cb5d3fcf9fdcc3f68fe63ac87aa335'
WANT_WHITE = '018b64bb9c54e1be70a6fd95de185ae89e19f3c931db6475e9f8052852af678e'
R = []

def sha(b):
    return hashlib.sha256(b).hexdigest()

def ok(n, c, i=''):
    R.append(bool(c))
    print('PASS' if c else 'FAIL', n, str(i)[:300])

def uris(text):
    out = []
    for m in BX_RE.finditer(text):
        data = base64.b64decode(re.sub(r'\s+', '', m.group(1)))
        out.append(sha(data))
    return out

def main():
    pack_color = sha(PACK_COLOR.read_bytes())
    pack_white = sha(PACK_WHITE.read_bytes())
    ok('pack print-horizontal-light-h75.png is the 25 Nov raster', pack_color == WANT_COLOR, pack_color)
    ok('pack print-horizontal-1color-white-h75.png is unchanged', pack_white == WANT_WHITE, pack_white)

    text = HTML.read_text()
    found = uris(text)
    ok('exactly two band-bx data URIs (color and one-color)', len(found) == 2, found)
    ok('color band-bx decoded sha256 equals pack print-horizontal-light-h75.png',
       WANT_COLOR in found and pack_color in found, found)
    ok('one-color white band-bx URI is unchanged', WANT_WHITE in found and pack_white in found, found)
    ok('stale 24 Nov v4 color URI a5cae07e is not embedded',
       'a5cae07e6be8395d25829ad2e48a22d8b94fb1cd88e14e1cc6e2d150324dfc88' not in found, found)
    ok('shared ML block is present', bool(ML_RE.search(text)))

    print(f'{sum(R)}/{len(R)} passed')
    sys.exit(0 if all(R) else 1)

if __name__ == '__main__':
    main()
