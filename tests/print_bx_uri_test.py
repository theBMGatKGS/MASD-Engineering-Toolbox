"""Pin every color band data URI on dark/navy headers to the whiteblue compact raster.

QA M2 / M-r2-1 / whiteblue (2026-11-25): color band-bx URIs in index.html and src/**
that sit on the #102645 header must decode to
assets/brand-brentronix/print-horizontal-whiteblue-dark-h75.png
(pack whiteblue/exports/print-300dpi/brentronix-whiteblue-horizontal-dark-h75-300dpi.png).
The one-color white URI, the shared ML block, and print-on-white light files are left alone.
"""
import base64, hashlib, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK_COLOR = ROOT / 'assets' / 'brand-brentronix' / 'print-horizontal-whiteblue-dark-h75.png'
PACK_LIGHT = ROOT / 'assets' / 'brand-brentronix' / 'print-horizontal-light-h75.png'
PACK_WHITE = ROOT / 'assets' / 'brand-brentronix' / 'print-horizontal-1color-white-h75.png'
HTML = ROOT / 'index.html'
SRC = ROOT / 'src'
BX_CONST_RE = re.compile(r"const bx = '<img class=\"band-bx\" src=\"data:image/png;base64,([A-Za-z0-9+/=\s]+)\"")
BAND_BX_RE = re.compile(
    r'<img class="band-bx" src="data:image/png;base64,([A-Za-z0-9+/=\s]+)"'
    r'|src="data:image/png;base64,([A-Za-z0-9+/=\s]+)"[^>]*class="band-bx"',
)
DATA_URI_RE = re.compile(r'data:image/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)', re.I)
CHIP_RE = re.compile(r'\.band\s+\.band-bx\{[^}]*\}')
ML_RE = re.compile(r'<!--ML-BEGIN-->.*?<!--ML-END-->', re.S)
WANT_COLOR = 'f100143778ddf178397ea298b339461f43a163375f9b161a415b31933f689a8c'
WANT_LIGHT = '78638f354d1fb3f0ba449848ed92304aa6cb5d3fcf9fdcc3f68fe63ac87aa335'
WANT_WHITE = '018b64bb9c54e1be70a6fd95de185ae89e19f3c931db6475e9f8052852af678e'
STALE_COLOR = 'a5cae07e6be8395d25829ad2e48a22d8b94fb1cd88e14e1cc6e2d150324dfc88'
ML_SHA = '2031e3938f9eea7b6cab8efb5f51e5cfb4fad73f8790f3ba374f20c926a37739'
R = []

def sha(b):
    return hashlib.sha256(b).hexdigest()

def ok(n, c, i=''):
    R.append(bool(c))
    print('PASS' if c else 'FAIL', n, str(i)[:300])

def decode_b64(s):
    return base64.b64decode(re.sub(r'\s+', '', s))

def text_files():
    files = [HTML]
    if SRC.is_dir():
        for p in sorted(SRC.rglob('*')):
            if p.is_file() and p.suffix.lower() in {'.js', '.mjs', '.cjs', '.html', '.css', '.ts'}:
                files.append(p)
    return files

def all_decoded_uris(text):
    out = []
    for m in DATA_URI_RE.finditer(text):
        try:
            out.append((m.start(), sha(decode_b64(m.group(2)))))
        except Exception:
            out.append((m.start(), None))
    return out

def main():
    pack_color = sha(PACK_COLOR.read_bytes())
    pack_light = sha(PACK_LIGHT.read_bytes())
    pack_white = sha(PACK_WHITE.read_bytes())
    ok('pack print-horizontal-whiteblue-dark-h75.png is the 25 Nov 10:10 CT raster', pack_color == WANT_COLOR, pack_color)
    ok('print-on-white print-horizontal-light-h75.png is still the navy/teal light raster', pack_light == WANT_LIGHT, pack_light)
    ok('pack print-horizontal-1color-white-h75.png is unchanged', pack_white == WANT_WHITE, pack_white)

    text = HTML.read_text()
    const_found = [sha(decode_b64(m.group(1))) for m in BX_CONST_RE.finditer(text)]
    ok('exactly two const bx band-bx data URIs (color and one-color)', len(const_found) == 2, const_found)
    ok('const bx color URI on the #102645 header decodes to the whiteblue compact horizontal',
       WANT_COLOR in const_found and pack_color in const_found, const_found)
    ok('one-color white band-bx URI is unchanged', WANT_WHITE in const_found and pack_white in const_found, const_found)

    ml = ML_RE.search(text)
    ok('shared ML block is present and unchanged', bool(ml) and sha(ml.group(0).encode()) == ML_SHA,
       sha(ml.group(0).encode()) if ml else None)

    files = text_files()
    rels = [p.relative_to(ROOT).as_posix() for p in files]
    ok('scan set includes index.html and src/**', 'index.html' in rels and any(r.startswith('src/') for r in rels), rels)

    raw_stale = []
    decoded_stale = []
    decoded_old_light_on_dark = []
    color_bands = []
    all_bands = []
    chips = []
    for p in files:
        t = p.read_text()
        rel = p.relative_to(ROOT).as_posix()
        if 'a5cae07e' in t or STALE_COLOR in t:
            raw_stale.append(rel)
        for pos, h in all_decoded_uris(t):
            if h == STALE_COLOR:
                decoded_stale.append((rel, t[:pos].count('\n') + 1, h))
        for m in BAND_BX_RE.finditer(t):
            h = sha(decode_b64(m.group(1) or m.group(2)))
            line = t[:m.start()].count('\n') + 1
            all_bands.append((rel, line, h))
            if h != WANT_WHITE:
                color_bands.append((rel, line, h))
                if h == WANT_LIGHT:
                    decoded_old_light_on_dark.append((rel, line, h))
        for m in CHIP_RE.finditer(t):
            rule = m.group(0)
            chips.append((rel, rule))

    ok('a5cae07e does not appear in raw text of index.html or src/**', not raw_stale, raw_stale)
    ok('decoded data URIs in index.html or src/** are not the stale 24 Nov v4 raster',
       not decoded_stale, decoded_stale)
    ok('old navy/teal light raster 78638f35 is not used on dark #102645 headers',
       not decoded_old_light_on_dark, decoded_old_light_on_dark)
    ok('every color band data URI on a dark header decodes to sha256 f1001437… (whiteblue compact h75)',
       bool(color_bands) and all(h == WANT_COLOR == pack_color for _, _, h in color_bands), color_bands)
    ok('tbReportHtml color band is present in index.html and src/toolbox.js',
       any(p == 'index.html' and h == WANT_COLOR for p, _, h in color_bands) and
       any(p == 'src/toolbox.js' and h == WANT_COLOR for p, _, h in color_bands),
       all_bands)
    ok('one-color white band-bx remains in index.html and is the only non-color band URI',
       any(p == 'index.html' and h == WANT_WHITE for p, _, h in all_bands) and
       all(h in (WANT_COLOR, WANT_WHITE) for _, _, h in all_bands), all_bands)
    ok('band-bx CSS on the #102645 header has no white chip',
       bool(chips) and all('background:#fff' not in rule and 'background: #fff' not in rule for _, rule in chips),
       chips)

    print(f'{sum(R)}/{len(R)} passed')
    sys.exit(0 if all(R) else 1)

if __name__ == '__main__':
    main()
