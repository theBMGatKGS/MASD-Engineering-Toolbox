"""Toolbox 00.02.000 — MiniLaser (FHSD8075-ULF) in Config mode. Requires TOOLBOX_DIR; screenshots → $SHOTS (default temp)."""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright
TB = os.environ.get('TOOLBOX_DIR')
if not TB: print('TOOLBOX_DIR is required'); sys.exit(2)
URL = 'file://' + TB + '/index.html'; SHOTS = os.environ.get('SHOTS') or tempfile.mkdtemp(prefix='tb-ml-'); os.makedirs(SHOTS, exist_ok=True)
R = []
def ok(n, c, i=''): R.append(bool(c)); print('PASS' if c else 'FAIL', n, str(i)[:300])
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': 1600, 'height': 1000})).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_function('typeof tbSetMode==="function"')
    await pg.evaluate('''()=>{ const loc=document.querySelector('.location').dataset.loc; mlAddRow(loc,{setup:'manual', zone:'ML Hoist', fan:6, af:8, method:'Remote', io:2});
      mlAddRow(loc,{setup:'manual', zone:'ML blank'}); recalcLocationInner(loc); recalcLocation(loc); tbSetMode('config'); }''')
    await pg.wait_for_timeout(400)
    devs = await pg.evaluate("tbDevices().filter(d=>d.kind==='minilaser').map(d=>[d.name,d.address,d.fan,d.ioModules])")
    ok('MiniLasers listed in Config mode, no address', len(devs) == 2 and all(d[1] == '' for d in devs), devs)
    await pg.evaluate("tbSel=tbDevices().find(d=>d.name==='ML Hoist').id; tbRenderConfig()")
    labels = await pg.evaluate("[...document.querySelectorAll('#tb-cfg-editor .tb-io tbody td:first-child b')].map(b=>b.textContent)")
    ok('relay labels exact', labels[:3] == ['R1 Fault relay (fixed)', 'R2 Relay output 1 (Prealarm)', 'R3 Relay output 2 (Fire Alarm)'], labels[:4])
    ok('IN1 + 2 expansion modules → X1/X2 OUT1–5 and IN1–2 (4 + 14 rows)', len(labels) == 18 and labels[3].startswith('IN1') and 'X2 IN2 (15 kΩ supervised)' in labels, len(labels))
    r1 = await pg.evaluate("(()=>{const c=document.querySelector('[data-tb-io=r1][data-io-k=used]'), f=document.querySelector('[data-tb-io=r1][data-io-k=fn]'); return [c.checked,c.disabled,f.disabled,f.value]})()")
    ok('R1 fixed: used, locked, Fault', r1 == [True, True, True, 'Fault'], r1)
    blanks = await pg.evaluate("[...document.querySelectorAll('#tb-cfg-editor [data-tb-ml]')].map(s=>[s.dataset.tbMl,s.value])")
    ok('no numeric prefills (application, delays, flow all blank)', len(blanks) == 4 and all(v == '' for _, v in blanks), blanks)
    await pg.select_option('[data-tb-ml=application]', 'UL 268 Ed.7 OAP'); await pg.wait_for_timeout(150)
    await pg.select_option('[data-tb-ml=flowLevel]', '40'); await pg.wait_for_timeout(200)
    w = await pg.evaluate("document.querySelector('#tb-cfg-editor').textContent")
    ok('flow fault 40% on UL application warns', 'Flow fault 40% on a UL/FM application' in w)
    await pg.screenshot(path=SHOTS + '/20-toolbox-config-minilaser.png', full_page=False)
    await pg.evaluate("tbSel=tbDevices().find(d=>d.name==='ML blank').id; tbRenderConfig()")
    ok('blank fan → ⚠ Incomplete warning', '⚠ Incomplete' in await pg.evaluate("document.querySelector('#tb-cfg-editor').textContent"))
    st = await pg.evaluate("tbDevices().filter(d=>d.kind==='minilaser').map(tbCfgState)")
    ok('config state computed', all(s in ('ok', 'warn', 'err', 'none') for s in st), st)
    ok('no page errors', not errs, errs)
    await b.close()
  print(f'SUMMARY {sum(R)} / {len(R)}'); sys.exit(0 if all(R) else 1)
asyncio.run(main())
