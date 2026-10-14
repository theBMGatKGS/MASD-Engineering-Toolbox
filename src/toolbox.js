/* =====================================================================
   MASD Engineering Toolbox — layer on top of the Battery Calculator UI
   (same engine: masd-engine.js; same project file: modulaser-project.js)
   Modes · Config (design) · Legacy imports · Field-change loop · Reports
   ===================================================================== */
const TB_CALC_LINEAGE = '02.00.002';          // Battery Calculator revision this Toolbox embeds (same engine)
const TB_ROLES = MLP.APPROVAL_ROLES;
const tbEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tbNum = v => { if (v == null || String(v).trim() === '') return null; const n = Number(String(v).trim()); return isFinite(n) ? n : NaN; };
const tbOk = n => n != null && !isNaN(n);
const TB_FIRE1_LIMIT_FM = MLP.HOLE_LIMITS;   // App. A, printed p.113 (FM/UL hole limits, strictly less than)
const TB_ADDR_RE = /^\d{1,3}:\d{1,3}:\d{1,4}$/;
let tbView = 'calc';
let tbSel = null;      // selected device id in Config view
let tbFilter = '';

(function(){ const _ex = mlpExportProject; mlpExportProject = function(){ const iss = MLP.perfIssues(tbPerf()); if (iss.length){ plShowAux('Export project — blocked', `<p>Define the <b>Performance Criteria</b> first (Config view):</p><ul>${iss.map(i => `<li>${tbEsc(i)}</li>`).join('')}</ul>`, `<button class="btn btn-primary" data-tb="goto-perf">Open Performance Criteria</button>`); return null; } return _ex.apply(this, arguments); }; })();
(function(){ const _st = MLP.stringify; MLP.stringify = function(d, a, r, u){ return _st(d, a === 'ModuLaser Battery Calculator' ? 'MASD Engineering Toolbox' : a, r, u); }; })();
/* imported calc files compare against the calculator lineage, not the Toolbox's own 01.00 numbering */
runningRevisionTuple = function(){ return parseRevisionTuple(TB_CALC_LINEAGE); };
mlpCalcRev = function(){ return 'Toolbox ' + runningRevisionFull(); };

/* ---------------- carried state ---------------- */
function tbCarry(){ if (!MLP_CARRY || typeof MLP_CARRY !== 'object') MLP_CARRY = {}; return MLP_CARRY; }
function tbCfgStore(){ const c = tbCarry(); c.config = c.config || {}; return c.config; }
function tbChanges(){ const c = tbCarry(); c.changes = c.changes || []; return c.changes; }
function tbApprovals(){ const c = tbCarry(); c.approvals = c.approvals || {}; return c.approvals; }
function tbMode(){ return (tbCarry().toolbox && tbCarry().toolbox.mode) || 'both'; }
function tbTouch(){ scheduleSave(); }

/* ---------------- devices (calculator sheets + config-only devices) ---------------- */
function tbCalcDevices(){
  const out = [];
  Array.from(document.querySelectorAll('.location')).forEach((locEl, i) => {
    const psuId = locEl.dataset.plSheetId || ('sheet-' + (i + 1));
    const area = (locEl.querySelector('.location-name') || {}).value || '';
    const psName = (locEl.querySelector('.ps-name') || {}).value || ('PS-' + (i + 1));
    Array.from(locEl.querySelectorAll('[data-role="module"]')).forEach((row, ri) => {
      const type = (row.querySelector('.type-select') || {}).value || 'Detector';
      const plKey = row.dataset.plKey || '';
      const id = plKey || (psuId + ':' + (row.id || ri));
      const link = plKey ? (PL_LINKS || []).find(l => l.id === plKey.slice(0, plKey.indexOf('|'))) : null;
      const ld = link && link.devices ? link.devices[plKey.slice(plKey.indexOf('|') + 1)] : null;
      out.push({ id, row, locEl, kind: /Display/.test(type) ? 'display' : 'detector', type, name: (row.querySelector('.zone-name') || {}).value || '',
        address: (row.querySelector('.module-address') || {}).value || '', fan: (row.querySelector('.fanspeed-select') || {}).value || '',
        area: area.trim(), psName, plName: ld ? ld.origName : '', pipe: ld && ld.pipe || null, src: 'calc' });
    });
  });
  return out;
}
function tbDevices(){
  const calc = tbCalcDevices(); const ids = new Set(calc.map(d => d.id));
  const extra = (tbCarry().cfgDevices || []).filter(d => !ids.has(d.id)).map(d => Object.assign({ src: 'pl' }, d));
  return calc.concat(extra);
}
function tbClassGuess(d){ const p = d.pipe; return (p && MLP.TT_TO_CLASS[p.maxTransit]) || ''; }
function tbEnsureCfg(d){
  const st = tbCfgStore();
  if (!st[d.id]) st[d.id] = MLP.configSeed(d.kind === 'display' ? '' : tbClassGuess(d), d.kind);
  return st[d.id];
}

/* ---------------- Performance Criteria ---------------- */
function tbPerf(){ const c = tbCarry(); if (!c.performance) c.performance = MLP.perfBlank(); return c.performance; }
function tbPerfClassesUsed(){ const set = new Set(); Object.values(tbCfgStore()).forEach(c => { if (c.perfClass) set.add(c.perfClass); }); tbDevices().forEach(d => { const g = tbClassGuess(d); if (g) set.add(g); }); return MLP.PERF_CLASSES.filter(c => set.has(c)); }
function tbPerfLimTable(o, scope){
  const ul = o.basis === 'UL' || (scope === '' && o.market === 'UL'); const L = ul ? MLP.perfUlLimits() : (o.limits || {});
  return `<table class="tb-io"><thead><tr><th>Class</th><th>Max hole sensitivity (%obs/ft, &lt;)</th><th>Max transport (s, &lt;)</th><th>Reference</th><th>Confirmed</th></tr></thead><tbody>${MLP.PERF_CLASSES.map(c => { const l = L[c] || {};
    const at = k => `data-tb-perf-lim="${c}" data-scope="${tbEsc(scope)}" data-k="${k}"`;
    return ul ? `<tr><td><b>${c === 'SFD' ? 'SFD / OAP' : c}</b></td><td>&lt;${l.sens}</td><td>&lt;${l.tt}</td><td><small>${tbEsc(l.ref)}</small></td><td>✓ UL</td></tr>`
      : `<tr${l.confirmed ? '' : ' class="err"'}><td><b>${c === 'SFD' ? 'SFD / OAP' : c}</b> ${l.src === 'prefill' ? '<span class="tb-src tb-src-manual" title="Prefilled from a cited source — confirm">cited prefill</span>' : ''}</td><td><input ${at('sens')} inputmode="decimal" value="${tbEsc(l.sens ?? '')}"></td><td><input ${at('tt')} inputmode="decimal" value="${tbEsc(l.tt ?? '')}"></td><td><input ${at('ref')} placeholder="Code/section or document" value="${tbEsc(l.ref || '')}"></td><td><input type="checkbox" ${at('confirmed')}${l.confirmed ? ' checked' : ''}></td></tr>`; }).join('')}</tbody></table>`;
}
function tbBasisSel(o, scope, withUl){ return `<label class="tb-f"><span class="lb">Basis</span><select data-tb-perf-k="basis" data-scope="${tbEsc(scope)}"><option value=""></option>${MLP.PERF_BASES.filter(b => withUl || b !== 'UL').map(b => `<option${o.basis === b ? ' selected' : ''}>${b}</option>`).join('')}</select></label>${o.basis === 'Other' || o.basis === 'Custom' ? `<label class="tb-f"><span class="lb">Describe basis</span><input data-tb-perf-k="basisOther" data-scope="${tbEsc(scope)}" value="${tbEsc(o.basisOther || '')}"></label>` : ''}`; }
function tbPerfHtml(){
  const P = tbPerf(), iss = MLP.perfIssues(P), ul = P.market === 'UL';
  if (!P.narrative && !P.narrativeEdited){ P.narrative = MLP.perfDraft(P, tbPerfClassesUsed()); P.narrativeDraft = P.narrative; }
  const areas = Array.from(new Set(tbDevices().map(d => d.area).filter(Boolean)));
  const ov = areas.map(a => { const o = (P.areas || {})[a] || {}; return `<div class="tb-area-ov"><label><input type="checkbox" data-tb-perf-area="${tbEsc(a)}"${o.enabled ? ' checked' : ''}> Override for Area/Group <b>${tbEsc(a)}</b></label>${o.enabled ? `<div class="tb-row">${tbBasisSel(o, a, true)}</div>${tbPerfLimTable(o, a)}` : ''}</div>`; }).join('');
  return `<section class="tb-perf" id="tb-perf"><div class="tb-sec">Performance Criteria ${iss.length ? `<span class="tb-msg err">— ${iss.length} item${iss.length === 1 ? '' : 's'} to define; Export project is blocked</span>` : '<span class="tb-ok">— defined</span>'}</div>
    <div class="tb-row"><label class="tb-f"><span class="lb">Standards basis (project)</span><select data-tb-perf-k="market" data-scope=""><option value="UL"${ul ? ' selected' : ''}>UL — US default</option><option value="other"${ul ? '' : ' selected'}>FM / NFPA 75 / 76 / 318 / other / custom</option></select></label>
    ${ul ? `<div class="tb-ulstate"><b>${MLP.UL_STATEMENT}</b><br><small>UL least-sensitive hole limits enforced (SFD/OAP 2.18 %obs/ft overrides the manual's FM 2.50).</small></div>` : tbBasisSel(P, '', false)}
    <label class="tb-f"><span class="lb">Engineer of Record</span><input data-tb-perf-k="eorName" data-scope="" value="${tbEsc(P.eorName || '')}"></label>
    <label class="tb-f"><span class="lb">Specification reference</span><input data-tb-perf-k="specRef" data-scope="" placeholder="e.g. Section 28 31 00, 2.4.B" value="${tbEsc(P.specRef || '')}"></label></div>
    ${!ul ? '<p class="tb-note">Only values with a source are prefilled (FM: App. A p.113; NFPA 76 VEWFD: per NFPA 76 as summarized in Honeywell ASAG44201 Table 1). Blank values were not found in a source — enter them with their reference. Each class must be confirmed.</p>' : ''}
    ${tbPerfLimTable(P, '')}
    ${areas.length ? `<details${Object.values(P.areas || {}).some(o => o.enabled) ? ' open' : ''}><summary>Per-Area/Group overrides (optional)</summary>${ov}</details>` : ''}
    <label class="tb-f" style="margin-top:8px"><span class="lb">Performance narrative (auto-drafted from the selections — edit to match the Engineer of Record's published intent; printed on the summary page)</span><textarea data-tb-perf-k="narrative" data-scope="" rows="4">${tbEsc(P.narrative || '')}</textarea></label>
    <div class="tb-row"><button class="btn" data-tb="perf-draft">Re-draft from selections</button>${P.narrativeEdited ? '<span class="tb-ok">edited by the engineer</span>' : '<span class="tb-warn">draft — edit or confirm</span>'}<label><input type="checkbox" data-tb-perf-k="narrativeConfirmed" data-scope=""${P.narrativeConfirmed ? ' checked' : ''}> Narrative confirmed by the engineer</label></div>
    ${iss.length ? `<ul class="tb-issues">${iss.map(i => `<li class="tb-err">${tbEsc(i)}</li>`).join('')}</ul>` : ''}</section>`;
}
function tbOnPerfInput(el){
  const P = tbPerf(); P.areas = P.areas || {};
  const scope = el.dataset.scope || ''; const O = scope ? (P.areas[scope] = P.areas[scope] || { enabled: true }) : P;
  if (el.dataset.tbPerfArea != null){ const a = el.dataset.tbPerfArea; P.areas[a] = Object.assign(P.areas[a] || { basis: '', limits: {} }, { enabled: el.checked }); }
  else if (el.dataset.tbPerfK){ const k = el.dataset.tbPerfK, v = el.type === 'checkbox' ? el.checked : el.value; O[k] = v;
    if (k === 'market'){ if (v === 'UL'){ P.basis = 'UL'; P.limits = MLP.perfUlLimits(); } else { P.basis = ''; P.limits = MLP.perfPrefill(''); } }
    if (k === 'basis'){ O.limits = O.basis === 'UL' ? MLP.perfUlLimits() : MLP.perfPrefill(v); }
    if (k === 'narrative'){ P.narrativeEdited = v !== P.narrativeDraft; P.narrativeConfirmed = false; }
    if (k !== 'narrative' && k !== 'narrativeConfirmed' && !P.narrativeEdited){ P.narrative = MLP.perfDraft(P, tbPerfClassesUsed()); P.narrativeDraft = P.narrative; } }
  else if (el.dataset.tbPerfLim){ O.limits = O.limits || {}; const l = O.limits[el.dataset.tbPerfLim] = O.limits[el.dataset.tbPerfLim] || MLP.perfLimitBlank(); const k = el.dataset.k;
    if (k === 'confirmed') l.confirmed = el.checked; else { l[k] = k === 'ref' ? el.value : (el.value === '' ? null : Number(el.value)); l.confirmed = false; if (k !== 'ref') l.src = 'engineer'; } }
  P.statement = MLP.perfStatement(P); P.definedBy = (document.getElementById('prepared-by-input') || {}).value || ''; P.definedAt = new Date().toISOString(); tbTouch();
}
/* ---------------- validation ---------------- */
function tbFacuAddrs(){
  const map = {};
  Object.entries(tbCfgStore()).forEach(([id, c]) => { const io = (c.values || {}).io || {}; MLP.IO_PORTS.forEach(p => { const a = io[p] && io[p].used && String(io[p].addr || '').trim(); if (a) (map[a] = map[a] || []).push(id + ':' + p); }); });
  return map;
}
function tbCfgIssues(d, c, fa){
  const out = []; const v = (c && c.values) || {}; const err = (k, t) => out.push({ k, lvl: 'err', t }); const warn = (k, t) => out.push({ k, lvl: 'warn', t });
  if (String(d.name || '').length > MLP.NAME_MAX) err('name', `Name is ${String(d.name).length} characters — the display shows ${MLP.NAME_MAX}`);
  if (!c) return out;
  if (d.kind === 'detector'){
    if (!c.perfClass) warn('perfClass', 'Performance class not set');
    const lv = ['alert', 'action', 'fire1', 'fire2'].map(k => tbNum(v[k]));
    lv.forEach((n, i) => { if (n != null && isNaN(n)) err(['alert', 'action', 'fire1', 'fire2'][i], 'Not a number'); });
    for (let i = 1; i < 4; i++) if (tbOk(lv[i]) && tbOk(lv[i - 1]) && lv[i] <= lv[i - 1]) err(['alert', 'action', 'fire1', 'fire2'][i], 'Alarm levels must rise: Alert < Prealarm < Fire 1 < Fire 2');
    const PL = MLP.perfLimits(tbPerf()) || {}; const lim = (PL[c.perfClass] && Number(PL[c.perfClass].sens)) || null; if (lim != null && tbOk(lv[2]) && lv[2] >= lim) warn('fire1', `Fire 1 ${lv[2]} is not below the ${c.perfClass} hole-sensitivity limit (<${lim.toFixed(2)} %obs/ft, Performance Criteria) — the limit applies to sampling holes; confirm the alarm setting`);
  }
  MLP.CONFIG_FIELDS.forEach(f => { if (f.kind !== 'num') return; const n = tbNum(v[f.k]); if (n == null) return; if (isNaN(n)) { err(f.k, 'Not a number'); return; }
    if ((f.min != null && n < f.min) || (f.max != null && n > f.max)) err(f.k, `${f.label} must be ${f.min}–${f.max}${f.unit ? ' ' + f.unit : ''}`); });
  const io = v.io || {}; fa = fa || tbFacuAddrs();
  MLP.IO_PORTS.forEach(p => { const x = io[p]; if (!x || !x.used) return; const a = String(x.addr || '').trim();
    if (a && !TB_ADDR_RE.test(a)) err('io.' + p, `${p.toUpperCase()} FACU address must be PPP:CCC:DDDD`);
    else if (a && (fa[a] || []).length > 1) err('io.' + p, `${p.toUpperCase()} FACU address ${a} is used more than once`); });
  const typ = Object.entries(c.src || {}).filter(([, s]) => s === 'typical').length;
  if (typ) warn('typical', `${typ} typical – unverified value${typ === 1 ? '' : 's'} — verify`);
  return out;
}
function tbCfgState(d){ const c = tbCfgStore()[d.id]; if (!c) return 'none'; const is = tbCfgIssues(d, c); return is.some(i => i.lvl === 'err') ? 'err' : is.some(i => i.lvl === 'warn') ? 'warn' : 'ok'; }

/* ---------------- mode switch + view ---------------- */
function tbSetMode(m){ const c = tbCarry(); c.toolbox = Object.assign({}, c.toolbox, { mode: m, rev: runningRevisionFull() }); tbApplyMode(); tbTouch(); }
function tbApplyMode(){
  const m = tbMode();
  if (m === 'config') tbView = 'config'; else if (m === 'calc') tbView = 'calc';
  document.body.dataset.tbMode = m; document.body.dataset.tbView = tbView;
  document.querySelectorAll('#tb-mode [data-mode]').forEach(b => { b.classList.toggle('on', b.dataset.mode === m); b.setAttribute('aria-pressed', String(b.dataset.mode === m)); });
  document.querySelectorAll('#tb-viewtabs [data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === tbView));
  if (tbView === 'config') tbRenderConfig();
  tbRenderChangesBadge();
}
function tbSetView(v){ tbView = v; tbApplyMode(); }

/* ---------------- Config view ---------------- */
const SRC_BADGE = { manual: ['manual', 'Value stated in the ModuLaser manual'], typical: ['typical – unverified', 'Typical starting point — verify before handoff'], design: ['design', 'Set by the designer'] };
function tbBadge(s){ const b = SRC_BADGE[s]; return b ? `<span class="tb-src tb-src-${s}" title="${b[1]}">${b[0]}</span>` : ''; }
function tbRenderConfig(){
  const host = document.getElementById('tb-config'); if (!host) return;
  const devs = tbDevices(); const fa = tbFacuAddrs();
  if (tbSel && !devs.some(d => d.id === tbSel)) tbSel = null;
  if (!tbSel && devs.length) tbSel = devs[0].id;
  const q = tbFilter.toLowerCase();
  const groups = {}; devs.filter(d => !q || (d.name + ' ' + d.area + ' ' + d.address).toLowerCase().includes(q)).forEach(d => { (groups[d.area || '—'] = groups[d.area || '—'] || []).push(d); });
  const cfgCount = devs.filter(d => tbCfgStore()[d.id]).length;
  const typ = devs.reduce((n, d) => { const c = tbCfgStore()[d.id]; return n + (c ? Object.values(c.src || {}).filter(s => s === 'typical').length : 0); }, 0);
  const list = Object.entries(groups).map(([a, ds]) => `<div class="tb-grp">${tbEsc(a)}<span>${ds.length}</span></div>` + ds.map(d => `<button class="tb-dev${d.id === tbSel ? ' on' : ''}" data-tb-dev="${tbEsc(d.id)}"><i class="dot tb-st-${tbCfgState(d)}"></i><span class="tx">${d.kind === 'display' ? '▣ ' : ''}${tbEsc(d.name || '(unnamed)')}</span><span class="ad">${tbEsc(d.address || '—')}</span></button>`).join('')).join('');
  const d = devs.find(x => x.id === tbSel);
  host.innerHTML = `<div class="tb-cfg-head"><div><h2>Device configuration</h2><div class="tb-sub">${devs.length} device${devs.length === 1 ? '' : 's'} · ${cfgCount} configured${typ ? ` · <b class="tb-warn">${typ} typical value${typ === 1 ? '' : 's'} to verify</b>` : ''}</div></div>
    <div class="tb-actions"><button class="btn" data-tb="cfg-import-pl" title="Read detectors and displays from PipeCAD .pl files without creating power supply sheets">Import .pl (config)…</button><button class="btn" data-tb="cfg-seed-all" title="Create a configuration for every device from its PipeCAD performance class">Seed all from class</button><button class="btn" data-tb="cfg-verify-all" title="Mark every typical value as checked by the designer">Mark all typical as verified</button></div></div>
    <p class="tb-note">Values seed from the performance class: <span class="tb-src tb-src-manual">manual</span> = stated in the ModuLaser Install Manual 04-4001-501-0803-05 (flow limits 20% and flow-fault delay 120 s: Table 29, p.76); <span class="tb-src tb-src-typical">typical – unverified</span> = typical starting point with no manual citation yet; you must check it; <span class="tb-src tb-src-design">design</span> = set by you. These values go to the Commissioning Report in the project file and replace its placeholder defaults.</p>
    ${tbPerfHtml()}
    ${devs.length ? `<div class="tb-cfg-grid"><div class="tb-cfg-list"><input type="search" id="tb-cfg-search" placeholder="Find name, area or address…" value="${tbEsc(tbFilter)}">${list}</div><div class="tb-cfg-editor" id="tb-cfg-editor">${d ? tbEditorHtml(d, fa) : ''}</div></div>`
      : `<div class="tb-empty">No devices yet. <b>File → Import .pl…</b> (calculator sheets) or <b>Import .pl (config)…</b> above.</div>`}`;
}
function tbEditorHtml(d, fa){
  const c = tbCfgStore()[d.id];
  const head = `<div class="tb-ed-head"><div><div class="tb-kick">${tbEsc(d.type)} · ${tbEsc(d.area || '—')}${d.psName ? ' · ' + tbEsc(d.psName) : ''}</div><h3>${tbEsc(d.name || '(unnamed)')}</h3><div class="tb-sub">SenseNET ${tbEsc(d.address || '—')}${d.fan ? ' · fan ' + tbEsc(d.fan) : ''}${d.pipe && d.pipe.tt ? ` · PipeCAD transport ${(+d.pipe.tt).toFixed(1)} s` : ''}${d.src === 'pl' ? ' · config only (no calculator sheet)' : ''}</div></div></div>`;
  if (!c) return head + `<div class="tb-empty">No configuration yet. <button class="btn btn-primary" data-tb="cfg-seed" data-id="${tbEsc(d.id)}">Seed from ${tbEsc(tbClassGuess(d) || 'class')}</button></div>`;
  const issues = tbCfgIssues(d, c, fa); const byK = {}; issues.forEach(i => { (byK[i.k] = byK[i.k] || []).push(i); });
  const v = c.values || {};
  const field = f => { const val = v[f.k] == null ? '' : v[f.k]; const is = byK[f.k] || [];
    const ctl = f.kind === 'yn' ? `<select data-tb-f="${f.k}"><option value=""></option>${['Y', 'N'].map(o => `<option${String(val) === o ? ' selected' : ''}>${o}</option>`).join('')}</select>`
      : f.kind === 'sel' ? `<select data-tb-f="${f.k}">${f.opts.map(o => `<option${String(val) === o ? ' selected' : ''}>${tbEsc(o)}</option>`).join('')}</select>`
      : `<input data-tb-f="${f.k}" value="${tbEsc(val)}" inputmode="decimal">`;
    return `<label class="tb-f${is.some(i => i.lvl === 'err') ? ' err' : ''}"><span class="lb" title="${tbEsc(MLP.CITES[f.k] || '')}">${tbEsc(f.label)}${f.unit ? ` <em>${tbEsc(f.unit)}</em>` : ''} ${tbBadge((c.src || {})[f.k])}</span>${ctl}${is.map(i => `<span class="tb-msg ${i.lvl}">${tbEsc(i.t)}</span>`).join('')}</label>`; };
  const fields = MLP.CONFIG_FIELDS.filter(f => d.kind === 'display' ? f.disp : f.det);
  const io = v.io || {};
  const ioRow = p => { const x = io[p] || {}; const isOut = p.startsWith('out'); const fixed = d.kind === 'display' && p === 'out1'; const is = byK['io.' + p] || [];
    return `<tr${is.length ? ' class="err"' : ''}><td><b>${p.toUpperCase()}</b></td><td><input type="checkbox" data-tb-io="${p}" data-io-k="used"${x.used || fixed ? ' checked' : ''}${fixed ? ' disabled' : ''}></td>
      <td><select data-tb-io="${p}" data-io-k="fn"${fixed ? ' disabled' : ''}>${MLP.IO_FUNCS[isOut ? 'out' : 'in'].map(o => `<option${(x.fn || (fixed ? 'General Fault' : '')) === o ? ' selected' : ''}>${tbEsc(o)}</option>`).join('')}</select></td>
      <td><input data-tb-io="${p}" data-io-k="addr" placeholder="PPP:CCC:DDDD" value="${tbEsc(x.addr || '')}">${is.map(i => `<span class="tb-msg err">${tbEsc(i.t)}</span>`).join('')}</td><td>${tbBadge((c.src || {})['io.' + p])}</td></tr>`; };
  const nameIss = byK.name ? `<div class="tb-msg err">${tbEsc(byK.name[0].t)}</div>` : '';
  const typ = Object.values(c.src || {}).filter(s => s === 'typical').length;
  return head + nameIss + `
    <div class="tb-row">${d.kind === 'detector' ? `<label class="tb-f"><span class="lb">Performance class ${byK.perfClass ? '<span class="tb-msg warn">not set</span>' : ''}</span><select data-tb-perf>${['', 'VEWFD', 'EWFD', 'SFD'].map(o => `<option${c.perfClass === o ? ' selected' : ''}>${o}</option>`).join('')}</select></label>
      <button class="btn" data-tb="cfg-reseed" data-id="${tbEsc(d.id)}" title="Replace manual/typical values with the class values (values you set stay)">Re-seed from class</button>` : ''}
      ${typ ? `<button class="btn" data-tb="cfg-verify" data-id="${tbEsc(d.id)}">Mark ${typ} typical as verified</button>` : ''}</div>
    <div class="tb-sec">${d.kind === 'detector' ? 'Alarm levels, delays, latching, flow faults, day/night, LDD' : 'Display settings'}</div>
    <div class="tb-fields">${fields.map(field).join('')}</div>
    <div class="tb-sec">I/O assignments</div>
    <table class="tb-io"><thead><tr><th>Port</th><th>Used</th><th>Function</th><th>FACU address</th><th></th></tr></thead><tbody>${MLP.IO_PORTS.map(ioRow).join('')}</tbody></table>`;
}
function tbOnCfgInput(el){
  const d = tbDevices().find(x => x.id === tbSel); if (!d) return; const c = tbEnsureCfg(d); c.values = c.values || {}; c.src = c.src || {};
  if (el.dataset.tbF){ const k = el.dataset.tbF; c.values[k] = el.value; c.src[k] = 'design'; }
  else if (el.hasAttribute('data-tb-perf')){ c.perfClass = el.value; }
  else if (el.dataset.tbIo){ const p = el.dataset.tbIo, k = el.dataset.ioK; c.values.io = c.values.io || {}; const x = c.values.io[p] = c.values.io[p] || {};
    x[k] = k === 'used' ? el.checked : el.value; if (k !== 'used' && el.value) x.used = true; c.src['io.' + p] = 'design'; }
  tbTouch();
}
function tbReseed(d, keepDesign){
  const st = tbCfgStore(); const old = st[d.id]; const seed = MLP.configSeed(d.kind === 'display' ? '' : ((old && old.perfClass) || tbClassGuess(d)), d.kind);
  if (old && keepDesign){ Object.entries(old.src || {}).forEach(([k, s]) => { if (s === 'design'){ if (k.startsWith('io.')){ seed.values.io = seed.values.io || {}; seed.values.io[k.slice(3)] = (old.values.io || {})[k.slice(3)]; } else seed.values[k] = old.values[k]; seed.src[k] = 'design'; } }); }
  st[d.id] = seed; tbTouch();
}
async function tbImportPlConfig(files){
  const st = tbCarry(); st.cfgDevices = st.cfgDevices || []; let n = 0; const errs = [];
  for (const f of files){
    try { const text = await f.text(); const pc = MLP.parsePl(text, f.name); const sha = await MLP.sha256(text); const link = MLP.linkFromParsed(pc, sha, f.size, f.lastModified);
      MLP_PIPE_CACHE[f.name] = pc;
      MLP.designFromPl([pc], [link]).devices.forEach(dv => { const i = st.cfgDevices.findIndex(x => x.id === dv.id); const rec = { id: dv.id, kind: dv.kind, type: dv.type, name: dv.name, area: dv.area, address: '', plName: dv.plName, pipe: dv.pipe, fan: dv.fan || '', pl: dv.pl };
        if (i >= 0) st.cfgDevices[i] = rec; else { st.cfgDevices.push(rec); n++; } });
      tbVerifyAgainstPl(f.name, pc);
    } catch (e){ errs.push(f.name + ': ' + e.message); }
  }
  tbTouch(); tbRenderConfig();
  tbToast(`${n} device${n === 1 ? '' : 's'} added for configuration${errs.length ? ' · ' + errs.join('; ') : ''}`);
}

/* ---------------- design export: configs, config-only devices, toolbox mode ---------------- */
(function hookDesign(){
  const _build = mlpBuildDesign;
  mlpBuildDesign = function(){
    const d = _build();
    const st = tbCfgStore(); const ids = new Set(d.devices.map(x => x.id));
    (tbCarry().cfgDevices || []).forEach(x => { if (!ids.has(x.id)) d.devices.push({ id: x.id, kind: x.kind, type: x.type, model: '', partNumber: '', name: x.name, plName: x.plName, area: x.area, address: x.address || '', psuId: '', fan: x.fan ? +x.fan : null, cluster: '', ma: null, pl: x.pl || null, pipe: x.pipe || null }); });
    d.devices.forEach(x => { if (st[x.id]) x.config = st[x.id]; else delete x.config; });
    d.performance = Object.assign({}, tbPerf(), { effectiveLimits: MLP.perfLimits(tbPerf()), statement: MLP.perfStatement(tbPerf()) });
    d.owner = 'masd-toolbox'; d.toolbox = { mode: tbMode(), rev: runningRevisionFull(), engine: MASD_ENGINE_VERSION, calcLineage: TB_CALC_LINEAGE };
    if (tbCarry().migration) d.migration = tbCarry().migration;
    return d;
  };
  const _apply = applyLoadedState;
  applyLoadedState = function(state){ const r = _apply(state); setTimeout(() => { tbApplyMode(); if (tbView === 'config') tbRenderConfig(); }, 0); return r; };
})();

/* =====================================================================
   Legacy imports → current state → .mlproj.json, with a migration report
   Formats: Save As .html (embedded-state, all revisions 01.04+), state JSON /
   localStorage dump, Excel export (01.04–01.06 per-sheet workbooks, 02.00.000 Detail sheet)
   ===================================================================== */
async function tbUnzip(buf){
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let e = u8.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error('Not a ZIP/XLSX file');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {}; const dec = new TextDecoder();
  for (let i = 0; i < n; i++){
    const meth = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true); const raw = u8.subarray(ds, ds + csz);
    let data = raw; if (meth === 8){ const s = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')); data = new Uint8Array(await new Response(s).arrayBuffer()); }
    out[name] = dec.decode(data);
  }
  return out;
}
async function tbReadXlsx(buf){
  const z = await tbUnzip(buf); const P = s => new DOMParser().parseFromString(s, 'application/xml');
  const ss = z['xl/sharedStrings.xml'] ? Array.from(P(z['xl/sharedStrings.xml']).getElementsByTagName('si')).map(si => Array.from(si.getElementsByTagName('t')).map(t => t.textContent).join('')) : [];
  const wb = P(z['xl/workbook.xml']); const rels = P(z['xl/_rels/workbook.xml.rels'] || '<r/>'); const relMap = {};
  Array.from(rels.getElementsByTagName('Relationship')).forEach(r => { relMap[r.getAttribute('Id')] = r.getAttribute('Target'); });
  return Array.from(wb.getElementsByTagName('sheet')).map((s, i) => {
    const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let t = relMap[rid] || `worksheets/sheet${i + 1}.xml`; t = t.replace(/^\/?xl\//, ''); const x = z['xl/' + t]; if (!x) return { name: s.getAttribute('name'), rows: [] };
    const rows = Array.from(P(x).getElementsByTagName('row')).map(r => { const cells = [];
      Array.from(r.getElementsByTagName('c')).forEach(c => { const ref = c.getAttribute('r') || ''; let ci = 0; (ref.match(/^[A-Z]+/) || [''])[0].split('').forEach(ch => { ci = ci * 26 + ch.charCodeAt(0) - 64; });
        const ty = c.getAttribute('t'); const v = c.getElementsByTagName('v')[0]; let val = '';
        if (ty === 's') val = ss[+(v && v.textContent)] || ''; else if (ty === 'inlineStr') val = Array.from(c.getElementsByTagName('t')).map(t => t.textContent).join(''); else val = v ? v.textContent : '';
        cells[(ci || cells.length + 1) - 1] = val; });
      return Array.from(cells, v => v == null ? '' : String(v)); });
    return { name: s.getAttribute('name'), rows };
  });
}
const TB_XL_KEYS = { 'Sheet Label': 'name', 'Power Supply Name': 'psName', 'Power Supply Location': 'psLocation', 'Design Basis': 'designBasis', 'Quiescent Load (mA)': 'customQuiescent', 'AUX Circuits': 'auxCircuits', 'Load per AUX Circuit (mA)': 'customAuxMa' };
function tbStateFromXlsx(sheets, fileName){
  const st = { version: 1, locations: [] }, notes = []; let loc = null, inMods = false, rev = '', reqAh = {};
  sheets.forEach(sh => { if (/^CAD Schedule$/i.test(sh.name)) return;
    sh.rows.forEach(r => { const k = (r[0] || '').trim(), v = (r[1] || '').trim();
      const rm = r.join(' ').match(/Rev (\d{2}\.\d{2}\.\d{3}(?:_\d{6})?)/); if (rm) rev = rm[1];
      if (k === 'Project') st.projectName = v; else if (k === 'Prepared By') st.preparedBy = v; else if (k === 'Date') st.projectDate = /^\d{4}-/.test(v) ? v : (v.match(/^(\d+)\/(\d+)\/(\d{4})$/) ? v.replace(/^(\d+)\/(\d+)\/(\d{4})$/, (m, a, b, c) => `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`) : v);
      else if (k === 'Network Number') st.networkNumber = v; else if (k === 'Building') st.building = v;
      else if (k === 'Sheet Label'){ loc = { name: v, modules: [] }; st.locations.push(loc); inMods = false; }
      else if (!loc) return;
      else if (TB_XL_KEYS[k]) loc[TB_XL_KEYS[k]] = v.replace(/\s*mA$/, '');
      else if (k === 'Standby (h)'){ loc.standbyHours = v; if ((r[2] || '').startsWith('Alarm')) loc.alarmMinutes = (r[3] || '').trim(); }
      else if (k === 'Ambient Temperature'){ const m = v.match(/(-?\d+)\s*°F/); if (m) loc.temperature = m[1]; }
      else if (k === 'Safety Margin'){ const m = v.match(/([\d.]+)\s*%/); if (m) loc.margin = String(+m[1] / 100); }
      else if (k === 'Power Supply Mode'){ loc.mode = /third|3rd|other/i.test(v) ? 'thirdparty' : 'builtin'; }
      else if (k === 'Required Capacity (Ah)'){ reqAh[st.locations.length - 1] = parseFloat(v); }
      else if (k === 'Address' && (r[1] || '') === 'Zone'){ inMods = true; }
      else if (inMods && /ModuLaser Module Load/.test(k)){ inMods = false; }
      else if (inMods){
        let c = r.slice(); if (c.length >= 8 && !/^\d*$/.test(c[0])) c.unshift('');      // rows without an address shift left
        if (c.length < 7) return; const [addr, zone, type, , cluster, power, fan] = c;
        const cm = String(cluster || '').match(/Cluster\s*0*(\d+)/i);
        loc.modules.push({ type: type || 'Detector', zone: zone === '(unnamed zone)' ? '' : zone, address: /^\d+$/.test(addr) ? addr : '', fan: /^\d+$/.test(fan) ? fan : '', cluster: cm ? cm[1] : '', power: /^Entry point/.test(power) ? 'own' : '', circuitSource: '', auxCircuitNum: '', rowId: '', _xlPower: power });
      }
    });
  });
  if (!st.locations.length) throw new Error(`${fileName}: no calculator sheets found in this workbook`);
  notes.push('Excel exports carry the displayed values, not the saved document: ribbon/power wiring, battery choice, charger and third-party supply fields are re-derived with defaults.');
  return { state: st, rev, notes, reqAh };
}
async function tbReadLegacy(file){
  const name = file.name;
  if (/\.xlsx$/i.test(name)){ const r = tbStateFromXlsx(await tbReadXlsx(await file.arrayBuffer()), name); return { kind: 'Excel export', state: r.state, rev: r.rev, notes: r.notes, reqAh: r.reqAh }; }
  const text = await file.text();
  if (/^\s*</.test(text)){ const p = parseImportedCalculatorHtml(text); if (!p.ok) throw new Error(p.error); return { kind: 'Saved calculator (.html)', state: p.state, rev: p.revision || '', notes: [], reqAh: null, html: text }; }
  let o; try { o = JSON.parse(text); } catch (e){ throw new Error(`${name}: not a calculator .html, .json or .xlsx file`); }
  if (MLP.isProject(o)) throw new Error(`${name} is already a .mlproj.json project — use File → Import project`);
  if (o && typeof o[SAVE_KEY_LEGACY] === 'string') o = JSON.parse(o[SAVE_KEY_LEGACY]);
  else if (o && !o.locations){ const k = Object.keys(o).find(k => /modulaser_calculator_state/.test(k)); if (k) o = typeof o[k] === 'string' ? JSON.parse(o[k]) : o[k]; }
  if (!o || !Array.isArray(o.locations)) throw new Error(`${name}: no calculator state (locations) found`);
  return { kind: 'Calculator state (JSON)', state: o, rev: o.calcRev || '', notes: [], reqAh: null };
}
const SAVE_KEY_LEGACY = 'modulaser_calculator_state_v1';
function tbMigrate(src){
  const st = JSON.parse(JSON.stringify(src.state)); const rep = { file: src.file, kind: src.kind, fromRev: src.rev || 'unknown', toRev: runningRevisionFull(), at: new Date().toISOString(), unmapped: [], defaulted: [], notes: (src.notes || []).slice(), checks: [] };
  const cur = buildStateObject(); const tmpl = serializeLocation(document.querySelector('.location')); const known = new Set(Object.keys(cur).concat(['plLinks', 'mlpSite', 'mlpProject', 'mlpCarry', 'calcRev']));
  Object.keys(st).forEach(k => { if (!known.has(k)) rep.unmapped.push({ where: 'project', key: k, value: JSON.stringify(st[k]).slice(0, 80) }); });
  const locKeys = Object.keys(tmpl), modKeys = ['type', 'zone', 'address', 'fan', 'cluster', 'power', 'circuitSource', 'auxCircuitNum', 'rowId', 'plKey'];
  st.locations.forEach((l, i) => { const tag = `Sheet ${i + 1} (${l.psName || l.name || '—'})`;
    Object.keys(l).forEach(k => { if (k !== 'modules' && !locKeys.includes(k)) rep.unmapped.push({ where: tag, key: k, value: JSON.stringify(l[k]).slice(0, 80) }); });
    locKeys.forEach(k => { if (k !== 'modules' && l[k] === undefined){ l[k] = tmpl[k]; rep.defaulted.push({ where: tag, key: k, value: String(tmpl[k]) }); } });
    (l.modules || []).forEach((m, mi) => { Object.keys(m).forEach(k => { if (k === '_xlPower'){ if (m[k] && !/^Entry point/.test(m[k])) rep.unmapped.push({ where: `${tag} row ${mi + 1}`, key: 'Power', value: m[k] }); delete m[k]; } else if (!modKeys.includes(k)) rep.unmapped.push({ where: `${tag} row ${mi + 1}`, key: k, value: String(m[k]) }); });
      if (!m.power){ m.power = mi ? 'auto' : 'own'; rep.defaulted.push({ where: `${tag} row ${mi + 1}`, key: 'power', value: m.power }); } }); });
  return { state: st, rep };
}
async function tbLegacyImport(files){
  const reps = [];
  for (const f of files){
    let src; try { src = await tbReadLegacy(f); } catch (e){ tbToast(e.message, 'err'); continue; }
    src.file = f.name; const { state, rep } = tbMigrate(src);
    const before = src.reqAh || {}; const keepCarry = tbCarry();
    applyLoadedState(state);
    if (state.plLinks && typeof PL_LINKS !== 'undefined'){ PL_LINKS = state.plLinks; }
    await new Promise(r => setTimeout(r, 50));
    v2AllModels('all').forEach((m, i) => { const was = before[i] != null ? before[i] : null; const now = isFinite(m.requiredAh) ? +m.requiredAh.toFixed(2) : null;
      rep.checks.push({ sheet: v2PsTag(m), area: m.area || '', wasAh: was, nowAh: now, status: v2StatusWord(m.status), same: was == null ? null : now != null && Math.abs(was - now) < 0.011 }); });
    Object.assign(MLP_CARRY = keepCarry, {}); tbCarry().migration = rep; reps.push(rep); scheduleSave();
  }
  if (reps.length){ tbApplyMode(); tbShowMigration(reps[reps.length - 1]); }
}
function tbShowMigration(rep){
  rep = rep || tbCarry().migration; if (!rep){ tbToast('No legacy import in this project yet'); return; }
  const t = (h, rows) => rows.length ? `<table class="tb-tbl"><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${tbEsc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p class="tb-ok">None.</p>';
  plShowAux('Legacy import — migration report', `<p><b>${tbEsc(rep.file)}</b> · ${tbEsc(rep.kind)} · from rev <b>${tbEsc(rep.fromRev)}</b> → ${tbEsc(rep.toRev)}</p>${rep.notes.map(n => `<p class="tb-note">${tbEsc(n)}</p>`).join('')}
    <h4>Did not map (${rep.unmapped.length})</h4>${t(['Where', 'Field', 'Value'], rep.unmapped.map(u => [u.where, u.key, u.value]))}
    <h4>Filled with current defaults (${rep.defaulted.length})</h4>${t(['Where', 'Field', 'Default'], rep.defaulted.map(u => [u.where, u.key, u.value]))}
    <h4>Re-calculated with engine ${MASD_ENGINE_VERSION}</h4>${t(['Sheet', 'Area', 'Old required Ah', 'Now', 'Status', 'Match'], rep.checks.map(c => [c.sheet, c.area, c.wasAh == null ? '— (not in file)' : c.wasAh, c.nowAh == null ? '—' : c.nowAh, c.status, c.same == null ? '—' : c.same ? 'yes' : 'NO']))}
    <p class="tb-note">The report is stored in the project (design.migration). Use <b>File → Export project</b> to write the .mlproj.json.</p>`,
    `<button class="btn" data-tb="rpt" data-rpt="migration">Print / export report…</button><button class="btn btn-primary" data-tb="export-project">Export .mlproj.json</button>`);
}

/* =====================================================================
   Field-change loop: Report logs → Toolbox verifies/applies → PipeCAD list →
   new .pl auto-verifies → QA approves.  Stored in doc.changes / doc.approvals.
   ===================================================================== */
const TB_STATUS_LBL = { logged: 'Logged on site', verified: 'Verified', rejected: 'Rejected', approved: 'QA approved' };
function tbDevById(id){ return tbDevices().find(d => d.id === id); }
function tbCfgKeyOf(field){ const k = String(field || '').replace(/^cfg[._]/, ''); return MLP.CONFIG_FIELDS.some(f => f.k === k) ? k : null; }
function tbApplyChange(c){
  const d = tbDevById(c.dev); const f = String(c.field || '');
  const setRow = (sel, v) => { if (!d || !d.row) return false; const el = d.row.querySelector(sel); if (!el) return false; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; };
  if (f === 'desc' || f === 'name') return d && d.row ? setRow('.zone-name', c.value) : tbSetExtra(c.dev, 'name', c.value);
  if (f === 'address' || f === 'cfg.addr') return d && d.row ? setRow('.module-address', c.value) : tbSetExtra(c.dev, 'address', c.value);
  if (f === 'cfg.fan' || f === 'fan') return d && d.row ? setRow('.fanspeed-select', c.value) : tbSetExtra(c.dev, 'fan', c.value);
  const ck = tbCfgKeyOf(f); if (ck && d){ const cf = tbEnsureCfg(d); cf.values[ck] = c.value; cf.src[ck] = 'design'; return true; }
  const io = f.match(/^io\.(in\d|out\d)(?:\.(fn|addr|used))?$/); if (io && d){ const cf = tbEnsureCfg(d); cf.values.io = cf.values.io || {}; const x = cf.values.io[io[1]] = cf.values.io[io[1]] || {}; x[io[2] || 'fn'] = c.value; x.used = true; cf.src['io.' + io[1]] = 'design'; return true; }
  return null;   // record-only field (measurement, transport time…) — nothing in the design to edit
}
function tbSetExtra(id, k, v){ const x = (tbCarry().cfgDevices || []).find(d => d.id === id); if (!x) return false; x[k] = v; return true; }
function tbRecheck(){
  const doc = { design: mlpBuildDesign() }; const iss = (MLP.validateDesign(doc.design) || []);
  const models = v2AllModels('all'); const fails = models.filter(m => m.status !== 'pass');
  return { issues: iss, models: models.map(m => ({ tag: v2PsTag(m), area: m.area || '', ah: isFinite(m.requiredAh) ? +m.requiredAh.toFixed(2) : null, battery: m.batteryLabel, status: v2StatusWord(m.status) })), fails: fails.length };
}
function tbPipecadList(){ return tbChanges().filter(c => c.pipecad && c.status !== 'rejected'); }
function tbRenderChangesBadge(){ const n = tbChanges().filter(c => c.status === 'logged').length; document.querySelectorAll('.tb-fc-badge').forEach(b => { b.textContent = n || ''; b.hidden = !n; }); }
function tbShowChanges(){
  const ch = tbChanges(), ap = tbApprovals(); const me = (document.getElementById('prepared-by-input') || {}).value || '';
  const appr = TB_ROLES.map(([r, lbl]) => { const a = ap[r] || {}; const ro = r === 'technician';
    return `<tr><td><b>${tbEsc(lbl)}</b></td><td>${ro ? tbEsc(a.name || '—') : `<input data-tb-ap="${r}" data-k="name" value="${tbEsc(a.name || (r === 'designer' ? me : ''))}">`}</td><td>${ro ? tbEsc(a.date || '—') : `<input type="date" data-tb-ap="${r}" data-k="date" value="${tbEsc(a.date || '')}">`}</td>
      <td>${ro ? tbEsc(a.status || '—') : `<select data-tb-ap="${r}" data-k="status">${['', 'pending', 'approved', 'rejected'].map(s => `<option${a.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select>`}</td></tr>`; }).join('');
  const rows = ch.map(c => `<tr class="tb-st-${c.status}"><td>${tbEsc(c.devName || c.dev)}</td><td>${tbEsc(c.label || c.field)}${c.pipecad ? ' <span class="tb-chip">PipeCAD</span>' : ''}</td><td>${tbEsc(c.design)}</td><td><b>${tbEsc(c.value)}</b></td>
    <td>${tbEsc(c.by || '—')}<br><small>${tbEsc(c.at ? new Date(c.at).toLocaleString() : '')}</small></td><td>${tbEsc(c.why || '')}${c.photo ? ' 📷' : ''}</td>
    <td><span class="tb-stat">${TB_STATUS_LBL[c.status] || c.status}</span>${c.plCheck ? `<br><small class="tb-pl-${c.plCheck.state}">.pl: ${tbEsc(c.plCheck.state)}${c.plCheck.found !== '' && c.plCheck.found != null ? ' (' + tbEsc(c.plCheck.found) + ')' : ''}</small>` : ''}</td>
    <td class="tb-act">${c.status === 'logged' ? `<button class="btn btn-primary" data-tb="fc-apply" data-id="${c.id}">Verify & apply</button><button class="btn" data-tb="fc-reject" data-id="${c.id}">Reject</button>` : c.status !== 'approved' ? `<button class="btn" data-tb="fc-reopen" data-id="${c.id}">Reopen</button>` : ''}</td></tr>`).join('');
  const rc = tbRecheck(); const pc = tbPipecadList();
  plShowAux('Field changes — verify, re-check, approve', `
    <p class="tb-note">Changes logged on site in the Commissioning Report (Section J). Verify applies each change to the design, re-runs the battery calculation and lists what must change in PipeCAD. Import the updated .pl to confirm PipeCAD changes automatically.</p>
    ${ch.length ? `<table class="tb-tbl tb-fc"><thead><tr><th>Device</th><th>Field</th><th>Design</th><th>Site value</th><th>By / when</th><th>Why</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="tb-empty">No field changes in this project. Import the project file returned from the Commissioning Report.</div>'}
    <h4>Re-check (engine ${MASD_ENGINE_VERSION})</h4><p>${rc.models.length} power suppl${rc.models.length === 1 ? 'y' : 'ies'} · ${rc.fails ? `<b class="tb-err">${rc.fails} not passing</b>` : '<b class="tb-ok">all pass</b>'} · ${rc.issues.length} design issue${rc.issues.length === 1 ? '' : 's'}</p>
    ${rc.issues.length ? `<ul class="tb-issues">${rc.issues.slice(0, 30).map(i => `<li>${tbEsc(i.msg || i.text || i)}</li>`).join('')}</ul>` : ''}
    <h4>PipeCAD change list (${pc.length})</h4>${pc.length ? `<ul>${pc.map(c => `<li>${tbEsc(c.devName)} — ${tbEsc(c.label || c.field)}: ${tbEsc(c.design)} → <b>${tbEsc(c.value)}</b> ${c.plCheck && c.plCheck.state === 'match' ? '<span class="tb-ok">✓ in .pl</span>' : '<span class="tb-warn">pending .pl</span>'}</li>`).join('')}</ul>` : '<p>None.</p>'}
    <h4>Approvals</h4><table class="tb-tbl"><thead><tr><th>Role</th><th>Name</th><th>Date</th><th>Status</th></tr></thead><tbody>${appr}</tbody></table>`,
    `<button class="btn" data-tb="fc-checkpl">Check against new .pl…</button><button class="btn" data-tb="rpt" data-rpt="changes">Field Change / As-Built report…</button><button class="btn" data-tb="rpt" data-rpt="pipecad">PipeCAD change list…</button><button class="btn btn-primary" data-tb="fc-qa">QA approve all verified</button>`);
}
function tbFcAction(act, id){
  const ch = tbChanges(); const c = ch.find(x => x.id === id); const me = (tbApprovals().designer || {}).name || (document.getElementById('prepared-by-input') || {}).value || 'Designer';
  const now = new Date().toISOString();
  if (act === 'fc-apply' && c){ const r = tbApplyChange(c); c.status = 'verified'; c.verify = { by: me, at: now, note: r === false ? 'Device not found in design' : r === null ? 'Recorded (no design field to edit)' : 'Applied to design' }; }
  if (act === 'fc-reject' && c){ const note = prompt('Reason for rejecting this change?', '') || ''; c.status = 'rejected'; c.verify = { by: me, at: now, note }; }
  if (act === 'fc-reopen' && c){ c.status = 'logged'; delete c.verify; }
  if (act === 'fc-qa'){ const qa = tbApprovals().qa || {}; if (!qa.name){ tbToast('Enter the QA / Auditor name first', 'err'); return; }
    const pend = ch.filter(x => x.pipecad && x.status === 'verified' && !(x.plCheck && x.plCheck.state === 'match'));
    if (pend.length && !confirm(`${pend.length} PipeCAD change(s) are not yet confirmed in a .pl. Approve anyway?`)) return;
    ch.forEach(x => { if (x.status === 'verified'){ x.status = 'approved'; x.qa = { by: qa.name, at: now }; } }); tbApprovals().qa = Object.assign({}, qa, { status: 'approved', date: qa.date || now.slice(0, 10) }); }
  if (/^fc-(apply|reject)$/.test(act)){ const d = tbApprovals(); d.designer = Object.assign({ name: me }, d.designer, { date: now.slice(0, 10), status: ch.every(x => x.status !== 'logged') ? 'approved' : 'pending' }); }
  tbTouch(); tbRenderChangesBadge(); tbShowChanges();
}
function tbVerifyAgainstPl(fileName, parsed){
  const ch = tbChanges(); if (!ch.some(c => c.pipecad)) return 0;
  const res = MLP.verifyChangesAgainstPl(ch, parsed, mlpBuildDesign().devices); let n = 0;
  res.forEach(r => { const c = ch.find(x => x.id === r.id); if (!c || r.state === 'not-found' && c.plCheck && c.plCheck.state === 'match') return; c.plCheck = { state: r.state, at: new Date().toISOString(), file: fileName, found: r.found }; if (r.state === 'match') n++; });
  if (res.length){ tbTouch(); tbRenderChangesBadge(); tbToast(`${fileName}: ${n} of ${res.length} PipeCAD change${res.length === 1 ? '' : 's'} confirmed`); }
  return n;
}
(function hookPl(){ const _p = plParse; plParse = function(text, fileName){ const r = _p.apply(this, arguments); setTimeout(() => { try { const pc = MLP.parsePl(text, fileName || '.pl'); MLP_PIPE_CACHE[pc.fileName || fileName] = MLP_PIPE_CACHE[pc.fileName || fileName] || pc; tbVerifyAgainstPl(fileName || '.pl', pc); } catch (e){} }, 0); return r; }; })();

/* =====================================================================
   Toolbox reports: Configuration schedule · Field Change / As-Built ·
   PipeCAD change list · Migration report.  Print/PDF, HTML, Word, Excel.
   ===================================================================== */
function tbHdr(){ const g = id => ((document.getElementById(id) || {}).value || '').trim(); return { project: g('project-name-input') || 'Untitled project', preparedBy: g('prepared-by-input'), date: g('project-date-input'), network: g('network-number-input'), building: g('building-input'), rev: runningRevisionFull() }; }
function tbReportModel(kind){
  const H = tbHdr(), secs = [];
  if (kind === 'config'){
    const devs = tbDevices();
    secs.push({ h: 'Detector alarm & fault settings', head: ['Device', 'Area', 'Address', 'Class', 'Alert', 'Action', 'Fire 1', 'Fire 2', 'Act dly', 'F1 dly', 'Flow lo/hi', 'Flow dly', 'Latch A/F', 'D/N', 'LDD', 'Source'],
      rows: devs.filter(d => d.kind === 'detector').map(d => { const c = tbCfgStore()[d.id]; const v = (c && c.values) || {}; const typ = c ? Object.values(c.src || {}).filter(s => s === 'typical').length : 0;
        return [d.name, d.area, d.address, c ? c.perfClass : 'not configured', v.alert, v.action, v.fire1, v.fire2, v.actionDly, v.fire1Dly, `${v.flowLow ?? ''}/${v.flowHigh ?? ''}`, v.flowDly, `${v.latchA || ''}/${v.latchF || ''}`, v.dayNight, v.ldd, c ? (typ ? `${typ} typical – unverified` : 'design/manual') : '—'].map(x => x == null ? '' : String(x)); }) });
    secs.push({ h: 'Displays', head: ['Device', 'Area', 'Address', 'Role', 'Buzzer', 'Latch A/F'], rows: devs.filter(d => d.kind === 'display').map(d => { const v = ((tbCfgStore()[d.id] || {}).values) || {}; return [d.name, d.area, d.address, v.cdmRole || '', v.buzzer || '', `${v.latchA || ''}/${v.latchF || ''}`]; }) });
    const io = []; devs.forEach(d => { const v = ((tbCfgStore()[d.id] || {}).values || {}).io || {}; MLP.IO_PORTS.forEach(p => { const x = v[p]; if (x && x.used) io.push([d.name, p.toUpperCase(), x.fn || '', x.addr || '']); }); });
    secs.push({ h: 'I/O assignments', head: ['Device', 'Port', 'Function', 'FACU address'], rows: io });
    secs.push({ note: 'Source key: manual = stated in the ModuLaser Install Manual 04-4001-501-0803-05 (flow limits 20% and flow-fault delay 120 s: Table 29, p.76). Fire 1 starts at the class hole-sensitivity limit (App. A, printed p.113) and is typical. typical – unverified = typical starting value with no manual citation yet; must be confirmed. design = set by the designer.' });
    const P = tbPerf(), PL = MLP.perfLimits(P) || {};
    secs.unshift({ h: 'Performance Criteria', head: ['Statement / basis', 'VEWFD', 'EWFD', 'SFD/OAP'], rows: [[MLP.perfStatement(P), ...MLP.PERF_CLASSES.map(c => PL[c] ? `<${PL[c].sens} %obs/ft · <${PL[c].tt} s` : 'not defined')]] }, { note: 'Performance narrative: ' + (P.narrative || '[NOT DEFINED — required]') });
    return { title: 'Device Configuration Schedule', H, secs };
  }
  if (kind === 'changes' || kind === 'pipecad'){
    const ch = kind === 'pipecad' ? tbPipecadList() : tbChanges();
    secs.push({ h: kind === 'pipecad' ? 'Changes to make in PipeCAD' : 'Field changes against design', head: ['#', 'Device', 'Field', 'Design', 'As-built', 'By', 'When (ET)', 'Why', 'Photo', 'Status', 'Verified by', '.pl check'],
      rows: ch.map((c, i) => [String(i + 1), c.devName || c.dev, c.label || c.field, c.design, c.value, c.by, c.at ? new Date(c.at).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '', c.why, c.photo ? 'yes' : '', TB_STATUS_LBL[c.status] || c.status, c.verify ? `${c.verify.by} ${String(c.verify.at || '').slice(0, 10)}${c.verify.note ? ' — ' + c.verify.note : ''}` : '', c.plCheck ? `${c.plCheck.state}${c.plCheck.found ? ' (' + c.plCheck.found + ')' : ''} ${c.plCheck.file || ''}` : (c.pipecad ? 'pending' : 'n/a')].map(x => x == null ? '' : String(x))) });
    if (kind === 'changes'){ const rc = tbRecheck(); secs.push({ h: 'Battery re-check after changes', head: ['PSU', 'Area', 'Required Ah', 'Battery', 'Status'], rows: rc.models.map(m => [m.tag, m.area, m.ah == null ? '—' : String(m.ah), m.battery, m.status]) });
      const ap = tbApprovals(); secs.push({ h: 'Approval chain', head: ['Role', 'Name', 'Date', 'Status'], rows: TB_ROLES.map(([r, l]) => [l, (ap[r] || {}).name || '', (ap[r] || {}).date || '', (ap[r] || {}).status || '']) }); }
    return { title: kind === 'pipecad' ? 'PipeCAD Change List' : 'Field Change / As-Built Report', H, secs };
  }
  const rep = tbCarry().migration || { unmapped: [], defaulted: [], checks: [], notes: [] };
  secs.push({ note: `Source: ${rep.file || '—'} (${rep.kind || '—'}), revision ${rep.fromRev || '—'} → ${rep.toRev || '—'}. ${(rep.notes || []).join(' ')}` });
  secs.push({ h: 'Did not map', head: ['Where', 'Field', 'Value'], rows: rep.unmapped.map(u => [u.where, u.key, u.value]) });
  secs.push({ h: 'Filled with defaults', head: ['Where', 'Field', 'Default'], rows: rep.defaulted.map(u => [u.where, u.key, u.value]) });
  secs.push({ h: 'Re-calculation check', head: ['Sheet', 'Area', 'Old Ah', 'Now Ah', 'Status', 'Match'], rows: rep.checks.map(c => [c.sheet, c.area, c.wasAh == null ? '—' : String(c.wasAh), c.nowAh == null ? '—' : String(c.nowAh), c.status, c.same == null ? '—' : c.same ? 'yes' : 'NO']) });
  return { title: 'Legacy Import — Migration Report', H, secs };
}
function tbReportHtml(m){
  const css = `@page{size:letter;margin:.5in}body{font:10pt "IBM Plex Sans",Arial,sans-serif;color:#1d1d1f;margin:0}.band{background:#102645;color:#fff;padding:10px 14px;border-bottom:3px solid #0C77BC}.band h1{margin:0;font-size:16pt}.band div{font-size:9pt;opacity:.85}h2{font-size:10pt;text-transform:uppercase;color:#102645;border-bottom:2px solid #0C77BC;margin:14px 0 6px}table{border-collapse:collapse;width:100%;font-size:8pt}th,td{border:1px solid #BFC4CA;padding:3px 5px;text-align:left;vertical-align:top}th{background:#F2F2F2;color:#555}tr{page-break-inside:avoid}.note{font-size:8.5pt;color:#555;margin:8px 0}.foot{margin-top:16px;font-size:8pt;color:#747574}`;
  const H = m.H; return `<!doctype html><html><head><meta charset="utf-8"><title>${tbEsc(m.title)} — ${tbEsc(H.project)}</title><style>${css}</style></head><body><div class="band"><h1>${tbEsc(m.title)}</h1><div>${tbEsc(H.project)}${H.network ? ' · ' + tbEsc(H.network) : ''}${H.building ? ' · ' + tbEsc(H.building) : ''} · Prepared by ${tbEsc(H.preparedBy || '—')} · ${tbEsc(H.date || '')} · MASD Engineering Toolbox ${tbEsc(H.rev)} · engine ${MASD_ENGINE_VERSION}</div></div>`
    + m.secs.map(s => s.note ? `<p class="note">${tbEsc(s.note)}</p>` : `<h2>${tbEsc(s.h)}</h2>` + (s.rows.length ? `<table><thead><tr>${s.head.map(h => `<th>${tbEsc(h)}</th>`).join('')}</tr></thead><tbody>${s.rows.map(r => `<tr>${r.map(c => `<td>${tbEsc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p class="note">None.</p>')).join('')
    + `<div class="foot">Generated ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</div></body></html>`;
}
function tbReportXlsx(m){
  const rows = [{ style: 3, cells: [m.title, '', '', '', 'Rev ' + m.H.rev] }, { cells: ['Project', m.H.project] }, { cells: ['Prepared By', m.H.preparedBy] }, { cells: ['Date', m.H.date] }, { cells: [] }];
  m.secs.forEach(s => { if (s.note){ rows.push({ cells: [s.note] }); return; } rows.push({ style: 3, cells: [s.h] }, { style: 2, cells: s.head }); s.rows.forEach(r => rows.push({ style: 1, cells: r })); rows.push({ cells: [] }); });
  const xml = v2SheetXml(rows, new Array(16).fill(16));
  const st = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/></cellXfs></styleSheet>`;
  const R = 'http://schemas.openxmlformats.org/'; return v2Zip([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${R}package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${R}package/2006/relationships"><Relationship Id="rId1" Type="${R}officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${R}spreadsheetml/2006/main" xmlns:r="${R}officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${R}package/2006/relationships"><Relationship Id="rId1" Type="${R}officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${R}officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: st }, { name: 'xl/worksheets/sheet1.xml', data: xml }]);
}
function tbReportDocx(m){
  const W = 14400; let body = v2DocxP(m.title, { b: true, color: 'FFFFFF', sz: 26, shade: '102645', after: 0 }) + v2DocxP(`${m.H.project} · Prepared by ${m.H.preparedBy || '—'} · ${m.H.date || ''} · Toolbox ${m.H.rev}`, { color: 'FFFFFF', sz: 16, shade: '102645', after: 80, border: true });
  m.secs.forEach(s => { if (s.note){ body += v2DocxP(s.note, { sz: 15, color: '555555' }); return; } body += v2DocxH(s.h); const w = Math.floor(W / s.head.length); body += s.rows.length ? v2DocxTable(s.head, s.rows, s.head.map(() => w)) : v2DocxP('None.', { color: '747574' }); });
  const R = 'http://schemas.openxmlformats.org/';
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${R}wordprocessingml/2006/main" xmlns:r="${R}officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`;
  return v2Zip([{ name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${R}package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${R}package/2006/relationships"><Relationship Id="rId1" Type="${R}officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/document.xml', data: doc }]);
}
const TB_RPT_NAMES = { config: 'Configuration schedule', changes: 'Field Change / As-Built', pipecad: 'PipeCAD change list', migration: 'Migration report' };
function tbShowReports(kind){
  kind = kind || 'config'; const m = tbReportModel(kind);
  plShowAux('Toolbox reports', `<div class="tb-rpt-pick">${Object.entries(TB_RPT_NAMES).map(([k, l]) => `<label><input type="radio" name="tb-rpt" value="${k}"${k === kind ? ' checked' : ''}> ${l}</label>`).join('')}</div><iframe id="tb-rpt-preview" class="tb-rpt-preview" title="Report preview"></iframe>`,
    `<button class="btn" data-tb="rpt-out" data-fmt="html">HTML</button><button class="btn" data-tb="rpt-out" data-fmt="docx">Word</button><button class="btn" data-tb="rpt-out" data-fmt="xlsx">Excel</button><button class="btn btn-primary" data-tb="rpt-out" data-fmt="pdf">Print / PDF</button>`);
  const f = document.getElementById('tb-rpt-preview'); if (f) f.srcdoc = tbReportHtml(m);
}
function tbRptKind(){ const r = document.querySelector('input[name="tb-rpt"]:checked'); return r ? r.value : 'config'; }
function tbReportOut(fmt){
  const kind = tbRptKind(), m = tbReportModel(kind), base = v2FileBase() + '_' + kind.replace('changes', 'field-changes');
  if (fmt === 'html') v2Download(new Blob([tbReportHtml(m)], { type: 'text/html' }), base + '.html');
  else if (fmt === 'xlsx') v2Download(tbReportXlsx(m), base + '.xlsx');
  else if (fmt === 'docx') v2Download(tbReportDocx(m), base + '.docx');
  else { const f = document.getElementById('tb-rpt-preview'); if (f && f.contentWindow) f.contentWindow.print(); }
}

/* ---------------- toast ---------------- */
function tbToast(msg, kind){ let t = document.getElementById('tb-toast'); if (!t){ t = document.createElement('div'); t.id = 'tb-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.className = 'show' + (kind ? ' ' + kind : ''); clearTimeout(t._h); t._h = setTimeout(() => { t.className = ''; }, 4200); }

/* =====================================================================
   UI wiring
   ===================================================================== */
function tbMenuItem(afterId, id, label, title){ const a = document.getElementById(afterId); if (!a) return null; const b = document.createElement('button'); b.setAttribute('role', 'menuitem'); b.id = id; b.textContent = label; if (title) b.title = title; a.after(b); return b; }
function tbFilePick(accept, multiple, cb){ const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = !!multiple; i.hidden = true; document.body.appendChild(i); i.onchange = () => { const f = Array.from(i.files || []); i.remove(); if (f.length) cb(f); }; i.click(); }
function tbInit(){
  const qr = document.querySelector('.quick-row');
  if (qr){
    const sw = document.createElement('div'); sw.id = 'tb-mode'; sw.className = 'tb-mode'; sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', 'Toolbox mode');
    sw.innerHTML = [['config', 'Config', 'Device configuration only'], ['calc', 'Calculator', 'Battery calculator only'], ['both', 'Both', 'Configuration and battery calculator']].map(([m, l, t]) => `<button data-mode="${m}" title="${t}">${l}</button>`).join('');
    qr.insertBefore(sw, qr.firstChild.nextSibling);
    const vt = document.createElement('div'); vt.id = 'tb-viewtabs'; vt.className = 'tb-viewtabs'; vt.innerHTML = `<button data-view="config">Config</button><button data-view="calc">Battery calc</button>`; sw.after(vt);
    const sep = qr.querySelector('.qr-sep');
    const ib = document.createElement('button'); ib.className = 'btn'; ib.id = 'tb-import-project-qr'; ib.textContent = 'Import project'; ib.title = 'Open a .mlproj.json (e.g. returned from the Commissioning Report)';
    const fb = document.createElement('button'); fb.className = 'btn'; fb.id = 'tb-fc-qr'; fb.innerHTML = 'Field changes <span class="tb-fc-badge" hidden></span>'; fb.title = 'Verify, re-check and approve field changes';
    if (sep){ sep.before(ib); sep.before(fb); }
  }
  const center = document.getElementById('v2-center'); if (center){ const c = document.createElement('section'); c.id = 'tb-config'; c.className = 'tb-config'; c.setAttribute('aria-label', 'Device configuration'); center.prepend(c); }
  tbMenuItem('export-project-btn', 'tb-legacy-btn', 'Import legacy calc / Excel…', 'Import any older Battery Calculator save (.html), state (.json) or Excel export (.xlsx) and migrate it');
  tbMenuItem('tb-legacy-btn', 'tb-migration-btn', 'Migration report…');
  tbMenuItem('confirm-defaults-btn', 'tb-fc-menu', 'Field changes…');
  tbMenuItem('tb-fc-menu', 'tb-pcl-menu', 'PipeCAD change list…');
  const v1 = tbMenuItem('cluster-report-btn', 'tb-view-config', 'Mode: Config only'); const v2 = tbMenuItem('tb-view-config', 'tb-view-calc', 'Mode: Calculator only'); tbMenuItem('tb-view-calc', 'tb-view-both', 'Mode: Both');
  tbMenuItem('tb-view-both', 'tb-reports-menu', 'Toolbox reports…');
  tbMenuItem('howdoi-toolbar-btn', 'tb-qs-menu', 'Quick Start (Toolbox)');
  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.addEventListener('click', fn); };
  on('tb-legacy-btn', () => tbFilePick('.html,.htm,.json,.xlsx', true, tbLegacyImport));
  on('tb-migration-btn', () => tbShowMigration());
  on('tb-fc-menu', tbShowChanges); on('tb-fc-qr', tbShowChanges); on('tb-pcl-menu', () => tbShowReports('pipecad'));
  on('tb-view-config', () => tbSetMode('config')); on('tb-view-calc', () => tbSetMode('calc')); on('tb-view-both', () => tbSetMode('both'));
  on('tb-reports-menu', () => tbShowReports('config'));
  on('tb-import-project-qr', () => { const b = document.getElementById('import-project-btn'); if (b) b.click(); });
  on('tb-qs-menu', () => { document.getElementById('help-overlay').classList.add('open'); buildHowDoIIndex(); const t = document.getElementById('help-tb-quickstart'); if (t) t.scrollIntoView({ block: 'start' }); });
  document.addEventListener('click', e => {
    const m = e.target.closest('#tb-mode [data-mode]'); if (m){ tbSetMode(m.dataset.mode); return; }
    const v = e.target.closest('#tb-viewtabs [data-view]'); if (v){ tbSetView(v.dataset.view); return; }
    const dv = e.target.closest('[data-tb-dev]'); if (dv){ tbSel = dv.dataset.tbDev; tbRenderConfig(); return; }
    const b = e.target.closest('[data-tb]'); if (!b) return; const a = b.dataset.tb, id = b.dataset.id;
    if (a === 'cfg-import-pl') tbFilePick('.pl', true, tbImportPlConfig);
    else if (a === 'cfg-seed' || a === 'cfg-reseed'){ const d = tbDevById(id); if (d){ tbReseed(d, a === 'cfg-reseed'); tbRenderConfig(); } }
    else if (a === 'cfg-seed-all'){ tbDevices().forEach(d => { if (!tbCfgStore()[d.id]) tbReseed(d, false); }); tbRenderConfig(); tbToast('Configurations seeded from performance class'); }
    else if (a === 'cfg-verify' || a === 'cfg-verify-all'){ Object.entries(tbCfgStore()).forEach(([k, c]) => { if (a === 'cfg-verify' && k !== id) return; Object.keys(c.src || {}).forEach(s => { if (c.src[s] === 'typical') c.src[s] = 'design'; }); }); tbTouch(); tbRenderConfig(); }
    else if (/^fc-/.test(a) && a !== 'fc-checkpl') tbFcAction(a, id);
    else if (a === 'fc-checkpl') tbFilePick('.pl', true, async fs => { for (const f of fs){ try { tbVerifyAgainstPl(f.name, MLP.parsePl(await f.text(), f.name)); } catch (er){ tbToast(f.name + ': ' + er.message, 'err'); } } tbShowChanges(); });
    else if (a === 'rpt') tbShowReports(b.dataset.rpt);
    else if (a === 'rpt-out') tbReportOut(b.dataset.fmt);
    else if (a === 'perf-draft'){ const P = tbPerf(); P.narrative = MLP.perfDraft(P, tbPerfClassesUsed()); P.narrativeDraft = P.narrative; P.narrativeEdited = false; P.narrativeConfirmed = false; tbTouch(); tbRenderConfig(); }
    else if (a === 'goto-perf'){ closePlWizard(); if (tbMode() === 'calc') tbSetMode('both'); tbSetView('config'); const el = document.getElementById('tb-perf'); if (el) el.scrollIntoView({ block: 'start' }); }
    else if (a === 'export-project'){ const x = document.getElementById('export-project-btn'); if (x) x.click(); }
  });
  document.addEventListener('change', e => {
    if (e.target.closest('#tb-perf')){ tbOnPerfInput(e.target); tbRenderConfig(); return; }
    if (e.target.closest('#tb-cfg-editor')){ tbOnCfgInput(e.target); tbRenderConfig(); return; }
    if (e.target.name === 'tb-rpt'){ const f = document.getElementById('tb-rpt-preview'); if (f) f.srcdoc = tbReportHtml(tbReportModel(e.target.value)); return; }
    const ap = e.target.dataset && e.target.dataset.tbAp; if (ap){ const A = tbApprovals(); A[ap] = Object.assign({}, A[ap], { [e.target.dataset.k]: e.target.value }); tbTouch(); }
  });
  document.addEventListener('input', e => { if (e.target.id === 'tb-cfg-search'){ tbFilter = e.target.value; const pos = e.target.selectionStart; tbRenderConfig(); const s = document.getElementById('tb-cfg-search'); if (s){ s.focus(); s.setSelectionRange(pos, pos); } } });
  if (typeof HOWDOI_COMMON !== 'undefined') HOWDOI_COMMON.push(...TB_HOWDOI);
  tbApplyMode();
}
const TB_HOWDOI = [
  { id: 'tb-modes', title: 'Switch between Config, Calculator and Both', keywords: 'mode config calculator both switch toggle view', blurb: 'Use the Config / Calculator / Both switch in the quick row (or View → Mode). The mode is stored per project. In Both, the Config and Battery calc tabs switch views.', target: 'tb-qs-modes', common: true },
  { id: 'tb-config', title: 'Set detector and display configuration', keywords: 'alert prealarm action fire1 fire2 delay latching flow fault day night ldd io output facu address display perf class vewfd ewfd sfd', blurb: 'Config view: pick a device, then Seed from class. Values badged manual come from the ModuLaser Install Manual (flow 20% and flow delay 120 s, Table 29 p.76); typical – unverified values must be checked; edits become design.', target: 'tb-qs-config', common: true },
  { id: 'tb-legacy', title: 'Import an old calculator file or Excel export', keywords: 'legacy old import migrate xlsx excel html json 01.04 01.05 01.06 02.00 mlproj', blurb: 'File → Import legacy calc / Excel… reads Save As .html, state .json and .xlsx exports from 01.04 onward, re-calculates, and shows what did not map. Export project writes the .mlproj.json.', target: 'tb-qs-legacy', common: true },
  { id: 'tb-loop', title: 'Verify field changes from the Commissioning Report', keywords: 'field change as-built verify approve qa auditor technician designer pipecad change list report', blurb: 'Import project from the Report, open Field changes, Verify & apply or Reject each, check the battery re-check, print the PipeCAD change list, import the new .pl to auto-confirm, then QA approves.', target: 'tb-qs-loop', common: true }
];
tbInit();

// Toolbox-saved files carry the Toolbox revision (00.01.000); compare them against the Toolbox, not the calculator lineage.
(function(){
  const orig = parseImportedCalculatorHtml;
  parseImportedCalculatorHtml = function(htmlText){
    const r = orig.apply(this, arguments);
    if (r && r.ok && /<title>[^<]*MASD Engineering Toolbox/i.test(htmlText) && r.revision && /^00\.01\.000/.test(r.revision)) r.revision = TB_CALC_LINEAGE + (r.revision.slice(9) || '');
    return r;
  };
})();
