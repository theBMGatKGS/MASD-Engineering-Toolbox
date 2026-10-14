# Release Notes — MASD Engineering Toolbox

Release-by-release summaries, newest first. Releases are tagged `vMM.mm.rrr`; itemized history is in
[CHANGELOG.md](CHANGELOG.md) and in the app under **Help → Revision Log** (source of truth).

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

QA delta re-check 2026-10-13, commit 4878e0e (clean). **PASS (pre-release), on condition that the updated tests are committed.** Verified: ≤ rule and targets, UL 268 ranges with lower limits (EWFD capped at 1.5 per NFPA 76, labelled as such), NFPA 318-2025 §11.1.3 cleanroom citations, offline Quick Start, shared modulaser-project.js and engine identical across apps. Tests: sens_rule 13/13, toolbox_test 139/139 and report_audit_test 30/30 using the updated test files. The committed copies in tests/ are stale and must be committed before the tag.

