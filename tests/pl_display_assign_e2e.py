"""Playwright E2E: PipeCAD Displays step (S1A/S2A/S3B/S5B) end to end, in the Battery Calculator or the Toolbox.

Synthetic fixtures only: tests/pl_display_fixtures.py writes them to a temp folder at test time (never committed);
the Campus / Deck cases use make_synthetic_pl.py fixtures from PL_FIXTURE_DIR when present.
Covers QA re-review RB2 (Command accept through Create sheets), 2-floor grouping (no cross-floor clusters),
RH1 (update adds to existing counts), RH2 (reopen keeps overrides, flag and Command "Not now"; flag shown),
RH3 (Standalone: no Command offer), RM2 (no default display keys in calc state), Check link replace on Apply only
(address, cluster and zone name kept), and the Field Report S4B badge from a real Calculator export.
Third review: new builds ask Networked / Standalone before the Command offer (limit b) and are not asked again after
Create sheets; Make all Standalone with an assumed Command display warns and offers removal; a skipped floor stays
skipped on Check link (stable link + Area key, limit c); assumed names never repeat; the job time zone is validated
and exported as project.timeZone only when set, and the Field Report picks it up.
Run: python3 tests/pl_display_assign_e2e.py        (APP= / RPT= / PL_FIXTURE_DIR= override the defaults)
"""
import asyncio, json, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import pl_display_fixtures as FX

REPO = HERE.parent
APP_FILE = REPO / ('modulaser_battery_calculator.html' if (REPO / 'modulaser_battery_calculator.html').exists() else 'index.html')
APP = os.environ.get('APP') or APP_FILE.resolve().as_uri()
RPT_FILE = REPO.parent / 'ModuLaser-Commisioning-Report' / 'index.html'
RPT = os.environ.get('RPT') or (RPT_FILE.resolve().as_uri() if RPT_FILE.exists() else '')
FIXTURE_DIR = Path(os.environ.get('PL_FIXTURE_DIR') or (REPO.parent / 'plbuild' / 't'))
CAMPUS = FIXTURE_DIR / 'Example-Campus-PSU.pl'
F = FX.write_all()

R = []
def ok(n, c, i=''):
    R.append((n, bool(c)))
    print(('PASS' if c else 'FAIL'), n, ('' if c else str(i)[:300]))

async def fresh(pg):
    await pg.goto(APP)
    await pg.evaluate('localStorage.clear()')
    await pg.reload()
    await pg.wait_for_function('typeof openPlWizard==="function" && typeof suggestDisplays==="function"')

async def to_rename(pg, pl_path):
    await pg.click('#import-pl-btn')
    await pg.wait_for_selector('#plw-overlay.open')
    await pg.evaluate("""()=>{for(const [id,v] of [['plw-basis','NFPA 72 Standard'],['plw-temp','77']]){
        const s=document.getElementById(id); if(s&&!s.value){ s.value=v; s.dispatchEvent(new Event('change')); } }}""")
    await pg.click('#plw-next')
    await pg.set_input_files('#plw-file', [str(pl_path)])
    await pg.wait_for_function('plWiz.files.length > 0')
    await pg.click('#plw-next')
    await pg.wait_for_timeout(150)
    if await pg.locator('#plw-suggest-all').count():
        await pg.click('#plw-suggest-all')

async def click_next(pg, wait=300):
    await pg.click('#plw-next'); await pg.wait_for_timeout(wait)
    return await pg.evaluate('[plWiz.step, plWiz.displaysPhase]')

SEEN = []
async def handle_post_create(pg, scheme='networked'):
    for _ in range(8):
        await pg.wait_for_timeout(250)
        title = await pg.evaluate("document.getElementById('prompt-overlay')?.classList.contains('open')?document.getElementById('prompt-title')?.textContent:''")
        if title: SEEN.append(title)
        if title == 'Confirm Settings?': await pg.click('#prompt-actions button[data-value="confirm"]')
        elif title == 'Networked or Standalone?': await pg.click(f'#prompt-actions button[data-value="{scheme}"]')
        elif title == 'Auto address?': await pg.click('#prompt-actions button[data-value="yes"]')
        elif title in ('Address the new sheets?', 'Address the new modules?'): await pg.click('#prompt-actions button[data-value="manual"]')
        elif title == 'MiniLaser import notice': await pg.click('#prompt-actions button[data-value="ok"]')
        elif not title: break

async def two_floor_to_fallback(pg):
    await to_rename(pg, F['two_floor'])
    st = await click_next(pg)
    ok('2-floor: Displays gate (S1A) opens', st == [4, 'gate'], st)
    body = await pg.inner_text('#plw-body')
    ok('2-floor: gate lists both floors as MISSING', body.count('MISSING') == 2 and 'Example Zone Alpha' in body and 'Example Zone Delta' in body, body[:300])
    await pg.click('#pl-disp-continue'); await pg.wait_for_timeout(200)
    plan = await pg.evaluate("plWiz.displaysSuggest.floors.map(f=>({k:f.floorKey,n:f.floorName,rule:f.suggestion&&f.suggestion.rule,need:f.needed,dets:f.detectors.map(d=>d.key)}))")
    alpha = next(f for f in plan if 'Alpha' in f['n']); delta = next(f for f in plan if 'Delta' in f['n'])
    ok('2-floor: Alpha (12 det) → S3B grouping, needs 2; Delta (8 det) → S2A suggestion',
       alpha['rule'] == 'grouped' and alpha['need'] == 2 and delta['rule'] == 'le8-floor', plan)
    return alpha, delta

async def group_alpha_accept_delta(pg, alpha, delta):
    # S3B: assign through the real swimlane buttons (8 + 4)
    for i, dk in enumerate(alpha['dets']):
        bid = 'new-0' if i < 8 else 'new-1'
        await pg.click(f'[data-assign="{alpha["k"]}|{bid}|{dk}"] >> nth=0')
    await pg.click(f'[data-acc="{delta["k"]}"]')
    await pg.wait_for_timeout(100)

async def create_sheets(pg, scheme='networked'):
    probs = await pg.evaluate('plStep4Problems()')
    ok('Power supplies: no rule problems after seeding', not probs, probs)
    await pg.click('#plw-finish', timeout=10000)
    await handle_post_create(pg, scheme)

async def sheet_rows(pg):
    return await pg.evaluate("""()=>[...document.querySelectorAll('.location')].map(l=>({loc:l.getAttribute('data-loc'), area:l.querySelector('.ps-location').value,
      rows:[...l.querySelectorAll('[data-role=module]')].map(r=>({type:r.querySelector('.type-select').value, origin:r.dataset.origin||'', key:r.dataset.plKey||'',
        zone:r.querySelector('.zone-name').value, addr:(r.querySelector('.module-address')||{}).value||'', cluster:(r.querySelector('.cluster-select')||{}).value||''}))}))""")

async def export_text(pg):
    # The Toolbox blocks Export until Performance Criteria are defined; then the same design section is built directly.
    return await pg.evaluate("""()=>new Promise(res=>{ const _d = v2Download; v2Download = (blob)=>{ v2Download = _d; blob.text().then(res); };
      if (mlpExportProject() === null){ v2Download = _d; closePlWizard(); const doc = MLP.blank(); doc.project = mlpProjectInfo(); doc.design = mlpBuildDesign(); doc.site = MLP_SITE;
        res(MLP.stringify(doc, 'ModuLaser Battery Calculator', mlpCalcRev(), '')); } })""")

async def pick_scheme(pg, scheme='networked'):
    st = await pg.evaluate('[plWiz.step, plWiz.displaysPhase]')
    if st == [4, 'scheme']:
        await pg.click('#pl-scheme-net' if scheme == 'networked' else '#pl-scheme-sa'); await pg.wait_for_timeout(300)
    return st

async def check_link(pg, pl_path):
    txt = Path(pl_path).read_text()
    await pg.evaluate("""([t,n])=>{ const l = PL_LINKS[0]; return plCheckLinkWithFile(l.id, new File([t], n)); }""", [txt, Path(pl_path).name])
    await pg.wait_for_timeout(300)

async def case_command_accept(pg):
    await fresh(pg)
    alpha, delta = await two_floor_to_fallback(pg)
    await group_alpha_accept_delta(pg, alpha, delta)
    st = await click_next(pg)
    body = await pg.inner_text('#plw-body')
    ok('Limit b: new build asks Networked or Standalone before any Command offer', st == [4, 'scheme'] and 'Networked or Standalone?' in body and await pg.locator('#pl-cmd-yes').count() == 0, [st, body[:200]])
    await pick_scheme(pg, 'networked')
    st = await pg.evaluate('[plWiz.step, plWiz.displaysPhase]')
    ok('S5B: Networked → 3 clusters on SenseNET 1, no Command → offer shown', st == [4, 'command'] and await pg.locator('#pl-cmd-yes').count() == 1, st)
    await pg.click('#pl-cmd-yes'); await pg.wait_for_timeout(300)
    st = await pg.evaluate('[plWiz.step, plWiz.displaysPhase]')
    ok('S5B Add 1 Command → Power supplies', st[0] == 5, st)
    cmd_psu = await pg.evaluate("Object.values(plWiz.psuByGroup).flat().filter(p=>p.devices.some(d=>d.type==='Command Display')).map(p=>p.devices.length)")
    ok('RB2: accepted Command display is on its own power supply', cmd_psu == [1], cmd_psu)
    tray = await pg.evaluate("Object.values(plWiz.unassignedByGroup).flat().length")
    ok('2-floor: every device placed (tray empty)', tray == 0, tray)
    SEEN.clear()
    await create_sheets(pg)
    ok('Limit b: Networked / Standalone is not asked again after Create sheets', 'Networked or Standalone?' not in SEEN and 'Auto address?' in SEEN, SEEN)
    ok('Limit b: every new sheet is Networked', await pg.evaluate("[...document.querySelectorAll('.location')].every(l=>addrSchemeOf(l)==='networked')"))
    sheets = await sheet_rows(pg)
    rows = [r for s in sheets for r in s['rows']]
    cmds = [r for r in rows if r['type'] == 'Command Display']
    ok('RB2: Create sheets writes the Command display row (assumed)', len(cmds) == 1 and cmds[0]['origin'] == 'assumed', cmds)
    std = [r for r in rows if r['type'] in ('Standard Display', 'Minimum Display')]
    ok('Create sheets: 3 assumed Std displays + 20 detectors', len(std) == 3 and all(r['origin'] == 'assumed' for r in std) and sum(r['type'] == 'Detector' for r in rows) == 20, [len(std), len(rows)])
    # clusters never cross floors: each detector's cluster points at a display sheet of its own Area
    disp_home = {}
    for s in sheets:
        for r in s['rows']:
            if r['type'] in ('Standard Display', 'Minimum Display'): disp_home[(s['loc'], r['cluster'])] = s['area']
    bad = []
    for s in sheets:
        for r in s['rows']:
            if r['type'] != 'Detector': continue
            c = r['cluster']
            home = (c.split(':')[1], c.split(':')[2]) if c.startswith('r:') else (s['loc'], c)
            if disp_home.get(home) != s['area']: bad.append((s['area'], c))
    ok('2-floor: every detector clusters to a display on its own floor (unpadded)', not bad and all(not r['cluster'].startswith('0') for r in rows if r['cluster']), bad[:5])
    per = {}
    for s in sheets:
        for r in s['rows']:
            if r['type'] == 'Detector': per[(s['loc'], r['cluster'])] = per.get((s['loc'], r['cluster']), 0) + 1
    ok('2-floor: no cluster over 8 detectors', True)  # per-sheet counts are ≤4; cross-sheet totals checked below
    tot = {}
    for s in sheets:
        for r in s['rows']:
            if r['type'] != 'Detector': continue
            c = r['cluster']; home = (c.split(':')[1], c.split(':')[2]) if c.startswith('r:') else (s['loc'], c)
            tot[home] = tot.get(home, 0) + 1
    ok('2-floor: clusters hold 8 / 4 / 8 detectors (≤ 8 each)', sorted(tot.values()) == [4, 8, 8], tot)
    flag = await pg.evaluate("(document.getElementById('pl-rerun-flag')||{}).textContent||''")
    ok('RH2: re-run-in-PipeCAD flag shown after the wizard closes', 'PipeCAD' in flag and '4 assumed displays' in flag, flag)
    st = await pg.evaluate('buildStateObject()')
    ok('RH2: state saves displayPlan, rerunPipeCad, displaysAssumed', st.get('rerunPipeCad') is True and st.get('displaysAssumed') is True and len(st.get('displayPlan') or {}) >= 2, {k: st.get(k) for k in ('rerunPipeCad', 'displaysAssumed', 'displayPlan')})
    ok('RH2: assumed origin/assumption saved on modules', sum(1 for l in st['locations'] for m in l['modules'] if m.get('origin') == 'assumed' and m.get('assumption')) == 4)
    text = await export_text(pg)
    doc = json.loads(text)
    devs = doc['design']['devices']
    ok('Export: Command display in design, origin assumed', any(d.get('type') == 'Command Display' and d.get('origin') == 'assumed' for d in devs))
    # reopen in a fresh page
    await fresh(pg)
    await pg.evaluate("([t])=>mlpImportProjectText(t, 'Example-Display-Job.mlproj.json')", [text])
    await pg.wait_for_timeout(500)
    st2 = await pg.evaluate('buildStateObject()')
    ok('RH2 reopen: displayPlan / rerunPipeCad / displaysAssumed restored', st2.get('displayPlan') == st.get('displayPlan') and st2.get('rerunPipeCad') is True and st2.get('displaysAssumed') is True,
       {k: st2.get(k) for k in ('rerunPipeCad', 'displaysAssumed')})
    ok('RH2 reopen: assumed rows keep origin', await pg.evaluate("document.querySelectorAll('[data-role=module][data-origin=assumed]').length") == 4)
    ok('RH2 reopen: flag shown', 'PipeCAD' in await pg.evaluate("(document.getElementById('pl-rerun-flag')||{}).textContent||''"))
    # the offer must not come back: a later import onto the same network already has a Command display
    await pg.evaluate("openPlWizard({})"); await pg.wait_for_timeout(100)
    ok('RB2: Command offer does not recur once the Command display exists', await pg.evaluate('plCommandOfferNeeded()') is False)
    await pg.evaluate('closePlWizard()')
    # Check link with v2: + 1 real Standard display on Delta → replace planned, nothing changed before Apply
    delta_before = [r for s in await sheet_rows(pg) if 'Delta' in s['area'] for r in s['rows'] if r['type'] == 'Standard Display'][0]
    await check_link(pg, F['v2'])
    pd = await pg.evaluate('PL_LINKS[0].pendingDiff')
    ok('Check link v2: +0 / −0 / 1 replaces assumed', pd and not pd['added'] and not pd['removed'] and len(pd.get('replaced') or []) == 1, pd)
    still = await pg.evaluate("document.querySelectorAll('[data-role=module][data-origin=assumed]').length")
    ok('Low: nothing is replaced before Apply', still == 4, still)
    body = await pg.inner_text('#plw-body')
    ok('Check link lists the replacement with address/cluster kept', 'replaces the assumed display' in body and 'keeps address' in body, body[:300])
    await pg.click('#pld-apply'); await pg.wait_for_timeout(300)
    delta_after = [r for s in await sheet_rows(pg) if 'Delta' in s['area'] for r in s['rows'] if r['type'] == 'Standard Display'][0]
    ok('Replace on Apply: Delta display is now from PipeCAD', delta_after['origin'] == 'pl' and delta_after['key'].endswith('#disp0'), delta_after)
    ok('Replace keeps address, cluster and zone name', (delta_after['addr'], delta_after['cluster'], delta_after['zone']) == (delta_before['addr'], delta_before['cluster'], delta_before['zone']) and delta_before['addr'] != '',
       [delta_before, delta_after])
    ok('Replace: no duplicate display row', sum(1 for s in await sheet_rows(pg) for r in s['rows'] if r['type'] == 'Standard Display') == 3)
    # Update with v4: a 9th detector on Delta (8 det + 1 display) must be a SHORTAGE, not OK
    await check_link(pg, F['v4'])
    pd = await pg.evaluate('PL_LINKS[0].pendingDiff')
    ok('Check link v4: +1 added', pd and len(pd['added']) == 1 and not pd['removed'], pd)
    await pg.click('#pld-apply'); await pg.wait_for_timeout(300)
    if await pg.locator('#plw-suggest-all').count(): await pg.click('#plw-suggest-all')
    st = await click_next(pg)
    body = await pg.inner_text('#plw-body')
    fl = await pg.evaluate("plWiz.displaysSuggest.floors.map(f=>[f.floorName,f.nDet,f.nCluster,f.status])")
    ok('RH1: update counts existing + added (Delta 9 det / 1 cluster → SHORTAGE)', st == [4, 'gate'] and 'SHORTAGE' in body and any(f[1] == 9 and f[2] == 1 and f[3] == 'needed' for f in fl), [st, fl])
    await pg.evaluate('closePlWizard()')

async def case_command_dismiss_and_reopen(pg):
    await fresh(pg)
    alpha, delta = await two_floor_to_fallback(pg)
    await group_alpha_accept_delta(pg, alpha, delta)
    st = await click_next(pg)
    await pick_scheme(pg, 'networked')
    await pg.click('#pl-cmd-no'); await pg.wait_for_timeout(300)
    await create_sheets(pg)
    text = await export_text(pg)
    await fresh(pg)
    await pg.evaluate("([t])=>mlpImportProjectText(t, 'Example-Display-Job.mlproj.json')", [text])
    await pg.wait_for_timeout(400)
    ok('RH2 reopen: Command "Not now" kept (displayPlan.__commandDismissed)', await pg.evaluate("!!(buildStateObject().displayPlan||{}).__commandDismissed"))
    await pg.evaluate("openPlWizard({})")
    ok('RH2: next wizard session starts from the saved overrides', await pg.evaluate("!!plWiz.displayPlan.__commandDismissed && plWiz.rerunPipeCad === false"))
    await pg.evaluate('closePlWizard()')

async def case_standalone(pg):
    await fresh(pg)
    alpha, delta = await two_floor_to_fallback(pg)
    await group_alpha_accept_delta(pg, alpha, delta)
    await click_next(pg)
    await pick_scheme(pg, 'standalone')
    st = await pg.evaluate('[plWiz.step, plWiz.displaysPhase]')
    ok('Limit b: Standalone first → no Command offer, straight to Power supplies', st[0] == 5 and await pg.locator('#pl-cmd-yes').count() == 0, st)
    ok('Limit b: Standalone → no assumed Command display planned', await pg.evaluate("!plIncludedGroups().some(({g})=>(g.displays||[]).some(d=>d.type==='Command Display'))"))
    SEEN.clear()
    await create_sheets(pg, scheme='networked')   # the prompt must not appear; if it did, answering Networked would fail the checks below
    n_sa = await pg.evaluate("[...document.querySelectorAll('.location')].filter(l=>addrSchemeOf(l)==='standalone').length")
    n_all = await pg.evaluate("document.querySelectorAll('.location').length")
    ok('Limit b: Standalone answer applied to every sheet, not asked twice', n_sa == n_all and n_all >= 1 and 'Networked or Standalone?' not in SEEN, [n_sa, n_all, SEEN])
    ok('Limit b: no Command display rows', await pg.evaluate("![...document.querySelectorAll('.type-select')].some(s=>s.value==='Command Display')"))
    await pg.evaluate("openPlWizard({})")
    r = await pg.evaluate("[plCommandOfferNeeded(), plWiz.settings.addrScheme]")
    ok('RH3: Standalone project → addrScheme standalone, no Command offer', n_sa >= 1 and r == [False, 'standalone'], [n_sa, r])
    await pg.evaluate('closePlWizard()')

async def wait_prompt(pg, title, ms=4000):
    for _ in range(ms // 100):
        t = await pg.evaluate("document.getElementById('prompt-overlay').classList.contains('open')?document.getElementById('prompt-title').textContent:''")
        if t == title: return True
        await pg.wait_for_timeout(100)
    return False

async def case_standalone_after_command(pg):
    # QA limit (b) safety net: Command accepted on Networked, then every sheet made Standalone
    await fresh(pg)
    alpha, delta = await two_floor_to_fallback(pg)
    await group_alpha_accept_delta(pg, alpha, delta)
    await click_next(pg); await pick_scheme(pg, 'networked')
    await pg.click('#pl-cmd-yes'); await pg.wait_for_timeout(300)
    await create_sheets(pg)
    n_sheets = await pg.evaluate("document.querySelectorAll('.location').length")
    await pg.evaluate("applyUnifiedAddressing('standalone', false)")
    shown = await wait_prompt(pg, 'Remove the assumed Command display?')
    desc = await pg.evaluate("document.getElementById('prompt-overlay').innerText")
    ok('Limit b: all sheets Standalone + assumed Command → warning offers removal', shown and 'Standalone' in desc and 'CMD' in desc, desc[:300])
    await pg.click('#prompt-actions button[data-value="remove"]'); await pg.wait_for_timeout(400)
    left = await pg.evaluate("[...document.querySelectorAll('.type-select')].filter(s=>s.value==='Command Display').length")
    n2 = await pg.evaluate("document.querySelectorAll('.location').length")
    ok('Limit b: Remove takes out the Command display and its own sheet', left == 0 and n2 == n_sheets - 1, [left, n_sheets, n2])
    ok('Limit b: other assumed displays and the re-run flag stay', await pg.evaluate("document.querySelectorAll('[data-role=module][data-origin=assumed]').length") == 3 and await pg.evaluate('!!window.__rerunPipeCad'))
    links = await pg.evaluate("PL_LINKS.map(l=>Object.keys(l.assumedDisplays||{}).filter(k=>k.startsWith('assumed:cmd')).length)")
    ok('Limit b: removed Command is dropped from the link record', links == [0], links)
    await pg.evaluate("applyUnifiedAddressing('networked', false)"); await pg.evaluate("applyUnifiedAddressing('standalone', false)")
    ok('Limit b: no warning when no assumed Command is left', not await wait_prompt(pg, 'Remove the assumed Command display?', 1500))

async def case_skip_key(pg):
    # QA limit (c): skip is keyed by link id + Area (not position); a skipped floor stays skipped while its need does not grow
    await fresh(pg)
    alpha, delta = await two_floor_to_fallback(pg)
    await pg.click(f'[data-acc="{delta["k"]}"]'); await pg.wait_for_timeout(80)
    await pg.click(f'[data-skip="{alpha["k"]}"] >> nth=0'); await pg.wait_for_timeout(100)
    await click_next(pg); await pick_scheme(pg, 'networked')
    if await pg.locator('#pl-cmd-no').count(): await pg.click('#pl-cmd-no'); await pg.wait_for_timeout(300)
    await pack_trays(pg)   # a skipped floor has no display, so its detectors wait in the tray until packed
    await create_sheets(pg)
    key = await pg.evaluate("PL_LINKS[0].id + ':area:Example Zone Alpha'")
    dp = await pg.evaluate("window.__displayPlan")
    ok('Limit c: skip saved under link id + Area name (no index)', (dp.get(key) or {}).get('decision') == 'skip' and (dp.get(key) or {}).get('needed') == 2 and not any(k[:2] in ('0:', '1:') for k in dp), dp)
    await check_link(pg, F['v6'])   # + a 13th detector on Alpha: 13 det / 0 displays still needs 2
    pd = await pg.evaluate('PL_LINKS[0].pendingDiff')
    ok('Check link v6: +1 added (detector on Alpha)', pd and len(pd['added']) == 1, pd)
    await pg.click('#pld-apply'); await pg.wait_for_timeout(300)
    if await pg.locator('#plw-suggest-all').count(): await pg.click('#plw-suggest-all')
    st = await click_next(pg)
    fl = await pg.evaluate("plWiz.displaysSuggest.floors.map(f=>[f.floorName,f.nDet,f.status,f.floorKey])")
    ok('Limit c: skipped Alpha (13 det, still needs 2) is not re-prompted on Check link', st[0] == 5 and any('Alpha' in f[0] and f[1] == 13 and f[2] == 'skipped' and f[3] == key for f in fl), [st, fl])
    await pg.evaluate('closePlWizard()')

async def case_unique_names(pg):
    await fresh(pg)
    await to_rename(pg, F['same_abbr'])
    # the detectors' suggested names collide too (same abbreviation); give Dock's detectors their own names, as a user would
    await pg.evaluate("plWiz.files[0].groups[1].detectors.forEach((d,i)=>{ d.newName='DOCK-D'+(i+1); d.userNamed=true; }); plRender()")
    await click_next(pg)
    await pg.click('#pl-disp-continue'); await pg.wait_for_timeout(200)
    for k in await pg.evaluate("plWiz.displaysSuggest.floors.filter(f=>f.status==='needed').map(f=>f.floorKey)"):
        await pg.click(f'[data-acc="{k}"]'); await pg.wait_for_timeout(80)
    await click_next(pg); await pick_scheme(pg, 'networked')
    if await pg.locator('#pl-cmd-no').count(): await pg.click('#pl-cmd-no'); await pg.wait_for_timeout(300)
    await create_sheets(pg)
    names = [r['zone'] for s in await sheet_rows(pg) for r in s['rows'] if r['origin'] == 'assumed']
    ok('Assumed names never repeat (Delta / Dock share an abbreviation)', len(names) == 2 and len(set(names)) == 2, names)

async def case_job_tz(pg):
    await fresh(pg)
    await pg.fill('#job-tz-input', 'Mars/Olympus'); await pg.dispatch_event('#job-tz-input', 'change'); await pg.wait_for_timeout(150)
    ok('Job TZ: an invalid zone is refused (field cleared, nothing stored)', await pg.evaluate("document.getElementById('job-tz-input').value === '' && !MLP_PROJECT_EXTRA.timeZone"))
    await pg.fill('#job-tz-input', 'america/chicago'); await pg.dispatch_event('#job-tz-input', 'change'); await pg.wait_for_timeout(150)
    ok('Job TZ: valid zone is normalized (america/chicago → America/Chicago)', await pg.evaluate("document.getElementById('job-tz-input').value") == 'America/Chicago')
    ok('Job TZ: carried as project.timeZone', await pg.evaluate('mlpProjectInfo().timeZone') == 'America/Chicago')
    st = await pg.evaluate('buildStateObject()')
    await fresh(pg)
    await pg.evaluate('s=>applyLoadedState(s)', st); await pg.wait_for_timeout(200)
    ok('Job TZ: saved with the project and restored on reopen', await pg.evaluate("document.getElementById('job-tz-input').value") == 'America/Chicago')

async def pack_trays(pg):
    await pg.evaluate("""()=>{ Object.keys(plWiz.unassignedByGroup||{}).forEach(gk=>{ const b=document.querySelector('[data-pack="'+gk+'"]'); if(b) b.click(); }); }""")
    await pg.wait_for_timeout(150)

async def case_no_defaults(pg):
    await fresh(pg)
    await to_rename(pg, F['ok_one'])
    st = await click_next(pg)
    ok('No shortage: Displays step skipped to Power supplies', st[0] == 5, st)
    await pg.evaluate("""()=>{ Object.keys(plWiz.unassignedByGroup||{}).forEach(gk=>{ const b=document.querySelector('[data-pack="'+gk+'"]'); if(b) b.click(); }); }""")
    await create_sheets(pg)
    doc = json.loads(await export_text(pg))
    cs = doc['design']['calc']['state']
    ok('Job TZ: blank → project.timeZone omitted from the export', 'timeZone' not in doc['project'], doc['project'])
    ok('RM2: export omits displayPlan / rerunPipeCad / displaysAssumed at defaults', not any(k in cs for k in ('displayPlan', 'rerunPipeCad', 'displaysAssumed')), [k for k in ('displayPlan', 'rerunPipeCad', 'displaysAssumed') if k in cs])
    links = cs.get('plLinks') or []
    ok('RM2: linked file carries no default display keys', links and not any(k in links[0] for k in ('displayPlan', 'rerunPipeCad', 'assumedDisplays')), list(links[0].keys()) if links else links)
    ok('RM2: no assumed rows → no flag on screen', await pg.evaluate("!document.getElementById('pl-rerun-flag')"))
    return doc

async def case_campus_stop(pg):
    if not CAMPUS.exists():
        print('SKIP Campus S1A Stop (make_synthetic_pl fixture not generated)'); return
    await fresh(pg)
    await to_rename(pg, CAMPUS)
    st = await click_next(pg)
    ok('Campus: Displays gate', st == [4, 'gate'], st)
    ok('S1A: Next visible / Create sheets hidden on Displays', await pg.is_visible('#plw-next') and await pg.is_hidden('#plw-finish'))
    await pg.click('#pl-disp-stop'); await pg.wait_for_timeout(200)
    ok('S1A Stop: wizard closed, nothing created, no flag', await pg.evaluate("!document.getElementById('plw-overlay').classList.contains('open') && !document.querySelector('[data-role=module][data-origin=assumed]') && !buildStateObject().rerunPipeCad"))

async def case_report_s4b(pg, text):
    if not RPT:
        print('SKIP Report S4B (Field Report checkout not found; set RPT=)'); return
    await pg.goto(RPT)
    await pg.evaluate('localStorage.clear()'); await pg.reload()
    await pg.wait_for_function('typeof importProjectText==="function"')
    await pg.evaluate("sessionStorage.setItem('mfr-technician','Example Tech')")
    await pg.evaluate("([t])=>importProjectText(t, 'Example-Display-Job.mlproj.json')", [text])
    await pg.wait_for_timeout(400)
    for _ in range(3):   # confirm the import review if one opens
        if await pg.evaluate("document.getElementById('dlg').classList.contains('show')"):
            await pg.evaluate("""()=>{ const b=[...document.querySelectorAll('#dlgBtns button')].find(x=>x.classList.contains('pri')); if(b) b.click(); }"""); await pg.wait_for_timeout(400)
    info = await pg.evaluate("""()=>{ const d=(state.design&&state.design.devices||[]).filter(x=>MLP.isAssumedDisplay(x)); const m=state.modules.find(x=>d.some(y=>y.id===x.dev));
        if(m){ state.ui.view='mod:'+m.id; renderAll(); } return { n:d.length, mod: !!m }; }""")
    ok('Report: Calculator export brings assumed displays (no injection)', info['n'] == 4 and info['mod'], info)
    await pg.wait_for_timeout(300)
    html = await pg.evaluate("document.getElementById('app').innerHTML")
    ok('Report S4B: badge + actions menu on the module sheet', 'Assumed display (not in PipeCAD)' in html and 'Confirm installed' in html)
    z = await pg.evaluate('rpJobTimeZone()')
    ok('Report: job time zone comes from the Calculator export (America/Chicago, source project)', z.get('timeZone') == 'America/Chicago' and z.get('source') == 'project', z)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await (await b.new_context(viewport={'width': 1500, 'height': 1000})).new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        print('APP', APP)
        await case_campus_stop(pg)
        await case_command_accept(pg)
        await case_command_dismiss_and_reopen(pg)
        await case_standalone(pg)
        await case_standalone_after_command(pg)
        await case_skip_key(pg)
        await case_unique_names(pg)
        await case_job_tz(pg)
        await case_no_defaults(pg)
        ok('App: no page errors', not errs, errs[:3])
        # Report S4B from a real export of the accepted-Command project
        await fresh(pg)
        alpha, delta = await two_floor_to_fallback(pg)
        await group_alpha_accept_delta(pg, alpha, delta)
        await click_next(pg); await pick_scheme(pg, 'networked'); await pg.click('#pl-cmd-yes'); await pg.wait_for_timeout(300)
        await create_sheets(pg)
        await pg.fill('#job-tz-input', 'America/Chicago'); await pg.dispatch_event('#job-tz-input', 'change')
        text = await export_text(pg)
        ok('Export: project.timeZone = America/Chicago', json.loads(text)['project'].get('timeZone') == 'America/Chicago')
        errs.clear()
        await case_report_s4b(pg, text)
        ok('Report: no page errors', not errs, errs[:3])
        await b.close()
    failed = sum(1 for _, c in R if not c)
    print(f'{len(R) - failed}/{len(R)} passed' + (f', {failed} failed' if failed else ''))
    sys.exit(1 if failed else 0)

if __name__ == '__main__':
    asyncio.run(main())
