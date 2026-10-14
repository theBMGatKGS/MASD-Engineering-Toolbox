"""Build the MASD Engineering Toolbox index.html from the Battery Calculator HTML.
The Toolbox shares the calculator's UI and the byte-identical MASD engine block."""
import re, json, shutil, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import quickstart as Q
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CALC = os.environ.get('CALC_HTML', '/workspace/ModuLaser-Battery-Calculator/modulaser_battery_calculator.html')
FONTS = os.environ.get('FONTS_CSS', '/workspace/tb/fonts/plex-inline.css')
VER, MAJ, MIN, REV, DATE = '00.01.000', '00', '01', '000', '261013'
s = open(CALC).read(); fonts = open(FONTS).read()
def sub1(pat, rep, flags=0):
    global s
    n = len(re.findall(pat, s, flags)); assert n >= 1, pat
    s = re.sub(pat, rep, s, count=1, flags=flags)
sub1(r'<title>.*?</title>', '<title>MASD Engineering Toolbox</title>')
s = re.sub(r'<link rel="preconnect" href="https://fonts\.(googleapis|gstatic)\.com"[^>]*>\n?', '', s)
sub1(r'<link href="https://fonts\.googleapis\.com/[^>]*>', lambda m: '<style id="plex-fonts">' + fonts + '</style>')
assert 'fonts.googleapis' not in s and 'cdn.' not in s.lower().split('<!--engine-begin-->')[0]
sub1(r'<h1>ModuLaser Battery Calculator</h1>', '<h1>MASD Engineering Toolbox</h1>')
sub1(r'<div class="brand-mark">ML</div>', '<div class="brand-mark">TB</div>')
sub1(r'(<span class="help-about-k">Application</span><span class="help-about-v">)ModuLaser Battery Calculator', r'\1MASD Engineering Toolbox')
sub1(r'(id="about-engine-value">)[^<]*', r'\1MASD engine')
s = s.replace('<div class="help-about-row"><span class="help-about-k">Authored by</span>', '<div class="help-about-row"><span class="help-about-k">Calculator lineage</span><span class="help-about-v mono-inline">Battery Calculator 02.00.002 (absorbed)</span></div><div class="help-about-row"><span class="help-about-k">Project file</span><span class="help-about-v mono-inline">modulaser-project 1.1.0 (.mlproj.json)</span></div><div class="help-about-row"><span class="help-about-k">Authored by</span>', 1)
sub1(r'const APP_MAJOR = "\d+";', f'const APP_MAJOR = "{MAJ}";'); sub1(r'const APP_MINOR = "\d+";', f'const APP_MINOR = "{MIN}";')
AM = [
 ("000", "MASD Engineering Toolbox 00.01.000 — first build (pre-release; 01.00.000 is reserved for the refined release). Performance Criteria (Config): per-project standards basis with optional per-Area/Group overrides; UL market states \"Complies with UL 268, 7th Edition\" and enforces UL least-sensitive limits VEWFD 1.0 / EWFD 1.5 / SFD-OAP 2.18 %obs/ft (strictly less than); other bases prefill only cited values and require the engineer to enter, reference and confirm the rest; auto-drafted narrative edited and confirmed by the engineer, with Engineer of Record and specification reference; unresolved criteria block Export project; carried in .mlproj.json and printed by the Commissioning Report. The Toolbox absorbs the ModuLaser Battery Calculator 02.00.002 (same UI, same calculation engine, same .pl import) and adds: a per-project mode switch (Config only, Calculator only, Both); Config (design) mode with Alert/Prealarm/Fire 1/Fire 2, delays, latching, flow-fault limits and delay, day/night, LDD, I/O assignments and display settings per device, seeded from the performance class (VEWFD/EWFD/SFD) — manual-sourced values flagged (flow limits 20% and flow-fault delay 120 s, Table 29 p.76, ModuLaser Install Manual 04-4001-501-0803-05), every other seeded value marked 'typical – unverified' (Fire 1 starts at the FM/UL hole-sensitivity limit, App. A printed p.113); legacy import of every Battery Calculator save/export format (Save As .html 01.04–02.00, state JSON, Excel 01.04–02.00) migrated to .mlproj.json with a migration report; the field-change loop (verify/reject changes logged in the Commissioning Report, battery re-check, PipeCAD change list, auto-verify on .pl import, technician → designer → QA/Auditor approval chain stored in the file); Toolbox reports (Configuration schedule, Field Change / As-Built, PipeCAD change list, Migration report) as PDF/HTML/Word/Excel; offline Quick Start; PWA and Windows installer. Engine: MASD engine 1.0.0. Harmonization rule: any engine change bumps the Toolbox and the Battery Calculator revisions with matching notes, and each records the engine version. Shared modulaser-project.js 1.2.0 (identical in the Toolbox, Battery Calculator 02.00.002 and Commissioning Report 02.00.001): SHA-256 design hash plus separate site hash, unknown-key pass-through, metric .pl hole-sensitivity warning, corrected citations ('Action' is Prealarm; flow-fault delay 120 s, Table 29 p.76; FM/UL hole limits App. A printed p.113 of ModuLaser Install Manual 04-4001-501-0803-05). QA audit — date 2026-10-13; commit audited: none (Toolbox is new; the audit covered the shared components in Battery Calculator cc55189 and Report 6854f2e); issue: none yet for the Toolbox (related: Calculator issue #1, Report issue #8); summary: defaults citations FAIL → fixed in this revision; Example Project worst-hole rule PASS; audit trail FAIL → fixed in this revision; Quick Start version text FAIL → fixed in this revision. Final verdict: [PENDING RE-CHECK — placeholder]."),
]
am = 'const AMENDMENTS = [\n' + ',\n'.join('  { rev: "%s", major: "%s", minor: "%s", date: "%s", desc: %s }' % (r, MAJ, MIN, DATE, json.dumps(d)) for r, d in AM) + '\n];'
sub1(r'const AMENDMENTS = \[.*?\n\];', lambda m: am, re.S)
sub1(r'const SAVE_KEY = "modulaser_calculator_state_v1";', 'const SAVE_KEY = "masd_toolbox_state_v1";')
s = s.replace('const AUTOSAVE_ACTIVATED_KEY = "modulaser_autosave_activated";', 'const AUTOSAVE_ACTIVATED_KEY = "masd_toolbox_autosave_activated";')
s = s.replace('const AUTOSAVE_ENABLED_KEY = "modulaser_autosave_enabled";', 'const AUTOSAVE_ENABLED_KEY = "masd_toolbox_autosave_enabled";')
s = s.replace('value="modulaser_calculator_saved"', 'value="masd_toolbox_saved"')
# ---- Help ----
help_nav = '<a href="#help-tb-quickstart">Quick Start (Toolbox)</a>\n        <a href="#help-tb-guide">Toolbox: modes, Config, legacy, field changes</a>\n        '
sub1(r'(<a href="#help-howtouse">)', help_nav + r'\1')
guide = open(os.path.join(ROOT, 'src', 'help-toolbox.html')).read()
sub1(r'(<div class="help-section" id="help-howtouse">)', lambda m: '<div class="help-section" id="help-tb">' + Q.fragment() + guide + '</div>\n      ' + m.group(1))
faq = open(os.path.join(ROOT, 'src', 'faq-toolbox.html')).read()
sub1(r'(<div class="help-section" id="help-faq">\s*<h3>FAQs</h3>)', lambda m: m.group(1) + faq)
std = open(os.path.join(ROOT, 'src', 'standards-toolbox.html')).read()
sub1(r'(<div class="help-section" id="help-standards">\s*<h3>[^<]*</h3>)', lambda m: m.group(1) + std)
s = s.replace('How to Use the Calculator</a>', 'How to Use the Battery Calculator</a>', 1)
# ---- Toolbox layer ----
css = open(os.path.join(ROOT, 'src', 'toolbox.css')).read() + Q.FRAG_CSS
js = open(os.path.join(ROOT, 'src', 'toolbox.js')).read()
block = f'<!--TOOLBOX-BEGIN--><style id="tb-css">\n{css}\n</style><script id="toolbox">\n{js}\n</script><!--TOOLBOX-END-->\n'
i = s.rindex('</body>'); s = s[:i] + block + s[i:]
open(os.path.join(ROOT, 'index.html'), 'w').write(s)
# copy shared modules for reference/tests
for src, dst in [('/workspace/tb/engine/masd-engine.js', 'masd-engine.js'), ('/workspace/mlp/modulaser-project.js', 'modulaser-project.js')]:
    shutil.copy(src, os.path.join(ROOT, dst))
os.makedirs(os.path.join(ROOT, 'docs'), exist_ok=True)
qs = Q.standalone(fonts)
open(os.path.join(ROOT, 'quickstart.html'), 'w').write(qs); open(os.path.join(ROOT, 'docs', 'quickstart.html'), 'w').write(qs)
print('index.html', len(s), 'bytes · rev', VER)
