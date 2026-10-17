// MiniLaser FHSD8075-ULF (modulaser-project.js 1.5.0) — real fixture: Brent's Example Shaft .pl (qa/minilaser/minilaser.pl).
// Run: node tests/mlp_minilaser_test.js  (needs @xmldom/xmldom; set XMLDOM_DIR or keep the Calculator checkout's node_modules)
const path = require('path'), fs = require('fs');
const xd = require(process.env.XMLDOM_DIR || '/workspace/ModuLaser-Battery-Calculator/node_modules/@xmldom/xmldom');
// xmldom lacks Element.children/localName on some nodes; the shared parser only needs children + localName/tagName + textContent
const proto = Object.getPrototypeOf(new xd.DOMParser().parseFromString('<a/>', 'application/xml').documentElement);
if (!('children' in proto)) Object.defineProperty(proto, 'children', { get(){ return Array.from(this.childNodes).filter(n => n.nodeType === 1); } });
global.DOMParser = xd.DOMParser;
const M = require(path.join(process.env.TOOLBOX_DIR || path.join(__dirname, '..'), 'modulaser-project.js'));
const FX = process.env.ML_FIXTURE || '/workspace/qa/minilaser/minilaser.pl';
let pass = 0, fail = 0; const t = (n, c, i) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
t('MLP 1.5.0', M.VERSION === '1.5.0', M.VERSION);
let pc = null; try { pc = M.parsePl(fs.readFileSync(FX, 'utf8'), 'minilaser.pl'); } catch (e) { t('Example Shaft .pl parses without throwing', false, e.message); }
const d = pc && pc.groups[0].detectors[0];
t('Example Shaft .pl parses without throwing', !!pc);
t('SOLO → MiniLaser kind', d && d.kind === 'minilaser' && d.type === 'MiniLaser', d && [d.kind, d.type]);
t('fan from aspiratorSpeed = 6', d && d.fan === 6);
t('address ignored', d && d.address === '');
t('8 sampling holes + 1 test point (test point not counted)', d && d.pipe.holes.length === 8 && d.pipe.testPoints.length === 1);
t('alarmFactorActivated false read raw', d && d.pipe.afActivatedRaw === 'false');
t('bends90 total 10 from .pl', d && d.pipe.bends90Total === 10, d && d.pipe.bends90Total);
t('expansionDatabase empty → no notice', d && d.pipe.expansionInPl === false);
const dev = d && M.deviceFromPl(d, 'Floor', { id: 'pl-x', name: 'minilaser.pl' });
t('deviceFromPl model FHSD8075-ULF, standalone, no address', dev && dev.model === 'FHSD8075-ULF' && dev.standalone === true && dev.address === '');
t('devNetwork → null (standalone; not counted on SenseNET)', dev && M.devNetwork(dev) === null && Object.keys(M.networkCounts([dev])).length === 0);
const ml = dev && dev.minilaser;
t('AF derived (not 0 from .pl): 8 holes × 0.25 = 2.00 ≤ SFD 2.0 → AF 8', ml && ml.alarmFactor === 8 && ml.alarmFactorSrc === 'derived' && ml.derivation.avg === 2, ml && ml.derivation);
t('class source recorded (maxTransitTime 42 → not a class; suite default SFD)', ml && ml.perfClass === 'SFD' && /default/.test(ml.perfClassSrc), ml && ml.perfClassSrc);
t('Remote recommended (fan 6 not DIP; 10 × 90°)', ml && ml.configMethod === 'Remote' && /Remote/.test(ml.advice), ml && ml.advice);
// derivation rule
const D = M.deriveAlarmFactor;
t('VEWFD 8 holes → AF6 (0.96)', D(8, 'VEWFD').af === 6 && D(8, 'VEWFD').avg === 0.96);
t('EWFD 8 holes → AF7 (1.44)', D(8, 'EWFD').af === 7);
t('OAP 8 holes → AF8 (2.00 ≤ 2.18)', D(8, 'OAP').af === 8);
t('rounds toward more sensitive: SFD 9 holes → AF7 (0.25×9=2.25 > 2.0; 0.18×9=1.62)', D(9, 'SFD').af === 7);
t('AF0 overflow → fail + recommendation', D(250, 'VEWFD').fail === true && D(250, 'VEWFD').af === 0 && /fewer holes or redesign/.test(D(250, 'VEWFD').msg));
t('exactly at threshold passes (VEWFD 4 holes × 0.25 = 1.00 → AF8)', D(4, 'VEWFD').af === 8);
// activated AF imported as-is
const act = Object.assign({}, d, { pipe: Object.assign({}, d.pipe, { afActivatedRaw: 'true', af: 5 }) });
t('alarmFactorActivated true → imported as-is', M.miniLaserFromPl(act).alarmFactor === 5 && M.miniLaserFromPl(act).alarmFactorSrc === 'pl');
// DIP / Remote advice
const A = M.miniLaserAdvice;
t('fan 4 / AF 6 / 10 elbows → DIP (both DIP-settable)', A({ fan: 4, af: 6, bends90: 10 }).method === 'DIP');
t('fan 7 / AF 5 → Remote (AF 5 Remote only)', A({ fan: 7, af: 5, bends90: 0 }).method === 'Remote');
t('pre-engineered when ≤1 elbow', A({ fan: 4, af: 4, bends90: 1 }).preEngineered === true && A({ fan: 4, af: 4, bends90: 2 }).preEngineered === false);
// constants
const ML = M.MINILASER;
t('draw table 120…365 mA', JSON.stringify(Object.values(ML.fanMa)) === '[120,134,157,180,200,230,255,285,320,365]');
t('relay labels exact', ML.relays.map(r => r.label).join('|') === 'R1 Fault relay (fixed)|R2 Relay output 1 (Prealarm)|R3 Relay output 2 (Fire Alarm)' && ML.relays[0].failsafe);
t('expansion 9-30520 / 9-30521, 5 out + 2 in, max 2', ML.expansion.housing === '9-30520' && ML.expansion.module === '9-30521' && ML.expansion.outPerModule === 5 && ML.expansion.inPerModule === 2 && ML.expansion.maxModules === 2);
t('pre-engineered: 9 tables, diameter counts match holes (T per branch)', ML.preEngineered.length === 9 && ML.preEngineered.every(tb => tb.rows.every(r => r.diameters.length === (tb.shape === 'T' ? r.holes / 2 : r.holes) && r.lengthFt > 0)));
const lk = M.preEngLookup('I', 4, 4, 8);
t('lookup I/fan 4/4 holes/AF8 → 34 s, 2.00 SFD|SA|OAP, 9/64 ×4, 80 ft (M Tables 23–24)', lk && lk.row.transport === 34 && lk.af.avg === 2 && lk.af.classes.join() === 'SFD,SA,OAP' && lk.row.diameters.every(x => x === '9/64') && lk.row.lengthFt === 80);
t('lookup offers no AF8 where the manual has none (T/fan 2/6 holes)', M.preEngLookup('T', 2, 6, 8).af === null);
// validation
const iss = M.validateDesign({ devices: [Object.assign({}, dev, { fan: null })] });
t('validate: missing fan → incomplete ⚠', iss.some(x => x.level === 'incomplete' && /⚠/.test(x.msg)));
t('validate: unknown kind guarded', M.validateDesign({ devices: [{ id: 'x', name: 'X', kind: 'spaceship' }] }).some(x => /unknown device kind/.test(x.msg)));
// round trip
const doc = M.blank(); doc.design = { devices: [Object.assign({}, dev, { ioModules: 2 })], psus: [] };
const back = M.parse(M.stringify(doc, 'test', '0'));
t('save → load keeps MiniLaser fields', back.design.devices[0].ioModules === 2 && back.design.devices[0].minilaser.alarmFactor === 8 && back.design.devices[0].model === 'FHSD8075-ULF');
t('diff sees I/O module change', M.diffDesign(doc.design, { devices: [Object.assign({}, dev, { ioModules: 1 })], psus: [] }).devices.changed.some(c => c.fields.some(f => f.f === 'ioModules')));
console.log(`${pass}/${pass + fail}`); process.exit(fail ? 1 : 0);
