"""Offline Quick Start one-pager (no CDN: inline SVG icons, inline IBM Plex fonts).
Produces docs/quickstart.html (standalone) and returns an in-app Help fragment."""
import html
VER='00.01.000'
I={ # 24px stroke icons, inline SVG
 'pipe':'<path d="M3 7h10a4 4 0 0 1 4 4v10"/><path d="M3 11h8a2 2 0 0 1 2 2v8"/>',
 'sliders':'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
 'battery':'<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2M6 11v2M10 11v2"/>',
 'send':'<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
 'clip':'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3h6v3H9zM9 12l2 2 4-4"/>',
 'check':'<path d="M20 6 9 17l-5-5"/>','x':'<path d="M18 6 6 18M6 6l12 12"/>',
 'loop':'<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
 'shield':'<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>',
 'file':'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
}
def ic(n,c='currentColor',s=20): return f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{I[n]}</svg>'
STEPS=[
 ('tb-qs-modes','pipe','1 · PipeCAD designer','Name Floors as Areas/Groups. Keep detector names ≤16 characters including spaces (display limit). Set display type (Standard/Minimum/Command = partNumber 0/1/2). Place PSU and Battery objects where they will be mounted. Set aspirator speed and transit-time class (60/90/120 s = VEWFD/EWFD/SFD). Run the calculation, then export the .pl — addresses export as 0, that is expected.'),
 ('tb-qs-config','sliders','2 · Toolbox — Config','Pick the mode (Config, Calculator or Both; saved per project). Import .pl. Each detector and display gets Alert/Prealarm/Fire 1/Fire 2, delays, latching, flow-fault limits and delay, day/night, LDD, I/O assignments and display settings, seeded from the performance class. Badges: <b>manual</b> = stated in the ModuLaser Install Manual (flow ±20% and 120 s flow-fault delay, Table 29 p.76); <b>typical – unverified</b> = must be checked; <b>design</b> = set by you. Then set <b>Performance Criteria</b>: UL market (US default) states UL 268, 7th Edition and applies VEWFD 1.0 / EWFD 1.5 / SFD-OAP 2.18 %obs/ft (strictly less than); any other basis needs each value entered, referenced and confirmed. Confirm the auto-drafted narrative and enter the Engineer of Record and spec reference — Export project is blocked until done.'),
 ('tb-qs-calc','battery','3 · Toolbox — Battery calc','Same engine as the Battery Calculator (MASD engine 1.0.0). Set battery factors, assign PSUs (≤4 detectors + 1 display, 65 Ah limit, never shared across Areas/Groups), set SenseNET addresses. File → Export project writes the .mlproj.json. Old calculator files and Excel exports: File → Import legacy calc / Excel… (migration report shows anything that did not map).'),
 ('tb-qs-field','clip','4 · Commissioning Report','Import project: devices, PSUs, batteries, addresses, pipe data and your configuration values arrive prefilled (typical values stay flagged). Every site change to a design value is logged — field, old/new, who, when, why, photo. Technician signs; print the Field Change / As-Built report; export the project back.'),
 ('tb-qs-loop','loop','5 · Toolbox — Verify & close','Import the returned project, open Field changes: Verify & apply or Reject each change; the battery calc re-runs. Print the PipeCAD change list, update PipeCAD, import the new .pl — matching changes verify automatically. QA/Auditor approves; name, date and status are stored in the file.'),
]
DO=['Name Floors as Areas/Groups; keep names ≤16 characters','Verify every <i>typical – unverified</i> value before handoff','Send the .mlproj.json and the .pl together','Re-import the updated .pl after PipeCAD changes']
DONT=['Share a PSU across Areas/Groups','Exceed 4 detectors + 1 display or 65 Ah per PSU','Edit addresses in PipeCAD (set them in the Toolbox)','Approve as QA with PipeCAD changes still pending .pl']
CHECK=['Mode chosen for the project','Every device configured, no red errors','Typical values verified','PSUs assigned, addresses set, all PASS','.mlproj.json exported with the .pl','Field changes verified / rejected','PipeCAD change list closed by new .pl','QA approval recorded']
OWN=[('PipeCAD','layout, pipes, names'),('Toolbox','configuration, PSUs, batteries, addresses, change approval'),('Report','site results and field changes')]
def fragment():
    st=''.join(f'<div class="tbq-step" id="{i}"><div class="tbq-ic">{ic(n,"#4aa3df",22)}</div><div><div class="qs-step-title">{t}</div><p>{b}</p></div></div>' for i,n,t,b in STEPS)
    return f'''<div class="help-subsection" id="help-tb-quickstart"><h3>Quick Start — MASD Engineering Toolbox</h3>
<p class="tbq-lead">Design → configure → size batteries → hand off → log site changes → verify and approve. One project file (.mlproj.json) carries it all.</p>
<div class="tbq-steps">{st}</div>
<div class="tbq-cols"><div><h4>{ic("check","#2ea043",16)} Do</h4><ul>{"".join(f"<li>{x}</li>" for x in DO)}</ul></div><div><h4>{ic("x","#e5534b",16)} Don't</h4><ul>{"".join(f"<li>{x}</li>" for x in DONT)}</ul></div><div><h4>{ic("shield","#4aa3df",16)} Checklist</h4><ul class="tbq-ck">{"".join(f"<li>☐ {x}</li>" for x in CHECK)}</ul></div></div>
<div class="tbq-own">{"".join(f"<span><b>{a}</b> = {b}</span>" for a,b in OWN)}</div>
<p class="tbq-lead"><a href="quickstart.html" target="_blank" rel="noopener">Open the printable one-pager</a></p></div>'''
FRAG_CSS='''#help-tb-quickstart .tbq-lead{font-size:12.5px;color:var(--text-dim)}.tbq-steps{display:grid;gap:10px;margin:10px 0}.tbq-step{display:flex;gap:10px;background:var(--panel-3);border-left:3px solid var(--accent);padding:9px 12px;border-radius:4px}.tbq-step p{margin:3px 0 0;font-size:12.5px;line-height:1.5}.tbq-ic{flex:none;padding-top:2px}.tbq-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;font-size:12.5px}.tbq-cols h4{display:flex;gap:6px;align-items:center;margin:6px 0}.tbq-cols ul{margin:0;padding-left:18px}.tbq-ck{list-style:none;padding-left:0!important}.tbq-own{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:12px;margin:12px 0;padding:8px 12px;border:1px solid var(--border,#333);border-radius:4px}'''
def standalone(fontcss):
    st=''.join(f'<section class="step"><div class="num">{ic(n,"#0C77BC",26)}</div><h2>{t}</h2><p>{b}</p></section>' for i,n,t,b in STEPS)
    return f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MASD Engineering Toolbox — Quick Start</title>
<style>{fontcss}
:root{{--bg:#0b0e12;--s:#12171e;--s2:#1a212b;--l:#2a3441;--ink:#e6edf3;--mut:#8b98a8;--acc:#0c77bc;--navy:#102645}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 "IBM Plex Sans",Segoe UI,sans-serif}}
header{{background:var(--navy);border-bottom:3px solid var(--acc);padding:22px 28px}}header h1{{margin:4px 0;font-size:26px}}.tag{{display:inline-block;font-size:11px;border:1px solid #3a5a85;border-radius:4px;padding:2px 8px;color:#b9c7d8}}header p{{margin:0;color:#b9c7d8}}
main{{max-width:1100px;margin:0 auto;padding:20px 28px}}.steps{{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}}@media(max-width:900px){{.steps{{grid-template-columns:1fr}}}}
.step{{background:var(--s);border:1px solid var(--l);border-top:3px solid var(--acc);border-radius:6px;padding:12px}}.step h2{{font-size:13.5px;margin:6px 0}}.step p{{font-size:12px;color:#c9d3de;margin:0}}
.cols{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}}@media(max-width:900px){{.cols{{grid-template-columns:1fr}}}}.box{{background:var(--s);border:1px solid var(--l);border-radius:6px;padding:12px}}.box h3{{display:flex;gap:6px;align-items:center;margin:0 0 6px;font-size:14px}}.box ul{{margin:0;padding-left:18px;font-size:12.5px}}.ck{{list-style:none;padding-left:0!important}}
.own{{margin-top:14px;display:flex;flex-wrap:wrap;gap:8px 22px;padding:10px 14px;background:var(--s2);border-radius:6px;font-size:12.5px}}footer{{text-align:center;color:var(--mut);font-size:11px;padding:14px}}
@media print{{@page{{size:letter landscape;margin:.35in}}body{{background:#fff;color:#1d1d1f;font-size:11px}}header{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}main{{padding:10px 0}}.step,.box{{background:#fff;border-color:#BFC4CA}}.step p{{color:#333}}.own{{background:#F2F2F2;-webkit-print-color-adjust:exact;print-color-adjust:exact}}}}
</style></head><body><header><span class="tag">Applies to MASD Engineering Toolbox {VER} · Battery Calculator 02.00.002 · Commissioning Report 02.00.001 · MASD engine 1.0.0</span>
<h1>MASD Engineering Toolbox — Quick Start</h1><p>From PipeCAD design to approved as-built: configure, size batteries, hand off, log site changes, verify and approve.</p></header>
<main><div class="steps">{st}</div><div class="cols"><div class="box"><h3>{ic("check","#2ea043")} Do</h3><ul>{"".join(f"<li>{x}</li>" for x in DO)}</ul></div><div class="box"><h3>{ic("x","#e5534b")} Don't</h3><ul>{"".join(f"<li>{x}</li>" for x in DONT)}</ul></div><div class="box"><h3>{ic("shield","#0c77bc")} Checklist before sign-off</h3><ul class="ck">{"".join(f"<li>☐ {x}</li>" for x in CHECK)}</ul></div></div>
<div class="own">{ic("file","#0c77bc",18)} {"".join(f"<span><b>{a}</b> = {b}</span>" for a,b in OWN)}</div></main><footer>Works offline — no web fonts or scripts are loaded. © The BMG</footer></body></html>'''
