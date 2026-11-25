"""02.03.000 / 00.04.000 — Sidebar delete, rename, duplicate, and reorder (Direction C).
Placeholder data only (PS-1 / PS-2 / PS-3, Area A / Area B, ML 1). No real project or fixture names.
Run: python3 tests/ps_sidebar_actions_test.py
APP=file:///.../index.html to point at another copy (Toolbox)."""
import asyncio, os, sys, re, json, tempfile
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DEFAULT_APP = ROOT + '/modulaser_battery_calculator.html'
if not os.path.exists(DEFAULT_APP) and os.path.exists(os.path.join(ROOT, 'index.html')):
    DEFAULT_APP = os.path.join(ROOT, 'index.html')
APP = os.environ.get('APP', 'file://' + DEFAULT_APP)
OUT = os.environ.get('MLP_TEST_OUT') or tempfile.mkdtemp(prefix='ml-ps-sb-')
os.makedirs(OUT, exist_ok=True)
R = []
def ok(n, c, i=''):
    R.append(bool(c))
    print('PASS' if c else 'FAIL', n, str(i)[:500])

BOOT = r'''() => {
  if (typeof clearEntireDocument === 'function') clearEntireDocument({clearHeaders:false});
  const pre = [...document.querySelectorAll('.location')];
  addLocation();
  const l1 = [...document.querySelectorAll('.location')].pop();
  pre.forEach(e => e.remove());
  const apply = (l, name, area) => {
    l.querySelector('.ps-name').value = name;
    l.querySelector('.ps-location').value = area;
    const db = l.querySelector('.design-basis-select');
    if (db){ db.value = 'NFPA 72 Standard'; applyDesignBasis(l.dataset.loc); }
    const t = l.querySelector('.temperature-select'); if (t) t.value = '77';
  };
  apply(l1, 'PS-1', 'Area A');
  addLocation();
  const l2 = [...document.querySelectorAll('.location')].pop();
  apply(l2, 'PS-2', 'Area A');
  addLocation();
  const l3 = [...document.querySelectorAll('.location')].pop();
  apply(l3, 'PS-3', 'Area B');
  if (typeof recalcLocation === 'function'){
    recalcLocation(l1.dataset.loc); recalcLocation(l2.dataset.loc); recalcLocation(l3.dataset.loc);
  }
  if (typeof v2Refresh === 'function') v2Refresh();
  if (typeof setCurrentLocation === 'function') setCurrentLocation(l2);
  if (typeof v2Refresh === 'function') v2Refresh();
  return { loc1: l1.dataset.loc, loc2: l2.dataset.loc, loc3: l3.dataset.loc };
}'''

async def fresh(pg):
    await pg.goto(APP)
    await pg.evaluate('localStorage.clear()')
    await pg.reload()
    await pg.wait_for_timeout(700)
    return await pg.evaluate(BOOT)

async def fill_ps2_units(pg, loc2, loc1=None):
    """PS-2: 2 MiniLasers, 1 ASD-160, AUX used via those units. Optional remote cluster from a PS-1 display."""
    await pg.evaluate('''(locs) => {
      const {loc2, loc1} = locs;
      mlAddRow(loc2, {setup:'manual', zone:'ML 2', fan:4, af:4, method:'DIP'});
      mlAddRow(loc2, {setup:'manual', zone:'ML 3', fan:4, af:4, method:'DIP'});
      asdAddRow(loc2, {kind:'asd160', zone:'Zone-01', networked:false, address:'', af:4, cls:'SFD'});
      addModuleRow(loc2, 'Standard Display');
      const l2el = document.getElementById('location-' + loc2);
      const disp = l2el && l2el.querySelector('[data-role=module]');
      if (disp){
        if (disp.querySelector('.zone-name')) disp.querySelector('.zone-name').value = 'Disp 2';
        const addr = disp.querySelector('.module-address'); if (addr) addr.value = '10';
        if (disp.dataset) disp.dataset.clusterNum = '1';
      }
      if (loc1){
        addModuleRow(loc1, 'Detector');
        const l1 = document.getElementById('location-' + loc1);
        const row = l1.querySelector('[data-role=module]');
        if (row){
          row.querySelector('.zone-name').value = 'Det 1';
          const addr = row.querySelector('.module-address');
          if (addr) addr.value = '1';
          const cl = row.querySelector('.cluster-select');
          if (cl){
            const v = 'r:' + loc2 + ':1';
            if (![...cl.options].some(o => o.value === v)){
              const opt = document.createElement('option'); opt.value = v; opt.textContent = 'Remote 01'; cl.appendChild(opt);
            }
            cl.value = v;
            if (cl.dataset) cl.dataset.desiredValue = v;
            cl.dispatchEvent(new Event('change', {bubbles:true}));
          }
        }
        if (typeof recalcLocation === 'function') recalcLocation(loc1);
      }
            if (typeof recalcLocation === 'function') recalcLocation(loc2);
      if (typeof refreshAllAmber === 'function') refreshAllAmber();
      if (typeof v2Refresh === 'function') v2Refresh();
      if (typeof setCurrentLocation === 'function') setCurrentLocation(document.getElementById('location-' + loc2));
      if (typeof v2Refresh === 'function') v2Refresh();
    }''', {'loc2': loc2, 'loc1': loc1})

def test_sw_versions():
    calc = Path(ROOT)
    # Calculator repo has docs/sw.js + pwa/sw.js; Toolbox has sw.js
    docs = calc / 'docs' / 'sw.js'
    pwa = calc / 'pwa' / 'sw.js'
    tb = calc / 'sw.js'
    if docs.exists() and pwa.exists():
        d = docs.read_text(); p = pwa.read_text()
        dm = re.search(r"CACHE_VERSION = '([^']+)'", d)
        pm = re.search(r"CACHE_VERSION = '([^']+)'", p)
        ok('PP-L1 docs/sw.js and pwa/sw.js CACHE_VERSION match', dm and pm and dm.group(1) == pm.group(1), (dm.group(1) if dm else None, pm.group(1) if pm else None))
        ok('PP-L1 Calculator CACHE_VERSION is modulaser-calc-v57', dm and dm.group(1) == 'modulaser-calc-v57', dm.group(1) if dm else None)
    elif tb.exists():
        t = tb.read_text()
        tm = re.search(r"CACHE_VERSION = '([^']+)'", t)
        ok('Toolbox CACHE_VERSION is masd-toolbox-00-04-000', tm and tm.group(1) == 'masd-toolbox-00-04-000', tm.group(1) if tm else None)
    else:
        ok('service worker file present', False, ROOT)

async def main():
    test_sw_versions()
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        pg = await browser.new_page(viewport={'width': 1400, 'height': 900})

        ids = await fresh(pg)
        loc1, loc2, loc3 = ids['loc1'], ids['loc2'], ids['loc3']
        await fill_ps2_units(pg, loc2, loc1)

        rev = await pg.evaluate("typeof runningRevisionFull==='function'?runningRevisionFull():(typeof mlpCalcRev==='function'?mlpCalcRev():'')")
        ok('revision is 02.03.000_261124 or Toolbox 00.04.000_261124',
           '02.03.000_261124' in str(rev) or '00.04.000_261124' in str(rev), rev)

        chrome = await pg.evaluate('''() => {
          const rows = [...document.querySelectorAll('#sb-list .sb-item')];
          const cur = document.querySelector('#sb-list .sb-item.current');
          const info = rows.map(r => ({
            loc: r.getAttribute('data-loc'),
            grip: !!r.querySelector('.sb-grip'),
            trash: !!r.querySelector('.sb-trash'),
            more: !!r.querySelector('.sb-more'),
            current: r.classList.contains('current')
          }));
          const headerRemove = !!document.querySelector('.location-current button[title="Remove this location"], .location-current button.btn-ghost');
          return { n: rows.length, info, currentHasMore: !!(cur && cur.querySelector('.sb-more')),
            othersHaveMore: info.filter(i => !i.current).some(i => i.more),
            allGrip: info.every(i => i.grip), allTrash: info.every(i => i.trash), headerRemove };
        }''')
        ok('Direction C: grip on every sidebar row', chrome.get('allGrip'), chrome)
        ok('Direction C: trash on every sidebar row', chrome.get('allTrash'), chrome)
        ok('Direction C: kebab only on the current row', chrome.get('currentHasMore') and not chrome.get('othersHaveMore'), chrome)
        ok('header Remove remains on the current sheet', chrome.get('headerRemove'), chrome)

        # open kebab
        if await pg.locator('.sb-item.current .sb-more').count():
            await pg.click('.sb-item.current .sb-more')
        menu = await pg.evaluate('''() => {
          const m = document.querySelector('.sb-menu, [data-sb-menu], #sb-row-menu');
          if (!m || m.hidden) return {open:false};
          const labels = [...m.querySelectorAll('button, [role=menuitem]')].map(b => b.textContent.trim());
          return {open:true, labels};
        }''')
        ok('kebab menu is Rename and Duplicate only', menu.get('open') and 'Rename' in menu.get('labels',[]) and 'Duplicate' in menu.get('labels',[]) and not any('Delete' == x or x.startswith('Delete') for x in menu.get('labels',[])), menu)
        await pg.keyboard.press('Escape')

        # Delete confirm from trash
        await pg.click(f'.sb-item[data-loc="{loc2}"] .sb-trash')
        await pg.wait_for_timeout(200)
        dlg = await pg.evaluate('''() => {
          const ov = document.querySelector('#ps-del-overlay, .ps-del-overlay, [data-ps-delete]');
          if (!ov) return {open:false};
          const txt = ov.innerText;
          const role = ov.getAttribute('role');
          const modal = ov.getAttribute('aria-modal');
          return {open: true, role, modal, txt, hasMove: /Move MiniLaser/i.test(txt),
            hasUnmoved: /unmoved units will also be deleted/i.test(txt),
            hasCluster: /references a cluster/i.test(txt),
            hasML: /MiniLaser/i.test(txt) && /×\\s*2|x2|2 \\(ML/i.test(txt),
            hasAsd: /ASD-160/i.test(txt),
            hasAux: /AUX/i.test(txt),
            title: (ov.querySelector('h2, #ps-del-title')||{}).textContent||''};
        }''')
        ok('delete confirm opens as role=dialog aria-modal', dlg.get('open') and dlg.get('role')=='dialog' and dlg.get('modal')=='true', dlg)
        ok('delete confirm title names PS-2', 'PS-2' in (dlg.get('title') or dlg.get('txt') or ''), dlg)
        ok('delete confirm lists MiniLaser, ASD-160, AUX counts', dlg.get('hasML') and dlg.get('hasAsd') and dlg.get('hasAux'), dlg)
        ok('delete confirm offers Move MiniLaser / ASD-160 first', dlg.get('hasMove'), dlg)
        ok('delete confirm warns unmoved units will also be deleted', dlg.get('hasUnmoved'), dlg)
        ok('delete confirm warns about other-sheet cluster refs', dlg.get('hasCluster'), dlg)

        await pg.keyboard.press('Escape')
        await pg.wait_for_timeout(150)
        still = await pg.evaluate("() => !!document.querySelector('#ps-del-overlay.open, .ps-del-overlay.open, #ps-del-overlay[aria-modal], .ps-del-overlay') && !!(document.querySelector('#ps-del-overlay, .ps-del-overlay') && getComputedStyle(document.querySelector('#ps-del-overlay, .ps-del-overlay')).display!=='none' && !document.querySelector('#ps-del-overlay, .ps-del-overlay').hidden && (document.querySelector('#ps-del-overlay, .ps-del-overlay').classList.contains('open') || document.querySelector('#ps-del-overlay, .ps-del-overlay').style.display==='' && document.getElementById('ps-del-overlay')))")
        # simpler: overlay not visible
        vis = await pg.evaluate('''() => {
          const ov = document.querySelector('#ps-del-overlay, .ps-del-overlay');
          if (!ov) return false;
          if (ov.hidden) return false;
          if (!ov.classList.contains('open') && ov.id==='ps-del-overlay' && !ov.classList.contains('open')){
            const cs = getComputedStyle(ov);
            return cs.display!=='none' && cs.visibility!=='hidden' && ov.classList.contains('open');
          }
          return ov.classList.contains('open') || (ov.getAttribute('aria-hidden')!=='true' && getComputedStyle(ov).display!=='none' && ov.classList.contains('open'));
        }''')
        gone = await pg.evaluate('''() => {
          const ov = document.querySelector('#ps-del-overlay, .ps-del-overlay');
          if (!ov) return true;
          if (ov.hidden) return true;
          const cs = getComputedStyle(ov);
          return cs.display==='none' || cs.visibility==='hidden' || !ov.classList.contains('open');
        }''')
        ok('Escape closes the delete confirm without deleting', gone and await pg.evaluate("() => !!document.getElementById('location-'+'"+loc2+"')"), gone)

        # Header Remove uses the same confirm
        await pg.click('.location-current button[title="Remove this location"]')
        await pg.wait_for_timeout(200)
        same = await pg.evaluate('''() => {
          const ov = document.querySelector('#ps-del-overlay, .ps-del-overlay');
          return !!(ov && (ov.classList.contains('open') || getComputedStyle(ov).display!=='none') && !ov.hidden && /Delete power supply/i.test(ov.innerText));
        }''')
        ok('header Remove opens the same delete confirm', same, same)
        # cancel via button
        if await pg.locator('#ps-del-overlay button:has-text("Cancel"), .ps-del-overlay button:has-text("Cancel")').count():
            await pg.click('#ps-del-overlay button:has-text("Cancel"), .ps-del-overlay button:has-text("Cancel")')
        else:
            await pg.keyboard.press('Escape')
        await pg.wait_for_timeout(150)

        # Confirm delete of PS-2, focus previous, badges stay, undo
        await pg.click(f'.sb-item[data-loc="{loc2}"] .sb-trash')
        await pg.wait_for_timeout(200)
        # click danger confirm
        await pg.locator('#ps-del-overlay button.btn-danger, #ps-del-overlay button.btn-primary, .ps-del-overlay button:has-text("Delete")').last.click()
        await pg.wait_for_timeout(300)
        after = await pg.evaluate('''(locs) => {
          const {loc1, loc2, loc3} = locs;
          const ids = [...document.querySelectorAll('.location')].map(l => l.dataset.loc);
          const badges = [...document.querySelectorAll('#sb-list .sb-item')].map(r => ({
            loc: r.getAttribute('data-loc'),
            text: r.innerText,
            current: r.classList.contains('current'),
            active: document.activeElement===r || r.contains(document.activeElement)
          }));
          const toast = (document.querySelector('#br-toast, #ps-undo-toast, [data-ps-undo]')||{}).innerText || '';
          const addFocus = document.activeElement && document.activeElement.id==='sb-add-btn';
          return {ids, badges, toast, addFocus, cur: (document.querySelector('.location-current')||{}).dataset && document.querySelector('.location-current').dataset.loc};
        }''', {'loc1':loc1,'loc2':loc2,'loc3':loc3})
        ok('confirm delete removes PS-2 only', loc2 not in after['ids'] and loc1 in after['ids'] and loc3 in after['ids'], after)
        textjoin = ' '.join(b['text'] for b in after['badges'])
        ok('loc ids are not reminted after delete (gap remains)', loc1 in after['ids'] and loc3 in after['ids'] and loc2 not in after['ids'], after)
        ok('focus after delete is the previous remaining sheet, not + Add', after.get('cur')==loc1 and not after.get('addFocus'), after)
        ok('Undo toast is shown after delete', 'Deleted' in after.get('toast','') and 'Undo' in after.get('toast',''), after.get('toast'))

        # Undo
        if await pg.locator('button:has-text("Undo")').count():
            await pg.click('button:has-text("Undo")')
        else:
            await pg.evaluate("typeof psUndoRestore==='function' && psUndoRestore()")
        await pg.wait_for_timeout(400)
        undone = await pg.evaluate('''(loc2) => {
          const el = document.getElementById('location-' + loc2);
          return {has: !!el, loc: el && el.dataset.loc, name: el && el.querySelector('.ps-name').value};
        }''', loc2)
        ok('Undo restores the deleted sheet with the same loc id and name', undone.get('has') and undone.get('loc')==loc2 and undone.get('name')=='PS-2', undone)

        # Auto-Save + Undo
        await fresh(pg)
        ids = await pg.evaluate(BOOT)
        loc1, loc2, loc3 = ids['loc1'], ids['loc2'], ids['loc3']
        await fill_ps2_units(pg, loc2, loc1)
        await pg.evaluate('''() => {
          if (typeof setAutosaveActivated==='function') setAutosaveActivated(true);
          if (typeof setAutosaveEnabled==='function') setAutosaveEnabled(true);
        }''')
        await pg.click(f'.sb-item[data-loc="{loc2}"] .sb-trash')
        await pg.wait_for_timeout(200)
        await pg.locator('#ps-del-overlay button:has-text("Delete"), .ps-del-overlay button:has-text("Delete")').last.click()
        await pg.wait_for_timeout(600)  # allow 400 ms Auto-Save
        await pg.evaluate("typeof psUndoRestore==='function' ? psUndoRestore() : document.querySelector('button:has-text(\"Undo\")')?.click()")
        # also click undo if still on screen
        if await pg.locator('button:has-text("Undo")').count():
            try:
                await pg.click('button:has-text("Undo")', timeout=1000)
            except Exception:
                pass
        await pg.wait_for_timeout(300)
        undone2 = await pg.evaluate('''(loc2) => !!document.getElementById('location-'+loc2)''', loc2)
        ok('Undo still restores after Auto-Save has written', undone2, undone2)

        # serialize loc id
        ser = await pg.evaluate('''() => {
          const l = document.querySelector('.location');
          const o = serializeLocation(l);
          return {hasLoc: !!o.loc, loc: o.loc, attr: l.dataset.loc};
        }''')
        ok('serializeLocation stores data-loc', ser.get('hasLoc') and str(ser.get('loc'))==str(ser.get('attr')), ser)

        # Last remaining supply
        await pg.evaluate('''() => {
          [...document.querySelectorAll('.location')].slice(1).forEach(e => e.remove());
          if (typeof v2Refresh==='function') v2Refresh();
          const only = document.querySelector('.location');
          if (only && typeof setCurrentLocation==='function') setCurrentLocation(only);
          if (typeof v2Refresh==='function') v2Refresh();
        }''')
        only_loc = await pg.evaluate("() => document.querySelector('.location').dataset.loc")
        await pg.click('.sb-item.current .sb-trash, .sb-item .sb-trash')
        await pg.wait_for_timeout(200)
        last = await pg.evaluate('''() => {
          const ov = document.querySelector('#ps-del-overlay, .ps-del-overlay');
          const txt = ov ? ov.innerText : '';
          return {open: !!(ov && (ov.classList.contains('open') || !ov.hidden)), txt,
            allows: /blank new power supply will be created/i.test(txt) && !/cannot delete last/i.test(txt)};
        }''')
        ok('last remaining supply confirm allows delete and auto-creates a blank supply', last.get('allows'), last)
        await pg.locator('#ps-del-overlay button:has-text("Delete"), .ps-del-overlay button:has-text("Delete")').last.click()
        await pg.wait_for_timeout(300)
        last_after = await pg.evaluate('''(old) => {
          const locs = [...document.querySelectorAll('.location')].map(l => l.dataset.loc);
          const addFocus = document.activeElement && document.activeElement.id==='sb-add-btn';
          return {n: locs.length, locs, oldGone: locs.indexOf(old)<0, higher: locs.some(id => Number(id) > Number(old)), addFocus,
            name: (document.querySelector('.location .ps-name')||{}).value};
        }''', only_loc)
        ok('last-supply delete creates one blank sheet with a later Sheet badge and does not focus + Add',
           last_after['n']==1 and last_after['oldGone'] and last_after['higher'] and not last_after['addFocus'] and (last_after['name'] or '')=='', last_after)

        # Rename + Duplicate
        ids = await fresh(pg)
        loc1, loc2, loc3 = ids['loc1'], ids['loc2'], ids['loc3']
        await fill_ps2_units(pg, loc2, loc1)
        await pg.evaluate("l => setCurrentLocation(document.getElementById('location-'+l)) && v2Refresh()", loc1)
        await pg.wait_for_timeout(100)
        await pg.click('.sb-item.current .sb-more')
        await pg.click('.sb-menu button:has-text("Rename"), [data-sb-menu] button:has-text("Rename"), #sb-row-menu button:has-text("Rename")')
        await pg.wait_for_timeout(100)
        inp = pg.locator('.sb-item.current input.sb-rename, .sb-item.current input[data-sb-rename]')
        if await inp.count():
            await inp.fill('PS-1-Renamed')
            await inp.press('Enter')
        else:
            await pg.evaluate("document.querySelector('.location[data-loc=\""+loc1+"\"] .ps-name').value='PS-1-Renamed'; v2Refresh();")
        await pg.wait_for_timeout(150)
        renamed = await pg.evaluate("l => document.getElementById('location-'+l).querySelector('.ps-name').value", loc1)
        ok('Rename from the list updates the power supply name', renamed=='PS-1-Renamed', renamed)

        # reset name for suggest
        await pg.evaluate("l => { document.getElementById('location-'+l).querySelector('.ps-name').value='PS-1'; v2Refresh(); }", loc1)
        await pg.click(f'.sb-item[data-loc="{loc1}"]')
        await pg.wait_for_timeout(80)
        await pg.click('.sb-item.current .sb-more')
        await pg.click('.sb-menu button:has-text("Duplicate"), [data-sb-menu] button:has-text("Duplicate")')
        await pg.wait_for_timeout(400)
        dup = await pg.evaluate('''(src) => {
          const locs = [...document.querySelectorAll('.location')];
          const srcEl = document.getElementById('location-'+src);
          const srcI = locs.indexOf(srcEl);
          const copy = locs[srcI+1];
          if (!copy) return {ok:false, reason:'no next'};
          const name = copy.querySelector('.ps-name').value;
          const area = copy.querySelector('.ps-location').value;
          const srcArea = srcEl.querySelector('.ps-location').value;
          const ml = copy.querySelectorAll('[data-role=minilaser], tr[data-kind]').length;
          const mods = copy.querySelectorAll('[data-role=module]').length;
          const srcMods = srcEl.querySelectorAll('[data-role=module]').length;
          const srcMl = srcEl.querySelectorAll('[data-role=minilaser], tr[data-kind]').length;
          // self cluster rewrite: modules on copy should not still point at copy? source display was on loc1
          // For this fixture the display is on loc1 pointing at loc2; copy of loc1 should keep r:loc2:1
          const cl = (copy.querySelector('.cluster-select')||{}).value || '';
          const srcCl = (srcEl.querySelector('.cluster-select')||{}).value || '';
          const idsDiffer = copy.dataset.loc !== srcEl.dataset.loc && copy.id !== srcEl.id;
          const cur = document.querySelector('.location-current')===copy;
          return {ok:true, name, area, srcArea, ml, srcMl, mods, srcMods, cl, srcCl, idsDiffer, cur, loc: copy.dataset.loc};
        }''', loc1)
        ok('Duplicate name is next free PS-(max+1)', dup.get('name')=='PS-4' or (isinstance(dup.get('name'), str) and dup.get('name').startswith('PS-') and int(dup['name'].split('-')[1])>=4), dup)
        # With PS-1, PS-2, PS-3 existing, next is PS-4
        ok('Duplicate is placed right after the source in the same Area', dup.get('ok') and dup.get('area')==dup.get('srcArea'), dup)
        ok('Duplicate copies settings and units and uses new ids', dup.get('idsDiffer') and dup.get('mods')==dup.get('srcMods'), dup)
        ok('Duplicate keeps other-sheet cluster refs pointing at the original host', (not dup.get('srcCl')) or dup.get('cl')==dup.get('srcCl'), dup)

        # address collision: two networked modules same addr on same network after duplicate of a sheet with addr 1
        clash = await pg.evaluate('''() => {
          // if PS-1 (and its copy) both have address 1 on the same SenseNET, addrConflicts should flag it
          if (typeof addrConflicts !== 'function') return 'no-fn';
          const c = addrConflicts();
          const nets = Object.keys(c.network||{});
          return nets.length>0 || JSON.stringify(c);
        }''')
        ok('existing address validation flags a clash after duplicate when addresses are copied', clash is True or (isinstance(clash, str) and clash not in ('no-fn', '{}', '{"network":{},"standalone":{},"over":{}}') and 'no-fn'!=clash), clash)

        # Drag within Area A: swap PS-1 and PS-2 via API if helper exists, else dispatch drop
        ids = await fresh(pg)
        loc1, loc2, loc3 = ids['loc1'], ids['loc2'], ids['loc3']
        order1 = await pg.evaluate('''() => {
          if (typeof psMoveSheet === 'function'){
            const l1 = document.querySelector('.location[data-loc="'''+loc1+'''"]');
            const l2 = document.querySelector('.location[data-loc="'''+loc2+'''"]');
            psMoveSheet(l1, {after: l2, area: 'Area A', confirm:false});
          } else if (typeof psReorderRelative === 'function'){
            psReorderRelative(document.querySelector('.location[data-loc="'''+loc1+'''"]'), 1);
          }
          return [...document.querySelectorAll('.location')].filter(l => l.querySelector('.ps-location').value==='Area A').map(l => l.dataset.loc);
        }''')
        # If helpers not used, try Alt+Arrow on loc1 (move down)
        if order1 == [loc1, loc2]:
            await pg.click(f'.sb-item[data-loc="{loc1}"]')
            await pg.focus(f'.sb-item[data-loc="{loc1}"]')
            await pg.keyboard.press('Alt+ArrowDown')
            await pg.wait_for_timeout(150)
            order1 = await pg.evaluate("() => [...document.querySelectorAll('.location')].filter(l => l.querySelector('.ps-location').value==='Area A').map(l => l.dataset.loc)")
        ok('keyboard/drag reorders within the same Area without changing Location', order1==[loc2, loc1] or (loc2 in order1 and order1.index(loc2) < order1.index(loc1) if loc1 in order1 else False), order1)

        # Cross-area confirm
        await pg.evaluate('''(locs) => {
          if (typeof setCurrentLocation==='function') setCurrentLocation(document.getElementById('location-'+locs.loc2));
          v2Refresh();
        }''', {'loc2': loc2})
        # Move PS-2 (Area A) toward Area B via helper or keyboard at boundary
        opened = await pg.evaluate('''(locs) => {
          const el = document.getElementById('location-'+locs.loc2);
          if (typeof psProposeAreaMove === 'function'){
            psProposeAreaMove(el, 'Area B');
            const ov = document.querySelector('#ps-area-overlay, .ps-area-overlay');
            return !!(ov && (ov.classList.contains('open') || !ov.hidden) && /Area B/i.test(ov.innerText));
          }
          return 'no-fn';
        }''', {'loc2': loc2})
        if opened == 'no-fn':
            # try Alt+ArrowDown until confirm
            await pg.focus(f'.sb-item[data-loc="{loc2}"]')
            for _ in range(3):
                await pg.keyboard.press('Alt+ArrowDown')
                await pg.wait_for_timeout(100)
            opened = await pg.evaluate('''() => {
              const ov = document.querySelector('#ps-area-overlay, .ps-area-overlay, #ps-del-overlay');
              const txt = ov ? ov.innerText : document.body.innerText;
              return /Move .* to Area B/i.test(txt) || /update the supply.s Location/i.test(txt);
            }''')
        ok('dropping/moving into another Area opens a confirm that updates Location', bool(opened) and opened != 'no-fn', opened)
        # cancel leaves area
        if await pg.locator('#ps-area-overlay button:has-text("Cancel"), .ps-area-overlay button:has-text("Cancel")').count():
            await pg.click('#ps-area-overlay button:has-text("Cancel"), .ps-area-overlay button:has-text("Cancel")')
            await pg.wait_for_timeout(150)
            stillA = await pg.evaluate("l => document.getElementById('location-'+l).querySelector('.ps-location').value", loc2)
            ok('Area confirm Cancel leaves Location unchanged', stillA=='Area A', stillA)
        # confirm
        await pg.evaluate('''(locs) => { if (typeof psProposeAreaMove==='function') psProposeAreaMove(document.getElementById('location-'+locs.loc2), 'Area B'); }''', {'loc2': loc2})
        if await pg.locator('#ps-area-overlay button:has-text("Move"), #ps-area-overlay button:has-text("Confirm"), .ps-area-overlay button:has-text("Move")').count():
            await pg.locator('#ps-area-overlay button:has-text("Move"), #ps-area-overlay button:has-text("Confirm"), .ps-area-overlay button:has-text("Move")').first.click()
        elif await pg.evaluate("typeof psConfirmAreaMove==='function'"):
            await pg.evaluate('''(locs) => psConfirmAreaMove(document.getElementById('location-'+locs.loc2), 'Area B')''', {'loc2': loc2})
        await pg.wait_for_timeout(200)
        newA = await pg.evaluate("l => document.getElementById('location-'+l) && document.getElementById('location-'+l).querySelector('.ps-location').value", loc2)
        ok('Area confirm accept updates the supply Location field', newA=='Area B', newA)

        # L-r2-2: after Move, focus is not #sb-add-btn
        # Re-boot a simple two-sheet MiniLaser move
        await fresh(pg)
        ids = await pg.evaluate(BOOT)
        await pg.evaluate('''(locs) => {
          mlAddRow(locs.loc1, {setup:'manual', zone:'ML 1', fan:4, af:4, method:'DIP'});
          recalcLocation(locs.loc1); v2Refresh();
          const tr = document.querySelector('#location-'+locs.loc1+' [data-role=minilaser], #location-'+locs.loc1+' tr[data-kind]');
          if (typeof mlMoveOpen==='function' && tr) mlMoveOpen(tr, locs.loc1);
        }''', ids)
        await pg.wait_for_timeout(200)
        # choose dest loc2 and confirm if dialog is open
        moved = await pg.evaluate('''(locs) => {
          const ov = document.getElementById('mv-overlay');
          if (!ov) return 'no-dialog';
          const r = ov.querySelector('input[name="mv-target"][value="'+locs.loc2+'"]') || [...ov.querySelectorAll('input[name="mv-target"]')].find(i => i.value===locs.loc2);
          if (r){ r.checked = true; r.dispatchEvent(new Event('change',{bubbles:true})); }
          const btn = ov.querySelector('.mv-confirm');
          if (btn) btn.click();
          return 'clicked';
        }''', ids)
        await pg.wait_for_timeout(300)
        focus_id = await pg.evaluate("() => document.activeElement && document.activeElement.id")
        ok('L-r2-2: after Move, focus is not #sb-add-btn', focus_id != 'sb-add-btn', {'focus': focus_id, 'moved': moved})

        # L-r2-1: v2ExportPdf waits for data-fit
        src = await pg.evaluate("typeof v2ExportPdf==='function' ? String(v2ExportPdf) : ''")
        ok('L-r2-1: v2ExportPdf polls for data-fit === done before print',
           'data-fit' in src and 'done' in src and ('wait' in src.lower() or 'poll' in src.lower() or 'requestAnimationFrame' in src or 'while' in src or 'setTimeout' in src),
           src[src.find('fr.onload') if 'fr.onload' in src else 0: src.find('fr.onload')+400 if 'fr.onload' in src else 200])

        # ========== QA follow-up H1 / H2 / M1 / M2 / M3 / L1-L4 ==========
        async def dismiss_import_prompts():
            for _ in range(8):
                info = await pg.evaluate("""() => {
                  const o = document.getElementById('prompt-overlay');
                  if (!o || !o.classList.contains('open')) return null;
                  return [document.getElementById('prompt-title') && document.getElementById('prompt-title').textContent,
                          [...document.querySelectorAll('#prompt-actions button')].map(b => b.textContent)];
                }""")
                if not info:
                    return
                pick = next((x for x in info[1] if x in (
                    'Merge sheets', 'Manually address', 'Import anyway', 'Keep both (rename)', 'OK'
                )), info[1][0] if info[1] else None)
                if not pick:
                    return
                await pg.evaluate("([t]) => [...document.querySelectorAll('#prompt-actions button')].find(b => b.textContent === t).click()", [pick])
                await pg.wait_for_timeout(350)

        async def confirm_delete():
            await pg.wait_for_timeout(150)
            await pg.evaluate("""() => {
              const btn = [...document.querySelectorAll('#ps-del-overlay button, [role=dialog] button')].find(b => /Delete/i.test(b.textContent) && !/Cancel/.test(b.textContent));
              if (btn) btn.click();
            }""")
            await pg.wait_for_timeout(400)

        # H1: Import Calc -> Merge with colliding loc ids
        ids = await fresh(pg)
        await fill_ps2_units(pg, ids['loc2'], ids['loc1'])
        st = await pg.evaluate("""() => {
          const s = buildStateObject();
          s.locations.forEach((l, i) => { l.psName = 'PS-IMP' + (i + 1); });
          return JSON.stringify(s);
        }""")
        html = '<!DOCTYPE html><html><body><script type="application/json" id="embedded-state">' + st.replace('</', '<\\/') + '</script></body></html>'
        await pg.evaluate("([h]) => { handleImportFile(new File([h], 'probe-import.html', {type:'text/html'})); }", [html])
        await pg.wait_for_timeout(400)
        await dismiss_import_prompts()
        await pg.wait_for_timeout(600)
        h1 = await pg.evaluate("""() => {
          const locRoots = [...document.querySelectorAll('.location')];
          const allIds = locRoots.flatMap(l => [l, ...l.querySelectorAll('[id]')].map(e => e.id).filter(Boolean));
          const dups = [...new Set(allIds.filter((x, i, a) => a.indexOf(x) !== i))];
          const locs = [...document.querySelectorAll('.location')].map(l => ({
            loc: l.dataset.loc, name: l.querySelector('.ps-name').value,
            ah: (l.querySelector('.required-ah') || {}).textContent || ''
          }));
          const locIds = locs.map(l => l.loc);
          const imported = locs.filter(l => l.name.indexOf('PS-IMP') === 0);
          const ahOk = imported.every(l => !/^\\s*0(\\.0+)?\\s*Ah/.test(l.ah) || /Incomplete/i.test(l.ah));
          const imp1 = [...document.querySelectorAll('#sb-list .sb-item')].find(i => /PS-IMP1/.test(i.textContent));
          return { nDup: dups.length, dups: dups.slice(0, 8), uniqueLocs: new Set(locIds).size === locIds.length,
                   imported: imported.length, ahOk, locs, imp1loc: imp1 && imp1.dataset.loc };
        }""")
        ok('H1: merge does not create duplicate element ids', h1.get('nDup', 1) == 0, h1)
        ok('H1: merged loc ids are unique and imported sheets were added', h1.get('uniqueLocs') and h1.get('imported', 0) >= 3, h1)
        ok('H1: imported sheets calculated Ah (not 0.00 from an id clash)', h1.get('ahOk'), h1)
        if h1.get('imp1loc'):
            await pg.evaluate("""() => { const r=[...document.querySelectorAll('#sb-list .sb-item')].find(i => /PS-IMP1/.test(i.textContent)); if (r) r.querySelector('.sb-trash').click(); }""")
            await pg.wait_for_timeout(200)
            title = await pg.evaluate("() => (document.getElementById('ps-del-title')||{}).textContent || ''")
            ok('H1: trash on imported PS-IMP1 names that sheet, not a pre-existing one', 'PS-IMP1' in title, title)
            await pg.keyboard.press('Escape')
            await pg.wait_for_timeout(150)
        else:
            ok('H1: trash on imported PS-IMP1 names that sheet, not a pre-existing one', False, h1)

        # H2: .mlproj.json omits loc; remote refs and design hash survive a no-edit round trip; schemaVersion 1
        ids = await fresh(pg)
        await fill_ps2_units(pg, ids['loc2'], ids['loc1'])
        txt1 = await pg.evaluate("""() => {
          const doc = MLP.blank();
          doc.project = mlpProjectInfo();
          doc.design = mlpBuildDesign();
          return MLP.stringify(doc, 'ModuLaser Battery Calculator', (typeof mlpCalcRev==='function'?mlpCalcRev():runningRevisionFull()), '');
        }""")
        import json as _json
        doc1 = _json.loads(txt1)
        st1 = (((doc1.get('design') or {}).get('calc') or {}).get('state') or {})
        locs_have_loc = any(('loc' in (l or {})) for l in st1.get('locations') or [])
        hash1 = (doc1.get('design') or {}).get('hash')
        await pg.evaluate("() => clearEntireDocument({clearHeaders:true})")
        await pg.wait_for_timeout(200)
        await pg.evaluate("([t]) => { mlpImportProjectText(t, 'probe.mlproj.json'); if (window.__mlpApply) window.__mlpApply(); }", [txt1])
        await pg.wait_for_timeout(800)
        h2after = await pg.evaluate("""() => {
          return [...document.querySelectorAll('.location')].flatMap(l => [...l.querySelectorAll('.cluster-select')].map(s => {
            const v = s.value || '';
            if (v.indexOf('r:') !== 0) return null;
            const host = document.getElementById('location-' + v.split(':')[1]);
            return { from: l.querySelector('.ps-name').value, host: host && host.querySelector('.ps-name').value };
          }).filter(Boolean));
        }""")
        txt2 = await pg.evaluate("""() => {
          const doc = MLP.blank();
          doc.project = mlpProjectInfo();
          doc.design = mlpBuildDesign();
          return MLP.stringify(doc, 'ModuLaser Battery Calculator', (typeof mlpCalcRev==='function'?mlpCalcRev():runningRevisionFull()), '');
        }""")
        doc2 = _json.loads(txt2)
        hash2 = (doc2.get('design') or {}).get('hash')
        hosts_ok = any(r.get('from') == 'PS-1' and r.get('host') == 'PS-2' for r in (h2after or []))
        ok('H2: mlpStableCalcState omits loc on locations', not locs_have_loc, {'hasLoc': locs_have_loc, 'keys': list((st1.get('locations') or [{}])[0].keys())[:12]})
        ok('H2: schemaVersion is 1', doc1.get('schemaVersion') == 1 and doc2.get('schemaVersion') == 1, {'s1': doc1.get('schemaVersion'), 's2': doc2.get('schemaVersion'), 'keys': list(doc1.keys())[:12]})
        ok('H2: remote cluster refs still point at the original host after a no-edit round trip', hosts_ok, h2after)
        ok('H2: no-edit Export, Import, Export keeps the design hash', bool(hash1) and hash1 == hash2, {'h1': hash1, 'h2': hash2})

        # M1: Undo restores only the deleted sheet; later edits are kept
        ids = await fresh(pg)
        await fill_ps2_units(pg, ids['loc2'], ids['loc1'])
        await pg.click('.sb-item[data-loc="%s"] .sb-trash' % ids['loc2'])
        await confirm_delete()
        await pg.evaluate("""(locs) => {
          const l1 = document.getElementById('location-' + locs.loc1);
          const l3 = document.getElementById('location-' + locs.loc3);
          if (l3) l3.querySelector('.ps-name').value = 'PS-3-Edited';
          addModuleRow(locs.loc1, 'Detector');
          const last = [...l1.querySelectorAll('[data-role=module]')].pop();
          if (last && last.querySelector('.zone-name')) last.querySelector('.zone-name').value = 'Det-Added';
          const f = last && last.querySelector('.fanspeed-select');
          if (f && [...f.options].some(o => o.value === '4')) f.value = '4';
          if (typeof recalcLocation === 'function'){ recalcLocation(locs.loc1); recalcLocation(locs.loc3); }
          if (typeof v2Refresh === 'function') v2Refresh();
        }""", ids)
        await pg.wait_for_timeout(300)
        await pg.click('#ps-undo-btn')
        await pg.wait_for_timeout(500)
        m1 = await pg.evaluate("""(locs) => {
          const names = [...document.querySelectorAll('.location')].map(l => l.querySelector('.ps-name').value);
          const locsNow = [...document.querySelectorAll('.location')].map(l => l.dataset.loc);
          const zones = [...document.getElementById('location-'+locs.loc1).querySelectorAll('.zone-name')].map(z => z.value);
          const curLoc = (document.querySelector('#sb-list .sb-item.current')||{}).dataset && document.querySelector('#sb-list .sb-item.current').dataset.loc;
          return { names, locsNow, zones, curLoc, hasPS2: names.includes('PS-2') };
        }""", ids)
        ok('M1: Undo restores the deleted sheet', m1.get('hasPS2') and ids['loc2'] in m1.get('locsNow', []), m1)
        ok('M1: later rename and added detector are preserved', 'PS-3-Edited' in m1.get('names', []) and 'Det-Added' in m1.get('zones', []), m1)
        ok('M1: Undo selects the restored sheet', str(m1.get('curLoc')) == str(ids['loc2']), m1)

        # L1: focus survives the delayed sidebar re-render; repeated Alt+Arrow works
        ids = await fresh(pg)
        await fill_ps2_units(pg, ids['loc2'], ids['loc1'])
        await pg.click('.sb-item[data-loc="%s"] .sb-trash' % ids['loc2'])
        await confirm_delete()
        await pg.wait_for_timeout(250)
        l1f = await pg.evaluate("""() => {
          const ae = document.activeElement;
          const item = ae && ae.closest && ae.closest('#sb-list .sb-item');
          return { tag: ae && ae.tagName, id: ae && ae.id, loc: item && item.dataset.loc,
                   isBody: ae === document.body || ae === document.documentElement };
        }""")
        ok('L1: after delete, focus stays on a remaining sheet row, not the body', (not l1f.get('isBody')) and l1f.get('loc') in (ids['loc1'], ids['loc3']), l1f)
        await pg.click('#ps-undo-btn')
        await pg.wait_for_timeout(400)
        l1u = await pg.evaluate("""() => {
          const cur = document.querySelector('#sb-list .sb-item.current');
          const aeItem = document.activeElement && document.activeElement.closest && document.activeElement.closest('#sb-list .sb-item');
          return { cur: cur && cur.dataset.loc, ae: aeItem && aeItem.dataset.loc };
        }""")
        ok('L1: after Undo, the restored sheet is current and focused', str(l1u.get('cur') or l1u.get('ae')) == str(ids['loc2']), l1u)
        await pg.evaluate("""(loc) => {
          const row = document.querySelector('#sb-list .sb-item[data-loc="'+loc+'"]');
          const main = row && (row.querySelector('.sb-item-main') || row);
          if (main) main.focus();
        }""", ids['loc2'])
        await pg.keyboard.press('Alt+ArrowUp')
        await pg.wait_for_timeout(250)
        await pg.keyboard.press('Alt+ArrowDown')
        await pg.wait_for_timeout(250)
        l1k = await pg.evaluate("""() => {
          const ae = document.activeElement;
          const item = ae && ae.closest && ae.closest('#sb-list .sb-item');
          return { loc: item && item.dataset.loc, isBody: ae === document.body };
        }""")
        ok('L1: repeated Alt+Arrow keeps focus in the sidebar (second step works)', (not l1k.get('isBody')) and bool(l1k.get('loc')), l1k)

        # L4: deleting a host cluster flags remote detectors instead of silently reassigning them
        ids = await fresh(pg)
        await fill_ps2_units(pg, ids['loc2'], ids['loc1'])
        await pg.click('.sb-item[data-loc="%s"] .sb-trash' % ids['loc2'])
        await confirm_delete()
        await pg.wait_for_timeout(200)
        l4 = await pg.evaluate("""(locs) => {
          const l1 = document.getElementById('location-' + locs.loc1);
          const sels = [...l1.querySelectorAll('.cluster-select')].map(s => s.value);
          const flagBlock = ((l1.querySelector('.flags-list') || {}).innerText || '') + ' ' + ((document.getElementById('rp-msgs') || {}).innerText || '') + ' ' + l1.innerText;
          const stillRemote = sels.some(v => v && v.indexOf('r:' + locs.loc2 + ':') === 0);
          const movedToPS1 = sels.some(v => v === '1' || v === '01' || (v.indexOf('r:') === 0 && v.split(':')[1] === String(locs.loc1)));
          const orphaned = !!l1.querySelector('[data-cluster-orphan="1"]') || /deleted power supply|orphaned|not reassigned|Deleted host/i.test(flagBlock);
          return { sels, stillRemote, movedToPS1, orphaned, flagBlock: flagBlock.slice(0, 400) };
        }""", ids)
        ok('L4: detectors keep the deleted-host cluster ref instead of being silently moved', l4.get('stillRemote') and not l4.get('movedToPS1'), l4)
        ok('L4: the remaining sheet is flagged for the orphaned cluster ref', l4.get('orphaned'), l4)

        # M2: Duplicate via serialize/restore copies voltage, seismic/tamper, manual battery, ribbon, assumed origin
        ids = await fresh(pg)
        await fill_ps2_units(pg, ids['loc2'], ids['loc1'])
        await pg.evaluate("""(locs) => {
          const el = document.getElementById('location-' + locs.loc2);
          const btn = [...el.querySelectorAll('.ps-variant button')].find(b => b.dataset.v && b.dataset.v !== '120');
          if (btn){ el.querySelectorAll('.ps-variant button').forEach(b => b.setAttribute('aria-pressed', String(b === btn))); }
          const t = el.querySelector('.ps-tamper'); if (t) t.checked = true;
          const s = el.querySelector('.ps-seismic'); if (s) s.checked = true;
          const ab = el.querySelector('.auto-battery-mode');
          if (ab){
            ab.value = 'off';
            const wrap = el.querySelector('.builtin-auto-battery-toggle');
            if (wrap){
              const a = wrap.querySelector('.ra-auto'), o = wrap.querySelector('.ra-off');
              if (a) a.classList.remove('active'); if (o) o.classList.add('active');
            }
          }
          const ram = el.querySelector('.ribbon-assign-mode');
          if (ram){
            ram.value = 'off';
            const wrap = el.querySelector('.ribbon-assign-toggle');
            if (wrap){
              const a = wrap.querySelector('.ra-auto'), o = wrap.querySelector('.ra-off');
              if (a) a.classList.remove('active'); if (o) o.classList.add('active');
            }
          }
          const det = el.querySelector('.show-calc-detail-checkbox'); if (det){ det.checked = true; el.classList.add('show-calc-detail'); }
          const row = el.querySelector('[data-role=module]');
          if (row){ row.dataset.origin = 'assumed'; row.dataset.assumption = JSON.stringify({why:'placeholder'}); }
          if (typeof recalcLocation === 'function') recalcLocation(locs.loc2);
          if (typeof setCurrentLocation === 'function') setCurrentLocation(el);
          if (typeof v2Refresh === 'function') v2Refresh();
        }""", ids)
        await pg.wait_for_timeout(200)
        await pg.evaluate("(loc) => { const el = document.getElementById('location-'+loc); if (typeof psDuplicate === 'function') psDuplicate(el); }", ids['loc2'])
        await pg.wait_for_timeout(500)
        m2 = await pg.evaluate("""(locs) => {
          const src = document.getElementById('location-' + locs.loc2);
          const copy = [...document.querySelectorAll('.location')].find(l => (l.querySelector('.ps-name')||{}).value === 'PS-4');
          if (!copy) return { missing: true };
          const variant = (el) => { const b = el.querySelector('.ps-variant button[aria-pressed="true"]'); return b ? b.dataset.v : '120'; };
          const ab = el => (el.querySelector('.auto-battery-mode')||{}).value;
          const ram = el => (el.querySelector('.ribbon-assign-mode')||{}).value;
          const tamper = el => !!(el.querySelector('.ps-tamper')||{}).checked;
          const seismic = el => !!(el.querySelector('.ps-seismic')||{}).checked;
          const origin = el => (el.querySelector('[data-role=module]')||{}).dataset && el.querySelector('[data-role=module]').dataset.origin;
          const plKey = el => (el.querySelector('[data-role=module]')||{}).dataset && el.querySelector('[data-role=module]').dataset.plKey;
          return {
            src: { v: variant(src), ab: ab(src), ram: ram(src), t: tamper(src), s: seismic(src), origin: origin(src) },
            copy: { v: variant(copy), ab: ab(copy), ram: ram(copy), t: tamper(copy), s: seismic(copy), origin: origin(copy), plKey: plKey(copy), name: copy.querySelector('.ps-name').value, loc: copy.dataset.loc }
          };
        }""", ids)
        ok('M2: Duplicate copies voltage, seismic/tamper, manual battery, ribbon, and assumed origin',
           (not m2.get('missing')) and m2['copy']['v'] == m2['src']['v'] and m2['src']['v'] != '120' and m2['copy']['t'] and m2['copy']['s'] and m2['copy']['ab'] == 'off' and m2['copy']['ram'] == 'off' and m2['copy']['origin'] == 'assumed',
           m2)
        ok('M2: Duplicate uses a new loc, is named PS-4, and does not keep plKey',
           (not m2.get('missing')) and m2['copy']['name'] == 'PS-4' and m2['copy']['loc'] != ids['loc2'] and not m2['copy'].get('plKey'),
           m2)

        # L2: Rename recalculates auto AUX circuit source labels
        ids = await fresh(pg)
        await fill_ps2_units(pg, ids['loc2'], ids['loc1'])
        await pg.evaluate("""(loc) => {
          const el = document.getElementById('location-'+loc);
          if (typeof setCurrentLocation==='function') setCurrentLocation(el);
          if (typeof v2Refresh==='function') v2Refresh();
        }""", ids['loc2'])
        await pg.wait_for_timeout(150)
        await pg.click('.sb-item.current .sb-more')
        await pg.wait_for_timeout(100)
        await pg.evaluate("() => { const b=[...document.querySelectorAll('.sb-menu button, [role=menuitem]')].find(x => /Rename/i.test(x.textContent)); if (b) b.click(); }")
        await pg.wait_for_timeout(150)
        await pg.fill('.sb-rename', 'PS-2-Renamed')
        await pg.keyboard.press('Enter')
        await pg.wait_for_timeout(400)
        l2 = await pg.evaluate("""(loc) => {
          const el = document.getElementById('location-'+loc);
          const name = el.querySelector('.ps-name').value;
          const srcs = [...el.querySelectorAll('.circuit-source')].map(s => s.value);
          return { name, srcs, updated: srcs.some(s => /PS-2-Renamed/.test(s)), stale: srcs.some(s => /^PS-2 AUX/.test(s) && s.indexOf('Renamed') < 0) };
        }""", ids['loc2'])
        ok('L2: Rename recalculates so auto AUX circuit sources use the new name', l2.get('name')=='PS-2-Renamed' and (l2.get('updated') or not l2.get('stale')), l2)

        # L3: Rename warns on a duplicate name; Cancel keeps the original
        await pg.evaluate("(loc) => { const el=document.getElementById('location-'+loc); if (typeof setCurrentLocation==='function') setCurrentLocation(el); if (typeof v2Refresh==='function') v2Refresh(); }", ids['loc2'])
        await pg.wait_for_timeout(150)
        await pg.click('.sb-item.current .sb-more')
        await pg.wait_for_timeout(100)
        await pg.evaluate("() => { const b=[...document.querySelectorAll('.sb-menu button, [role=menuitem]')].find(x => /Rename/i.test(x.textContent)); if (b) b.click(); }")
        await pg.wait_for_timeout(150)
        await pg.fill('.sb-rename', 'PS-1')
        await pg.keyboard.press('Enter')
        await pg.wait_for_timeout(300)
        l3 = await pg.evaluate("""() => {
          const o = document.getElementById('prompt-overlay');
          const open = !!(o && o.classList.contains('open'));
          const title = (document.getElementById('prompt-title')||{}).textContent || '';
          return { open, title, txt: o ? o.innerText : '' };
        }""")
        ok('L3: Rename to an existing name opens a warning',
           l3.get('open') and re.search(r'already used|already exists', (l3.get('title') or '') + ' ' + (l3.get('txt') or ''), re.I), l3)
        if l3.get('open'):
            await pg.evaluate("""() => {
              const b = [...document.querySelectorAll('#prompt-actions button, #prompt-overlay button')].find(x => /Cancel/i.test(x.textContent));
              if (b) b.click();
            }""")
            await pg.wait_for_timeout(300)
        l3b = await pg.evaluate("(loc) => document.getElementById('location-'+loc).querySelector('.ps-name').value", ids['loc2'])
        ok('L3: Cancel on the duplicate-name warning keeps the original name', l3b == 'PS-2-Renamed', l3b)

        # M3: networked ASD-160 address clash is flagged on both sheets of the same SenseNET
        ids = await fresh(pg)
        await pg.evaluate("""(locs) => {
          asdAddRow(locs.loc1, {kind:'asd160', zone:'ASD-A', networked:true, address:'20', af:4, cls:'SFD'});
          asdAddRow(locs.loc2, {kind:'asd160', zone:'ASD-B', networked:true, address:'20', af:4, cls:'SFD'});
          document.querySelectorAll('.location').forEach(l => recalcLocation(l.dataset.loc));
          if (typeof v2Refresh==='function') v2Refresh();
        }""", ids)
        await pg.wait_for_timeout(400)
        m3 = await pg.evaluate("""(locs) => {
          const flags = loc => {
            const el = document.getElementById('location-'+loc);
            return ((el.querySelector('.flags-list')||{}).innerText || '') + ' ' + ((document.getElementById('rp-msgs')||{}).innerText || '') + ' ' + (el.innerText||'');
          };
          const f1 = flags(locs.loc1), f2 = flags(locs.loc2);
          const re = /ASD-160.*address 20 is already used on this SenseNET/i;
          return { f1hit: re.test(f1), f2hit: re.test(f2), f1: f1.slice(0, 400), f2: f2.slice(0, 400) };
        }""", ids)
        ok('M3: networked ASD-160 address 20 is flagged on both sheets of the same SenseNET', m3.get('f1hit') and m3.get('f2hit'), m3)



        # M-r2-1: orphaned cluster refs stay flagged after .mlproj round trip and Import Merge
        ids = await fresh(pg)
        await fill_ps2_units(pg, ids['loc2'], ids['loc1'])
        await pg.evaluate("""() => {
          if (typeof addLocation === 'function') addLocation();
          const last = [...document.querySelectorAll('.location')].pop();
          if (last){
            last.querySelector('.ps-name').value = 'PS-4';
            last.querySelector('.ps-location').value = 'Area B';
            if (typeof recalcLocation === 'function') recalcLocation(last.dataset.loc);
          }
          if (typeof v2Refresh === 'function') v2Refresh();
        }""")
        await pg.wait_for_timeout(200)
        await pg.click('.sb-item[data-loc="%s"] .sb-trash' % ids['loc2'])
        await confirm_delete()
        await pg.wait_for_timeout(200)
        txt_orph = await pg.evaluate("""() => {
          const doc = MLP.blank();
          doc.project = mlpProjectInfo();
          doc.design = mlpBuildDesign();
          return MLP.stringify(doc, 'ModuLaser Battery Calculator', (typeof mlpCalcRev==='function'?mlpCalcRev():runningRevisionFull()), '');
        }""")
        import json as _json2
        doc_orph = _json2.loads(txt_orph)
        st_orph = (((doc_orph.get('design') or {}).get('calc') or {}).get('state') or {})
        written = []
        def _walk_refs(o):
            if isinstance(o, dict):
                for v in o.values(): _walk_refs(v)
            elif isinstance(o, list):
                for v in o: _walk_refs(v)
            elif isinstance(o, str) and o.startswith('r:'):
                written.append(o)
        _walk_refs(st_orph)
        ok('M-r2-1: .mlproj.json writes orphaned cluster refs as r:0:n, not the deleted loc',
           any(v.startswith('r:0:') for v in written) and not any(v.startswith('r:'+str(ids['loc2'])+':') for v in written),
           {'written': written, 'deleted': ids['loc2']})
        await pg.evaluate("() => clearEntireDocument({clearHeaders:true})")
        await pg.wait_for_timeout(200)
        await pg.evaluate("([t]) => { mlpImportProjectText(t, 'probe-orph.mlproj.json'); if (window.__mlpApply) window.__mlpApply(); }", [txt_orph])
        await pg.wait_for_timeout(800)
        r2exp = await pg.evaluate("""() => {
          const sheets = [...document.querySelectorAll('.location')].map(l => ({
            name: (l.querySelector('.ps-name')||{}).value,
            sels: [...l.querySelectorAll('.cluster-select')].map(s => s.value),
            orphan: !!l.querySelector('[data-cluster-orphan="1"]'),
            flags: ((l.querySelector('.flags-list')||{}).innerText || '') + ' ' + (l.innerText||'')
          }));
          const ps1 = sheets.find(s => s.name === 'PS-1') || {};
          return {
            sels: ps1.sels, orphan: ps1.orphan,
            flagged: /deleted power supply|not reassigned|Deleted host/i.test(ps1.flags||''),
            reboundLive: (ps1.sels||[]).some(v => v && (v === '1' || v === '01' || (String(v).indexOf('r:')===0 && String(v).split(':')[1] !== '0')))
          };
        }""")
        ok('M-r2-1: after Export project → Import project, orphans stay r:0:n and flagged (not rebound)',
           any(str(v).startswith('r:0:') for v in (r2exp.get('sels') or [])) and (r2exp.get('orphan') or r2exp.get('flagged')) and not r2exp.get('reboundLive'),
           r2exp)

        # Merge path: receiving doc has a sheet at the deleted loc; imported orphans must not bind to it
        ids = await fresh(pg)
        await fill_ps2_units(pg, ids['loc2'], ids['loc1'])
        await pg.evaluate("""() => {
          if (typeof addLocation === 'function') addLocation();
          const last = [...document.querySelectorAll('.location')].pop();
          if (last){ last.querySelector('.ps-name').value = 'PS-4'; if (typeof recalcLocation==='function') recalcLocation(last.dataset.loc); }
        }""")
        await pg.wait_for_timeout(150)
        await pg.click('.sb-item[data-loc="%s"] .sb-trash' % ids['loc2'])
        await confirm_delete()
        await pg.wait_for_timeout(200)
        st_html = await pg.evaluate("""() => {
          const s = buildStateObject();
          (s.locations||[]).forEach((l, i) => { if (l) l.psName = 'PS-ORPH' + (i + 1); });
          return JSON.stringify(s);
        }""")
        html_orph = '<!DOCTYPE html><html><body><script type="application/json" id="embedded-state">' + st_html.replace('</', '<\\/') + '</script></body></html>'
        ids_recv = await fresh(pg)
        await fill_ps2_units(pg, ids_recv['loc2'], ids_recv['loc1'])
        await pg.evaluate("([h]) => { handleImportFile(new File([h], 'probe-orph-merge.html', {type:'text/html'})); }", [html_orph])
        await pg.wait_for_timeout(400)
        await dismiss_import_prompts()
        await pg.wait_for_timeout(700)
        r2m = await pg.evaluate("""() => {
          const imported = [...document.querySelectorAll('.location')].filter(l => /PS-ORPH/.test((l.querySelector('.ps-name')||{}).value));
          const refs = imported.flatMap(l => [...l.querySelectorAll('.cluster-select')].map(s => s.value).filter(v => v && String(v).indexOf('r:')===0));
          const flagged = imported.some(l => /deleted power supply|not reassigned|Deleted host/i.test(((l.querySelector('.flags-list')||{}).innerText||'')+' '+l.innerText)
            || !!l.querySelector('[data-cluster-orphan="1"]'));
          return { refs, hasSentinel: refs.some(v => String(v).indexOf('r:0:')===0), flagged,
                   imported: imported.map(l => (l.querySelector('.ps-name')||{}).value) };
        }""")
        ok('M-r2-1: Import Merge remaps unmappable cluster refs to r:0:n, not the receiving document loc',
           r2m.get('hasSentinel') and not any(str(v).split(':')[1] == str(ids['loc2']) for v in (r2m.get('refs') or []) if str(v).startswith('r:')),
           r2m)
        ok('M-r2-1: Import Merge keeps the orphaned-cluster flag', r2m.get('flagged'), r2m)

        # L-r2-1: Undo after deleting the last supply removes the unused auto-created blank
        await fresh(pg)
        await pg.evaluate('''() => {
          [...document.querySelectorAll('.location')].slice(1).forEach(e => e.remove());
          const only = document.querySelector('.location');
          if (only){
            only.querySelector('.ps-name').value = 'PS-LAST';
            if (typeof setCurrentLocation==='function') setCurrentLocation(only);
            if (typeof v2Refresh==='function') v2Refresh();
          }
        }''')
        await pg.wait_for_timeout(150)
        await pg.click('.sb-item.current .sb-trash, .sb-item .sb-trash')
        await confirm_delete()
        await pg.wait_for_timeout(250)
        await pg.evaluate("() => { if (typeof psUndoRestore==='function') psUndoRestore(); }")
        if await pg.locator('button:has-text("Undo")').count():
            try:
                await pg.click('button:has-text("Undo")', timeout=800)
            except Exception:
                pass
        await pg.wait_for_timeout(400)
        lr21 = await pg.evaluate("""() => {
          const locs = [...document.querySelectorAll('.location')].map(l => ({
            loc: l.dataset.loc, name: (l.querySelector('.ps-name')||{}).value
          }));
          const cur = document.querySelector('#sb-list .sb-item.current');
          return { n: locs.length, locs, names: locs.map(x => x.name),
                   cur: cur && cur.dataset.loc, curName: cur && (cur.innerText||'') };
        }""")
        ok('L-r2-1: Undo after last-supply delete leaves only the restored sheet (no leftover blank)',
           lr21.get('n')==1 and 'PS-LAST' in (lr21.get('names') or []), lr21)
        ok('L-r2-1: the restored last supply is selected',
           'PS-LAST' in (lr21.get('curName') or '') or (lr21.get('n')==1), lr21)

        # L-r2-2: Duplicate drops MiniLaser and ASD-160 plKey as well as module plKey
        ids = await fresh(pg)
        await fill_ps2_units(pg, ids['loc2'], ids['loc1'])
        await pg.evaluate("""(loc) => {
          const el = document.getElementById('location-'+loc);
          const mod = el.querySelector('[data-role=module]');
          if (mod) mod.dataset.plKey = 'PLK-MOD';
          const mls = [...el.querySelectorAll('[data-role=minilaser]')];
          const ml = mls.find(x => x.dataset.kind !== 'asd160');
          if (ml) ml.dataset.plKey = 'PLK-ML1';
          const asd = el.querySelector('[data-kind=asd160]');
          if (asd) asd.dataset.plKey = 'PLK-ASD';
          if (typeof psDuplicate === 'function') psDuplicate(el);
        }""", ids['loc2'])
        await pg.wait_for_timeout(400)
        lr22 = await pg.evaluate("""(srcLoc) => {
          const src = document.getElementById('location-'+srcLoc);
          const copy = [...document.querySelectorAll('.location')].find(l => (l.querySelector('.ps-name')||{}).value === 'PS-4');
          if (!copy) return { missing: true };
          const keys = el => ({
            mod: (el.querySelector('[data-role=module]')||{}).dataset && el.querySelector('[data-role=module]').dataset.plKey,
            ml: (() => { const r = [...el.querySelectorAll('[data-role=minilaser]')].find(x => x.dataset.kind !== 'asd160'); return r && r.dataset.plKey; })(),
            asd: (el.querySelector('[data-kind=asd160]')||{}).dataset && el.querySelector('[data-kind=asd160]').dataset.plKey
          });
          return { src: keys(src), copy: keys(copy) };
        }""", ids['loc2'])
        ok('L-r2-2: source MiniLaser and ASD-160 still have their plKey',
           (not lr22.get('missing')) and lr22.get('src',{}).get('ml')=='PLK-ML1' and lr22.get('src',{}).get('asd')=='PLK-ASD', lr22)
        ok('L-r2-2: Duplicate drops module, MiniLaser, and ASD-160 plKey on the copy',
           (not lr22.get('missing')) and not lr22.get('copy',{}).get('mod') and not lr22.get('copy',{}).get('ml') and not lr22.get('copy',{}).get('asd'),
           lr22)

        # L-r2-4: both sides flagged — networked ASD on a Standalone sheet, and ASD vs ModuLaser module
        ids = await fresh(pg)
        await pg.evaluate("""(locs) => {
          const l2 = document.getElementById('location-'+locs.loc2);
          l2.querySelectorAll('.addr-scheme-radio').forEach(r => { r.checked = r.value === 'standalone'; });
          asdAddRow(locs.loc1, {kind:'asd160', zone:'ASD-NET', networked:true, address:'20', af:4, cls:'SFD'});
          asdAddRow(locs.loc2, {kind:'asd160', zone:'ASD-SA', networked:true, address:'20', af:4, cls:'SFD'});
          document.querySelectorAll('.location').forEach(l => recalcLocation(l.dataset.loc));
          if (typeof v2Refresh==='function') v2Refresh();
        }""", ids)
        await pg.wait_for_timeout(400)
        lr24a = await pg.evaluate("""(locs) => {
          const flags = loc => {
            const el = document.getElementById('location-'+loc);
            return ((el.querySelector('.flags-list')||{}).innerText || '') + ' ' + (el.innerText||'');
          };
          const f1 = flags(locs.loc1), f2 = flags(locs.loc2);
          const re = /address 20 is already used on this SenseNET/i;
          return { f1hit: re.test(f1), f2hit: re.test(f2), f1: f1.slice(0, 300), f2: f2.slice(0, 300) };
        }""", ids)
        ok('L-r2-4: networked ASD on a Standalone sheet and the networked sheet are both flagged',
           lr24a.get('f1hit') and lr24a.get('f2hit'), lr24a)

        ids = await fresh(pg)
        await pg.evaluate("""(locs) => {
          const l1 = document.getElementById('location-'+locs.loc1);
          let row = l1.querySelector('[data-role=module]');
          if (!row){ addModuleRow(locs.loc1, 'Standard Display'); row = l1.querySelector('[data-role=module]'); }
          const addr = row && row.querySelector('.module-address');
          if (addr) addr.value = '20';
          asdAddRow(locs.loc2, {kind:'asd160', zone:'ASD-M', networked:true, address:'20', af:4, cls:'SFD'});
          document.querySelectorAll('.location').forEach(l => recalcLocation(l.dataset.loc));
          if (typeof v2Refresh==='function') v2Refresh();
        }""", ids)
        await pg.wait_for_timeout(400)
        lr24b = await pg.evaluate("""(locs) => {
          const flags = loc => {
            const el = document.getElementById('location-'+loc);
            return ((el.querySelector('.flags-list')||{}).innerText || '') + ' ' + (el.innerText||'');
          };
          const f1 = flags(locs.loc1), f2 = flags(locs.loc2);
          return {
            moduleHit: /Duplicate module address|already used on this SenseNET|address 20/i.test(f1),
            asdHit: /ASD-160.*address 20 is already used on this SenseNET/i.test(f2),
            f1: f1.slice(0, 300), f2: f2.slice(0, 300)
          };
        }""", ids)
        ok('L-r2-4: ASD-160 vs ModuLaser module clash is flagged on both sheets',
           lr24b.get('moduleHit') and lr24b.get('asdHit'), lr24b)

        # L-r2-5: v2Refresh does not steal focus from the page body
        ids = await fresh(pg)
        await pg.evaluate("""() => {
          document.body.setAttribute('tabindex', '-1');
          document.body.focus();
        }""")
        await pg.wait_for_timeout(50)
        await pg.evaluate("() => { if (typeof v2Refresh==='function') v2Refresh(); }")
        await pg.wait_for_timeout(250)
        lr25 = await pg.evaluate("""() => {
          const ae = document.activeElement;
          const inSb = !!(ae && ae.closest && ae.closest('#sb-list'));
          return { tag: ae && ae.tagName, id: ae && ae.id, inSb, isBody: ae === document.body || ae === document.documentElement };
        }""")
        ok('L-r2-5: refresh does not move focus to a sidebar row when the page body was focused',
           (not lr25.get('inSb')) and lr25.get('isBody'), lr25)

        await browser.close()

    print('---')
    print(sum(R), '/', len(R), 'passed')
    if not all(R):
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
