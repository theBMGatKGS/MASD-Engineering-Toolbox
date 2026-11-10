"""Synthetic PipeCAD .pl fixtures for the Displays-assign tests (02.02.002 / 00.03.002).

Numbers-only, fictional names (Example-*), generated at test time into a temp folder — never committed.
Detectors sit 40 ft apart, so nothing clusters by the 3 ft rule; display placement comes only from the Displays step.

  two_floor  Zone Alpha 12 detectors + Zone Delta 8 detectors, 0 displays           (QA re-review base file)
  v2         two_floor + 1 real Standard display on Zone Delta                      (Check link replace)
  v4         v2 + a 9th detector on Zone Delta                                      (update: 9 det / 1 cluster = SHORTAGE)
  v6         two_floor + a 13th detector on Zone Alpha                              (update: skipped Alpha still needs 2 → stays skipped)
  ok_one     Zone Echo 4 detectors + 1 Standard display                             (no Displays prompt)
  same_abbr  Zone Delta 4 detectors + Zone Dock 4 detectors, 0 displays             (assumed names must not repeat)
  dup_area   two floors both named Zone Alpha (8 and 12 detectors), 0 displays      (per-floor keys inside one file)
  dup_area_v2  dup_area + a 9th detector on the first Zone Alpha                    (Check link: floor 1 SHORTAGE, not pooled)
  dup_disp   two floors both named Zone Alpha, 4 detectors + 1 Standard display each (distinct display keys)
"""
import atexit, os, shutil, tempfile
from xml.sax.saxutils import escape

def _floor(name, n_det, displays, id0, x0):
    dets = ''.join(f"""
        <Detector><name>Det {i + 1:02d}</name><startX>{x0 + 40.0 * i:.1f}</startX><startY>{20.0 + 40.0 * (i % 3):.1f}</startY><startZ>0.0</startZ>
          <id>{id0 + i}</id><aspiratorSpeed>4</aspiratorSpeed><address>0</address><partNumber>0</partNumber><type>MULTISENSE</type></Detector>""" for i in range(n_det))
    disp = ''.join(f"""
        <Display><startX>{x0 + 7.0 + 40.0 * j:.1f}</startX><startY>5.0</startY><startZ>0.0</startZ><partNumber>{pn}</partNumber></Display>""" for j, pn in enumerate(displays))
    return f"""
    <Floor>
      <name>{escape(name)}</name>
      <curveDatabase />
      <detectorDatabase>{dets}
      </detectorDatabase>
      <displayDatabase>{disp}
      </displayDatabase>
      <virtualDetectorDatabase />
      <psuDatabase />
      <batteryDatabase />
    </Floor>"""

def pl_text(file_name, floors):
    """floors: [(name, n_detectors, [display partNumbers 0=Std 1=Min 2=Command]), ...]"""
    body = ''.join(_floor(n, d, disp, 100 * (k + 1), 1000.0 * k) for k, (n, d, disp) in enumerate(floors))
    return f"""<?xml version="1.0" encoding="utf-8"?>
<PipeLayout xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <properties>
    <FileName>{escape(file_name)}</FileName>
    <Location>Example Display Job</Location>
    <Designer>Example Engineer</Designer>
    <CompanyName>Example Co.</CompanyName>
    <ProjectName>Example Display Job</ProjectName>
  </properties>
  <pipecadVersion>0.0.0-example</pipecadVersion>
  <unit>1</unit>
  <floorDatabase>{body}
  </floorDatabase>
</PipeLayout>
"""

SPECS = {
    'two_floor': [('Example Zone Alpha', 12, []), ('Example Zone Delta', 8, [])],
    'v2':        [('Example Zone Alpha', 12, []), ('Example Zone Delta', 8, [0])],
    'v4':        [('Example Zone Alpha', 12, []), ('Example Zone Delta', 9, [0])],
    'v6':        [('Example Zone Alpha', 13, []), ('Example Zone Delta', 8, [])],
    'ok_one':    [('Example Zone Echo', 4, [0])],
    'same_abbr': [('Example Zone Delta', 4, []), ('Example Zone Dock', 4, [])],
    'dup_area':  [('Example Zone Alpha', 8, []), ('Example Zone Alpha', 12, [])],
    'dup_area_v2': [('Example Zone Alpha', 9, []), ('Example Zone Alpha', 12, [])],
    'dup_disp':  [('Example Zone Alpha', 4, [0]), ('Example Zone Alpha', 4, [0])],
}

def write_all(folder=None):
    """Write every fixture (same file name for the linked series, so Check link sees one file) and return {key: path}."""
    if not folder:
        folder = tempfile.mkdtemp(prefix='pl-disp-fx-')
        atexit.register(shutil.rmtree, folder, True)   # temp fixtures are removed when the test exits
    out = {}
    for k, fl in SPECS.items():
        d = os.path.join(folder, k); os.makedirs(d, exist_ok=True)
        name = 'Example-Display-Job.pl' if k in ('two_floor', 'v2', 'v4', 'v6') else 'Example-dup_area.pl' if k in ('dup_area', 'dup_area_v2') else f'Example-{k}.pl'
        p = os.path.join(d, name)
        with open(p, 'w') as f: f.write(pl_text(name, fl))
        out[k] = p
    return out

if __name__ == '__main__':
    print(write_all())
