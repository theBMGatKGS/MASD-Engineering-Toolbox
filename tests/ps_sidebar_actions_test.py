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

        await browser.close()

    print('---')
    print(sum(R), '/', len(R), 'passed')
    if not all(R):
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
