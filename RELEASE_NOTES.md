# Release Notes — MASD Engineering Toolbox

Release-by-release summaries, newest first. Releases are tagged `vMM.mm.rrr`; itemized history is in
[CHANGELOG.md](CHANGELOG.md) and in the app under **Help → Revision Log** (source of truth).

---

## v00.03.001 — Printed Quick Start header and light screenshots (2026-10-19) · not released

### Recent improvements
- Harmonized with Battery Calculator 02.02.001. **Printed Quick Start:** larger white brand logo (Edwards or Kidde Commercial) with the revision in the subtitle; print screenshots in a complementary light theme (same layout), on-screen Help stays dark; 2 letter pages.
- No calculation change.

### QA audit
- Pending: QA/Auditor review of 02.02.001 (Calculator) / 00.03.001 (Toolbox).

## v00.03.000 — Brands, ASD-160 and printable Quick Start (2026-10-19) · pre-release, released 2026-10-19

### Download / Open
- **Web / PWA (live):** https://thebmgatkgs.github.io/MASD-Engineering-Toolbox/ — open in a browser, or install it (Chrome/Edge install icon; iPhone/iPad Safari → Share → Add to Home Screen). Works offline after the first visit.
- **Windows installer:** **MASD-Engineering-Toolbox-Setup-00.03.000.exe** — Windows x64 NSIS installer (unsigned; SmartScreen may prompt: More info → Run anyway)
  - Direct: https://github.com/theBMGatKGS/MASD-Engineering-Toolbox/releases/download/v00.03.000/MASD-Engineering-Toolbox-Setup-00.03.000.exe
  - SHA-256: `0e52dbca1fdf7c98fb4a0d32a9717e52a9db7d0215ce5fa577a5e4ec642686c9`

### Recent improvements
- **Config: ASD-160 branch** — Remote configuration levels (Aux < Pre-Alarm < Fire < Fire 2) seeded from the Alarm Factor worksheet; Fire 2 0.00914–7.62 %obs/ft; ASD-160s are no longer listed as MiniLasers.
- **Report band: brand logo and brand label**; Excel report header gets a Brand row (no fills).
- **Quick Start one-pager (quickstart.html) and in-app Toolbox Quick Start** carry current screenshots.
- `tools/build.py` is marked retired (index.html is the source of truth); `src/toolbox.js` and `src/tb-asd160.js` are exact copies of the inline blocks (tested).
- **Manual battery or capacity pick turns Auto Battery Sizing off** (with a toast); the controls stay selectable in Auto.
- **Networked ASD-160s count toward the 127-module SenseNET limit** and share the network's addresses (duplicates flagged).
- **Unidentified power source → ⚠ Incomplete** everywhere: sheet status and amber dot, side panel, print stamp and project file; the Report adds a blank “Power source identified” item to every power supply sheet and an amber banner.
- **A manual alarm factor on an ASD-160 row is what gets validated** ("alarm factor N … exceeds … — lower the alarm factor").
- **Excel Detail sheet: Brand row** under Project (no fills). **Brand logo in the KGS print band** (PDF / HTML / print preview).
- Harmonized with Battery Calculator 02.02.000.
- **UL opt-in for ASD-160** ("Apply UL 268 7th edition to ASD-160 units") in the FM and Custom standard notes, shown when the design has an ASD-160.
- **Brand selector (Edwards | Kidde Commercial).** First field in Project Settings; part numbers, supply labels, BOM, logos and report titles follow the brand; the last choice is remembered for new projects.
- **Per-sheet supply variant** (120 V / 220–230 V / ULC), tamper and seismic accessories, and **FACU powers these ASDs** with a power-source prompt (in-house / third-party / unidentified — unidentified keeps the sheet Incomplete).
- **ASD-160 (Micra25 / Senator 25).** + Add ASD-160 and PipeCAD .pl import (MICRA25): 250 mA, dedicated AUX circuit, Remote configuration, networked address 1–127; UL scopes cap SFD/OAP at 1.28 %obs/ft with R-AF7.
- **Battery 12V6A5 (7.2 Ah)** is manual-only, with a too-small advisory.
- **AUX/ribbon rules.** Max 4 AUX per power supply; each ribbon run holds max 4 detectors + 1 display; a detector-started run counts that detector; hybrid clusters may use any number of runs; own-AUX modules are not runs. FAQ text no longer says "2-segment/4-follower".
- **View menu check marks** for Project Settings bar, Sheet sidebar and Results panel.
- **Help revised** with current screenshots, captured headless from the built app with example data (dark UI). New How Do I and FAQ topics: brand, ASD-160, Print Quick Start, ribbon/AUX limits, 12V6A5, 1.28 cap.
- **Help ▸ Print Quick Start.** 2-page letter Quick Start with numbered steps and screenshots, KGS print palette, printed from its own document (no Help chrome).
- Shared modules: modulaser-project.js 1.6.0, MASD engine 1.2.0. Hash policy: new fields at their defaults are stripped, so unchanged 02.01.000 files keep their hash.

### QA audit
- **QA/Auditor verdict: GO (final)** (2026-10-19, on Calculator 4f4c5e5 / Toolbox 7cd58c1 / Report 3303031; `qa/qa-build-review-02.02.000.md`). Brent approved the release 2026-10-19 3:59 PM CT.
- **Findings fixed before release:** F4 UI test that Auto never picks 12V6A5; F6 plan/decisions log completed (C1 #59–#67, plan rev 4.23c); F8 ribbon scope documented; F10 Toolbox Help uses Toolbox-specific menu shots; F11 two Help images replaced to show what the text names; F12 stale Report FAQ versions; Quick Start step 9 nit; paperwork (verbatim quotes).
- **Suites green:** 37 suites, 986 checks, 0 FAIL, 0 SKIP (Calculator, Toolbox and Report, including the Calculator 02.02.000 suites run against the Toolbox).
- **Deferred:** per-cluster total flag → 02.02.001.

## v00.02.000 — MiniLaser ASD support, harmonized with Battery Calculator 02.01.000 (2026-10-16) · pre-release, released 2026-10-17

### Recent improvements
- **Harmonized with Battery Calculator 02.01.000: MiniLaser ASD (FHSD8075-ULF).** Each sheet gets a Standalone ASDs table; MiniLasers are never addressed. Each MiniLaser uses its own dedicated AUX circuit (35 mA overhead, 3.0 A limit), and overflow recommends adding a power supply. You can add 0–2 I/O Expansion Modules (9-30521); the 9-30520 housing is added automatically. **+ Add MiniLaser** offers the Pre-engineered picker (Tables 13–31) or Manual config. A blank fan speed shows amber with ⚠. On .pl import, SOLO detectors become MiniLasers, with alarm-factor derivation and DIP/Remote advice.
- **Config mode: MiniLaser devices.** The relays are R1 Fault relay (fixed, fail-safe, locked), R2 Relay output 1 (Prealarm) and R3 Relay output 2 (Fire Alarm). Ports are IN1 (15 kΩ supervised) and expansion X1/X2 OUT1–5 / IN1–2. Application (Table 35), alarm delay and flow-fault level/delay start blank, with no numeric prefills. A flow fault of 40% on a UL/FM application gives a warning.
- `masd-engine.js` 1.1.0, `modulaser-project.js` 1.5.1. New tests: `tests/mlp_minilaser_test.js` (39) and `tests/minilaser_config_test.py` (9).
- **Current Draw Reference (Brent 10-16).** The MiniLaser (FHSD8075-ULF) has its own table in the in-app Help Module Current Draw Reference, the Battery Calculator's `ModuLaser_Current_Draw_Reference` html/xlsx: fan speeds 1–10 draw 120, 134, 157, 180, 200, 230, 255, 285, 320 and 365 mA, with alarm equal to the fan draw.
- **MiniLaser-only sheets** no longer show the "No modules yet" guide. They still count as having devices, and a blank MiniLaser fan speed still keeps the sheet *Needs entry*.
- **Multi-supply arrangement.** MiniLasers aren't addressed, so they are never part of the address/network grouping. Arrangement export moves clusters only, so MiniLasers stay on the original sheet. Arrangement 1 adds their mA and their dedicated AUX circuits and shows a "MiniLasers (stay on this sheet)" row.
- **Arrangement with 2+ clusters (Brent 10-16, 9:02 PM).** The "Disparate clusters must not share power pathways" warning stays, but it no longer withholds the Recommended Power Supply Arrangement: the card (with MiniLasers on Arrangement 1) and its export show alongside the warning. Other flags still withhold it. Help/FAQ updated.
- **QA delta (02.01.000 review).** Same as Calculator: M p.66 MiniLaser pipe limits are enforced, the Disparate-clusters warning on Edwards A/BPS fires only when clusters actually share a pathway, and the Config-mode 40% flow warning reads "UL/FM requires ≤20% (M p.71)". Tests: `mlp_minilaser_test.js` gets xmldom from the Toolbox's own `electron` devDependency (no Calculator checkout), `mlp_sync_test.py` takes `CALC_DIR`/`REPORT_DIR`/`MLP_SRC`/`ENGINE_SRC` to check pinned commits, and `minilaser_config_test.py` honours `MLP_TEST_OUT`.
- **Final (QA GO + Brent).** Same as the Calculator: the Disparate-clusters message is a warning only (sheet can pass; recommendation, arrangement, BOM and Export shown), and the A/BPS dead branch is removed. MLP **1.5.1**. `mlp_sync_test.py` defaults to the Toolbox under test (its own shared-module files as reference, sibling checkouts). `mlp_minilaser_test.js` skips the Example Shaft checks when the fixture is absent.
- **Release prep (QA delta 3).** Service-worker cache bumped to `masd-toolbox-00-02-000-r2`. Same side-panel styling and count change as the Calculator. `mlp_sync_test.py` prints a clear message when a sibling repo or source is missing, and also checks `/workspace/mlp` when present. Fixture tests report `SKIPPED` and fail when `REQUIRE_FIXTURES=1`. README now says MLP 1.5.1.
- **MiniLaser detection class from a .pl (Brent-approved):** area override → project standard → SFD. Max transport time is no longer used. **A MiniLaser imported from a .pl is non-pre-engineered by default** (Brent: pre-engineered units don't need a PipeCAD design), so elbow/tee counts no longer decide it. The recommendation is DIP only when the fan is 2/4/7/10 and the AF is 2/4/6/8, otherwise Remote. Tick **Pre-engineered** on an imported row to override; DIP is then recommended (saved with the project and carried in `.mlproj.json` as `minilaser.preEngineered`).

### QA audit
- **QA/Auditor verdict: GO** (Delta review 4, 2026-10-17, on Calculator c59a78c / Toolbox e3dfb68 / Report b7cbadb; `qa/qa-report-02.01.000.md`). No blocking findings.
- **Findings fixed before release:** F1 MiniLaser pipe limits (manual p.66) enforced; F3/F4 test hygiene (fixture tests report SKIPPED, fail with `REQUIRE_FIXTURES=1`; repo-under-test defaults); F5 40% flow wording (PASS with a warning note); F6 print font; F8 Disparate-clusters made a warning only (sheet can pass; nothing withheld); dead A/BPS branch removed; `modulaser-project.js` 1.5.1; side-panel flag vs warning styling; service-worker cache bumps; README versions.
- **Suites green:** minilaser 46, regression set green, v2 64, toolbox_test 139, report_audit 31, save_import 6, minilaser_config 9, mlp_sync PASS, sens_rule 14, mlp_minilaser 48.
- **Remaining non-blocking nits:** `mlp_sync_test` silently skips `/workspace/mlp` when it's absent and doesn't compare the engine build source; the Calculator root build registers a `sw.js` that isn't present at the repo root (pwa/ and docs/ builds have one; predates this release).

## v00.01.003 — Harmonized with Battery Calculator 02.00.005 (2026-10-16) · pre-release, released 2026-10-16

**In-app revision:** 00.01.003_261016 · **Engine:** MASD engine 1.0.0 (unchanged) · **Calculator lineage:** Battery Calculator 02.00.005

### Recent improvements
- **Harmonized with Battery Calculator 02.00.005** (engine 1.0.0 and `modulaser-project.js` 1.4.0 unchanged).
- **Auto addressing** (Calculator): **new build** — Networked or Standalone?, then Auto address? Yes / No; **existing project** gaining modules (new .pl, new sheet, more modules, Merge) — Continue addressing per previous sheets (only the new modules; SenseNET 2 past 127; new Standalone sheets from 1), Manually address, or Re-auto address entire project. After a .pl import: Confirm Settings? → (mode) → address. Logged, one-step Undo.
- **Excel CAD Schedule** tables start with each sheet's Standby time (h), Alarm time (min) and Safety margin (%).
- **Cluster Validation Report print redesign** (Brent approved): KGS palette, Entry point / Ribbon Path / status chips, running header and footer with Page n of N on every page, repeated table headers, rows never split, no wrapping.
- **Incomplete shown in amber with ⚠** (Brent 6:07 PM): status, empty-sheet Ah / battery / PSU recommendation, sidebar, Live Results, print (incl. legend), Word, the withheld PSU recommendation and the CVR pending chip; needs-entry amber on screen, #8a5a00 on #fdf3dc in print/Word; Excel has no fills or colour (plain ⚠ Incomplete); `.mlproj.json` keeps the plain status.

### QA audit
| Date | Commits audited | Result | Report |
|---|---|---|---|
| 2026-10-16 | Toolbox f04f862 / Calculator 57230cc | QA/Auditor PASS (GO), no blocking findings. Toolbox suites green: amber 22, auto_address 47, cad 6, cvr 12, addrlog 27, sensenet 30, empty 17, confirm 24, toolbox_test 139, report_audit 31, save_import 6, sens_rule 14, mlp_sync OK | `qa/qa-report-02.00.005.md` |

## v00.01.002 — Harmonized with Battery Calculator 02.00.004 (2026-10-15) · pre-release, released 2026-10-16

**In-app revision:** 00.01.002_261015 · **Engine:** MASD engine 1.0.0 (unchanged) · **Calculator lineage:** Battery Calculator 02.00.004

### Recent improvements
- **Valid defaults are no longer flagged** in the Calculator: Design Basis, Standby (h), Alarm (min), Ambient Temp., Module Type, Power, Addressing, supply mode, edition and margin keep their defaults without amber and no longer make a sheet *Needs entry*; only empty required fields are amber. Confirm defaults kept but no longer needed (harmless).
- **New calculator sheets start with no modules**; an empty-state guide offers **Import .pl…** or **+ Add Display / + Add Detector**. An empty sheet is *Needs entry* / INCOMPLETE.
- **Standby (h) / Alarm (min)** boxes no longer cut values off at ≤ 1366 px.
- **Addressing per mode:** Networked sheets share an address pool per SenseNET network (1–127 on each network); a Standalone sheet is its own pool (1–9, per sheet) and may reuse other sheets' addresses; duplicates inside a Standalone sheet are still flagged.
- **Mixed Networked + Standalone:** banner with **Make all Networked…** / **Make all Standalone…**, confirm first, optional re-address (Networked 1…N across sheets; Standalone 1…n per sheet; module order, ribbon/AUX/cluster unchanged).
- **Imports keep addresses** and list per-mode conflicts after import.
- **SenseNET networks (up to 127 modules each).** Each Networked sheet has a SenseNET network number (selector on the Addressing row, SN1/SN2 tag in the sidebar, *Networked · SenseNET n* in print/Word/Excel settings, saved per sheet; older files default to network 1). Past 127 modules, whole sheets (last in sheet order first) move to SenseNET 2, 3… and are addressed from 1, and you're told a new network was added and the design must include its infrastructure. A sheet never spans networks. Duplicate addresses are checked per network. Networked re-address: 1–127 on SenseNET 1 in sheet order, then 1… on SenseNET 2. Imports keep networks; an import over 127 offers *Move overflow to a new SenseNET network*. Shared `modulaser-project.js` unchanged (the network rides in the calculator state inside `.mlproj.json`).
- **Address change log + Undo (QA F1/F2).** Unify / re-address, SenseNET network moves and Standalone clears are written to **Edit → Address change log…** (saved with the project and in `.mlproj.json` calculator state) with each module's address and network before and after, and can be undone in one step (Undo bar above the sheet, or Ctrl+Z outside text fields). Make all Standalone lists the addresses above 9 it will clear before you confirm and reports them afterwards; switching one sheet to Standalone does the same. Undo is disarmed by the next manual address/mode/network edit and Ctrl+Z is ignored while any field or dropdown has focus. Automatic SenseNET moves happen only when a network's count rises past 127; while a network is over 127 (e.g. after undoing a move) the flag stays and a **Move overflow to SenseNET n** banner offers the move. Clear file clears the address log.
- **Confirm Settings? after a .pl import (Brent 10-16).** After **Create sheets**, a prompt summarizes the settings applied during import (Design Basis, standby/alarm, ambient temperature, margin, edition, supply capacity/mode, files → sheets/modules). **Confirm** marks every item configured during the import as confirmed, so only genuinely empty fields (e.g. addresses) stay amber. **Revise import** rolls the import back and reopens the wizard on the review step with every choice kept. (Linked-file updates are unchanged.)
- **Design Basis and Ambient Temperature start on "- Select -".** It's an empty required selection: amber, and the sheet stays INCOMPLETE/Needs entry until chosen (no de-rating meanwhile, so no NaN). The .pl wizard requires both in step 1. Saved files keep their values; legacy files without these keys keep the old defaults (NFPA 72 Voice, 77 °F). Until a sheet has modules it shows **Incomplete** for battery Ah everywhere: results card, Live Results, sidebar, print, Word and Excel. In `.mlproj.json` the PSU has `requiredAh: null` and `incomplete: true`, with no battery and a blank PSU model/enclosure. There's no PASS and no battery/PSU recommendation. The Field Report imports it with Required Ah blank, and the shared modules are unchanged.
- Engine (MASD engine 1.0.0) unchanged. Shared `modulaser-project.js` 1.4.0 (bumped from 1.3.0 for SenseNET networks: each device in .mlproj.json carries its network, the shared validator checks duplicates per network and the 127 limit per network; byte-identical in the Calculator, Toolbox and Field Report 02.00.002).

### QA audit
| Date | Commits audited | Result | Report |
|---|---|---|---|
| 2026-10-16 | Calculator 951f769 / Toolbox 956e1e1 / Report de287fb | QA 2026-10-16: Calculator 951f769 / Toolbox 956e1e1 / Report de287fb GO | `qa/brief-02.00.004.md` |

---

## v00.01.001 — Needs-entry highlight fix (2026-10-14) · pre-release

**In-app revision:** 00.01.001_261014 · **Engine:** MASD engine 1.0.0 (unchanged) · **Calculator lineage:** Battery Calculator 02.00.003

### Recent improvements
- Needs-entry fields now outlined in **amber** (2px), matching the amber *Needs entry* sidebar dot; the old 1px soft-blue outline was invisible on the dark theme
- **Show next ›** in Live Results jumps to each field that still needs entry
- Print label grey `#747574` → `#6b6c6b` (WCAG AA contrast)
- Live web / PWA URL (https://thebmgatkgs.github.io/MASD-Engineering-Toolbox/) added to README, Quick Start and in-app Help; verified installable there (manifest start_url ./index.html, scope ./, service worker active, no Chrome installability errors)
- Re-importing a file saved by this Toolbox no longer shows a false *Older revision* warning (QA F1); Toolbox files are compared with the running Toolbox revision, older ones still warn. Calculator lineage 02.00.003 (also written into `.mlproj.json`)
- **Already-saved .html files keep the code they were saved with.** Opening one of them directly still shows the old look. To get these fixes, open 00.01.001 and bring the data in with **File → Import Calc** (or Import project).
- Module table: Module Type DISP-MIN / DISP-STD / DISP-CMD / DETECTOR, 2-digit Cluster, Power *Own circuit* / *Ribbon Path*; no truncation or wrap on screen, in print or in Word (Model, Cluster and Power columns added to printed/Word module tables)

### QA audit
| Date | Commits audited | Result | Report |
|---|---|---|---|
| 2026-10-14 | Calculator 43d5a23 · Toolbox 7d1cfec | **QA 2026-10-14: Calculator 43d5a23 / Toolbox 7d1cfec GO-conditional; Word header wrap fixed in final** | `qa/qa-needs-entry-2026-10-14.md` |
| 2026-10-14 | Calculator d34555b · Toolbox 209f54f | **QA 2026-10-14 final: Calculator d34555b / Toolbox 209f54f GO** | `qa/qa-needs-entry-2026-10-14.md` |

QA findings fixed after that audit: Toolbox false "Older revision" warning when re-importing its own saved file (F1); cross-sheet Cluster hint overflow (F2); "No cluster display" button text (F3); Word default font, fixed table layout and spanned summary rows (F4); a hidden field counted on new sheets, 19 instead of 18 (F5); stale lineage/docs (F6); tests extended to every sheet, imported through the app, Word render checked (F7). Final: Word Standby mA / Alarm mA columns widened to 1100 twips so the header no longer wraps; the summary row shows 'Status:' again.

---

## v00.01.000 — First build (2026-10-13) · pre-release

**In-app revision:** 00.01.000_261013 · **Engine:** MASD engine 1.0.0 · **Project file:** modulaser-project 1.3.0 · **Calculator lineage:** Battery Calculator 02.00.002

### Highlights
- **One app for design and battery sizing.** The Battery Calculator is built in, with the same engine and results.
- **Mode switch** per project: Config only, Calculator only, or Both.
- **Device configuration** for every detector and display, seeded from the performance class, with a source badge and citation on every value.
- **Performance Criteria** per project: pick a Referenced standard — NFPA presets apply UL 268 thresholds and state UL 268, 7th Edition; FM DS 5-32/5-48 are FM only; BS 5839-1 (as in the calculator) and Custom are engineer to define. Cited values prefilled, the rest engineer-confirmed with references; narrative, Engineer of Record and spec reference printed in the Report.
- **Legacy imports** of every calculator save and Excel export since 01.04, migrated to `.mlproj.json` with a report of what didn't map.
- **Field-change loop** with the Commissioning Report 02.00.001: verify, re-check, PipeCAD change list, auto-verify from the new `.pl`, QA approval.
- **Reports:** Configuration schedule, Field Change / As-Built, PipeCAD change list, Migration report.
- **Offline everywhere:** inline fonts and icons, PWA, Windows installer.

### Recent improvements
- Toolbox reports in PDF, HTML, Word and Excel
- Fire 1 checked against the class FM/UL hole limit (App. A, printed p.113)
- Prealarm replaces the non-existent "Action" level
- Flow-fault delay seeds at the manual's 120 s (Table 29, p.76)
- SHA-256 design and site hashes in the project file
- Searchable How Do I… entries for modes, config, legacy and the field-change loop

### QA audit
| Date | Commit audited | Result | Issue |
|---|---|---|---|
| 2026-10-13 | none for the Toolbox (new); shared parts in Battery Calculator cc55189 and Report 6854f2e | Defaults citations FAIL → fixed · Example Project rule PASS · Audit trail FAIL → fixed · Quick Start version FAIL → fixed | [Toolbox #1](https://github.com/theBMGatKGS/MASD-Engineering-Toolbox/issues/1) |
| 2026-10-13 re-check (8:28–8:45 PM ET) | e15af39 | **CONDITIONAL PASS** — fixed after re-check: stable design hash, mis-cited table number removed, UL 268 confirmation required, UL thresholds (≤60/43/43 s), sign-off order enforced, name-gated edits, append-only log, ASAG44201 replaced by NFPA 76-2024 clauses, Quick Start 02.00.001+, legacy Ah checks | [#1](https://github.com/theBMGatKGS/MASD-Engineering-Toolbox/issues/1) |

**Fixes included:** corrected citations and labels; changes/approvals/unknown keys preserved; SHA-256 hashes; Saved-by user name; Quick Start version text.
**QA re-check (2026-10-13):** CONDITIONAL PASS; post-re-check fixes listed above and in the revision log.
**Final verdict:**

QA audit 2026-10-13, final re-check of commit c42156a (clean tree). **PASS (pre-release).** Tests: toolbox_test 139/139, shared-file and engine parity 2/2. Verified: Config/Calculator/Both modes, engine byte-identical to the Battery Calculator, legacy imports (15 fixtures) with Ah checks, sign-off order technician → designer → QA enforced (no manual status, real names required, QA ≠ designer), reopen keeps verifier history, QA overrides logged with a reason, "Complies with UL 268, 7th Edition" printed only after engineer confirmation. Note: the UL 268 thresholds (VEWFD 1.0/60 s, EWFD 1.5/43 s, SFD/OAP 2.18/43 s) are per Brent and not verified by QA. EWFD 1.5 %obs/ft comes from NFPA 76-2024 8.5.3.2.1.3, not from a UL 268 range (Range 2 is 0.05–2.18 %obs/ft, 3–43 s; Open Area 1.70–2.18, 6–43 s, Install Manual App. A p.113). Issue: https://github.com/theBMGatKGS/MASD-Engineering-Toolbox/issues/1

QA delta re-check 2026-10-13, commit 4878e0e (clean). **PASS (pre-release).** Verified: ≤ rule and targets, UL 268 ranges with lower limits (EWFD capped at 1.5 per NFPA 76, labelled as such), NFPA 318-2025 §11.1.3 cleanroom citations, offline Quick Start, shared modulaser-project.js and engine identical across apps. Tests: sens_rule 14/14, toolbox_test 139/139 and report_audit_test 31/31 (committed tests). Final pre-tag pass 2026-10-13 (10:02–10:40 PM ET): Calculator 6adde0d / Report 5448488 (release a32d988) / Toolbox 8aa707a — GO; sens_rule 14/14; committed tests pass (release commits differ from these only by this release-note line).

