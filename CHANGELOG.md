# Changelog

All notable changes to the MASD Engineering Toolbox. Format `MM.mm.rrr` (date `YYYY-MM-DD`). Major/minor are set by the
document owner; the revision counter increments per distinct change. Generated from the in-app Revision Log
(`AMENDMENTS` in `index.html`), which is the source of truth. Per-release summaries: [RELEASE_NOTES.md](RELEASE_NOTES.md).

## 00.01 — 2026-10-13

- **00.01.000** (2026-10-13): First build (pre-release; 01.00.000 reserved). Absorbs Battery Calculator 02.00.002 (same UI, MASD engine 1.0.0, same .pl import). Adds: per-project mode switch (Config / Calculator / Both); Config (design) mode — Alert, Prealarm, Fire 1, Fire 2, delays, latching, flow-fault limits and delay, day/night, LDD, I/O assignments, display settings — seeded from the performance class with manual / typical – unverified / design source badges and citations; legacy import of every calculator format (Save As .html 01.04–02.00, state JSON, Excel 01.04–02.00) with a migration report; Performance Criteria (per-project basis with per-Area/Group overrides, UL 268 7th Edition statement and UL least-sensitive limits VEWFD 1.0 / EWFD 1.5 / SFD-OAP 2.18, cited-only prefill for FM/NFPA bases with engineer-confirmed values and references, auto-drafted narrative confirmed by the engineer, EOR name and spec reference; unresolved criteria block export); field-change loop (verify/reject, battery re-check, PipeCAD change list, .pl auto-verify, technician → designer → QA approvals); Toolbox reports (Configuration schedule, Field Change / As-Built, PipeCAD change list, Migration report) as PDF/HTML/Word/Excel; offline Quick Start; PWA and Windows installer. Shared modulaser-project.js 1.2.0 (SHA-256 design and site hashes, unknown-key pass-through, metric hole-sensitivity warning, corrected citations).

  **QA audit** — date 2026-10-13 · commit audited: none for the Toolbox (shared parts in Battery Calculator cc55189 and Report 6854f2e) · issue: none yet for the Toolbox (related: [Calculator #1](https://github.com/theBMGatKGS/ModuLaser-Battery-Calculator/issues/1), [Report #8](https://github.com/theBMGatKGS/ModuLaser-Commisioning-Report/issues/8))
  - Defaults citations: **FAIL → fixed** (App. A p.113 hole limits, no "Table 45"; flow delay 120 s Table 29 p.76; Prealarm not Action; unsourced values typical – unverified)
  - Example Project worst-hole rule: **PASS**
  - Audit trail: **FAIL → fixed** (pass-through of changes/approvals/unknown keys, SHA-256 hashes, Saved-by name)
  - Quick Start version text: **FAIL → fixed** (Export project needs Battery Calculator 02.00.001+)
  - Final verdict: [PENDING RE-CHECK — placeholder]
