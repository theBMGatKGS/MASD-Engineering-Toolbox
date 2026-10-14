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
**Final verdict:** [PENDING RE-CHECK — placeholder]
