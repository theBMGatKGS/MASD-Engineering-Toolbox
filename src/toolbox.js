/* =====================================================================
   MASD Engineering Toolbox — layer on top of the Battery Calculator UI
   (same engine: masd-engine.js; same project file: modulaser-project.js)
   Modes · Config (design) · Legacy imports · Field-change loop · Reports
   ===================================================================== */
const TB_LINEAGE_BY_REV = { '00.01.000': '02.00.002', '00.01.001': '02.00.003', '00.01.002': '02.00.004', '00.01.003': '02.00.005', '00.02.000': '02.01.000', '00.03.000': '02.02.000', '00.03.001': '02.02.001', '00.03.002': '02.02.002' };
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
  const css = `@page{size:letter;margin:.5in}body{font:10pt "IBM Plex Sans",Arial,sans-serif;color:#1d1d1f;margin:0}.band{background:#102645;color:#fff;padding:10px 14px;border-bottom:3px solid #0C77BC}.band h1{margin:0;font-size:16pt}.band div{font-size:9pt;opacity:.85}.band{display:flex;justify-content:space-between;align-items:center;gap:12px}.band .band-logo{height:28px;width:auto;background:#fff;padding:3px 6px;border-radius:3px;opacity:1}.band .band-bx{height:28px;width:auto;background:#fff;padding:3px 6px;border-radius:3px;opacity:1;margin-right:8px}h2{font-size:10pt;text-transform:uppercase;color:#102645;border-bottom:2px solid #0C77BC;margin:14px 0 6px}table{border-collapse:collapse;width:100%;font-size:8pt}th,td{border:1px solid #BFC4CA;padding:3px 5px;text-align:left;vertical-align:top}th{background:#F2F2F2;color:#555}tr{page-break-inside:avoid}.note{font-size:8.5pt;color:#555;margin:8px 0}.foot{margin-top:16px;font-size:8pt;color:#6b6c6b}`;
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

