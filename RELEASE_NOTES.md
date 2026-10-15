# Release Notes — MASD Engineering Toolbox

Release-by-release summaries, newest first. Releases are tagged `vMM.mm.rrr`; itemized history is in
[CHANGELOG.md](CHANGELOG.md) and in the app under **Help → Revision Log** (source of truth).

---

## v00.01.002 — Harmonized with Battery Calculator 02.00.004 (2026-10-15) · pre-release, not yet released

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
- Engine (MASD engine 1.0.0) and `modulaser-project.js` 1.3.0 unchanged.

### QA audit
| Date | Commits audited | Result | Report |
|---|---|---|---|
| pending | — | QA pending | `qa/brief-02.00.004.md` |

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

