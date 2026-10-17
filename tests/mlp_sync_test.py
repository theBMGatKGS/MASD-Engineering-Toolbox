"""Shared-module sync check: modulaser-project.js and masd-engine.js must be identical everywhere they are used.
Test the commit under test, not live sibling checkouts: set CALC_DIR, REPORT_DIR, MLP_SRC and ENGINE_SRC (e.g. to `git worktree`/`git archive`
exports of the pinned commits). Defaults are the /workspace checkouts. Usage: TOOLBOX_DIR=.. CALC_DIR=<calc> REPORT_DIR=<report> python3 tests/mlp_sync_test.py"""
import hashlib, os, re, sys
# QA D1: never run silently against the wrong checkout — TOOLBOX_DIR must be set explicitly.
if not os.environ.get('TOOLBOX_DIR'):
    sys.stderr.write('ERROR: set TOOLBOX_DIR to the Toolbox checkout to test (e.g. TOOLBOX_DIR=$PWD/..). Refusing to guess.\n'); sys.exit(2)

H=lambda b: hashlib.sha256(b.encode()).hexdigest()[:16]
TB=os.environ['TOOLBOX_DIR'].rstrip('/')+'/'; CA=os.environ.get('CALC_DIR','/workspace/ModuLaser-Battery-Calculator').rstrip('/')+'/'; RP=os.environ.get('REPORT_DIR','/workspace/ModuLaser-Commisioning-Report').rstrip('/')+'/'
MS=os.environ.get('MLP_SRC','/workspace/mlp/modulaser-project.js'); ES=os.environ.get('ENGINE_SRC','/workspace/tb/engine/masd-engine.js')
print('checking', TB, CA, RP)
def block(path, sid):
    s=open(path).read(); m=re.search(r'<script id="%s">\n(.*?)\n</script>'%sid, s, re.S); return m.group(1) if m else None
mlp={ 'source /workspace/mlp': open(MS).read(),
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
ver=re.search(r"MLP.VERSION = '([\d.]+)'", mlp['source /workspace/mlp']).group(1); ev=re.search(r"MASD_ENGINE_VERSION\s*=\s*'([\d.]+)'", eng['source']).group(1)
print('MLP', ver, 'engine', ev); sys.exit(0 if ok else 1)
