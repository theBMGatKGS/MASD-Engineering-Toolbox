# MASD Engineering Toolbox

Offline engineering toolbox for **Edwards ModuLaser Modular Aspirating Smoke Detector (MASD)** projects.
It absorbs the **ModuLaser Battery Calculator** and adds device configuration, legacy-file migration and
the field-change approval loop with the **ModuLaser MASD Field (Commissioning) Report**.

> **Version 00.01.000_261013 — pre-release.** 01.00.000 is reserved for the refined first release.
> Calculation engine: **MASD engine 1.0.0** · Project file: **modulaser-project 1.3.0 (`.mlproj.json`)** ·
> Calculator lineage: **Battery Calculator 02.00.002**

![Config mode](docs/screenshots/03-config-editor-seeded.png)

## Features

### Modes (per project, toggle any time)
| Mode | Shows |
|---|---|
| **Config** | Device configuration only |
| **Calculator** | The Battery Calculator, unchanged from Battery Calculator 02.00.002 |
| **Both** | Config and Battery calc tabs |

The mode is stored in the project file (`design.toolbox.mode`). Switching never removes data.

### Config (design) mode
For every detector and display: **Alert, Prealarm, Fire 1, Fire 2 (absolute)**, Prealarm and Fire 1 delays,
cascading, latching alarms/faults, **flow-fault limits and delay**, day/night (start hours), **LDD**,
**I/O assignments** (IN1/IN2/OUT1–OUT3 function and FACU address `PPP:CCC:DDDD`) and display role/buzzer.

Values seed from the performance class (VEWFD / EWFD / SFD from the PipeCAD transit class). Every value carries a source badge:

| Badge | Meaning |
|---|---|
| **manual** | Stated in *ModuLaser Install Manual 04-4001-501-0803-05*: flow High/Low limit 20% and flow-fault delay 120 s (Table 29, p.76) |
| **typical – unverified** | Starting point with no manual citation yet — verify. Includes Fire 1 (starts at the FM/UL **hole** limit, App. A printed p.113: VEWFD <1.00, EWFD <1.50, SFD <2.50 %obs/ft), Alert (ClassiFire factor, Table 24 p.71, default 10; VEWFD 0.2 %obs/ft per NFPA 76-2024 8.5.3.1.2.5 (VEWFD Alert 0.2 / Alarm 1.0 %/ft = 0.65 / 3.2 %/m, effective at each port, above ambient)), Prealarm (ModuLaser has no "Action" level), Fire 2 and the 5 s delays (site choice; Table 26 p.73 range 0–90 s) |
| **design** | Set by the designer |

Validation: rising levels, ranges, FACU address format and duplicates, 16-character display names, Fire 1 vs the class hole limit.
These values travel in `design.devices[].config` and **replace the Commissioning Report's placeholder defaults**; values still marked typical stay flagged there.

### Performance Criteria (Config)
Set once per project (optional per-Area/Group overrides), carried in `.mlproj.json` (`design.performance`), printed on the Toolbox Configuration schedule and the Commissioning Report summary page. The Report checks each module against its Area/Group limits.

**Referenced standard** presets:

| Preset | Rule | Prefilled (cited) | Source |
|---|---|---|---|
| VEWFD – NFPA 76/318 | UL 268, 7th Ed. thresholds + code; "Complies with UL 268, 7th Edition" after the engineer confirms | Sensitivity < VEWFD 1.0 / EWFD 1.5 / SFD-OAP 2.18 %obs/ft; transport ≤ 60 / 43 / 43 s; NFPA 76 VEWFD 1.0 %obs/ft per hole, <60 s | UL 268, 7th Ed. Special Application Range 1 / Range 2 / Open Area per Install Manual App. A, printed p.113; EWFD 1.5 from NFPA 76; per NFPA 76-2024 8.5.3.1.2.5 (VEWFD Alert 0.2 / Alarm 1.0 %/ft = 0.65 / 3.2 %/m, effective at each port, above ambient) |
| EWFD – NFPA 76 | UL 268 thresholds + code (NFPA 76-2024 8.5.3.2.1.2–.5: 1.5 %/ft alarm, 400 ft², mfr criteria → App. A p.113; NFPA 76 allows 90 s transport, UL 43 s governs); UL 268 statement | UL limits as above | Install Manual App. A, printed p.113 (EWFD 1.5 from NFPA 76) |
| SFD/OAP – NFPA 72 (default) | UL 268 thresholds + code; UL 268 statement | UL limits as above | Install Manual App. A, printed p.113 (EWFD 1.5 from NFPA 76) |
| EWFD – FM DS 5-32 | FM only, no UL statement | VEWFD 1.00 / EWFD 1.50 / SFD 2.50 %obs/ft, <60 / <90 / <120 s (engineer confirms) | FM Class 3230 per ModuLaser Install Manual 04-4001-501-0803-05, App. A, printed p.113 |
| SFD – FM DS 5-48 | FM only, no UL statement | Same FM Class 3230 limits | Same |
| BS 5839-1 Category M/L · M/L + Generator · P (Staffed) · P (Unstaffed) | Same options as the Battery Calculator's Design Basis drop-down | none — engineer to define | — |
| Custom | Named by the engineer | none — engineer to define | — |

Code prescriptions beyond the cited rows (FM DS 5-32/5-48, NFPA 72/76/318 ASD specifics) are **engineer to define** until research supplies citations. Every blank value must be entered with its reference and **Confirmed**. The narrative is auto-drafted from the selections, names the referenced standard, and is edited and confirmed by the engineer; Engineer of Record and specification reference are recorded. Anything undefined or unconfirmed **blocks Export project**.

### Battery calculator
Identical to Battery Calculator 02.00.002: PipeCAD `.pl` import wizard, PSU assignment rules (≤4 detectors + 1 display, ≤65 Ah, no sharing across Area/Groups), live results, Print / Export (PDF, Word, HTML, Excel CAD Schedule + Detail).

### Legacy imports
**File → Import legacy calc / Excel…** reads every format in the calculator's history and migrates it to `.mlproj.json`:

| Source | Revisions | Notes |
|---|---|---|
| Save As `.html` (embedded state) | 01.04.008 → 02.00.000 | lossless |
| State `.json` / localStorage dump | 01.04 → 02.00 | lossless |
| Excel export `.xlsx` | 01.04–01.06 (one sheet per PSU), 02.00.000 (CAD Schedule + Detail) | displayed values only; wiring/battery choices re-derived |

A **migration report** lists everything that didn't map, everything filled with a current default, and old vs new required Ah per sheet. It is stored in `design.migration` and printable. (01.00–01.03 exist only in the revision log; no files were found.)

### Field-change loop
1. **Commissioning Report 02.00.001+** logs each change to a design value on site: field, old/new, who, when, why, photo; the technician signs; prints a **Field Change / As-Built** report.
2. **Toolbox → Field changes**: *Verify & apply* (writes name, address, fan speed, configuration or I/O into the design) or *Reject*; the battery calculation re-runs.
3. **PipeCAD change list** for fields PipeCAD must also carry (fan speed, Alarm Factor, name, transport, holes, class).
4. Importing the updated `.pl` **auto-verifies** those changes (match / mismatch / not found).
5. **QA / Auditor** approves. Names, dates and statuses for technician → designer → QA are stored in `doc.approvals`.

### Reports
Configuration schedule · Field Change / As-Built · PipeCAD change list · Migration report — Print/PDF, HTML, Word, Excel (View → Toolbox reports…).

### Help
In-app **How to use, How Do I…, Quick Start (offline), FAQ, Standards/References and Revision log**. Printable one-pager: [`docs/quickstart.html`](docs/quickstart.html) / [`docs/quickstart.pdf`](docs/quickstart.pdf).

## Install
- **PWA:** serve the repository root (or GitHub Pages) over HTTPS, open `index.html`, then install (Chrome/Edge install icon; iOS Safari → Share → Add to Home Screen). Works fully offline — fonts and icons are inlined, no CDN.
- **Windows:** `MASD-Engineering-Toolbox-Setup-00.01.000.exe` (x64 NSIS, unsigned; SmartScreen may prompt). Build it yourself:
  ```
  cd electron
  npm install
  npm run dist          # → electron/dist/MASD-Engineering-Toolbox-Setup-00.01.000.exe
  ```
- **Single file:** `index.html` also runs straight from disk.

## File formats
### `.mlproj.json` (modulaser-project 1.3.0, schemaVersion 1)
| Key | Owner | Content |
|---|---|---|
| `project` | all | name, location, designer, company, building, network |
| `design` | Toolbox / Calculator | devices (with `config`), psus, plLinks, placement, `calc.state`, `engine`, `toolbox {mode, rev, engine, calcLineage}`, `migration`, `hash` (SHA-256 over canonical JSON), `id` (short FNV display id) |
| `site` | Commissioning Report | site results, append-only `editLog`, `hash` (SHA-256) |
| `changes[]` | Report → Toolbox | `{id, dev, devName, field, label, design, value, by, at, why, photo, pipecad, status, verify, plCheck, qa}`; status `logged → verified/rejected → approved` |
| `approvals` | all | `{technician, designer, qa: {name, date, status}}` |
| `savedBy` | all | `{app, rev, name}` |
Unknown top-level keys are kept by every app (forward compatibility).

### Legacy
See *Legacy imports* above.

## Harmonization rule (shared engine)
The battery math and `.pl` import live in one module, **`masd-engine.js`**, embedded byte-identically in the Toolbox and the Battery Calculator. **Any engine change bumps both apps' revisions with matching notes, and each app records the engine version** (Help → Revision Log → Calculation engine). `modulaser-project.js` is likewise identical in the Toolbox, the Battery Calculator and the Commissioning Report. Tests enforce both (see below).

## Build and test
```
python3 tools/build.py        # builds index.html + quickstart.html from the calculator source, engine, project module and src/
```
Tests (real data only — PipeCAD samples and files produced by the historical calculator builds):
- `toolbox_test.py` — modes, config, Performance Criteria (preset list incl. calculator BS options, NFPA/UL, FM-only, BS engineer-to-define, code prescriptions, area override, narrative), Report round trip, verify/reject, PipeCAD auto-verify, QA, reports, every legacy fixture, help, mobile.
- `regress.py` — same scenarios through Battery Calculator and Toolbox; results must be identical.
- `test.py` / `test_v2.py` with `APP=toolbox` — the calculator suites run against the Toolbox.
- `mlp_sync_test.py` — modulaser-project.js and masd-engine.js identical across all repos.

## Screenshots
See [`docs/screenshots/`](docs/screenshots/) (copied from the Playwright run). Printable Quick Start: [`docs/quickstart.pdf`](docs/quickstart.pdf).

## QA audit
| Date | Commit audited | Summary | Issue | Verdict |
|---|---|---|---|---|
| 2026-10-13 | none for the Toolbox (new); shared parts audited in Battery Calculator cc55189 and Report 6854f2e | Defaults citations **FAIL → fixed**; Example Project rule **PASS**; audit trail **FAIL → fixed**; Quick Start version **FAIL → fixed** | [Toolbox #1](https://github.com/theBMGatKGS/MASD-Engineering-Toolbox/issues/1) | superseded by the final re-check (next rows) |
| 2026-10-13 re-check (8:28–8:45 PM ET) | e15af39 | **CONDITIONAL PASS** — fixed after re-check: stable design hash, mis-cited table number removed, UL 268 confirmation required, UL thresholds (≤60/43/43 s), sign-off order enforced, name-gated edits, append-only log, ASAG44201 replaced by NFPA 76-2024 clauses, Quick Start 02.00.001+, legacy Ah checks | [#1](https://github.com/theBMGatKGS/MASD-Engineering-Toolbox/issues/1)  QA audit 2026-10-13, final re-check of commit c42156a (clean tree). PASS (pre-release). Tests: toolbox_test 139/139, shared-file and engine parity 2/2. Verified: Config/Calculator/Both modes, engine byte-identical to the Battery Calculator, legacy imports (15 fixtures) with Ah checks, sign-off order technician → designer → QA enforced (no manual status, real names required, QA ≠ designer), reopen keeps verifier history, QA overrides logged with a reason, "Complies with UL 268, 7th Edition" printed only after engineer confirmation. Note: the UL 268 thresholds (VEWFD 1.0/60 s, EWFD 1.5/43 s, SFD/OAP 2.18/43 s) are per Brent and not verified by QA. EWFD 1.5 %obs/ft comes from NFPA 76-2024 8.5.3.2.1.3, not from a UL 268 range (Range 2 is 0.05–2.18 %obs/ft, 3–43 s; Open Area 1.70–2.18, 6–43 s, Install Manual App. A p.113). Issue: https://github.com/theBMGatKGS/MASD-Engineering-Toolbox/issues/1 QA delta re-check 2026-10-13, commit 4878e0e (clean). PASS (pre-release), on condition that the updated tests are committed. Verified: ≤ rule and targets, UL 268 ranges with lower limits (EWFD capped at 1.5 per NFPA 76, labelled as such), NFPA 318-2025 §11.1.3 cleanroom citations, offline Quick Start, shared modulaser-project.js and engine identical across apps. Tests: sens_rule 13/13, toolbox_test 139/139 and report_audit_test 30/30 using the updated test files. The committed copies in tests/ are stale and must be committed before the tag. |

## License
GPL-3.0 · © The BMG
