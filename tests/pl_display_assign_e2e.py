"""Toolbox Displays E2E — drives the Toolbox app DOM (not a Calculator-only wrapper)."""
import os, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TB_ROOT = HERE.parent
WORKSPACE = TB_ROOT.parent
os.environ['APP'] = (TB_ROOT / 'index.html').resolve().as_uri()
os.environ.setdefault('RPT', (WORKSPACE / 'ModuLaser-Commisioning-Report' / 'index.html').resolve().as_uri())
os.environ.setdefault('PL_FIXTURE_DIR', str(WORKSPACE / 'plbuild' / 't'))
# Reuse the shared E2E script from the Calculator repo (relative neighbor)
calc_e2e = WORKSPACE / 'ModuLaser-Battery-Calculator' / 'tests' / 'pl_display_assign_e2e.py'
if not calc_e2e.exists():
    # Fallback: copy-local path next to this file if vendors relocate
    calc_e2e = HERE / 'pl_display_assign_e2e_shared.py'
sys.argv = [str(calc_e2e)]
import runpy
runpy.run_path(str(calc_e2e), run_name='__main__')
