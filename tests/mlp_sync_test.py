"""Shared-module sync check: modulaser-project.js and masd-engine.js must be identical everywhere they are used."""
import hashlib, os, re, sys
H=lambda b: hashlib.sha256(b.encode()).hexdigest()[:16]
TB=os.environ.get('TOOLBOX_DIR','/workspace/MASD-Engineering-Toolbox').rstrip('/')+'/'; CA='/workspace/ModuLaser-Battery-Calculator/'; RP='/workspace/ModuLaser-Commisioning-Report/'
def block(path, sid):
    s=open(path).read(); m=re.search(r'<script id="%s">\n(.*?)\n</script>'%sid, s, re.S); return m.group(1) if m else None
mlp={ 'source /workspace/mlp': open('/workspace/mlp/modulaser-project.js').read(),
  'toolbox file': open(TB+'modulaser-project.js').read(), 'toolbox index.html': block(TB+'index.html','mlp-shared'),
  'calculator file': open(CA+'modulaser-project.js').read(), 'calculator html': block(CA+'modulaser_battery_calculator.html','mlp-shared'),
  'report file': open(RP+'modulaser-project.js').read(), 'report index.html': block(RP+'index.html','mlp-shared') }
eng={ 'source': open('/workspace/tb/engine/masd-engine.js').read(), 'toolbox file': open(TB+'masd-engine.js').read(),
  'toolbox index.html': block(TB+'index.html','masd-engine'), 'calculator file': open(CA+'masd-engine.js').read(), 'calculator html': block(CA+'modulaser_battery_calculator.html','masd-engine') }
ok=True
for name,d in [('modulaser-project.js',mlp),('masd-engine.js',eng)]:
    ref=d[next(iter(d))].strip(); hs={k:(H(v.strip()) if v else 'MISSING') for k,v in d.items()}
    same=all(v and v.strip()==ref for v in d.values()); ok&=same
    print(('PASS' if same else 'FAIL'), name, hs)
ver=re.search(r"MLP.VERSION = '([\d.]+)'", mlp['source /workspace/mlp']).group(1); ev=re.search(r"MASD_ENGINE_VERSION\s*=\s*'([\d.]+)'", eng['source']).group(1)
print('MLP', ver, 'engine', ev); sys.exit(0 if ok else 1)
