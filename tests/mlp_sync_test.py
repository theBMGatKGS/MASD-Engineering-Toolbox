"""Shared-module sync check: modulaser-project.js and masd-engine.js must be identical everywhere they are used.
Test the commit under test, not live sibling checkouts: set CALC_DIR, REPORT_DIR, MLP_SRC and ENGINE_SRC (e.g. to `git worktree`/`git archive`
exports of the pinned commits). Defaults: the Toolbox containing this test, its own shared-module files as the reference, and the
Calculator/Report checkouts next to it. Usage: TOOLBOX_DIR=.. CALC_DIR=<calc> REPORT_DIR=<report> python3 tests/mlp_sync_test.py"""
import hashlib, os, re, sys
# QA D1: never run silently against the wrong checkout — TOOLBOX_DIR must be set explicitly.
# Final QA: default to the repo under test (the checkout containing this file), not a guessed or live sibling path.
REPO=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('TOOLBOX_DIR', REPO)

H=lambda b: hashlib.sha256(b.encode()).hexdigest()[:16]
TB=os.environ['TOOLBOX_DIR'].rstrip('/')+'/'; _sib=os.path.dirname(TB.rstrip('/'))
CA=os.environ.get('CALC_DIR',os.path.join(_sib,'ModuLaser-Battery-Calculator')).rstrip('/')+'/'; RP=os.environ.get('REPORT_DIR',os.path.join(_sib,'ModuLaser-Commisioning-Report')).rstrip('/')+'/'
MS=os.environ.get('MLP_SRC',TB+'modulaser-project.js'); ES=os.environ.get('ENGINE_SRC',TB+'masd-engine.js')   # reference = the Toolbox under test
print('checking', TB, CA, RP)
def block(path, sid):
    s=open(path).read(); m=re.search(r'<script id="%s">\n(.*?)\n</script>'%sid, s, re.S); return m.group(1) if m else None
mlp={ 'reference (MLP_SRC)': open(MS).read(),
  'toolbox file': open(TB+'modulaser-project.js').read(), 'toolbox index.html': block(TB+'index.html','mlp-shared'),
  'calculator file': open(CA+'modulaser-project.js').read(), 'calculator html': block(CA+'modulaser_battery_calculator.html','mlp-shared'),
  'report file': open(RP+'modulaser-project.js').read(), 'report index.html': block(RP+'index.html','mlp-shared') }
eng={ 'source': open(ES).read(), 'toolbox file': open(TB+'masd-engine.js').read(),
  'toolbox index.html': block(TB+'index.html','masd-engine'), 'calculator file': open(CA+'masd-engine.js').read(), 'calculator html': block(CA+'modulaser_battery_calculator.html','masd-engine') }
ok=True
for name,d in [('modulaser-project.js',mlp),('masd-engine.js',eng)]:
    ref=d[next(iter(d))].strip(); hs={k:(H(v.strip()) if v else 'MISSING') for k,v in d.items()}
    same=all(v and v.strip()==ref for v in d.values()); ok&=same
    print(('PASS' if same else 'FAIL'), name, hs)
ver=re.search(r"MLP.VERSION = '([\d.]+)'", mlp['reference (MLP_SRC)']).group(1); ev=re.search(r"MASD_ENGINE_VERSION\s*=\s*'([\d.]+)'", eng['source']).group(1)
print('MLP', ver, 'engine', ev); sys.exit(0 if ok else 1)
