/* =====================================================================
   MASD Engineering Toolbox — layer on top of the Battery Calculator UI
   (same engine: masd-engine.js; same project file: modulaser-project.js)
   Modes · Config (design) · Legacy imports · Field-change loop · Reports
   ===================================================================== */
const TB_LINEAGE_BY_REV = { '00.01.000': '02.00.002', '00.01.001': '02.00.003', '00.01.002': '02.00.004', '00.01.003': '02.00.005', '00.02.000': '02.01.000', '00.03.000': '02.02.000', '00.03.001': '02.02.001', '00.03.002': '02.02.002', '00.03.003': '02.02.003', '00.04.000': '02.03.000', '00.04.001': '02.03.001', '00.04.002': '02.03.002' };
let TB_LINEAGE_MISSING = false;   // QA D5: true when the lineage map has no entry for the running Toolbox revision (tests fail on it)
const TB_CALC_LINEAGE = (() => { const l = AMENDMENTS[AMENDMENTS.length - 1], k = `${l.major}.${l.minor}.${l.rev}`; if (TB_LINEAGE_BY_REV[k]) return TB_LINEAGE_BY_REV[k];
  TB_LINEAGE_MISSING = true; console.warn(`TB_LINEAGE_BY_REV has no entry for Toolbox ${k}; calculator lineage falls back to the last mapped revision — add the entry.`);
  const ks = Object.keys(TB_LINEAGE_BY_REV).sort(); return TB_LINEAGE_BY_REV[ks[ks.length - 1]]; })();   // QA F1: derived from the running Toolbox revision          // Battery Calculator revision this Toolbox embeds (same engine)
// Toolbox revision -> Battery Calculator revision it embedded (for comparing Toolbox-saved files)
const TB_ROLES = MLP.APPROVAL_ROLES;
const tbEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tbNum = v => { if (v == null || String(v).trim() === '') return null; const n = Number(String(v).trim()); return isFinite(n) ? n : NaN; };
const tbOk = n => n != null && !isNaN(n);
const TB_FIRE1_LIMIT_FM = MLP.HOLE_LIMITS;   // App. A, printed p.113 (FM/UL hole limits; pass at or below — Brent 2026-10-13)
const TB_ADDR_RE = /^\d{1,3}:\d{1,3}:\d{1,4}$/;
let tbView = 'calc';
let tbSel = null;      // selected device id in Config view
let tbFilter = '';

(function(){ const _ex = mlpExportProject; mlpExportProject = function(){ const iss = MLP.perfIssues(tbPerf(), { kinds: tbSfdKinds() }); if (iss.length){ plShowAux('Export project — blocked', `<p>Define the <b>Performance Criteria</b> first (Config view):</p><ul>${iss.map(i => `<li>${tbEsc(i)}</li>`).join('')}</ul>`, `<button class="btn btn-primary" data-tb="goto-perf">Open Performance Criteria</button>`); return null; } return _ex.apply(this, arguments); }; })();
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
  if (!st[d.id]) st[d.id] = MLP.configSeed(d.kind === 'display' ? '' : tbClassGuess(d), d.kind, tbPerf(), d.area);
  return st[d.id];
}

/* ---------------- Performance Criteria ---------------- */
function tbPerf(){ const c = tbCarry(); if (!c.performance) c.performance = MLP.perfBlank(); MLP.perfMigrate(c.performance); return c.performance; }
function tbPerfClassesUsed(){ const set = new Set(); Object.values(tbCfgStore()).forEach(c => { if (c.perfClass) set.add(c.perfClass); }); tbDevices().forEach(d => { const g = tbClassGuess(d); if (g) set.add(g); }); return MLP.PERF_CLASSES.filter(c => set.has(c)); }
const TB_TBD = '<span class="tb-tbd">engineer to define</span>';
function tbPerfLimTable(o, scope){
  const ul = MLP.perfIsUl(o.standard); const L = ul ? MLP.perfUlLimits(o.ulConfirmed) : (o.limits || {}); const pc = (MLP.perfPreset(o.standard) || {}).cls;
  return `<table class="tb-io"><thead><tr><th>Class</th><th>Target (%obs/ft)</th><th>Max hole sensitivity (%obs/ft, pass ≤)</th><th>Max transport (s, ≤)</th>${ul ? '<th>UL range (lower limit enforced)</th>' : ''}<th>Reference</th><th>Confirmed</th></tr></thead><tbody>${MLP.PERF_CLASSES.map(c => { const l = L[c] || {};
    const at = k => `data-tb-perf-lim="${c}" data-scope="${tbEsc(scope)}" data-k="${k}"`; const nm = `<b>${c === 'SFD' ? 'SFD / OAP' : c}</b>${pc === c ? ' <span class="tb-src tb-src-design">preset class</span>' : ''}`;
    const T = c === 'SFD' ? MLP.sfdTarget(tbPerf(), scope) : null;
    const tg = T ? `<td>Target ${MLP.fmtTarget(T.value)}${T.src !== 'default' ? ` <span class="tb-src tb-src-design" title="${tbEsc((T.ref || '') + (T.initials ? ' · ' + T.initials : ''))}">${T.src === 'area' ? 'Area/Group target' : 'project target'}</span>` : ''}</td>` : `<td>Target ${MLP.fmtTarget(l.target ?? MLP.SENS_TARGETS[c])}</td>`;
    return ul ? `<tr><td>${nm}</td>${tg}<td>≤${l.sens}</td><td>≤${l.tt}</td><td>${tbEsc(l.ulRange || '')}${l.provisional ? ' <span class="tb-src tb-src-manual" title="SFD range pending confirmation (Open Area vs Range 2)">provisional</span>' : ''}</td><td><small>${tbEsc(l.ref)}</small></td><td>${l.confirmed ? '✓ UL 268 confirmed' : 'confirm UL 268 above'}</td></tr>`
      : `<tr${l.confirmed ? '' : ' class="err"'}><td>${nm} ${l.src === 'prefill' ? '<span class="tb-src tb-src-manual" title="Prefilled from a cited source — confirm">cited prefill</span>' : (l.sens == null || l.tt == null ? TB_TBD : '')}</td>${tg}<td><input ${at('sens')} inputmode="decimal" placeholder="engineer to define" value="${tbEsc(l.sens ?? '')}"></td><td><input ${at('tt')} inputmode="decimal" placeholder="engineer to define" value="${tbEsc(l.tt ?? '')}"></td><td><input ${at('ref')} placeholder="Code/section or document" value="${tbEsc(l.ref || '')}"></td><td><input type="checkbox" ${at('confirmed')}${l.confirmed ? ' checked' : ''}></td></tr>`; }).join('')}</tbody></table>`;
}
function tbCodeReqTable(o, scope){
  const R = o.codeReqs || []; if (!R.length) return '';
  return `<table class="tb-io tb-codereq"><thead><tr><th>Code prescription</th><th>Requirement</th><th>Reference</th><th>Confirmed</th></tr></thead><tbody>${R.map((r, i) => { const at = k => `data-tb-perf-req="${i}" data-scope="${tbEsc(scope)}" data-k="${k}"`;
    return `<tr${r.confirmed ? '' : ' class="err"'}><td>${tbEsc(r.item)} ${r.src === 'cited' ? '<span class="tb-src tb-src-manual">cited prefill</span>' : (String(r.value || '').trim() ? '' : TB_TBD)}</td><td><input ${at('value')} placeholder="engineer to define" value="${tbEsc(r.value || '')}"></td><td><input ${at('ref')} placeholder="Code/section" value="${tbEsc(r.ref || '')}"></td><td><input type="checkbox" ${at('confirmed')}${r.confirmed ? ' checked' : ''}></td></tr>`; }).join('')}</tbody></table>`;
}
function tbStdSel(o, scope){
  const fam = { NFPA: 'NFPA (UL 268 thresholds + code)', FM: 'FM Global data sheets (FM only)', BS: 'British Standards', Custom: 'Custom' };
  const opts = Object.keys(fam).map(f => `<optgroup label="${fam[f]}">${MLP.PERF_PRESETS.filter(p => p.family === f).map(p => `<option value="${tbEsc(p.id)}"${o.standard === p.id ? ' selected' : ''}>${tbEsc(p.id)}</option>`).join('')}</optgroup>`).join('');
  return `<label class="tb-f"><span class="lb">Referenced standard</span><select data-tb-perf-k="standard" data-scope="${tbEsc(scope)}">${scope ? '<option value=""></option>' : ''}${opts}</select></label>${o.standard === 'Custom' ? `<label class="tb-f"><span class="lb">Custom standard name</span><input data-tb-perf-k="standardOther" data-scope="${tbEsc(scope)}" value="${tbEsc(o.standardOther || '')}"></label>` : ''}`;
}
function tbStdNote(o, scope){
  const p = MLP.perfPreset(o.standard); if (!p) return '';
  if (p.family === 'NFPA') return `<div class="tb-ulstate"><label><input type="checkbox" data-tb-perf-k="ulConfirmed" data-scope="${tbEsc(scope || '')}"${o.ulConfirmed ? ' checked' : ''}> <b>Engineer confirms: ${MLP.UL_STATEMENT}</b></label> ${o.ulConfirmed ? '<span class="tb-ok">confirmed — printed</span>' : '<span class="tb-msg err">not confirmed — the UL 268 statement will not print</span>'}<br><small>${tbEsc(p.code)} preset: UL 268, 7th Ed. thresholds apply (Install Manual App. A, printed p.113): hole sensitivity at or below (≤) VEWFD 1.0 (Special Application Range 1) / EWFD 1.5 (Special Application Range 2; 1.5 from NFPA 76) / SFD-OAP 2.18 %obs/ft (Open Area), transport time no more than 60 / 43 / 43 s — plus the code's prescriptions below. Targets: VEWFD 1.0 / EWFD 1.5 / SFD/OAP 2.0 %obs/ft (design target, adjustable below within the published limits; pass/fail unchanged). UL range lower limits are enforced: VEWFD 0.05 %obs/ft, 3 s; EWFD 0.05, 3 s; SFD 1.70, 6 s.</small></div>`;
  const ulOpt = (p.family === 'FM' || p.family === 'Custom') && tbDevices().some(d => d.kind === 'asd160') ? `<div class="tb-ulstate"><label><input type="checkbox" data-tb-perf-k="ulOptIn" data-scope="${tbEsc(scope || '')}"${o.ulOptIn ? ' checked' : ''}> Apply UL 268 7th edition to ASD-160 units (1.28 %obs/ft cap, UL limits)</label></div>` : '';   // 02.02.000 §7b (C1 #29)
  if (p.family === 'FM') return ulOpt + `<p class="tb-note">${tbEsc(p.code)}: FM requirements only — not UL, no UL 268 statement. Hole limits prefilled from FM Class 3230 per the Install Manual App. A p.113; confirm them and define the data-sheet prescriptions.</p>`;
  if (p.family === 'BS') return `<p class="tb-note">${tbEsc(p.code)} (mirrors the Battery Calculator design basis). No cited ASD hole/transport values are on file — every value is engineer to define, with its reference (e.g. BS 5839-1 / EN 54-20 class).</p>`;
  return ulOpt + '<p class="tb-note">Custom: name the standard; every value is engineer to define, with its reference.</p>';
}
/* 02.02.001 (Brent 2026-10-20): SFD/OAP design target — project-wide, per-Area/Group overrides, published-limit validation, reject with a message */
let tbSfdDraft = {}, tbSfdMsg = {};
function tbSfdKinds(){ return tbDevices().map(d => d.kind); }
function tbSfdRow(o, scope){
  const P = tbPerf(), fam = MLP.sfdFamily(o), T = MLP.sfdTarget(P, scope), env = MLP.sfdEnvelope(fam, tbSfdKinds()), sc = tbEsc(scope || '');
  if (!o.standard) return '';
  if (!env) return `<div class="tb-sfd" data-scope="${sc}"><span class="lb">SFD/OAP design target</span> <b>${MLP.fmtTarget(T.value)} %obs/ft</b> <small>fixed for this referenced standard (engineer-defined limits apply)</small></div>`;
  const D = tbSfdDraft[scope || ''] || {}, m = tbSfdMsg[scope || ''];
  const v = D.value != null ? D.value : T.value.toFixed(2), ref = D.ref != null ? D.ref : (T.src !== 'default' ? T.ref : ''), ini = D.initials != null ? D.initials : (T.src !== 'default' ? T.initials : '');
  const src = T.src === 'default' ? `default ${MLP.fmtTarget(T.def)} (${fam === 'UL' ? 'UL-driven' : 'FM'})` : T.src === 'project' && scope ? `inherited from the project · ${tbEsc(T.ref)} · ${tbEsc(T.initials)}` : `set · ${tbEsc(T.ref)} · ${tbEsc(T.initials)}`;
  return `<div class="tb-sfd" data-scope="${sc}"><div class="tb-sfd-h"><b>SFD/OAP design target ${scope ? `— Area/Group ${tbEsc(scope)}` : '(project-wide)'}</b> <span class="tb-src ${T.src === 'default' ? 'tb-src-manual' : 'tb-src-design'}">${src}</span></div>
    <div class="tb-row"><label class="tb-f"><span class="lb">Target (%obs/ft)</span><input data-tb-sfd="value" data-scope="${sc}" inputmode="decimal" value="${tbEsc(v)}" aria-label="SFD/OAP design target"></label>
    <label class="tb-f"><span class="lb">Reference (required if not ${MLP.fmtTarget(T.def)})</span><input data-tb-sfd="ref" data-scope="${sc}" placeholder="Spec section, EOR letter or listing" value="${tbEsc(ref)}"></label>
    <label class="tb-f tb-f-ini"><span class="lb">Engineer initials</span><input data-tb-sfd="initials" data-scope="${sc}" maxlength="6" placeholder="e.g. BW" value="${tbEsc(ini)}"></label>
    <button class="btn" data-tb="sfd-apply" data-scope="${sc}">Apply</button><button class="btn" data-tb="sfd-reset" data-scope="${sc}">Reset to ${MLP.fmtTarget(T.def)}</button></div>
    <small>Published ${fam} limits: ${tbEsc(env.text)}. Design target only — ${fam === 'UL' ? 'UL pass/fail stays at the Open Area range (1.70–2.18 %obs/ft, ≤43 s)' : 'FM pass/fail stays at FM Class 3230 (≤2.50 %obs/ft, ≤120 s)'}.${fam === 'UL' ? ' On this scope the SFD Fire 1 seed follows the target.' : ' SFD Fire 1 seed stays 2.5.'}</small>
    ${m ? `<div class="tb-msg ${m.ok ? 'tb-ok' : 'err'}" role="${m.ok ? 'status' : 'alert'}">${tbEsc(m.msg)}</div>` : ''}</div>`;
}
function tbSfdApply(scope, reset){
  const P = tbPerf(), k = scope || '', D = tbSfdDraft[k] || {}, T = MLP.sfdTarget(P, scope);
  const r = reset ? (MLP.sfdTargetReset(P, scope), { ok: true, msg: 'SFD/OAP target reset to the default.' })
    : MLP.sfdTargetSet(P, scope, D.value != null ? D.value : T.value, { ref: D.ref != null ? D.ref : T.ref, initials: D.initials != null ? D.initials : T.initials, kinds: tbSfdKinds() });
  tbSfdMsg[k] = r; if (r.ok){ delete tbSfdDraft[k]; if (!P.narrativeEdited){ P.narrative = MLP.perfDraft(P, tbPerfClassesUsed()); P.narrativeDraft = P.narrative; } tbTouch(); }
  tbRenderConfig();
}
function tbSfdNotice(P){ return P.sfdNotice ? `<div class="tb-sfd-notice" role="status">${tbEsc(MLP.SFD_NOTICE)} <button class="btn" data-tb="sfd-notice-ok">OK</button></div>` : ''; }
function tbPerfHtml(){
  const P = tbPerf(), iss = MLP.perfIssues(P, { kinds: tbSfdKinds() });
  if (!P.narrative && !P.narrativeEdited){ P.narrative = MLP.perfDraft(P, tbPerfClassesUsed()); P.narrativeDraft = P.narrative; }
  const areas = Array.from(new Set(tbDevices().map(d => d.area).filter(Boolean)));
  const ov = areas.map(a => { const o = (P.areas || {})[a] || {}; return `<div class="tb-area-ov"><label><input type="checkbox" data-tb-perf-area="${tbEsc(a)}"${o.enabled ? ' checked' : ''}> Override for Area/Group <b>${tbEsc(a)}</b></label>${o.enabled ? `<div class="tb-row">${tbStdSel(o, a)}</div>${tbStdNote(o, a)}${tbSfdRow(o, a)}${o.standard ? tbPerfLimTable(o, a) + tbCodeReqTable(o, a) : ''}` : ''}</div>`; }).join('');
  return `<section class="tb-perf" id="tb-perf"><div class="tb-sec">Performance Criteria ${iss.length ? `<span class="tb-msg err">— ${iss.length} item${iss.length === 1 ? '' : 's'} to define; Export project is blocked</span>` : '<span class="tb-ok">— defined</span>'}</div>
    <div class="tb-row">${tbStdSel(P, '')}
    <label class="tb-f"><span class="lb">Engineer of Record</span><input data-tb-perf-k="eorName" data-scope="" value="${tbEsc(P.eorName || '')}"></label>
    <label class="tb-f"><span class="lb">Specification reference</span><input data-tb-perf-k="specRef" data-scope="" placeholder="e.g. Section 28 31 00, 2.4.B" value="${tbEsc(P.specRef || '')}"></label></div>
    ${tbSfdNotice(P)}${tbStdNote(P, '')}
    ${tbSfdRow(P, '')}
    ${tbPerfLimTable(P, '')}${tbCodeReqTable(P, '')}
    ${areas.length ? `<details${Object.values(P.areas || {}).some(o => o.enabled) ? ' open' : ''}><summary>Per-Area/Group overrides (optional)</summary>${ov}</details>` : ''}
    <label class="tb-f" style="margin-top:8px"><span class="lb">Performance narrative (auto-drafted from the selections and naming the referenced standard — edit to match the Engineer of Record's published intent; printed on the summary page)</span><textarea data-tb-perf-k="narrative" data-scope="" rows="4">${tbEsc(P.narrative || '')}</textarea></label>
    <div class="tb-row"><button class="btn" data-tb="perf-draft">Re-draft from selections</button>${P.narrativeEdited ? '<span class="tb-ok">edited by the engineer</span>' : '<span class="tb-warn">draft — edit or confirm</span>'}<label><input type="checkbox" data-tb-perf-k="narrativeConfirmed" data-scope=""${P.narrativeConfirmed ? ' checked' : ''}> Narrative confirmed by the engineer</label></div>
    ${iss.length ? `<ul class="tb-issues">${iss.map(i => `<li class="tb-err">${tbEsc(i)}</li>`).join('')}</ul>` : ''}</section>`;
}
function tbOnPerfInput(el){
  const P = tbPerf(); P.areas = P.areas || {};
  if (el.dataset.tbSfd){ const k = el.dataset.scope || ''; (tbSfdDraft[k] = tbSfdDraft[k] || {})[el.dataset.tbSfd] = el.value; delete tbSfdMsg[k]; return; }
  const scope = el.dataset.scope || ''; const O = scope ? (P.areas[scope] = P.areas[scope] || { enabled: true }) : P;
  if (el.dataset.tbPerfArea != null){ const a = el.dataset.tbPerfArea; P.areas[a] = Object.assign(P.areas[a] || { standard: '', limits: {}, codeReqs: [] }, { enabled: el.checked }); }
  else if (el.dataset.tbPerfK){ const k = el.dataset.tbPerfK, v = el.type === 'checkbox' ? el.checked : el.value; O[k] = v;
    if (k === 'standard') MLP.perfScopeInit(O, v);
    if (k === 'narrative'){ P.narrativeEdited = v !== P.narrativeDraft; P.narrativeConfirmed = false; } }
  else if (el.dataset.tbPerfLim){ O.limits = O.limits || {}; const l = O.limits[el.dataset.tbPerfLim] = O.limits[el.dataset.tbPerfLim] || MLP.perfLimitBlank(); const k = el.dataset.k;
    if (k === 'confirmed') l.confirmed = el.checked; else { l[k] = k === 'ref' ? el.value : (el.value === '' ? null : Number(el.value)); l.confirmed = false; if (k !== 'ref') l.src = 'engineer'; } }
  else if (el.dataset.tbPerfReq != null){ const r = (O.codeReqs || [])[+el.dataset.tbPerfReq]; if (r){ const k = el.dataset.k; if (k === 'confirmed') r.confirmed = el.checked; else { r[k] = el.value; r.confirmed = false; if (k === 'value') r.src = 'engineer'; } } }
  const k = el.dataset.tbPerfK; if (k !== 'narrative' && k !== 'narrativeConfirmed' && !P.narrativeEdited){ P.narrative = MLP.perfDraft(P, tbPerfClassesUsed()); P.narrativeDraft = P.narrative; }
  P.market = MLP.perfIsUl(P.standard) ? 'UL' : 'other';
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
    const PL = MLP.perfLimits(tbPerf(), d.area) || {}; const lim = (PL[c.perfClass] && Number(PL[c.perfClass].sens)) || null; if (lim != null && tbOk(lv[2]) && lv[2] > lim + 1e-9) warn('fire1', `Fire 1 ${lv[2]} exceeds the ${c.perfClass} hole-sensitivity maximum (≤${lim.toFixed(2)} %obs/ft, Performance Criteria; target ${MLP.SENS_TARGETS[c.perfClass].toFixed(1)}) — the limit applies to sampling holes; confirm the alarm setting`);
    { const lm = PL[c.perfClass] && PL[c.perfClass].sensMin; if (lm != null && tbOk(lv[2]) && lv[2] < lm - 1e-9) warn('fire1', `Fire 1 ${lv[2]} — Outside UL 268 listed range: sensitivity below the lower limit ${lm} %obs/ft (${PL[c.perfClass].ulRange})`); }
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
  const st = tbCfgStore(); const old = st[d.id]; const seed = MLP.configSeed(d.kind === 'display' ? '' : ((old && old.perfClass) || tbClassGuess(d)), d.kind, tbPerf(), d.area);
  if (old && keepDesign){ Object.entries(old.src || {}).forEach(([k, s]) => { if (s === 'design'){ if (k.startsWith('io.')){ seed.values.io = seed.values.io || {}; seed.values.io[k.slice(3)] = (old.values.io || {})[k.slice(3)]; } else seed.values[k] = old.values[k]; seed.src[k] = 'design'; } }); }
  st[d.id] = seed; tbTouch();
}
async function tbImportPlConfig(files){
  const st = tbCarry(); st.cfgDevices = st.cfgDevices || []; let n = 0; const errs = [];
  for (const f of files){
    try { const text = await f.text(); const pc = MLP.parsePl(text, f.name); const sha = await MLP.sha256(text); const link = MLP.linkFromParsed(pc, sha, f.size, f.lastModified);
      MLP_PIPE_CACHE[f.name] = pc;
      MLP.designFromPl([pc], [link], tbPerf()).devices.forEach(dv => { const i = st.cfgDevices.findIndex(x => x.id === dv.id); const rec = { id: dv.id, kind: dv.kind, type: dv.type, name: dv.name, area: dv.area, address: '', plName: dv.plName, pipe: dv.pipe, fan: dv.fan || '', pl: dv.pl };
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
    return `<tr><td><b>${tbEsc(lbl)}</b></td><td>${ro ? tbEsc(a.name || '—') : `<input data-tb-ap="${r}" data-k="name" placeholder="Full name (required)" value="${tbEsc(a.name || (r === 'designer' ? me : ''))}">`}</td><td>${tbEsc(a.date || '—')}</td><td><span class="tb-stat">${tbEsc(a.status || '—')}</span></td></tr>`; }).join('')
    + ((ap.log || []).length ? `<tr><td colspan="4"><details><summary>Approval history (${ap.log.length})</summary><ol class="tb-aplog">${ap.log.map(l => `<li>${tbEsc(new Date(l.at).toLocaleString('en-US', { timeZone: 'America/New_York' }))} ET — ${tbEsc(l.role)} ${tbEsc(l.by)}: ${tbEsc(l.action)}${l.note ? ' — ' + tbEsc(l.note) : ''}</li>`).join('')}</ol></details></td></tr>` : '');
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
/* QA 2026-10-13 re-check: sign-off order technician → designer → QA; status is never set by hand;
   reopening keeps history; real names required; QA overrides are logged. */
function tbRealName(n){ n = String(n || '').trim(); return n.length >= 2 && /[A-Za-z]/.test(n) && !/^(designer|qa|qa\/auditor|auditor|technician|tech|test|n\/?a|none|name|\(name not set\))$/i.test(n); }
function tbApLog(role, by, action, note){ const A = tbApprovals(); A.log = A.log || []; A.log.push({ role, by, action, note: note || '', at: new Date().toISOString() }); }
function tbTechSigned(){ const t = tbApprovals().technician || {}; return tbRealName(t.name) && /^(submitted|signed|approved)$/.test(t.status || ''); }
function tbFcAction(act, id){
  const ch = tbChanges(); const c = ch.find(x => x.id === id); const A = tbApprovals();
  const me = String((A.designer || {}).name || '').trim();
  const now = new Date().toISOString();
  if (/^fc-(apply|reject|reopen)$/.test(act)){
    if (!tbTechSigned()){ tbToast('The technician must sign the field changes in the Commissioning Report first (order: technician → designer → QA).', 'err'); return; }
    if (!tbRealName(me)){ tbToast('Enter the designer\'s real name in Approvals first.', 'err'); return; }
    if ((A.qa || {}).status === 'approved' && act !== 'fc-reopen'){ tbToast('QA has approved; reopen a change to edit.', 'err'); return; }
  }
  if (act === 'fc-apply' && c){ const r = tbApplyChange(c); c.status = 'verified'; c.verify = { by: me, at: now, note: r === false ? 'Device not found in design' : r === null ? 'Recorded (no design field to edit)' : 'Applied to design' }; tbApLog('designer', me, 'verified ' + (c.devName || c.dev) + ' ' + (c.label || c.field)); }
  if (act === 'fc-reject' && c){ const note = (prompt('Reason for rejecting this change?', '') || '').trim(); if (!note){ tbToast('A reason is required to reject.', 'err'); return; } c.status = 'rejected'; c.verify = { by: me, at: now, note }; tbApLog('designer', me, 'rejected ' + (c.devName || c.dev) + ' ' + (c.label || c.field), note); }
  if (act === 'fc-reopen' && c){ const note = (prompt('Why reopen this change?', '') || '').trim(); if (!note){ tbToast('A reason is required to reopen.', 'err'); return; }
    c.history = c.history || []; c.history.push({ status: c.status, verify: c.verify || null, qa: c.qa || null, reopenedBy: me, at: now, note }); c.status = 'logged'; delete c.verify; delete c.qa;
    if (A.qa && A.qa.status === 'approved'){ A.qa = Object.assign({}, A.qa, { status: 'reopened' }); }
    tbApLog('designer', me, 'reopened ' + (c.devName || c.dev) + ' ' + (c.label || c.field), note); }
  if (act === 'fc-qa'){ const qa = A.qa || {};
    if (!tbRealName(qa.name)){ tbToast('Enter the QA / Auditor\'s real name first', 'err'); return; }
    if (!tbTechSigned()){ tbToast('Technician sign-off is missing (order: technician → designer → QA).', 'err'); return; }
    if (!A.designer || A.designer.status !== 'approved' || ch.some(x => x.status === 'logged')){ tbToast('The designer must verify or reject every change first (order: technician → designer → QA).', 'err'); return; }
    if (String(qa.name).trim().toLowerCase() === me.toLowerCase()){ tbToast('QA must be a different person from the designer.', 'err'); return; }
    const pend = ch.filter(x => x.pipecad && x.status === 'verified' && !(x.plCheck && x.plCheck.state === 'match'));
    let override = '';
    if (pend.length){ override = (prompt(`${pend.length} PipeCAD change(s) are not yet confirmed in a .pl. To approve anyway, enter the override reason (it is logged):`, '') || '').trim(); if (!override){ tbToast('QA approval cancelled — no override reason.', 'err'); return; } }
    ch.forEach(x => { if (x.status === 'verified'){ x.status = 'approved'; x.qa = Object.assign({ by: qa.name, at: now }, pend.includes(x) ? { override } : {}); } });
    A.qa = Object.assign({}, qa, { status: 'approved', date: now.slice(0, 10) });
    if (override){ A.qa.overrides = (A.qa.overrides || []).concat([{ at: now, by: qa.name, reason: override, changes: pend.map(x => x.id) }]); tbApLog('qa', qa.name, `override: approved ${pend.length} PipeCAD change(s) not confirmed in a .pl`, override); }
    tbApLog('qa', qa.name, 'approved all verified changes'); }
  if (/^fc-(apply|reject|reopen)$/.test(act)){ A.designer = Object.assign({}, A.designer, { name: me, date: now.slice(0, 10), status: ch.every(x => x.status !== 'logged') ? 'approved' : 'pending' }); }
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
    const lc = (L, c) => (L && L[c] && L[c].sens != null && L[c].tt != null ? `<${L[c].sens} %obs/ft · ≤${L[c].tt} s` : 'engineer to define') + (c === 'SFD' && L && L.SFD && L.SFD.target != null ? ` · target ${MLP.fmtTarget(L.SFD.target)}${L.SFD.targetSrc !== 'default' ? ` (${L.SFD.targetRef}; ${L.SFD.targetInitials})` : ' (default)'}` : '');
    const prow = [['Project', MLP.perfStatement(P), ...MLP.PERF_CLASSES.map(c => lc(PL, c))]].concat(Object.entries(P.areas || {}).filter(([, o]) => o && o.enabled).map(([a, o]) => ['Area/Group: ' + a, MLP.perfStatement(Object.assign({}, o, { areas: {} })), ...MLP.PERF_CLASSES.map(c => lc(MLP.perfLimits(P, a), c))]));
    const reqs = [['Project', P]].concat(Object.entries(P.areas || {}).filter(([, o]) => o && o.enabled)).flatMap(([a, o]) => (o.codeReqs || []).map(r => [a, r.item, r.value || 'engineer to define', r.ref || '—', r.confirmed ? 'confirmed' : 'NOT CONFIRMED']));
    secs.unshift({ h: 'Performance Criteria', head: ['Scope', 'Referenced standard / statement', 'VEWFD', 'EWFD', 'SFD/OAP'], rows: prow }, ...(reqs.length ? [{ h: 'Code prescriptions', head: ['Scope', 'Prescription', 'Requirement', 'Reference', 'Status'], rows: reqs }] : []), { note: `Engineer of Record: ${P.eorName || '—'} · Specification reference: ${P.specRef || '—'}` }, { note: 'Performance narrative: ' + (P.narrative || '[NOT DEFINED — required]') });
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
  const css = `@page{size:letter;margin:.5in}body{font:10pt "IBM Plex Sans",Arial,sans-serif;color:#1d1d1f;margin:0}.band{background:#102645;color:#fff;padding:10px 14px;border-bottom:3px solid #0C77BC}.band h1{margin:0;font-size:16pt}.band div{font-size:9pt;opacity:.85}.band{display:flex;justify-content:space-between;align-items:center;gap:12px}.band .band-logo{height:28px;width:auto;background:#fff;padding:3px 6px;border-radius:3px;opacity:1}.band .band-bx{height:28px;width:auto;background:transparent;padding:0;border-radius:0;opacity:1;margin-right:8px}h2{font-size:10pt;text-transform:uppercase;color:#102645;border-bottom:2px solid #0C77BC;margin:14px 0 6px}table{border-collapse:collapse;width:100%;font-size:8pt}th,td{border:1px solid #BFC4CA;padding:3px 5px;text-align:left;vertical-align:top}th{background:#F2F2F2;color:#555}tr{page-break-inside:avoid}.note{font-size:8.5pt;color:#555;margin:8px 0}.foot{margin-top:16px;font-size:8pt;color:#6b6c6b}`;
  const H = m.H; return `<!doctype html><html><head><meta charset="utf-8"><title>${tbEsc(m.title)} — ${tbEsc(H.project)}</title><style>${css}</style></head><body><div class="band"><section><h1>${tbEsc(m.title)}</h1><div>${typeof brInfo === 'function' ? tbEsc(brInfo().label) + ' · ' : ''}${tbEsc(H.project)}${H.network ? ' · ' + tbEsc(H.network) : ''}${H.building ? ' · ' + tbEsc(H.building) : ''} · Prepared by ${tbEsc(H.preparedBy || '—')} · ${tbEsc(H.date || '')} · MASD Engineering Toolbox ${tbEsc(H.rev)} · engine ${MASD_ENGINE_VERSION}</div></section><img class="band-bx" src="data:image/png;base64,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" alt="BRENTRONIX">${typeof brLogoHtml === 'function' ? brLogoHtml(true).replace('class="br-logo"', 'class="band-logo"') : ''}</div>`
    + m.secs.map(s => s.note ? `<p class="note">${tbEsc(s.note)}</p>` : `<h2>${tbEsc(s.h)}</h2>` + (s.rows.length ? `<table><thead><tr>${s.head.map(h => `<th>${tbEsc(h)}</th>`).join('')}</tr></thead><tbody>${s.rows.map(r => `<tr>${r.map(c => `<td>${tbEsc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p class="note">None.</p>')).join('')
    + `<div class="foot">Generated ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</div></body></html>`;
}
function tbReportXlsx(m){
  const rows = [{ style: 3, cells: [m.title, '', '', '', 'Rev ' + m.H.rev] }, { cells: ['Project', m.H.project] }, { cells: ['Brand', typeof brInfo === 'function' ? brInfo().label : 'Edwards'] }, { cells: ['Prepared By', m.H.preparedBy] }, { cells: ['Date', m.H.date] }, { cells: [] }];
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
  m.secs.forEach(s => { if (s.note){ body += v2DocxP(s.note, { sz: 15, color: '555555' }); return; } body += v2DocxH(s.h); const w = Math.floor(W / s.head.length); body += s.rows.length ? v2DocxTable(s.head, s.rows, s.head.map(() => w)) : v2DocxP('None.', { color: '6b6c6b' }); });
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
    else if (a === 'sfd-apply' || a === 'sfd-reset'){ tbSfdApply(b.dataset.scope || '', a === 'sfd-reset'); }
    else if (a === 'sfd-notice-ok'){ const P = tbPerf(); P.sfdNotice = false; tbTouch(); tbRenderConfig(); }
    else if (a === 'perf-draft'){ const P = tbPerf(); P.narrative = MLP.perfDraft(P, tbPerfClassesUsed()); P.narrativeDraft = P.narrative; P.narrativeEdited = false; P.narrativeConfirmed = false; tbTouch(); tbRenderConfig(); }
    else if (a === 'goto-perf'){ closePlWizard(); if (tbMode() === 'calc') tbSetMode('both'); tbSetView('config'); const el = document.getElementById('tb-perf'); if (el) el.scrollIntoView({ block: 'start' }); }
    else if (a === 'export-project'){ const x = document.getElementById('export-project-btn'); if (x) x.click(); }
  });
  document.addEventListener('change', e => {
    if (e.target.closest('#tb-perf')){ tbOnPerfInput(e.target); tbRenderConfig(); return; }
    if (e.target.closest('#tb-cfg-editor')){ tbOnCfgInput(e.target); tbRenderConfig(); return; }
    if (e.target.name === 'tb-rpt'){ const f = document.getElementById('tb-rpt-preview'); if (f) f.srcdoc = tbReportHtml(tbReportModel(e.target.value)); return; }
    const ap = e.target.dataset && e.target.dataset.tbAp; if (ap && e.target.dataset.k === 'name' && ap !== 'technician'){ const A = tbApprovals(); const old = (A[ap] || {}).name || ''; const v = e.target.value.trim(); if (v !== old){ A[ap] = Object.assign({}, A[ap], { name: v }); tbApLog(ap, v || '(blank)', 'name set', old ? 'was ' + old : ''); } tbTouch(); }
  });
  document.addEventListener('input', e => { if (e.target.id === 'tb-cfg-search'){ tbFilter = e.target.value; const pos = e.target.selectionStart; tbRenderConfig(); const s = document.getElementById('tb-cfg-search'); if (s){ s.focus(); s.setSelectionRange(pos, pos); } } });
  if (typeof HOWDOI_COMMON !== 'undefined') HOWDOI_COMMON.push(...TB_HOWDOI);
  tbApplyMode();
}
const TB_HOWDOI = [
  { id: 'tb-perf', title: 'Set the Performance Criteria (referenced standard)', keywords: 'performance criteria referenced standard nfpa 72 76 318 fm ds 5-32 5-48 bs 5839 custom ul 268 narrative engineer of record spec override area group engineer to define', blurb: 'Config → Performance Criteria: pick the Referenced standard (NFPA presets use UL 268 thresholds, FM presets are FM only, BS/Custom are engineer to define), fill and confirm any blank values and code prescriptions with references, add EOR and spec reference, then confirm the auto-drafted narrative.', target: 'tb-qs-perf', common: true },
  { id: 'tb-modes', title: 'Switch between Config, Calculator and Both', keywords: 'mode config calculator both switch toggle view', blurb: 'Use the Config / Calculator / Both switch in the quick row (or View → Mode). The mode is stored per project. In Both, the Config and Battery calc tabs switch views.', target: 'tb-qs-modes', common: true },
  { id: 'tb-config', title: 'Set detector and display configuration', keywords: 'alert prealarm action fire1 fire2 delay latching flow fault day night ldd io output facu address display perf class vewfd ewfd sfd', blurb: 'Config view: pick a device, then Seed from class. Values badged manual come from the ModuLaser Install Manual (flow 20% and flow delay 120 s, Table 29 p.76); typical – unverified values must be checked; edits become design.', target: 'tb-qs-config', common: true },
  { id: 'tb-legacy', title: 'Import an old calculator file or Excel export', keywords: 'legacy old import migrate xlsx excel html json 01.04 01.05 01.06 02.00 mlproj', blurb: 'File → Import legacy calc / Excel… reads Save As .html, state .json and .xlsx exports from 01.04 onward, re-calculates, and shows what did not map. Export project writes the .mlproj.json.', target: 'tb-qs-legacy', common: true },
  { id: 'tb-loop', title: 'Verify field changes from the Commissioning Report', keywords: 'field change as-built verify approve qa auditor technician designer pipecad change list report', blurb: 'Import project from the Report, open Field changes, Verify & apply or Reject each, check the battery re-check, print the PipeCAD change list, import the new .pl to auto-confirm, then QA approves.', target: 'tb-qs-loop', common: true }
];
tbInit();

// Toolbox-saved files carry the Toolbox revision (00.MM.rrr); compare them against the running Toolbox, then map to the calculator lineage.
(function(){
  const orig = parseImportedCalculatorHtml;
  parseImportedCalculatorHtml = function(htmlText){
    const r = orig.apply(this, arguments);
    if (r && r.ok && /<title>[^<]*MASD Engineering Toolbox/i.test(htmlText) && r.revision && /^00\.\d{2}\.\d{3}/.test(r.revision)){
      const tbRev = r.revision.slice(0, 9), fileT = parseRevisionTuple(tbRev), runT = parseRevisionTuple(runningRevisionFull());
      const older = fileT && runT && compareRevisionTuples(fileT, runT) < 0;
      r.toolboxRevision = r.revision;
      // same or newer Toolbox file: compare equal to the running lineage (no false "Older revision"); older: its own embedded lineage
      r.revision = (older ? (TB_LINEAGE_BY_REV[tbRev] || '02.00.002') : TB_CALC_LINEAGE) + (r.revision.slice(9) || '');
    }
    return r;
  };
})();

