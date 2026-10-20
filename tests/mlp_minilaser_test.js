// MiniLaser FHSD8075-ULF (modulaser-project.js 1.5.1) — real fixture: Brent's Example Shaft .pl (qa/minilaser/minilaser.pl).
// Run: node tests/mlp_minilaser_test.js  (needs @xmldom/xmldom: `cd electron && npm install` — it's an electron devDependency; or set XMLDOM_DIR)
const path = require('path'), fs = require('fs');
const xd = require(process.env.XMLDOM_DIR || require.resolve('@xmldom/xmldom', { paths: [path.join(__dirname, '..', 'electron'), path.join(__dirname, '..')] }));
// xmldom lacks Element.children/localName on some nodes; the shared parser only needs children + localName/tagName + textContent
const proto = Object.getPrototypeOf(new xd.DOMParser().parseFromString('<a/>', 'application/xml').documentElement);
if (!('children' in proto)) Object.defineProperty(proto, 'children', { get(){ return Array.from(this.childNodes).filter(n => n.nodeType === 1); } });
global.DOMParser = xd.DOMParser;
const M = require(path.join(process.env.TOOLBOX_DIR || path.join(__dirname, '..'), 'modulaser-project.js'));
const FX = process.env.ML_FIXTURE || '/workspace/qa/minilaser/minilaser.pl';
let pass = 0, fail = 0; const t = (n, c, i) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
t('MLP 1.6.3', M.VERSION === '1.6.3', M.VERSION);
const HAVE = fs.existsSync(FX); let skipped = 0;   // Brent: the Example Shaft .pl stays off GitHub — fixture checks SKIP when it's absent
const tf = (n, c, i) => { if (HAVE) t(n, c, i); else { skipped++; console.log('SKIP', n, '(fixture absent: ' + FX + ')'); } };
let pc = null; if (HAVE) try { pc = M.parsePl(fs.readFileSync(FX, 'utf8'), 'minilaser.pl'); } catch (e) { t('Example Shaft .pl parses without throwing', false, e.message); }
const d = pc && pc.groups[0].detectors[0];
tf('Example Shaft .pl parses without throwing', !!pc);
tf('SOLO → MiniLaser kind', d && d.kind === 'minilaser' && d.type === 'MiniLaser', d && [d.kind, d.type]);
tf('fan from aspiratorSpeed = 6', d && d.fan === 6);
tf('address ignored', d && d.address === '');
tf('8 sampling holes + 1 test point (test point not counted)', d && d.pipe.holes.length === 8 && d.pipe.testPoints.length === 1);
tf('alarmFactorActivated false read raw', d && d.pipe.afActivatedRaw === 'false');
tf('bends90 total 10 from .pl', d && d.pipe.bends90Total === 10, d && d.pipe.bends90Total);
tf('expansionDatabase empty → no notice', d && d.pipe.expansionInPl === false);
const dev = d && M.deviceFromPl(d, 'Floor', { id: 'pl-x', name: 'minilaser.pl' });
tf('deviceFromPl model FHSD8075-ULF, standalone, no address', dev && dev.model === 'FHSD8075-ULF' && dev.standalone === true && dev.address === '');
tf('devNetwork → null (standalone; not counted on SenseNET)', dev && M.devNetwork(dev) === null && Object.keys(M.networkCounts([dev])).length === 0);
const ml = dev && dev.minilaser;
tf('AF derived (not 0 from .pl): 8 holes × 0.25 = 2.00 ≤ SFD 2.0 → AF 8', ml && ml.alarmFactor === 8 && ml.alarmFactorSrc === 'derived' && ml.derivation.avg === 2, ml && ml.derivation);
tf('class source recorded (no Area/project class → default SFD)', ml && ml.perfClass === 'SFD' && ml.perfClassSrc === 'default SFD', ml && ml.perfClassSrc);
// Brent-approved class order: Area/Group → project → SFD
const P = { standard: 'EWFD – NFPA 76', areas: { Floor: { enabled: true, standard: 'VEWFD – NFPA 76/318' }, Other: { enabled: false, standard: 'VEWFD – NFPA 76/318' } } };
t('class order: Area/Group override wins', JSON.stringify(M.miniLaserClass(P, 'Floor')) === JSON.stringify({ cls: 'VEWFD', src: 'area' }), M.miniLaserClass(P, 'Floor'));
t('class order: disabled area → project class', JSON.stringify(M.miniLaserClass(P, 'Other')) === JSON.stringify({ cls: 'EWFD', src: 'project' }), M.miniLaserClass(P, 'Other'));
t('class order: no class (BS / none) → SFD', M.miniLaserClass({ standard: 'BS 5839-1 Category M/L' }, 'Floor').cls === 'SFD' && M.miniLaserClass(null).src === 'default SFD');
const devV = d && M.deviceFromPl(d, 'Floor', { id: 'pl-x', name: 'minilaser.pl' }, undefined, P);
tf('Example Shaft with a VEWFD area: 8 × AF → AF 6 (8 × 0.12 = 0.96 ≤ 1.0), class src area', devV && devV.minilaser.alarmFactor === 6 && devV.minilaser.perfClass === 'VEWFD' && devV.minilaser.perfClassSrc === 'area', devV && devV.minilaser.derivation);
const dsg = pc && M.designFromPl([pc], [{ id: 'pl-x', name: 'minilaser.pl' }], { standard: 'EWFD – NFPA 76' });
tf('designFromPl passes the project class: EWFD → AF 7 (8 × 0.18 = 1.44 ≤ 1.5)', dsg && dsg.devices[0].minilaser.alarmFactor === 7 && dsg.devices[0].minilaser.perfClassSrc === 'project', dsg && dsg.devices[0].minilaser.derivation);
tf('Remote recommended (fan 6 not DIP; 10 × 90°)', ml && ml.configMethod === 'Remote' && /Remote/.test(ml.advice), ml && ml.advice);
// derivation rule
const D = M.deriveAlarmFactor;
t('VEWFD 8 holes → AF6 (0.96)', D(8, 'VEWFD').af === 6 && D(8, 'VEWFD').avg === 0.96);
t('EWFD 8 holes → AF7 (1.44)', D(8, 'EWFD').af === 7);
t('OAP 8 holes → AF8 (2.00 ≤ 2.0 default target)', D(8, 'OAP').af === 8);
t('rounds toward more sensitive: SFD 9 holes → AF7 (0.25×9=2.25 > 2.0; 0.18×9=1.62)', D(9, 'SFD').af === 7);
t('AF0 overflow → fail + recommendation', D(250, 'VEWFD').fail === true && D(250, 'VEWFD').af === 0 && /fewer holes or redesign/.test(D(250, 'VEWFD').msg));
t('exactly at threshold passes (VEWFD 4 holes × 0.25 = 1.00 → AF8)', D(4, 'VEWFD').af === 8);
// activated AF imported as-is
const act = HAVE && Object.assign({}, d, { pipe: Object.assign({}, d.pipe, { afActivatedRaw: 'true', af: 5 }) });
if (HAVE) t('alarmFactorActivated true → imported as-is', M.miniLaserFromPl(act).alarmFactor === 5 && M.miniLaserFromPl(act).alarmFactorSrc === 'pl'); else tf('alarmFactorActivated true → imported as-is');
// DIP / Remote advice
const A = M.miniLaserAdvice;
t('fan 4 / AF 6 / 10 elbows → DIP (both DIP-settable)', A({ fan: 4, af: 6, bends90: 10 }).method === 'DIP');
t('fan 7 / AF 5 → Remote (AF 5 Remote only)', A({ fan: 7, af: 5, bends90: 0 }).method === 'Remote');
t('never pre-engineered from elbow/tee counts (Brent: .pl import is non-pre-engineered by default)', A({ fan: 4, af: 4, bends90: 1, tees: 0 }).preEngineered === false && A({ fan: 4, af: 4 }).preEngineered === false);
t('non-pre-engineered: fan 6 / AF 8 → Remote; fan 7 / AF 2 → DIP', A({ fan: 6, af: 8 }).method === 'Remote' && A({ fan: 7, af: 2 }).method === 'DIP');
t('user override preEngineered:true → DIP even with Remote-only fan/AF', A({ fan: 6, af: 5, preEngineered: true }).method === 'DIP' && A({ fan: 6, af: 5, preEngineered: true }).preEngineered === true);
t('.pl import advice is non-pre-engineered regardless of fittings', (() => { const r = M.miniLaserFromPl({ fan: 4, pipe: { holes: [1,2,3,4], bends90Total: 0, tees: 0, afActivatedRaw: 'true', af: 8 } }, 'SFD'); return r.advice.preEngineered === false && r.configMethod === 'DIP'; })());
// constants
const ML = M.MINILASER;
t('draw table 120…365 mA', JSON.stringify(Object.values(ML.fanMa)) === '[120,134,157,180,200,230,255,285,320,365]');
t('relay labels exact', ML.relays.map(r => r.label).join('|') === 'R1 Fault relay (fixed)|R2 Relay output 1 (Prealarm)|R3 Relay output 2 (Fire Alarm)' && ML.relays[0].failsafe);
t('expansion 9-30520 / 9-30521, 5 out + 2 in, max 2', ML.expansion.housing === '9-30520' && ML.expansion.module === '9-30521' && ML.expansion.outPerModule === 5 && ML.expansion.inPerModule === 2 && ML.expansion.maxModules === 2);
t('F1: 20 holes on VEWFD fails (M p.66 max 10)', M.miniLaserPipeCheck({ key: 'VEWFD', holes: 20 }).ok === false && /maximum of 10/.test(M.miniLaserPipeCheck({ key: 'VEWFD', holes: 20 }).errors[0]));
t('F1: 10 holes VEWFD, 20 EWFD, 35 SFD pass; 36 SFD fails', M.miniLaserPipeCheck({ key: 'VEWFD', holes: 10 }).ok && M.miniLaserPipeCheck({ key: 'EWFD', holes: 20 }).ok && M.miniLaserPipeCheck({ key: 'SFD', holes: 35 }).ok && !M.miniLaserPipeCheck({ key: 'SFD', holes: 36 }).ok);
t('F1: UL OAP 24 holes / 300 ft; SA Range 2 200 ft; ULC 35 holes / 400 ft', M.miniLaserPipeCheck({ key: 'UL 268 Ed.7 OAP', holes: 24, lengthFt: 300 }).ok && !M.miniLaserPipeCheck({ key: 'UL 268 Ed.7 OAP', holes: 25 }).ok && !M.miniLaserPipeCheck({ key: 'UL 268 Ed.7 SA Range 2', lengthFt: 201 }).ok && M.miniLaserPipeCheck({ key: 'ULC-S529', holes: 35, lengthFt: 400 }).ok);
t('F1: NFPA length 400 ft; 401 ft fails', M.miniLaserPipeCheck({ key: 'SFD', lengthFt: 400 }).ok && !M.miniLaserPipeCheck({ key: 'SFD', lengthFt: 401 }).ok);
t('F1: first hole > 16 ft fails when known', !M.miniLaserPipeCheck({ key: 'SFD', firstHoleFt: 20 }).ok && M.miniLaserPipeCheck({ key: 'SFD', firstHoleFt: 16 }).ok);
t('F1: .pl import carries pipeCheck (Example Shaft-like 8 holes SFD OK; 20 holes VEWFD fails)', M.miniLaserFromPl({ fan: 4, pipe: { holes: new Array(8).fill({}), lengthFt: 100 } }, 'SFD').pipeCheck.ok && !M.miniLaserFromPl({ fan: 4, pipe: { holes: new Array(20).fill({}) } }, { cls: 'VEWFD', src: 'area' }).pipeCheck.ok);
t('pre-engineered: 9 tables, diameter counts match holes (T per branch)', ML.preEngineered.length === 9 && ML.preEngineered.every(tb => tb.rows.every(r => r.diameters.length === (tb.shape === 'T' ? r.holes / 2 : r.holes) && r.lengthFt > 0)));
const lk = M.preEngLookup('I', 4, 4, 8);
t('lookup I/fan 4/4 holes/AF8 → 34 s, 2.00 SFD|SA|OAP, 9/64 ×4, 80 ft (M Tables 23–24)', lk && lk.row.transport === 34 && lk.af.avg === 2 && lk.af.classes.join() === 'SFD,SA,OAP' && lk.row.diameters.every(x => x === '9/64') && lk.row.lengthFt === 80);
t('lookup offers no AF8 where the manual has none (T/fan 2/6 holes)', M.preEngLookup('T', 2, 6, 8).af === null);
// validation
const iss = M.validateDesign({ devices: [Object.assign({}, dev || { id: 'syn', kind: 'minilaser', type: 'MiniLaser', model: 'FHSD8075-ULF', name: 'Synthetic ML', standalone: true, address: '', minilaser: { alarmFactor: 4 } }, { fan: null })] });
t('validate: missing fan → incomplete ⚠', iss.some(x => x.level === 'incomplete' && /⚠/.test(x.msg)));
t('validate: unknown kind guarded', M.validateDesign({ devices: [{ id: 'x', name: 'X', kind: 'spaceship' }] }).some(x => /unknown device kind/.test(x.msg)));
// round trip
const doc = M.blank(); if (HAVE) doc.design = { devices: [Object.assign({}, dev, { ioModules: 2 })], psus: [] };
const back = HAVE && M.parse(M.stringify(doc, 'test', '0'));
if (HAVE) t('save → load keeps MiniLaser fields', back.design.devices[0].ioModules === 2 && back.design.devices[0].minilaser.alarmFactor === 8 && back.design.devices[0].model === 'FHSD8075-ULF'); else tf('save → load keeps MiniLaser fields');
if (HAVE) t('diff sees I/O module change', M.diffDesign(doc.design, { devices: [Object.assign({}, dev, { ioModules: 1 })], psus: [] }).devices.changed.some(c => c.fields.some(f => f.f === 'ioModules'))); else tf('diff sees I/O module change');
const REQ = process.env.REQUIRE_FIXTURES === '1';
console.log(`${pass}/${pass + fail} passed` + (skipped ? `, SKIPPED: ${skipped} (fixture absent${REQ ? ' — REQUIRE_FIXTURES=1, failing' : ''})` : '')); process.exit(fail || (skipped && REQ) ? 1 : 0);
