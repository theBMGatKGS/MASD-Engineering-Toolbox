/* 02.02.000 — Toolbox Config: ASD-160 (Micra25 / Senator 25) branch. Remote configuration levels per the ModuLaser Alarm Factor
   worksheet (MLP.asd160ConfigSeed / MLP.asd160ConfigIssues; plan rev 4.23b §7c, C1 #46–#48). ModuLaser/MiniLaser branches are unchanged. */
(function tbAsd160(){
  if (typeof tbCalcDevices !== 'function' || !MLP.asd160ConfigIssues) return;
  const isAsd = row => row && row.dataset && row.dataset.kind === 'asd160';
  const _calc = tbCalcDevices;
  tbCalcDevices = function(){
    return _calc().map(d => { if (d.kind !== 'minilaser' || !isAsd(d.row)) return d;
      const r = asdRowData(d.row);
      return Object.assign({}, d, { kind: 'asd160', type: 'ASD-160 (Micra25 / Senator 25)', name: r.zone || '', networked: r.networked, address: r.networked ? r.address : '', af: r.af, afSrc: r.afSrc, cls: r.cls, fan: '', ioModules: 0, relayCard: r.relayCard, pipe: r.pipe }); });
  };
  const F = [['alert', 'Aux (Alert)', '%obs/ft'], ['action', 'Pre-Alarm', '%obs/ft'], ['fire1', 'Fire', '%obs/ft'], ['fire2', 'Fire 2', '%obs/ft'], ['actionDly', 'Pre-Alarm delay', 's'], ['fire1Dly', 'Fire delay', 's'], ['flowLow', 'Flow low', '%'], ['flowHigh', 'Flow high', '%'], ['flowDly', 'Flow fault delay', 's']];
  const _ensure = tbEnsureCfg;
  tbEnsureCfg = function(d){ if (d.kind !== 'asd160') return _ensure(d); const st = tbCfgStore();
    if (!st[d.id]){ const seed = MLP.asd160ConfigSeed(d.af); const values = {}, src = {}; F.forEach(([k]) => { if (seed[k] != null){ values[k] = String(seed[k]); src[k] = 'typical'; } });
      st[d.id] = { kind: 'asd160', perfClass: d.cls || '', values, src, seeded: seed.seeded }; }
    return st[d.id]; };
  const _issues = tbCfgIssues;
  tbCfgIssues = function(d, c, fa){
    if (d.kind !== 'asd160') return _issues(d, c, fa);
    const out = []; if (String(d.name || '').length > MLP.NAME_MAX) out.push({ k: 'name', lvl: 'err', t: `Name is ${String(d.name).length} characters — the display shows ${MLP.NAME_MAX}` });
    if (d.networked && !d.address) out.push({ k: 'address', lvl: 'warn', t: '⚠ Incomplete — networked ASD-160 has no SenseNET address (set it on the calculator sheet)' });
    if (!c) return out;
    const v = c.values || {}; const key = m => (F.find(([k, l]) => m.indexOf(l.replace(' (Alert)', '')) === 0) || F.find(([k]) => m.toLowerCase().indexOf(k) >= 0) || ['fire2'])[0];
    MLP.asd160ConfigIssues(v).forEach(i => out.push({ k: /Fire 2/.test(i.msg) ? 'fire2' : key(i.msg), lvl: i.level === 'error' ? 'err' : 'warn', t: (i.level === 'incomplete' ? '⚠ Incomplete — ' : '') + i.msg }));
    return out;
  };
  const _editor = tbEditorHtml;
  tbEditorHtml = function(d, fa){
    if (d.kind !== 'asd160') return _editor(d, fa);
    const c = tbEnsureCfg(d), v = c.values || {}, is = tbCfgIssues(d, c, fa), byK = {}; is.forEach(i => (byK[i.k] = byK[i.k] || []).push(i));
    const msg = k => (byK[k] || []).map(i => `<span class="tb-msg ${i.lvl}">${tbEsc(i.t)}</span>`).join('');
    const fld = ([k, l, u]) => `<label class="tb-f${(byK[k] || []).some(i => i.lvl === 'err') ? ' err' : ''}"><span class="lb">${tbEsc(l)} <em>${u}</em> ${tbBadge((c.src || {})[k])}</span><input data-tb-asd="${k}" value="${tbEsc(v[k] ?? '')}" inputmode="decimal">${msg(k)}</label>`;
    return `<div class="tb-ed-head"><div><div class="tb-kick">ASD-160 (Micra25 / Senator 25) · ${d.networked ? 'networked · SenseNET address ' + tbEsc(d.address || '—') : 'standalone · not addressed'} · ${tbEsc(d.area || '—')}${d.psName ? ' · ' + tbEsc(d.psName) : ''}</div><h3>${tbEsc(d.name || '(unnamed)')}</h3>
      <div class="tb-sub">Configuration: Remote (Remote.exe / SenseNET — no DIP sensitivity) · alarm factor ${d.af == null ? '—' : tbEsc(d.af)}${d.afSrc ? ' (' + tbEsc(d.afSrc) + ')' : ''} · class ${tbEsc(d.cls || '—')}${d.relayCard ? ' · relay card' : ''}</div></div></div>${msg('name')}${msg('address')}
      <div class="tb-sec">Remote configuration levels (Aux &lt; Pre-Alarm &lt; Fire &lt; Fire 2)</div>
      <div class="tb-fields">${F.map(fld).join('')}</div>
      <p class="tb-note">${tbEsc(c.seeded || '')}${c.seeded ? ' · ' : ''}Fire 2 must be within 0.00914–7.62 %obs/ft (Senator 25 Handbook Table 1 p3); delays 0–90 s. Alarm factor, class and address are set on the calculator sheet's ASD units table.</p>`;
  };
  const _input = tbOnCfgInput;
  tbOnCfgInput = function(el){
    const d = tbDevices().find(x => x.id === tbSel); if (!d || d.kind !== 'asd160' || !el.dataset.tbAsd) return _input(el);
    const c = tbEnsureCfg(d); c.values = c.values || {}; c.src = c.src || {}; c.values[el.dataset.tbAsd] = el.value; c.src[el.dataset.tbAsd] = 'design'; tbTouch();
  };
})();
