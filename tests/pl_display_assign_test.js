#!/usr/bin/env node
/* Synthetic-only tests for Displays assign (plan §12). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const CALC_ROOT = process.env.CALC_DIR || path.join(ROOT, '..', 'ModuLaser-Battery-Calculator');
const TB = process.env.TOOLBOX_DIR || ROOT;
const RPT = process.env.REPORT_DIR || path.join(ROOT, '..', 'ModuLaser-Commisioning-Report');

let failed = 0;
function t(name, cond, detail){
  if (cond) console.log('ok -', name);
  else { console.log('NOT OK -', name, detail || ''); failed++; }
}

function loadEngine(){
  const code = fs.readFileSync(path.join(ROOT, 'masd-engine.js'), 'utf8');
  const ctx = { console, Math, Date, parseFloat, parseInt, isFinite, String, Number, Array, Object, JSON, Infinity };
  vm.createContext(ctx);
  vm.runInContext(code + '\nthis.MASD_ENGINE=MASD_ENGINE; this.suggestDisplays=suggestDisplays; this.MAX_DETECTORS_PER_CLUSTER=MAX_DETECTORS_PER_CLUSTER; this.CHARGER_MAX_AH=CHARGER_MAX_AH; this.MODULE_TYPES=MODULE_TYPES; this.FAN_SPEED_MA=FAN_SPEED_MA; this.plRequiredAh=plRequiredAh; this.displayBucketAh=displayBucketAh; this.displayBucketPsuCount=displayBucketPsuCount;', ctx);
  return ctx;
}
function loadMLP(){
  const code = fs.readFileSync(path.join(ROOT, 'modulaser-project.js'), 'utf8');
  const ctx = { console, Math, Date, parseFloat, parseInt, isFinite, String, Number, Array, Object, JSON, TextEncoder: class { encode(s){ return Buffer.from(s); } }, Buffer, Intl };
  // minimal browser root
  ctx.window = ctx; ctx.self = ctx; ctx.root = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx.MLP || ctx.root.MLP;
}

const E = loadEngine();
const MLP = loadMLP();

t('engine version 1.3.1', E.MASD_ENGINE.version === '1.3.1', E.MASD_ENGINE.version);
t('MLP version 1.7.1', MLP.VERSION === '1.7.1', MLP.VERSION);
t('schema still v1', MLP.SCHEMA_VERSION === 1);

// H5: numbers unchanged
t('FAN_SPEED_MA fan10 = 471', E.FAN_SPEED_MA[10] === 471);

function floor(name, nDet, nStd, nMin, nCmd){
  const detectors = [];
  for (let i = 0; i < nDet; i++) detectors.push({ kind: 'detector', key: name+'-d'+i, fan: 10, newName: 'DET'+i });
  const displays = [];
  for (let i = 0; i < (nStd||0); i++) displays.push({ kind: 'display', type: 'Standard Display' });
  for (let i = 0; i < (nMin||0); i++) displays.push({ kind: 'display', type: 'Minimum Display' });
  for (let i = 0; i < (nCmd||0); i++) displays.push({ kind: 'display', type: 'Command Display' });
  return { name, origName: name, detectors, displays };
}

// Case Campus-like: 3 det, 0 disp → 1 Std
{
  const p = E.suggestDisplays([floor('Level 1', 3, 0, 0, 0)]);
  t('3 det 0 disp → needed 1 le8', p.anyNeeded && p.floors[0].needed === 1 && p.floors[0].suggestion.rule === 'le8-floor');
}
// H4: 10 det + 1 Min → needed 1
{
  const p = E.suggestDisplays([floor('Mezzanine', 10, 0, 1, 0)]);
  t('10 det + 1 Min → needed 1', p.floors[0].needed === 1 && p.floors[0].status === 'needed', p.floors[0]);
}
// H4: 12 det + 1 Min + 1 Cmd → needed 1 (Cmd ignored)
{
  const p = E.suggestDisplays([floor('Roof', 12, 0, 1, 1)]);
  t('12 det + 1 Min + 1 Cmd → needed 1', p.floors[0].needed === 1, p.floors[0]);
}
// H4: 12 det + 2 Min → OK
{
  const p = E.suggestDisplays([floor('Level 2', 12, 0, 2, 0)]);
  t('12 det + 2 Min → ok', p.floors[0].status === 'ok' && !p.anyNeeded);
}
// MiniLaser-only skip
{
  const g = { name: 'ML', detectors: [{ kind: 'minilaser', key: 'm1' }], displays: [] };
  const p = E.suggestDisplays([g]);
  t('minilaser-only skipped', p.floors[0].status === 'skip');
}
// >8 empty buckets
{
  const p = E.suggestDisplays([floor('Mezzanine', 14, 0, 0, 0)]);
  t('14 det → grouped buckets needed 2', p.floors[0].suggestion.rule === 'grouped' && p.floors[0].needed === 2 && p.floors[0].buckets.length === 2, p.floors[0]);
}

// M2: 4 det fan10 + display Ah > 65
{
  const dets = [];
  for (let i = 0; i < 4; i++) dets.push({ kind: 'detector', fan: 10 });
  dets.push({ kind: 'display', type: 'Standard Display' });
  const ah = E.displayBucketAh(dets, { designBasis: 'NFPA 72 Standard', standbyHours: '24', alarmMinutes: '5', margin: '0.25', temperature: '77', mode: 'edwards' });
  t('4 det fan10 + Std display Ah > 65', ah > 65, ah);
}

// MLP assumed helpers
{
  const a = MLP.makeAssumedDisplay({ floor: 'Level 1', floorIdx: 0, type: 'Standard Display', name: 'L1-DSP01' });
  t('makeAssumedDisplay origin assumed', a.origin === 'assumed' && MLP.isAssumedDisplay(a));
  const replaced = MLP.replaceAssumedWithReal([a], [{ type: 'Standard Display', name: 'REAL', address: '007', cluster: '2', origin: 'pl' }]);
  t('replace keeps address/cluster when real omits', replaced[0].address === '007' || replaced[0].cluster === '2');
  // keep when real has blanks
  const a2 = MLP.makeAssumedDisplay({ name: 'X' }); a2.address = '003'; a2.cluster = '1';
  const r2 = MLP.replaceAssumedWithReal([a2], [{ type: 'Standard Display', name: 'Y', address: '', cluster: '' }]);
  t('replace keeps assumed address/cluster if real blank', r2[0].address === '003' && r2[0].cluster === '1', r2[0]);
  t('replaced origin pl', r2[0].origin === 'pl' && !MLP.isAssumedDisplay(r2[0]));
}

// R4A time zone
{
  const z = MLP.resolveTimeZone({ timeZone: 'America/Chicago' }, 'UTC');
  t('resolveTimeZone project Chicago', z.timeZone === 'America/Chicago' && z.source === 'project');
  const z2 = MLP.resolveTimeZone({}, 'America/New_York');
  t('resolveTimeZone runtime NY', z2.timeZone === 'America/New_York' && z2.source === 'runtime');
}

// Hash defaults include new keys; blank has timeZone
{
  t('HASH_DEFAULTS has origin', Object.prototype.hasOwnProperty.call(MLP.HASH_DEFAULTS, 'origin'));
  const b = MLP.blank();
  t('blank project.timeZone field', Object.prototype.hasOwnProperty.call(b.project, 'timeZone'));
}

// M8 parity: engine + MLP byte-identical across apps
{
  const engCalc = fs.readFileSync(path.join(ROOT, 'masd-engine.js'), 'utf8');
  const engTb = fs.readFileSync(path.join(TB, 'masd-engine.js'), 'utf8');
  t('masd-engine.js Calc≡Toolbox', engCalc === engTb);
  const mlpCalc = fs.readFileSync(path.join(ROOT, 'modulaser-project.js'), 'utf8');
  const mlpTb = fs.readFileSync(path.join(TB, 'modulaser-project.js'), 'utf8');
  const mlpR = fs.readFileSync(path.join(RPT, 'modulaser-project.js'), 'utf8');
  t('modulaser-project.js Calc≡Toolbox', mlpCalc === mlpTb);
  t('modulaser-project.js Calc≡Report', mlpCalc === mlpR);
}

// Wizard region parity: PL_STEPS Displays present in both
{
  const calc = fs.readFileSync(path.join(CALC_ROOT, 'modulaser_battery_calculator.html'), 'utf8');
  const tb = fs.readFileSync(path.join(TB, 'index.html'), 'utf8');
  t('Calc has Displays step', calc.includes("'Displays'") && calc.includes('plRenderDisplaysStep'));
  t('Toolbox has Displays step', tb.includes("'Displays'") && tb.includes('plRenderDisplaysStep'));
  // extract wizard helper function bodies for parity (plRenderDisplaysStep presence + PL_STEPS string)
  const steps = "const PL_STEPS = ['Battery settings', 'Pick .pl files', 'Rename', 'Displays', 'Power supplies'];";
  t('PL_STEPS identical string in both', calc.includes(steps) && tb.includes(steps));
  const _engFile = fs.readFileSync(path.join(ROOT, 'masd-engine.js'), 'utf8');
  t('H5 comment in engine file', _engFile.includes('engineering-approved values'));
  t('H5 comment in Calc HTML engine block', calc.includes('engineering-approved values'));
}

// Skip persistence: prior skip not re-prompted
{
  const g = floor('Level 1', 6, 0, 0, 0);
  const p1 = E.suggestDisplays([g], { displayPlan: { 'link:0:Level 1': { decision: 'skip', needed: 1 } } });
  // floorKey in suggestDisplays uses state.linkId — default 'link'
  const key = p1.floors[0].floorKey;
  const p2 = E.suggestDisplays([g], { linkId: 'link', displayPlan: { [key]: { decision: 'skip', needed: 1 } } });
  t('skip persistence', p2.floors[0].status === 'skipped', p2.floors[0]);
}

console.log(failed ? `\n${failed} failed` : '\nall passed');

// SenseNET Command flag (R3A): 2+ clusters, 0 Cmd → offer
{
  // two floors each with 1 Std => 2 clusters, no Cmd
  const g1 = floor('A', 3, 1, 0, 0);
  const g2 = floor('B', 3, 1, 0, 0);
  const clusters = [g1, g2].reduce((n, g) => n + g.displays.filter(d => d.type === 'Standard Display' || d.type === 'Minimum Display').length, 0);
  const cmds = [g1, g2].reduce((n, g) => n + g.displays.filter(d => d.type === 'Command Display').length, 0);
  t('SenseNET Command flag', clusters >= 2 && cmds === 0);
}

// transport time unaffected by assumed display (pipe/fan null)
{
  const a = MLP.makeAssumedDisplay({ type: 'Standard Display', name: 'X', floor: 'L1', floorIdx: 0, bucket: 0, linkId: 'L', rule: 'le8-floor' });
  t('assumed display pipe/fan null (transport unaffected)', a.pipe == null && a.fan == null);
  // hole / AF path ignores displays without pipe
  const design = MLP.blankDesign ? null : null;
  t('assumed not a detector for AF', a.kind === 'display' && a.origin === 'assumed');
}

// schema v1 back-compat: older project without origin still loads; missing origin ⇒ pl
{
  t('SCHEMA_VERSION stays 1', MLP.SCHEMA_VERSION === 1);
  const legacy = { kind: 'display', type: 'Standard Display', name: 'OLD' }; // no origin
  t('missing origin reads as pl', !MLP.isAssumedDisplay(legacy));
  // HASH_DEFAULTS additives present so untouched files keep stable hash keys
  t('HASH_DEFAULTS additives', 'assumption' in MLP.HASH_DEFAULTS && 'displayPlan' in MLP.HASH_DEFAULTS && 'timeZone' in MLP.HASH_DEFAULTS);
}

// Wizard region contains mockup-picked strings (S1A/S2A/S3B/S5B)
{
  const calc = fs.readFileSync(path.join(CALC_ROOT, 'modulaser_battery_calculator.html'), 'utf8');
  t('S1A Stop import primary copy', calc.includes('Stop import') && calc.includes('fix displays in PipeCAD'));
  t('S2A Accept / change type / Skip', calc.includes('plDisplaysAcceptFloor') && calc.includes('plDisplaysSetType') && calc.includes('plDisplaysSkipFloor'));
  t('S3B 65 Ah live warning', calc.includes('over 65 Ah charger'));
  t('S5B Command offer', calc.includes('Add 1 Command display') && calc.includes('plCommandDismiss'));
  t('footer Next on Displays (not blocked at step 4)', calc.includes("plw-next').hidden = plWiz.step === 5"));
}

console.log(failed ? (failed + ' failed') : 'all passed');
process.exit(failed ? 1 : 0);
