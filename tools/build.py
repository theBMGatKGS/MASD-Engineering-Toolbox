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
 ("000", "MASD Engineering Toolbox 00.01.000 — first build (pre-release; 01.00.000 is reserved for the refined release). Performance Criteria (Config): a Referenced standard drop-down of presets — VEWFD – NFPA 76/318, EWFD – NFPA 76, SFD/OAP – NFPA 72 (UL 268, 7th Ed. thresholds per Brent 2026-10-13: hole sensitivity at or below (≤) VEWFD 1.0 / EWFD 1.5 / SFD-OAP 2.18 %obs/ft and transport time no more than 60 / 43 / 43 s (UL 268, 7th Ed. Special Application Range 1 / Special Application Range 2 / Open Area per ModuLaser Install Manual App. A, printed p.113; EWFD 1.5 %obs/ft from NFPA 76), plus the code's prescriptions; \"Complies with UL 268, 7th Edition\" prints only after the engineer confirms it), EWFD – FM DS 5-32 and SFD – FM DS 5-48 (FM requirements only, no UL statement; FM Class 3230 hole limits App. A p.113), the Battery Calculator's four BS 5839-1 design bases, and Custom; only cited values are prefilled, the rest are marked engineer to define and must be entered, referenced and confirmed; optional per-Area/Group overrides; auto-drafted narrative naming the referenced standard, edited and confirmed by the engineer, with Engineer of Record and specification reference; unresolved criteria block Export project; carried in .mlproj.json and printed by the Commissioning Report, which checks each module against its Area/Group limits. The Toolbox absorbs the ModuLaser Battery Calculator 02.00.002 (same UI, same calculation engine, same .pl import) and adds: a per-project mode switch (Config only, Calculator only, Both); Config (design) mode with Alert/Prealarm/Fire 1/Fire 2, delays, latching, flow-fault limits and delay, day/night, LDD, I/O assignments and display settings per device, seeded from the performance class (VEWFD/EWFD/SFD) — manual-sourced values flagged (flow limits 20% and flow-fault delay 120 s, Table 29 p.76, ModuLaser Install Manual 04-4001-501-0803-05), every other seeded value marked 'typical – unverified' (Fire 1 starts at the FM/UL hole-sensitivity limit, App. A printed p.113); legacy import of every Battery Calculator save/export format (Save As .html 01.04–02.00, state JSON, Excel 01.04–02.00) migrated to .mlproj.json with a migration report; the field-change loop (verify/reject changes logged in the Commissioning Report, battery re-check, PipeCAD change list, auto-verify on .pl import, technician → designer → QA/Auditor approval chain stored in the file); Toolbox reports (Configuration schedule, Field Change / As-Built, PipeCAD change list, Migration report) as PDF/HTML/Word/Excel; offline Quick Start; PWA and Windows installer. Engine: MASD engine 1.0.0. Harmonization rule: any engine change bumps the Toolbox and the Battery Calculator revisions with matching notes, and each records the engine version. Shared modulaser-project.js 1.3.0 (identical in the Toolbox, Battery Calculator 02.00.002 and Commissioning Report 02.00.001): SHA-256 design hash plus separate site hash, unknown-key pass-through, metric .pl hole-sensitivity warning, corrected citations ('Action' is Prealarm; flow-fault delay 120 s, Table 29 p.76; FM/UL hole limits App. A printed p.113 of ModuLaser Install Manual 04-4001-501-0803-05). QA audit — date 2026-10-13; commit audited: none (Toolbox is new; the audit covered the shared components in Battery Calculator cc55189 and Report 6854f2e); issue: Toolbox issue #1 (https://github.com/theBMGatKGS/MASD-Engineering-Toolbox/issues/1; related: Calculator issue #1, Report issue #8); summary: defaults citations FAIL → fixed in this revision; Example Project worst-hole rule PASS; audit trail FAIL → fixed in this revision; Quick Start version text FAIL → fixed in this revision. QA re-check 2026-10-13 (8:28–8:45 PM ET): CONDITIONAL PASS. Fixed after the re-check: design hash stable on a no-op Calculator round trip (site and carried data kept out of design; calculator row ids renumbered by position); the mis-cited table number removed from the Report (App. A, printed p.113); UL 268, 7th Edition compliance never auto-confirmed — the engineer must confirm it before \"Complies with UL 268, 7th Edition\" prints; UL thresholds for NFPA presets per Brent: sensitivity at or below (≤) VEWFD 1.0 / EWFD 1.5 / SFD-OAP 2.18 %obs/ft, transport time no more than 60 / 43 / 43 s (UL 268 Special Application Range 1 / Range 2 / Open Area, ModuLaser Install Manual App. A, printed p.113; EWFD 1.5 from NFPA 76); sign-off order technician → designer → QA enforced, no hand-set status, reopening keeps history, real names required, QA overrides logged; Report edits blocked until a technician name is set; the edit log never overwrites entries; ASAG44201 citation replaced by NFPA 76-2024 clauses (Research 2026-10-13); standalone Quick Start says Battery Calculator 02.00.001+; legacy-import tests check required Ah per sheet. Final verdict: QA audit 2026-10-13, final re-check of commit c42156a (clean tree). PASS (pre-release). Tests: toolbox_test 139/139, shared-file and engine parity 2/2. Verified: Config/Calculator/Both modes, engine byte-identical to the Battery Calculator, legacy imports (15 fixtures) with Ah checks, sign-off order technician → designer → QA enforced (no manual status, real names required, QA ≠ designer), reopen keeps verifier history, QA overrides logged with a reason, \"Complies with UL 268, 7th Edition\" printed only after engineer confirmation. Note: the UL 268 thresholds (VEWFD 1.0/60 s, EWFD 1.5/43 s, SFD/OAP 2.18/43 s) are per Brent and not verified by QA. EWFD 1.5 %obs/ft comes from NFPA 76-2024 8.5.3.2.1.3, not from a UL 268 range (Range 2 is 0.05–2.18 %obs/ft, 3–43 s; Open Area 1.70–2.18, 6–43 s, Install Manual App. A p.113). Issue: https://github.com/theBMGatKGS/MASD-Engineering-Toolbox/issues/1 QA delta re-check 2026-10-13, commit 4878e0e (clean). PASS (pre-release), on condition that the updated tests are committed. Verified: ≤ rule and targets, UL 268 ranges with lower limits (EWFD capped at 1.5 per NFPA 76, labelled as such), NFPA 318-2025 §11.1.3 cleanroom citations, offline Quick Start, shared modulaser-project.js and engine identical across apps. Tests: sens_rule 13/13, toolbox_test 139/139 and report_audit_test 30/30 using the updated test files. The committed copies in tests/ are stale and must be committed before the tag..."),
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
