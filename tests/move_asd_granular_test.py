"""02.03.000 / 00.04.000 — Move MiniLaser & ASD-160 between power supplies, plus granular calc / display cleanup.
Placeholder data only (PS-1 / PS-2 / Area A / ML 1). No real project or fixture names.
Run: python3 tests/move_asd_granular_test.py
APP=file:///.../index.html to point at another copy (Toolbox)."""
import asyncio, os, sys, re, tempfile, json, zipfile, io, base64
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
APP = os.environ.get('APP', 'file://' + ROOT + '/index.html')
OUT = os.environ.get('MLP_TEST_OUT') or tempfile.mkdtemp(prefix='ml-move-')
os.makedirs(OUT, exist_ok=True)
R = []
def ok(n, c, i=''):
    R.append(bool(c))
    print('PASS' if c else 'FAIL', n, str(i)[:400])

BOOT = r'''() => {
  clearEntireDocument({clearHeaders:false});
  const pre = [...document.querySelectorAll('.location')];
  addLocation();
  const l1 = [...document.querySelectorAll('.location')].pop();
  pre.forEach(e => e.remove());
  const apply = (l, name, area) => {
    l.querySelector('.ps-name').value = name;
    l.querySelector('.ps-location').value = area;
    l.querySelector('.design-basis-select').value = 'NFPA 72 Standard';
    applyDesignBasis(l.dataset.loc);
    l.querySelector('.temperature-select').value = '77';
  };
  apply(l1, 'PS-1', 'Area A');
  addLocation();
  const l2 = [...document.querySelectorAll('.location')].pop();
  apply(l2, 'PS-2', 'Area B');
  recalcLocation(l1.dataset.loc); recalcLocation(l2.dataset.loc);
  return { loc1: l1.dataset.loc, loc2: l2.dataset.loc };
}'''

ADD_ML = r'''({loc, zone, fan, extra}) => {
  const d = Object.assign({setup:'manual', zone: zone || 'ML 1', fan: fan == null ? 4 : fan, af:4, method:'DIP'}, extra || {});
  const tr = mlAddRow(loc, d);
  recalcLocation(loc);
  if (typeof refreshAllAmber === 'function') refreshAllAmber();
  if (typeof v2Refresh === 'function') v2Refresh();
  return tr && tr.id;
}'''

ADD_ASD = r'''({loc, zone, networked, address, extra}) => {
  const d = Object.assign({kind:'asd160', zone: zone || 'ASD 1', networked: !!networked, address: address || '', af:4, cls:'SFD'}, extra || {});
  const tr = asdAddRow(loc, d);
  recalcLocation(loc);
  if (typeof refreshAllAmber === 'function') refreshAllAmber();
  if (typeof v2Refresh === 'function') v2Refresh();
  return tr && tr.id;
}'''

def parse_ma_sum(s):
    nums = [int(x) for x in re.findall(r'(\d+)\s*mA', s or '')]
    return sum(nums), nums

async def fresh(pg):
    await pg.goto(APP)
    await pg.evaluate('localStorage.clear()')
    await pg.reload()
    await pg.wait_for_timeout(700)
    return await pg.evaluate(BOOT)

async def snap(pg, loc):
    return await pg.evaluate('''(loc) => {
      const l = document.getElementById('location-' + loc);
      const rows = [...l.querySelectorAll('[data-role=minilaser]')].map(tr => {
        const d = (typeof mlRowData === 'function') ? mlRowData(tr) : {};
        return {
          id: tr.id, kind: tr.dataset.kind || 'minilaser', zone: (tr.querySelector('.ml-zone')||{}).value,
          aux: (tr.querySelector('.aux-circuit-num')||{}).value,
          src: (tr.querySelector('.circuit-source')||{}).value,
          edited: (tr.querySelector('.circuit-source')||{}).dataset.userEdited === '1',
          addr: ((tr.querySelector('.asd-addr')||{}).value) || '',
          net: ((tr.querySelector('.asd-net')||{}).value) || '',
          plKey: tr.dataset.plKey || '', holes: tr.dataset.holes || '', lengthFt: tr.dataset.lengthFt || '',
          bends90: tr.dataset.bends90 || '', tees: tr.dataset.tees || '', pre: tr.dataset.pre || '',
          derivation: tr.dataset.derivation || '', pipe: tr.dataset.pipe || '',
          afSrc: tr.dataset.afSrc || '', clsSrc: tr.dataset.clsSrc || '',
          relay: !!(tr.querySelector('.asd-relay') && tr.querySelector('.asd-relay').checked),
          fan: (tr.querySelector('.ml-fan')||{}).value,
          ma: (typeof mlModel === 'function') ? (mlModel(l).find(x => x.zone === (tr.querySelector('.ml-zone')||{}).value) || {}).ma : 0
        };
      });
      const cd = {
        total: (l.querySelector('.cd-total-ma-detail')||{}).textContent,
        formula: (l.querySelector('.cd-total-formula')||{}).textContent,
        q: (l.querySelector('.cd-quiescent-ma')||{}).textContent,
        aux: (l.querySelector('.cd-aux-ma')||{}).textContent,
        dispHidden: !!(l.querySelector('.cd-displays-row') && l.querySelector('.cd-displays-row').hidden),
        detHidden: !!(l.querySelector('.cd-detectors-row') && l.querySelector('.cd-detectors-row').hidden),
        asdHtml: (l.querySelector('.cd-asd-unit-rows')||{}).innerText || '',
        sheetTotal: (l.querySelector('.total-ma')||{}).textContent
      };
      const m = v2SheetModel(l);
      const full = v2CalcSteps(m, 'full');
      const std = v2CalcSteps(m, 'standard');
      const loadFull = (full[0] && full[0].rows) || [];
      const loadStd = (std[0] && std[0].rows) || [];
      const rp = (document.getElementById('rp-body')||{}).innerText || '';
      const legend = {
        disp: (l.querySelector('.pct-display')||{}).closest ? !!(l.querySelector('.pct-display') && l.querySelector('.pct-display').closest('span').hidden) : true,
        det: (l.querySelector('.pct-detector')||{}).closest ? !!(l.querySelector('.pct-detector') && l.querySelector('.pct-detector').closest('span').hidden) : true,
        ml: (l.querySelector('.pct-minilaser')||{}).closest ? !!(l.querySelector('.pct-minilaser') && !l.querySelector('.pct-minilaser').closest('span').hidden) : false,
        asd: (l.querySelector('.pct-asd160')||{}).closest ? !!(l.querySelector('.pct-asd160') && !l.querySelector('.pct-asd160').closest('span').hidden) : false,
        mlPct: (l.querySelector('.pct-minilaser')||{}).textContent || '',
        asdPct: (l.querySelector('.pct-asd160')||{}).textContent || '',
        qPct: (l.querySelector('.pct-quiescent')||{}).textContent || '',
        auxPct: (l.querySelector('.pct-aux')||{}).textContent || ''
      };
      const exp = {
        dispHidden: !!(l.querySelector('.export-display-stat') && l.querySelector('.export-display-stat').hidden),
        detHidden: !!(l.querySelector('.export-detector-stat') && l.querySelector('.export-detector-stat').hidden),
        mlHidden: !!(l.querySelector('.export-ml-stat') && l.querySelector('.export-ml-stat').hidden),
        asdHidden: !!(l.querySelector('.export-asd-stat') && l.querySelector('.export-asd-stat').hidden),
        ml: (l.querySelector('.export-ml-ma')||{}).textContent,
        asd: (l.querySelector('.export-asd-ma')||{}).textContent,
        total: (l.querySelector('.export-total-ma-2')||{}).textContent,
        cap: (l.querySelector('.export-total-caption')||{}).textContent
      };
      const sticky = (() => {
        const cell = l.querySelector('.ml-actions-col');
        if (!cell) return null;
        const cs = getComputedStyle(cell);
        return { pos: cs.position, right: cs.right, bg: cs.backgroundColor, text: cell.closest('th,td') && cell.textContent };
      })();
      return {
        name: (l.querySelector('.ps-name')||{}).value, area: (l.querySelector('.ps-location')||{}).value,
        nRows: rows.length, rows, cd, loadFull, loadStd,
        I_total_full: (loadFull.find(r => r.label === 'Total load') || {}),
        I_total_std: (loadStd.find(r => r.label === 'Total load') || {}),
        rp, legend, exp, sticky, exists: !!l,
        flags: [...l.querySelectorAll('.flags-list li')].map(li => li.textContent),
        basis: (l.querySelector('.design-basis-select')||{}).value,
        temp: (l.querySelector('.temperature-select')||{}).value,
        totalMa: (l.querySelector('.total-ma')||{}).textContent,
        requiredAh: (l.querySelector('.required-ah')||{}).textContent
      };
    }''', loc)

async def open_move(pg, row_id):
    opened = await pg.evaluate("""(id) => {
      const tr = document.getElementById(id);
      if (!tr) return false;
      const locEl = tr.closest('.location');
      if (typeof setCurrentLocation === 'function' && locEl) setCurrentLocation(locEl);
      const btn = tr.querySelector('.ml-move-btn');
      if (btn) { btn.click(); return true; }
      if (typeof mlMoveOpen === 'function' && locEl) { mlMoveOpen(tr, locEl.dataset.loc); return true; }
      return false;
    }""", row_id)
    await pg.wait_for_timeout(150)
    if not opened:
        return None
    return await pg.evaluate('''() => {
      const ov = document.getElementById('mv-overlay');
      if (!ov) return null;
      const preview = ov.querySelector('#mv-preview');
      const targets = [...ov.querySelectorAll('.target-item')].map(el => ({
        loc: el.getAttribute('data-mv-loc'),
        selected: el.classList.contains('selected'),
        full: el.classList.contains('is-full'),
        rec: !!el.querySelector('.mv-badge-rec'),
        fullBadge: !!el.querySelector('.mv-badge-full'),
        text: el.innerText,
        disabled: !!(el.querySelector('input') && el.querySelector('input').disabled)
      }));
      return {
        open: true,
        role: ov.getAttribute('role'),
        modal: ov.getAttribute('aria-modal'),
        title: (ov.querySelector('#mv-title')||{}).textContent,
        from: (ov.querySelector('.mv-from')||{}).innerText,
        confirm: (ov.querySelector('.mv-confirm')||{}).textContent,
        confirmDisabled: !!(ov.querySelector('.mv-confirm') && ov.querySelector('.mv-confirm').disabled),
        preview: preview ? preview.innerText : '',
        previewClass: preview ? preview.className : '',
        targets,
        units: ov.querySelector('.mv-units') ? ov.querySelector('.mv-units').innerText : '',
        unitsHidden: !!(ov.querySelector('.mv-units') && ov.querySelector('.mv-units').hidden),
        createOpen: !!(ov.querySelector('.mv-create-fields') && ov.querySelector('.mv-create-fields').classList.contains('open')),
        newName: (ov.querySelector('.mv-new-name')||{}).value,
        newArea: (ov.querySelector('.mv-new-area')||{}).value
      };
    }''')

async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={'width': 1600, 'height': 1000})
    pg = await ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))

    ids = await fresh(pg)
    loc1, loc2 = ids['loc1'], ids['loc2']
    v = await pg.evaluate('[runningRevisionFull(), typeof mlMoveOpen, typeof mlRecalcHook]')
    ok('revision is 02.03.000 or 00.04.000 and Move is loaded',
       v[0] in ('02.03.000_261124', '00.04.000_261124') and v[1] == 'function' and v[2] == 'function', v)

    # ---- sticky Actions + single MiniLaser move, metadata, auto circuit source ----
    extra = {'plKey':'PL-KEY-1','holes':4,'lengthFt':80,'bends90':1,'tees':0,'afSrc':'table','pre':{'shape':'I'},'derivation':{'src':'placeholder'}}
    rid = await pg.evaluate(ADD_ML, {'loc': loc1, 'zone': 'ML 1', 'fan': 4, 'extra': extra})
    s1 = await snap(pg, loc1)
    ok('sticky Actions column is position:sticky; right:0 with solid background',
       s1['sticky'] and s1['sticky']['pos'] == 'sticky' and s1['sticky']['right'] == '0px' and s1['sticky']['bg'] not in ('rgba(0, 0, 0, 0)', 'transparent'),
       s1['sticky'])
    ok('Move button present with accessible name',
       await pg.evaluate('''(id) => { const b=document.querySelector("#"+CSS.escape(id)+" .ml-move-btn"); return b && /Move/.test(b.textContent) && b.getAttribute("aria-label") && b.getAttribute("title"); }''', rid))

    dlg = await open_move(pg, rid)
    ok('Move dialog: role=dialog, aria-modal, names source unit and PS-1 · Area A',
       dlg and dlg['role']=='dialog' and dlg['modal']=='true' and 'ML 1' in dlg['from'] and 'PS-1' in dlg['from'] and 'Area A' in dlg['from'], dlg)
    rec = next((t for t in dlg['targets'] if t['rec']), None)
    ps2 = next((t for t in dlg['targets'] if 'PS-2' in t['text']), None)
    ok('PS-2 is listed (other area, no Recommended because Area B ≠ Area A) and is selectable',
       ps2 and not ps2['rec'] and not ps2['disabled'] and ps2['loc'] != 'new', ps2)
    ok('+ Create new power supply is in the target list',
       any(t['loc']=='new' for t in dlg['targets']), dlg['targets'])
    ok('live preview shows AUX 0/4 → 1/4 and a required-Ah after value (not —)',
       dlg and '0/4' in dlg['preview'] and '1/4' in dlg['preview'] and '→' in dlg['preview'] and not re.search(r'→\s*—', dlg['preview'].split('Required')[-1] if 'Required' in dlg['preview'] else ''),
       dlg['preview'] if dlg else None)
    ok('single-unit sheet hides the multi-unit section', dlg and dlg['unitsHidden'], dlg and dlg['unitsHidden'])

    # Escape closes
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
    ok('Escape closes the Move dialog', await pg.evaluate("!document.getElementById('mv-overlay')"))

    # same-Area sheet with open AUX is Recommended and pre-selected
    await pg.evaluate("""(loc2) => {
      const l=document.getElementById('location-'+loc2);
      l.querySelector('.ps-location').value='Area A';
    }""", loc2)
    dlg_rec = await open_move(pg, rid)
    rec = next((t for t in dlg_rec['targets'] if t['rec']), None)
    ok('same-Area sheet with open AUX gets Recommended badge and is pre-selected',
       rec and rec['selected'] and 'PS-2' in rec['text'] and 'Recommended' in rec['text'], rec)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(80)

    dlg = await open_move(pg, rid)
    # click PS-2 and confirm
    await pg.click('label.target-item[data-mv-loc="' + str(loc2) + '"]')
    await pg.wait_for_timeout(80)
    await pg.click('.mv-confirm'); await pg.wait_for_timeout(400)
    s1b = await snap(pg, loc1)
    s2 = await snap(pg, loc1=None) if False else await snap(pg, loc2)
    ok('source sheet still exists after its last unit is moved (never auto-deleted)', s1b['exists'] and s1b['nRows']==0, s1b['nRows'])
    ok('destination received the MiniLaser with PipeCAD metadata preserved',
       s2['nRows']==1 and s2['rows'][0]['zone']=='ML 1' and s2['rows'][0]['plKey']=='PL-KEY-1'
       and s2['rows'][0]['holes']=='4' and s2['rows'][0]['lengthFt']=='80' and s2['rows'][0]['bends90']=='1'
       and 'placeholder' in s2['rows'][0]['derivation'] and 'I' in s2['rows'][0]['pre'], s2['rows'])
    ok('moved unit got a free AUX circuit on the destination (AUX 1) and auto circuit source PS-2 AUX-…',
       s2['rows'] and s2['rows'][0]['aux']=='1' and s2['rows'][0]['src'].startswith('PS-2 AUX') and not s2['rows'][0]['edited'], s2['rows'][:1])

    # ---- custom circuit source preserved; multi-unit move ----
    ids = await fresh(pg); loc1, loc2 = ids['loc1'], ids['loc2']
    r1 = await pg.evaluate(ADD_ML, {'loc': loc1, 'zone': 'ML 1', 'fan': 4, 'extra': {}})
    r2 = await pg.evaluate(ADD_ML, {'loc': loc1, 'zone': 'ML 2', 'fan': 10, 'extra': {}})
    await pg.evaluate('''(id) => {
      const inp = document.querySelector('#' + CSS.escape(id) + ' .circuit-source');
      inp.value = 'Custom feeder A'; inp.dataset.userEdited = '1';
      recalcLocation(document.querySelector('#' + CSS.escape(id)).closest('.location').dataset.loc);
    }''', r1)
    dlg = await open_move(pg, r1)
    ok('multi-unit section lists both source units; clicked unit pre-checked',
       dlg and not dlg['unitsHidden'] and 'ML 1' in dlg['units'] and 'ML 2' in dlg['units'] and 'PS-1' in dlg['units'].upper() and 'INCLUDE ADDITIONAL' in dlg['units'].upper(), dlg['units'] if dlg else None)
    # check ML 2; confirm text and preview should update
    await pg.check(f'.mv-units input[data-row="{r2}"]')
    await pg.wait_for_timeout(80)
    dlg2 = await pg.evaluate('''() => { const ov=document.getElementById('mv-overlay'); return {confirm:ov.querySelector('.mv-confirm').textContent, preview:ov.querySelector('#mv-preview').innerText}; }''')
    ok('checking a second unit live-updates confirm text and AUX preview (2 units → 2/4)',
       'Move 2 units to PS-2' in dlg2['confirm'] and '2/4' in dlg2['preview'], dlg2)
    # uncheck both is blocked (at least 1 stays checked)
    await pg.evaluate("""() => {
      document.querySelectorAll('.mv-units input[type=checkbox]:checked').forEach(c => {
        c.click();
      });
    }""")
    nchk = await pg.evaluate("[...document.querySelectorAll('.mv-units input[type=checkbox]:checked')].length")
    ok('at least one unit stays checked (cannot confirm an empty move)', nchk >= 1, nchk)
    # re-check both and move
    await pg.check(f'.mv-units input[data-row="{r1}"]')
    await pg.check(f'.mv-units input[data-row="{r2}"]')
    await pg.click('label.target-item[data-mv-loc="' + str(loc2) + '"]')
    await pg.click('.mv-confirm'); await pg.wait_for_timeout(400)
    s1c = await snap(pg, loc1); s2c = await snap(pg, loc2)
    ok('multi-unit move: both units left PS-1 and arrived on PS-2 in original order',
       s1c['nRows']==0 and [r['zone'] for r in s2c['rows']]==['ML 1','ML 2'], [r['zone'] for r in s2c['rows']])
    custom = next((r for r in s2c['rows'] if r['zone']=='ML 1'), None)
    auto = next((r for r in s2c['rows'] if r['zone']=='ML 2'), None)
    ok('custom Circuit source preserved; unedited source auto-filled on dest',
       custom and custom['src']=='Custom feeder A' and custom['edited'] and auto and auto['src'].startswith('PS-2 AUX') and not auto['edited'],
       {'custom': custom, 'auto': auto})

    # ---- + Create new power supply ----
    ids = await fresh(pg); loc1, loc2 = ids['loc1'], ids['loc2']
    r1 = await pg.evaluate(ADD_ML, {'loc': loc1, 'zone': 'ML 1', 'fan': 4, 'extra': {}})
    dlg = await open_move(pg, r1)
    await pg.click('label.target-item[data-mv-loc="new"]')
    await pg.wait_for_timeout(80)
    created_ui = await pg.evaluate('''() => {
      const ov=document.getElementById('mv-overlay');
      return {open:ov.querySelector('.mv-create-fields').classList.contains('open'),
              name:ov.querySelector('.mv-new-name').value, area:ov.querySelector('.mv-new-area').value,
              confirm:ov.querySelector('.mv-confirm').textContent, preview:ov.querySelector('#mv-preview').innerText};
    }''')
    ok('Create-new fields open with suggested PS-3 and Area A (source area); confirm says Create PS-3 & Move',
       created_ui['open'] and created_ui['name']=='PS-3' and created_ui['area']=='Area A' and 'Create PS-3 & Move' in created_ui['confirm'], created_ui)
    ok('new-sheet preview has AUX 0/4 → 1/4 and a computed after Ah',
       '0/4' in created_ui['preview'] and '1/4' in created_ui['preview'] and re.search(r'\d+\.\d+\s*Ah', created_ui['preview']), created_ui['preview'])
    n_before = await pg.evaluate("document.querySelectorAll('.location').length")
    await pg.click('.mv-confirm'); await pg.wait_for_timeout(500)
    n_after = await pg.evaluate("document.querySelectorAll('.location').length")
    newloc = await pg.evaluate('''() => {
      const l=[...document.querySelectorAll('.location')].find(el => (el.querySelector('.ps-name')||{}).value==='PS-3');
      return l ? l.dataset.loc : null;
    }''')
    ssrc = await snap(pg, loc1); snew = await snap(pg, newloc) if newloc else {}
    ok('confirm created a third sheet via addLocation and moved the unit onto it',
       n_after==n_before+1 and newloc and ssrc['nRows']==0 and snew.get('nRows')==1 and snew['rows'][0]['zone']=='ML 1',
       {'n': (n_before, n_after), 'newloc': newloc, 'src': ssrc.get('nRows'), 'new': snew.get('nRows')})
    ok('new sheet inherited source design basis and temperature',
       snew and snew.get('basis')=='NFPA 72 Standard' and snew.get('temp')=='77', {k: snew.get(k) for k in ('basis','temp','name','area')})

    # ---- 4/4 overflow warning, move still allowed ----
    ids = await fresh(pg); loc1, loc2 = ids['loc1'], ids['loc2']
    # fill PS-2 with 4 MiniLasers
    for i in range(4):
        await pg.evaluate(ADD_ML, {'loc': loc2, 'zone': f'D{i+1}', 'fan': 4, 'extra': {}})
    rsrc = await pg.evaluate(ADD_ML, {'loc': loc1, 'zone': 'OVERFLOW', 'fan': 4, 'extra': {}})
    dlg = await open_move(pg, rsrc)
    ps2 = next((t for t in dlg['targets'] if t['loc']==str(loc2) or 'PS-2' in t['text']), None)
    ok('full destination shows Full — overflow badge and stays selectable (radio not disabled)',
       ps2 and ps2['full'] and ps2['fullBadge'] and not ps2['disabled'], ps2)
    await pg.click('label.target-item[data-mv-loc="' + str(loc2) + '"]')
    await pg.wait_for_timeout(80)
    prv = await pg.evaluate("document.querySelector('#mv-preview').innerText + '|' + document.querySelector('#mv-preview').className")
    ok('overflow preview warns (5/4 AUX) in amber/red but confirm stays enabled',
       '5/4' in prv and ('warn' in prv or 'bad' in prv) and 'still confirm' in prv.lower()
       and not await pg.evaluate("document.querySelector('.mv-confirm').disabled"), prv)
    await pg.click('.mv-confirm'); await pg.wait_for_timeout(500)
    s2f = await snap(pg, loc2)
    overflow_row = next((r for r in s2f['rows'] if r['zone']=='OVERFLOW'), None)
    ok('overflow move completed; 5th unit is unassigned (no colliding AUX) and dest still has 5 units; source emptied but present',
       overflow_row and overflow_row['aux']=='' and s2f['nRows']==5 and (await snap(pg, loc1))['exists'] and (await snap(pg, loc1))['nRows']==0,
       overflow_row)

    # ---- ASD-160 networked move + address uniqueness ----
    ids = await fresh(pg); loc1, loc2 = ids['loc1'], ids['loc2']
    a1 = await pg.evaluate(ADD_ASD, {'loc': loc1, 'zone': 'NET-A', 'networked': True, 'address': '10',
                                    'extra': {'plKey':'ASD-KEY','pipe':{'holes':[1,2]},'clsSrc':'pl','relayCard':True,'network':3}})
    a2 = await pg.evaluate(ADD_ASD, {'loc': loc2, 'zone': 'NET-B', 'networked': True, 'address': '11', 'extra': {}})
    dlg = await open_move(pg, a1)
    ok('ASD-160 dialog title names the ASD-160', dlg and 'ASD-160' in dlg['title'] and 'NET-A' in dlg['from'], dlg)
    await pg.click('label.target-item[data-mv-loc="' + str(loc2) + '"]')
    await pg.click('.mv-confirm'); await pg.wait_for_timeout(400)
    s2a = await snap(pg, loc2)
    moved = next((r for r in s2a['rows'] if r['zone']=='NET-A'), None)
    ok('networked ASD-160 moved with address 10, pipe/plKey/relay/clsSrc preserved; dest has both units',
       moved and moved['addr']=='10' and moved['net']=='networked' and moved['plKey']=='ASD-KEY'
       and 'holes' in moved['pipe'] and moved['relay'] and moved['clsSrc']=='pl' and s2a['nRows']==2, moved)
    # moving onto a sheet that already uses address 10 should flag a clash after we force a duplicate
    ids = await fresh(pg); loc1, loc2 = ids['loc1'], ids['loc2']
    await pg.evaluate(ADD_ASD, {'loc': loc2, 'zone': 'NET-B', 'networked': True, 'address': '10', 'extra': {}})
    a1 = await pg.evaluate(ADD_ASD, {'loc': loc1, 'zone': 'NET-A', 'networked': True, 'address': '10', 'extra': {}})
    await open_move(pg, a1)
    await pg.click('label.target-item[data-mv-loc="' + str(loc2) + '"]')
    await pg.click('.mv-confirm'); await pg.wait_for_timeout(400)
    flags = (await snap(pg, loc2))['flags']
    ok('duplicate SenseNET address after move is flagged on the destination sheet',
       any(re.search(r'address|duplicate|unique|already', f, re.I) for f in flags) or any('10' in f for f in flags), flags)

    # ===================== Feature 2: granular + display cleanup =====================
    async def build_sheet(kind):
        await pg.evaluate('localStorage.clear()')
        # keep a single fresh sheet
        data = await pg.evaluate('''(kind) => {
          clearEntireDocument({clearHeaders:false});
          const pre=[...document.querySelectorAll('.location')];
          addLocation();
          const l=[...document.querySelectorAll('.location')].pop();
          pre.forEach(e=>e.remove());
          l.querySelector('.ps-name').value='PS-1';
          l.querySelector('.ps-location').value='Area A';
          l.querySelector('.design-basis-select').value='NFPA 72 Standard';
          applyDesignBasis(l.dataset.loc);
          l.querySelector('.temperature-select').value='77';
          const loc=l.dataset.loc;
          if (kind==='ml') mlAddRow(loc,{setup:'manual', zone:'ML 1', fan:4, af:4, method:'DIP'});
          if (kind==='asd') asdAddRow(loc,{kind:'asd160', zone:'ASD 1', af:4, cls:'SFD'});
          if (kind==='ml+asd'){ mlAddRow(loc,{setup:'manual', zone:'ML 1', fan:4, af:4, method:'DIP'}); asdAddRow(loc,{kind:'asd160', zone:'ASD 1', af:4, cls:'SFD'}); }
          if (kind==='det+ml'){ addModuleRow(loc,'Detector'); const det=l.querySelector('[data-role=module]'); if (det){ const fs=det.querySelector('.fanspeed-select'); if(fs){ fs.value='4'; fs.dispatchEvent(new Event('change',{bubbles:true})); } } mlAddRow(loc,{setup:'manual', zone:'ML 1', fan:4, af:4, method:'DIP'}); }
          if (kind==='fullmix'){ addModuleRow(loc,'Standard Display'); addModuleRow(loc,'Detector'); const det=[...l.querySelectorAll('[data-role=module]')].find(r=>r.querySelector('.type-select').value==='Detector'); if (det){ const fs=det.querySelector('.fanspeed-select'); if(fs){ fs.value='4'; fs.dispatchEvent(new Event('change',{bubbles:true})); } } mlAddRow(loc,{setup:'manual', zone:'ML 1', fan:4, af:4, method:'DIP'}); }
          recalcLocation(loc); if (typeof v2Refresh==='function') v2Refresh();
          return loc;
        }''', kind)
        return data

    def check_formula(label, s, expect_terms, expect_total, hide_disp, hide_det, asd_text=None, ml_text=None):
        ok(f'{label}: Displays row hidden={hide_disp}', s['cd']['dispHidden']==hide_disp, s['cd'])
        ok(f'{label}: Detectors row hidden={hide_det}', s['cd']['detHidden']==hide_det, s['cd'])
        ok(f'{label}: Total Load formula is {expect_terms}', s['cd']['formula']==expect_terms, s['cd']['formula'])
        total = int(re.search(r'(\d+)', s['cd']['total']).group(1)) if re.search(r'(\d+)', s['cd']['total'] or '') else None
        sheet = int(re.search(r'(\d+)', s['totalMa'] or s['cd']['sheetTotal'] or '').group(1)) if re.search(r'(\d+)', (s['totalMa'] or s['cd']['sheetTotal'] or '')) else None
        ok(f'{label}: on-screen Total Load equals {expect_total} mA and the sheet total',
           total==expect_total and sheet==expect_total, {'cd': s['cd']['total'], 'sheet': s['totalMa'], 'expect': expect_total})
        # v2CalcSteps: Full includes the Module & supply load table; Standard keeps the 02.02.002 layout (starts at Standby).
        std_labels = [r['label'] for r in s['loadStd']]
        ok(f'{label}: v2CalcSteps[standard] keeps 02.02.002 step 1 (Standby Ah), no Module & supply load table',
           'Standby Ah' in std_labels and 'Total load' not in std_labels and 'MiniLaser subtotal' not in std_labels, std_labels)
        row = s['I_total_full']
        lv = 'full'
        sym = row.get('sym') or ''
        sub = row.get('sub') or ''
        res = row.get('res') or ''
        want_sym_bits = []
        if 'Displays' in expect_terms: want_sym_bits.append('I_disp')
        if 'Detectors' in expect_terms: want_sym_bits.append('I_det')
        if 'MiniLasers' in expect_terms: want_sym_bits.append('I_ml')
        if 'ASD-160' in expect_terms: want_sym_bits.append('I_asd')
        want_sym_bits += ['I_q','I_aux']
        ok(f'{label}: v2CalcSteps[{lv}] symbol list is I_total = {" + ".join(want_sym_bits)}',
           sym == 'I_total = ' + ' + '.join(want_sym_bits), sym)
        sm, parts = parse_ma_sum(sub)
        resn = int(re.search(r'(\d+)', res).group(1)) if re.search(r'(\d+)', res) else None
        ok(f'{label}: v2CalcSteps[{lv}] substitution {parts} sums to result {resn} = {expect_total}',
           sm==resn==expect_total, {'sub': sub, 'res': res, 'sum': sm})
        labels = [r['label'] for r in s['loadFull']]
        ok(f'{label}: v2CalcSteps[{lv}] hides absent Displays/Detectors and includes present subtotals',
           ('Displays subtotal' in labels) == (not hide_disp) and ('Detectors subtotal' in labels) == (not hide_det)
           and (('MiniLaser subtotal' in labels) == ('MiniLasers' in expect_terms))
           and (('ASD-160 subtotal' in labels) == ('ASD-160' in expect_terms)),
           labels)
        if ml_text:
            ok(f'{label}: granular lists MiniLaser unit + subtotal', ml_text in s['cd']['asdHtml'] and 'MiniLaser subtotal' in s['cd']['asdHtml'], s['cd']['asdHtml'])
        if asd_text:
            ok(f'{label}: granular lists ASD-160 unit + subtotal', asd_text in s['cd']['asdHtml'] and 'ASD-160 subtotal' in s['cd']['asdHtml'], s['cd']['asdHtml'])
        # Results panel
        ok(f'{label}: Results hides "ModuLaser modules 0 mA" when no ModuLaser modules' if hide_disp and hide_det else f'{label}: Results mentions ModuLaser modules when present',
           ('ModuLaser modules' not in s['rp']) if (hide_disp and hide_det) else ('ModuLaser modules' in s['rp']), s['rp'][:400])

    # MiniLaser-only: 180 + 70 + 35 = 285
    loc = await build_sheet('ml')
    s = await snap(pg, loc)
    check_formula('MiniLaser-only', s, 'MiniLasers + Quiescent + AUX', 285, True, True, ml_text='MiniLaser 1')
    ok('MiniLaser-only Results shows MiniLaser ×1 and 180 mA, not ASD-160',
       'MiniLaser ×1' in s['rp'] and '180 mA' in s['rp'] and 'ASD-160' not in s['rp'], s['rp'][:400])
    # donut percentages sum ~100, no 0% Displays/Detectors
    def pcts(s):
        vals=[]
        for k in ('mlPct','asdPct','qPct','auxPct'):
            m=re.search(r'([\d.]+)', s['legend'].get(k) or '')
            if m and ((k=='mlPct' and not s['legend']['ml'] is False and 'MiniLaser' in (s['cd']['asdHtml'] or '')) or
                      (k=='asdPct' and s['legend']['asd']) or
                      k in ('qPct','auxPct')):
                if k=='mlPct' and s['legend']['ml']: vals.append(float(m.group(1)))
                elif k=='asdPct' and s['legend']['asd']: vals.append(float(m.group(1)))
                elif k in ('qPct','auxPct') and m: vals.append(float(m.group(1)))
        return vals
    # simpler donut check
    vis = await pg.evaluate('''(loc) => {
      const l=document.getElementById('location-'+loc);
      const items=[...l.querySelectorAll('.legend-group span')].filter(el => el.querySelector('.pct') && !el.hidden).map(el => ({t:el.textContent, p:el.querySelector('.pct').textContent}));
      return items;
    }''', loc)
    vis_pcts = [float(re.search(r'([\d.]+)', x['p']).group(1)) for x in vis if re.search(r'([\d.]+)', x['p'] or '')]
    ok('MiniLaser-only donut legend omits Displays and Detectors and visible % sum to ~100',
       not any(re.search(r'Display', x['t']) for x in vis) and not any(re.search(r'Detector', x['t']) for x in vis)
       and any(re.search(r'MiniLaser', x['t']) for x in vis) and abs(sum(vis_pcts)-100)<0.2,
       {'items': vis, 'sum': sum(vis_pcts) if vis_pcts else None})

    # third-party export panel (switch this sheet)
    await pg.evaluate('''(loc) => {
      const l=document.getElementById('location-'+loc);
      const m=l.querySelector('.mode-radio[value=thirdparty]'); if (m){ m.checked=true; m.dispatchEvent(new Event('change',{bubbles:true})); }
      const s=l.querySelector('.submode-radio[value=export]'); if (s){ s.checked=true; s.dispatchEvent(new Event('change',{bubbles:true})); }
      recalcLocation(loc); if (typeof v2Refresh==='function') v2Refresh();
    }''', loc)
    await pg.wait_for_timeout(200)
    exp = await pg.evaluate('''(loc) => {
      const l=document.getElementById('location-'+loc);
      return {
        dispHidden: !!(l.querySelector('.export-display-stat') && l.querySelector('.export-display-stat').hidden),
        detHidden: !!(l.querySelector('.export-detector-stat') && l.querySelector('.export-detector-stat').hidden),
        mlHidden: !!(l.querySelector('.export-ml-stat') && l.querySelector('.export-ml-stat').hidden),
        asdHidden: !!(l.querySelector('.export-asd-stat') && l.querySelector('.export-asd-stat').hidden),
        ml: (l.querySelector('.export-ml-ma')||{}).textContent,
        total: (l.querySelector('.export-total-ma-2')||{}).textContent,
        cap: (l.querySelector('.export-total-caption')||{}).textContent,
        copy: (typeof copyExportValues==='function') ? (window.__copied=null, (function(){ const orig=navigator.clipboard; /* just rebuild the text via evaluate of internals */ })(), null) : null
      };
    }''', loc)
    # rebuild copy text ourselves from the same DOM
    copy_txt = await pg.evaluate('''(loc) => {
      const l=document.getElementById('location-'+loc);
      // call the function if it returns text; otherwise reconstruct
      const ta = document.getElementById('export-copy-target');
      if (typeof copyExportValues === 'function') {
        // hook clipboard
      }
      const lines=[];
      if (l.querySelector('.export-display-stat') && !l.querySelector('.export-display-stat').hidden) lines.push('Displays: '+(l.querySelector('.export-display-ma')||{}).textContent);
      if (l.querySelector('.export-detector-stat') && !l.querySelector('.export-detector-stat').hidden) lines.push('Detectors');
      if (l.querySelector('.export-ml-stat') && !l.querySelector('.export-ml-stat').hidden) lines.push('MiniLasers: '+(l.querySelector('.export-ml-ma')||{}).textContent);
      if (l.querySelector('.export-asd-stat') && !l.querySelector('.export-asd-stat').hidden) lines.push('ASD-160');
      return {lines, cap:(l.querySelector('.export-total-caption')||{}).textContent, total:(l.querySelector('.export-total-ma-2')||{}).textContent, ml:(l.querySelector('.export-ml-ma')||{}).textContent};
    }''', loc)
    ok('MiniLaser-only third-party export hides Display 0 mA, shows MiniLaser 180, caption mentions MiniLasers, total = 180 (device load)',
       exp['dispHidden'] and exp['detHidden'] and not exp['mlHidden'] and exp['asdHidden']
       and exp['ml']=='180' and exp['total']=='180' and 'MiniLaser' in (exp['cap'] or ''), exp)

    # Print / Word / Excel for MiniLaser-only (rebuild builtin sheet so print uses same 285)
    loc = await build_sheet('ml')
    exports = await pg.evaluate('''(loc) => {
      const l=document.getElementById('location-'+loc);
      const htmlStd = (typeof v2BuildPrintHtml==='function') ? v2BuildPrintHtml(Object.assign((typeof v2PeOpts==='function'?v2PeOpts():{scope:'current',level:'standard'}), {level:'standard', scope:'current'})) : '';
      const htmlFull = (typeof v2BuildPrintHtml==='function') ? v2BuildPrintHtml(Object.assign((typeof v2PeOpts==='function'?v2PeOpts():{scope:'current',level:'full'}), {level:'full', scope:'current'})) : '';
      return {htmlStd, htmlFull, hasFn: typeof v2BuildPrintHtml};
    }''', loc)
    ok('Print HTML Full includes MiniLaser subtotal / I_ml and 285 mA and omits Displays subtotal',
       'I_ml' in exports['htmlFull'] and 'MiniLaser subtotal' in exports['htmlFull'] and 'Displays subtotal' not in exports['htmlFull'] and '285 mA' in exports['htmlFull'],
       {'full_has_disp': 'Displays subtotal' in exports['htmlFull'], 'len': (len(exports['htmlStd']), len(exports['htmlFull']))})
    ok('Print HTML Standard keeps 02.02.002 layout (no Module & supply load table) and still shows the 285 mA total',
       '1. Module & supply load' not in exports['htmlStd'] and 'MiniLaser subtotal' not in exports['htmlStd']
       and ('1. Standby & alarm capacity' in exports['htmlStd'] or '1. Standby &amp; alarm capacity' in exports['htmlStd'])
       and '285 mA' in exports['htmlStd'],
       {'has_load': '1. Module & supply load' in exports['htmlStd'], 'has_285': '285 mA' in exports['htmlStd'],
        'has_standby': ('1. Standby & alarm capacity' in exports['htmlStd'] or '1. Standby &amp; alarm capacity' in exports['htmlStd'])})

    # Word + Excel via builders
    async def export_text():
        raw = await pg.evaluate('''(async () => {
          const out = {};
          if (typeof v2BuildDocx === 'function') {
            const u = await v2BuildDocx({level:'full', scope:'current'});
            const a = new Uint8Array(u instanceof Blob ? await u.arrayBuffer() : u);
            let s=''; for (const c of a) s+=String.fromCharCode(c);
            out.docx = btoa(s);
          }
          if (typeof v2BuildXlsx === 'function') {
            const u = v2BuildXlsx({level:'full', scope:'current'});
            const a = new Uint8Array(u instanceof Blob ? await u.arrayBuffer() : u);
            let s=''; for (const c of a) s+=String.fromCharCode(c);
            out.xlsx = btoa(s);
          }
          return out;
        })()''')
        return raw
    raw = await export_text()
    if raw.get('docx'):
        z = zipfile.ZipFile(io.BytesIO(base64.b64decode(raw['docx'])))
        doc = z.read('word/document.xml').decode()
        ok('Word Full Detail has I_ml / MiniLaser subtotal, 285 mA, no Displays subtotal',
           ('I_ml' in doc or 'MiniLaser subtotal' in doc) and '285' in doc and 'Displays subtotal' not in doc,
           {'iml':'I_ml' in doc, 'sub':'MiniLaser subtotal' in doc, 'disp':'Displays subtotal' in doc})
    else:
        ok('Word Full Detail built', False, 'no docx')
    if raw.get('xlsx'):
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(base64.b64decode(raw['xlsx'])))
        det = wb['Detail'] if 'Detail' in wb.sheetnames else wb.active
        cells = ' | '.join(str(c or '') for row in det.iter_rows(values_only=True) for c in row)
        cad = wb['CAD Schedule'] if 'CAD Schedule' in wb.sheetnames else None
        cad_txt = ' | '.join(str(c or '') for row in cad.iter_rows(values_only=True) for c in row) if cad else ''
        ok('Excel Detail has MiniLaser / I_ml and 285, no Displays subtotal',
           ('I_ml' in cells or 'MiniLaser' in cells) and '285' in cells and 'Displays subtotal' not in cells, cells[:400])
        ok('Excel CAD / location rows mention MiniLaser (not mislabeled as ModuLaser-only)',
           'MiniLaser' in cells or 'MiniLaser' in cad_txt or 'FHSD8075' in cad_txt or 'FHSD8075' in cells, cad_txt[:300])
    else:
        ok('Excel Detail built', False, 'no xlsx')

    # ASD-160-only: 250 + 70 + 35 = 355
    loc = await build_sheet('asd')
    s = await snap(pg, loc)
    check_formula('ASD-160-only', s, 'ASD-160 + Quiescent + AUX', 355, True, True, asd_text='ASD-160 1')
    ok('ASD-160-only Results shows ASD-160 ×1 and 250 mA, not labeled as MiniLaser',
       'ASD-160 ×1' in s['rp'] and '250 mA' in s['rp'] and 'MiniLaser ×' not in s['rp'], s['rp'][:400])

    # Mixed MiniLaser + ASD-160: 180+250+70+70 = 570 (each unit takes an AUX circuit)
    loc = await build_sheet('ml+asd')
    s = await snap(pg, loc)
    check_formula('Mixed MiniLaser+ASD-160', s, 'MiniLasers + ASD-160 + Quiescent + AUX', 570, True, True, asd_text='ASD-160 1', ml_text='MiniLaser 1')

    # Detectors + MiniLaser, no display. Detector fan 4 mA is from MODULE table — don't hardcode detector mA; just require formula terms and sum==sheet total
    loc = await build_sheet('det+ml')
    s = await snap(pg, loc)
    total = int(re.search(r'(\d+)', s['cd']['total']).group(1))
    ok('Detectors+MiniLaser hides Displays, shows Detectors + MiniLasers + Quiescent + AUX, formula sums to totalMa',
       s['cd']['dispHidden'] and not s['cd']['detHidden'] and s['cd']['formula']=='Detectors + MiniLasers + Quiescent + AUX'
       and total==int(re.search(r'(\d+)', s['totalMa']).group(1)) and total > 180,
       {'formula': s['cd']['formula'], 'total': total, 'sheet': s['totalMa']})
    sm, parts = parse_ma_sum(s['I_total_full'].get('sub') or '')
    ok('Detectors+MiniLaser v2CalcSteps I_total omits I_disp and sums to total',
       'I_disp' not in (s['I_total_full'].get('sym') or '') and 'I_det' in (s['I_total_full'].get('sym') or '') and 'I_ml' in (s['I_total_full'].get('sym') or '') and sm==total,
       s['I_total_full'])

    # Full mixed: display + detector + MiniLaser
    loc = await build_sheet('fullmix')
    s = await snap(pg, loc)
    total = int(re.search(r'(\d+)', s['cd']['total']).group(1))
    ok('Full mixed shows Displays + Detectors + MiniLasers + Quiescent + AUX and equals sheet total',
       not s['cd']['dispHidden'] and not s['cd']['detHidden'] and s['cd']['formula']=='Displays + Detectors + MiniLasers + Quiescent + AUX'
       and total==int(re.search(r'(\d+)', s['totalMa']).group(1)) and 'I_disp' in (s['I_total_full'].get('sym') or '') and 'I_ml' in (s['I_total_full'].get('sym') or ''),
       {'formula': s['cd']['formula'], 'total': total, 'sym': s['I_total_full']})
    sm, parts = parse_ma_sum(s['I_total_full'].get('sub') or '')
    ok('Full mixed v2CalcSteps substitution sums to totalMa', sm==total, {'sub': s['I_total_full'].get('sub'), 'sum': sm, 'total': total})


    # ===================== QA re-review: M1 XSS, M2 preview, L1 AUX, L4 focus =====================
    PAYLOAD = '<img src=x onerror="window.__xss=1">'
    ids = await fresh(pg); loc1, loc2 = ids['loc1'], ids['loc2']
    rid = await pg.evaluate(''' (args) => {
      window.__xss = undefined;
      const l1 = document.getElementById('location-' + args.loc1);
      const l2 = document.getElementById('location-' + args.loc2);
      l1.querySelector('.ps-name').value = args.payload;
      l2.querySelector('.ps-name').value = 'PS-2 <">&';
      const tr = mlAddRow(args.loc1, {setup:'manual', zone:'tmp', fan:4, af:4, method:'DIP'});
      tr.querySelector('.ml-zone').value = args.payload;
      addModuleRow(args.loc1, 'Standard Display');
      const mod = l1.querySelector('[data-role=module]');
      if (mod && mod.querySelector('.zone-name')) mod.querySelector('.zone-name').value = args.payload;
      recalcLocation(args.loc1); recalcLocation(args.loc2);
      if (typeof v2Refresh === 'function') v2Refresh();
      const cb = l1.querySelector('.show-calc-detail-checkbox');
      if (cb && !cb.checked){ cb.checked = true; if (typeof toggleCalcDetail === 'function') toggleCalcDetail(args.loc1); }
      if (typeof setCurrentLocation === 'function') setCurrentLocation(l1);
      return tr.id;
    } ''', {'loc1': loc1, 'loc2': loc2, 'payload': PAYLOAD})
    await open_move(pg, rid)
    xss = await pg.evaluate('typeof window.__xss === "undefined" ? "undef" : window.__xss')
    ok('M1: XSS payload in sheet name / zone does not run (window.__xss undefined)', xss == 'undef', xss)
    inj = await pg.evaluate(''' () => ({
      imgs: document.querySelectorAll('#mv-overlay img, #mv-preview img, .cd-asd-unit-rows img, .cd-permodule-rows img, .mv-from img').length,
      head: (document.querySelector('.mv-preview-h')||{}).innerHTML || '',
      headText: (document.querySelector('.mv-preview-h')||{}).textContent || '',
      granular: (document.querySelector('.cd-asd-unit-rows')||{}).innerHTML || '',
      modules: (document.querySelector('.cd-permodule-rows')||{}).innerHTML || '',
      from: (document.querySelector('.mv-from')||{}).innerHTML || ''
    }) ''')
    ok('M1: no injected <img> nodes in the Move dialog or granular panel', inj['imgs']==0, inj['imgs'])
    ok('M1: existing-target destName is escaped in the preview heading',
       '&lt;' in inj['head'] and '<img' not in inj['head'] and '&amp;' in inj['head'], inj['head'][:200])
    await pg.click('label.target-item[data-mv-loc="new"]')
    await pg.wait_for_timeout(80)
    await pg.fill('.mv-new-name', PAYLOAD)
    await pg.wait_for_timeout(80)
    head2 = await pg.evaluate("({html:(document.querySelector('.mv-preview-h')||{}).innerHTML||'', text:(document.querySelector('.mv-preview-h')||{}).textContent||'', xss: typeof window.__xss === 'undefined' ? 'undef' : window.__xss})")
    ok('M1: +Create destName with <img onerror> is escaped and does not run',
       head2['xss']=='undef' and '&lt;img' in head2['html'] and '<img' not in head2['html'] and 'onerror' in head2['text'], head2)
    ok('M1: granular MiniLaser zone is escaped',
       '&lt;img' in inj['granular'] and '<img' not in inj['granular'], inj['granular'][:240])
    ok('M1: ModuLaser module zone in the breakdown is escaped',
       '&lt;img' in inj['modules'] and '<img' not in inj['modules'], inj['modules'][:240])
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(80)

    # M2: + Create new preview in third-party custom (400 mA q, 6x50 mA AUX, fan-4 MiniLaser)
    ids = await fresh(pg); loc1, loc2 = ids['loc1'], ids['loc2']
    rid = await pg.evaluate(''' (loc) => {
      const l = document.getElementById('location-' + loc);
      const m = l.querySelector('.mode-radio[value=thirdparty]');
      if (m){ m.checked = true; m.dispatchEvent(new Event('change', {bubbles:true})); }
      const s = l.querySelector('.submode-radio[value=custom]');
      if (s){ s.checked = true; s.dispatchEvent(new Event('change', {bubbles:true})); }
      l.querySelector('.custom-quiescent').value = '400';
      l.querySelector('.aux-circuits-custom').value = '6';
      l.querySelector('.custom-aux-ma').value = '50';
      const tr = mlAddRow(loc, {setup:'manual', zone:'ML 1', fan:4, af:4, method:'DIP'});
      recalcLocation(loc);
      if (typeof v2Refresh === 'function') v2Refresh();
      return tr.id;
    } ''', loc1)
    await open_move(pg, rid)
    await pg.click('label.target-item[data-mv-loc="new"]')
    await pg.wait_for_timeout(80)
    prev_ah = await pg.evaluate(r''' () => {
      const t = document.querySelector('#mv-preview').innerText;
      const m = t.match(/Required battery[\s\S]*?→\s*([0-9.]+)\s*Ah/i) || t.match(/→\s*([0-9.]+)\s*Ah/i);
      return {text: t, ah: m ? parseFloat(m[1]) : null};
    } ''')
    ok('M2: third-party custom +Create preview is the real inherited load (~26.49 Ah at NFPA 25% margin; 880 mA), not the old builtin 6.02 Ah',
       prev_ah['ah'] is not None and abs(prev_ah['ah'] - 26.49) < 0.06 and abs(prev_ah['ah'] - 6.02) > 1,
       prev_ah)
    await pg.click('.mv-confirm'); await pg.wait_for_timeout(500)
    new_ah = await pg.evaluate(''' () => {
      const l = [...document.querySelectorAll('.location')].find(el => (el.querySelector('.ps-name')||{}).value === 'PS-3');
      if (!l) return {missing:true};
      return {
        total: (l.querySelector('.total-ma')||{}).textContent,
        ah: parseFloat(String((l.querySelector('.required-ah')||{}).textContent).replace(/[^0-9.]/g,'')) || null,
        q: (l.querySelector('.custom-quiescent')||{}).value,
        auxN: (l.querySelector('.aux-circuits-custom')||{}).value,
        auxMa: (l.querySelector('.custom-aux-ma')||{}).value
      };
    } ''')
    ok('M2: created sheet inherited 400 mA / 6x50 mA, totals 880 mA, and required Ah matches the preview (not 6.02 Ah)',
       new_ah.get('q')=='400' and new_ah.get('auxN')=='6' and new_ah.get('auxMa')=='50'
       and new_ah.get('total') in ('880','880.0') and new_ah.get('ah') is not None
       and abs(new_ah['ah'] - prev_ah['ah']) < 0.06 and abs(new_ah['ah'] - 6.02) > 1,
       {'preview': prev_ah, 'sheet': new_ah})

    # L1: third-party custom AUX counter counts units (1/6 -> 2/6), not hidden selects (0/6)
    ids = await fresh(pg); loc1, loc2 = ids['loc1'], ids['loc2']
    rid = await pg.evaluate(''' (locs) => {
      const setTp = (l) => {
        const m = l.querySelector('.mode-radio[value=thirdparty]');
        if (m){ m.checked = true; m.dispatchEvent(new Event('change', {bubbles:true})); }
        const s = l.querySelector('.submode-radio[value=custom]');
        if (s){ s.checked = true; s.dispatchEvent(new Event('change', {bubbles:true})); }
        l.querySelector('.custom-quiescent').value = '400';
        l.querySelector('.aux-circuits-custom').value = '6';
        l.querySelector('.custom-aux-ma').value = '50';
      };
      const l1 = document.getElementById('location-' + locs.loc1);
      const l2 = document.getElementById('location-' + locs.loc2);
      setTp(l1); setTp(l2);
      mlAddRow(locs.loc2, {setup:'manual', zone:'DEST', fan:4, af:4, method:'DIP'});
      const tr = mlAddRow(locs.loc1, {setup:'manual', zone:'SRC', fan:4, af:4, method:'DIP'});
      recalcLocation(locs.loc1); recalcLocation(locs.loc2);
      return tr.id;
    } ''', {'loc1': loc1, 'loc2': loc2})
    dlg = await open_move(pg, rid)
    ps2 = next((t for t in dlg['targets'] if 'PS-2' in t['text']), None)
    ok('L1: destination already holding 1 unit shows 1/6 AUX used (not 0/6)',
       ps2 and '1/6' in ps2['text'] and '0/6' not in ps2['text'], ps2)
    await pg.click('label.target-item[data-mv-loc="' + str(loc2) + '"]')
    await pg.wait_for_timeout(80)
    prv = await pg.evaluate("document.querySelector('#mv-preview').innerText")
    ok('L1: preview counts 1/6 -> 2/6 in third-party custom (not 0/6 -> 1/6)',
       '1/6' in prv and '2/6' in prv and '0/6' not in prv, prv)
    await pg.click('.mv-confirm'); await pg.wait_for_timeout(400)
    after = await pg.evaluate(''' (loc) => {
      const l = document.getElementById('location-' + loc);
      return (typeof mlAuxState === 'function') ? mlAuxState(l).label : '';
    } ''', loc2)
    ok('L1: after the move the destination reports 2/6 AUX used', '2/6' in after, after)

    # L4: Escape/Cancel restore focus; Tab is trapped in the dialog
    ids = await fresh(pg); loc1, loc2 = ids['loc1'], ids['loc2']
    rid = await pg.evaluate(ADD_ML, {'loc': loc1, 'zone': 'ML 1', 'fan': 4, 'extra': {}})
    await pg.evaluate(''' (id) => {
      const tr = document.getElementById(id);
      const locEl = tr.closest('.location');
      if (typeof setCurrentLocation === 'function') setCurrentLocation(locEl);
      const btn = tr.querySelector('.ml-move-btn');
      btn.focus();
      btn.click();
    } ''', rid)
    await pg.wait_for_timeout(150)
    await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(80)
    back = await pg.evaluate(''' () => {
      const el = document.activeElement;
      return {id: el && el.closest && (el.closest('tr')||{}).id, cls: el && el.className, tag: el && el.tagName, text: el && (el.textContent||'').slice(0,20)};
    } ''')
    ok('L4: Escape restores focus to the triggering Move button',
       back.get('id')==rid and back.get('cls') and 'ml-move-btn' in back['cls'], back)
    await pg.evaluate(''' (id) => { document.getElementById(id).querySelector('.ml-move-btn').focus(); document.getElementById(id).querySelector('.ml-move-btn').click(); } ''', rid)
    await pg.wait_for_timeout(150)
    trapped = True
    inside_ids = []
    for _ in range(20):
        await pg.keyboard.press('Tab')
        info = await pg.evaluate(''' () => {
          const el = document.activeElement;
          const ov = document.getElementById('mv-overlay');
          return {inside: !!(ov && ov.contains(el)), tag: el && el.tagName, name: el && (el.name||el.className||'')};
        } ''')
        inside_ids.append(info)
        if not info['inside']:
            trapped = False
            break
    ok('L4: Tab stays trapped inside the Move dialog (20 Tab presses)', trapped, inside_ids[-3:])
    await pg.evaluate(''' () => {
      const ov = document.getElementById('mv-overlay');
      const list = typeof mlMoveFocusables === 'function' ? mlMoveFocusables(ov) : [];
      if (list[0]) list[0].focus();
    } ''')
    await pg.keyboard.press('Shift+Tab')
    wrap = await pg.evaluate(''' () => {
      const el = document.activeElement;
      const ov = document.getElementById('mv-overlay');
      return {inside: !!(ov && ov.contains(el)), cls: el && el.className};
    } ''')
    ok('L4: Shift+Tab wraps inside the dialog', wrap['inside'] is True, wrap)
    await pg.click('.mv-cancel')
    await pg.wait_for_timeout(80)
    back2 = await pg.evaluate(''' () => { const el=document.activeElement; return {cls: el && el.className, id: el && el.closest && (el.closest('tr')||{}).id}; } ''')
    ok('L4: Cancel restores focus to the triggering Move button',
       back2.get('id')==rid and back2.get('cls') and 'ml-move-btn' in back2['cls'], back2)


    ok('no page errors', not errs, errs[:5])
    await b.close()
  print(f"{sum(R)}/{len(R)}")
  sys.exit(0 if all(R) else 1)

asyncio.run(main())
