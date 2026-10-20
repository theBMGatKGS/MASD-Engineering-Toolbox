"""02.02.001 (Brent 2026-10-20): SFD/OAP design target UI in the Toolbox (dark theme) — project-wide, Area/Group override, rejection, reference/initials, Fire 1 seed, older-project notice."""
import asyncio, os, sys, json
if not os.environ.get('TOOLBOX_DIR'):
    sys.stderr.write('ERROR: set TOOLBOX_DIR to the Toolbox checkout to test. Refusing to guess.\n'); sys.exit(2)
from playwright.async_api import async_playwright
import tempfile
OUT=os.environ.get('MLP_TEST_OUT') or tempfile.mkdtemp(prefix='mlp-test-'); SH=os.path.join(OUT,'sfd-shots'); os.makedirs(SH,exist_ok=True)
URL='file://'+os.environ['TOOLBOX_DIR'].rstrip('/')+'/index.html'
R=[]
def chk(n,c,i=''): R.append((n,bool(c))); print('PASS' if c else 'FAIL', n, str(i)[:300])
async def setv(pg, scope, k, v):
    await pg.fill(f'#tb-perf [data-tb-sfd={k}][data-scope="{scope}"]', v); await pg.dispatch_event(f'#tb-perf [data-tb-sfd={k}][data-scope="{scope}"]', 'change'); await pg.wait_for_timeout(80)
async def apply(pg, scope=''):
    await pg.click(f'#tb-perf [data-tb=sfd-apply][data-scope="{scope}"]'); await pg.wait_for_timeout(150)
    return await pg.evaluate('s=>{const r=document.querySelector(`#tb-perf .tb-sfd[data-scope="${s}"] .tb-msg`);return r?r.textContent:""}', scope)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1440,'height':900},device_scale_factor=2); pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(URL); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_function('typeof tbSetMode==="function"')
    # QA F2: synthetic example data only (no client names in screenshots)
    PLF=os.environ.get('SFD_PL','/workspace/build0202/fixtures/Example-Tower.pl'); txt=open(PLF).read()
    sys.path.insert(0, '/workspace/ModuLaser-Battery-Calculator/tests/regression'); import helpers as H
    H.T = os.path.dirname(PLF) + '/'; await H.import_files(pg, [os.path.basename(PLF)])
    btn=await pg.query_selector('#plw-overlay.open button.btn-primary, .pl-aux-foot .btn-primary')
    if btn: await btn.click(); await pg.wait_for_timeout(400)
    await pg.click('#tb-mode [data-mode=both]'); await pg.click('#tb-viewtabs [data-view=config]'); await pg.wait_for_timeout(250)
    await pg.evaluate('(()=>{const P=tbPerf(); P.sfdNotice=false; tbRenderConfig();})()')
    row=await pg.query_selector('#tb-perf .tb-sfd[data-scope=""]'); chk('project-wide SFD/OAP target row shown (UL default)', row is not None)
    st=await pg.evaluate('(()=>{const r=document.querySelector("#tb-perf .tb-sfd[data-scope=\\"\\"]"); return [r.querySelector("[data-tb-sfd=value]").value, r.textContent, getComputedStyle(r).backgroundColor, getComputedStyle(document.body).backgroundColor]})()')
    chk('default 2.00, published limits and pass/fail note shown', st[0]=='2.00' and 'ModuLaser 1.70–2.18' in st[1] and 'pass/fail stays' in st[1], st[:2])
    chk('dark theme (dark page background)', st[3].startswith('rgb(') and sum(int(x) for x in st[3][4:-1].split(',')[:3]) < 200, st[2:])
    await row.screenshot(path=os.path.join(SH,'sfd-01-default.png'))
    # rejection — out of range
    await setv(pg,'','value','2.30'); m=await apply(pg)
    chk('2.30 rejected with a message, not saved', 'Rejected' in m and '2.18' in m and await pg.evaluate('!tbPerf().sfdTarget'), m)
    await (await pg.query_selector('#tb-perf .tb-sfd[data-scope=""]')).screenshot(path=os.path.join(SH,'sfd-02-rejected-range.png'))
    # rejection — no reference
    await setv(pg,'','value','1.95'); m=await apply(pg)
    chk('1.95 without reference rejected', 'reference' in m and await pg.evaluate('!tbPerf().sfdTarget'), m)
    await setv(pg,'','ref','Spec 28 31 00 2.4.B'); m=await apply(pg)
    chk('1.95 without initials rejected', 'initials' in m and await pg.evaluate('!tbPerf().sfdTarget'), m)
    await (await pg.query_selector('#tb-perf .tb-sfd[data-scope=""]')).screenshot(path=os.path.join(SH,'sfd-03-rejected-initials.png'))
    await setv(pg,'','initials','bw'); m=await apply(pg)
    t=await pg.evaluate('tbPerf().sfdTarget')
    chk('1.95 with reference + initials saved project-wide', t and t['value']==1.95 and t['initials']=='BW' and 'saved' in m, [t,m])
    tbl=await pg.evaluate('document.querySelector("#tb-perf table.tb-io").textContent')
    chk('Performance table shows Target 1.95 + project target chip, max still ≤2.18', 'Target 1.95' in tbl and 'project target' in tbl and '≤2.18' in tbl, tbl[:300])
    await (await pg.query_selector('#tb-perf .tb-sfd[data-scope=""]')).screenshot(path=os.path.join(SH,'sfd-04-saved.png'))
    nar=await pg.evaluate('MLP.perfDraft(tbPerf(),["SFD"])'); chk('narrative draft (SFD class) cites target 1.95', 'SFD/OAP: target 1.95 %obs/ft' in nar, nar[:200])
    af=await pg.evaluate('(()=>{const c=MLP.miniLaserClass(tbPerf(),""); return [c.target, MLP.deriveAlarmFactor(8,"OAP",c).threshold, MLP.deriveAlarmFactor(8,"OAP",c).af]})()')
    chk('MiniLaser OAP alarm factor follows the project target 1.95 (8 holes → AF7)', af==[1.95,1.95,7], af)
    # Fire 1 seed follows on a UL project
    seed=await pg.evaluate('(()=>{const d=tbDevices().find(x=>x.kind==="detector"); if(!d) return null; const c=MLP.configSeed("SFD",d.kind,tbPerf(),d.area); return c.values.fire1})()')
    chk('Fire 1 seed (UL project, SFD) = 1.95', seed==1.95, seed)
    # print schedule
    sch=await pg.evaluate('JSON.stringify(tbReportModel("config"))')
    chk('Configuration schedule SFD/OAP cell prints target 1.95 with reference and initials', 'target 1.95 (Spec 28 31 00 2.4.B; BW)' in sch, sch[sch.find('SFD/OAP'):][:200] if 'SFD/OAP' in sch else sch[:200])
    # Area/Group override
    areas=await pg.evaluate('Array.from(new Set(tbDevices().map(d=>d.area).filter(Boolean)))'); A=areas[0] if areas else None
    chk('project has Areas/Groups (example data only)', A is not None and not any(('NDA' in x) for x in areas), areas)
    if A:
        await pg.evaluate('()=>{const d=document.querySelector("#tb-perf details"); if(d) d.open=true;}')
        await pg.check(f'#tb-perf [data-tb-perf-area="{A}"]'); await pg.wait_for_timeout(200)
        await pg.evaluate('()=>{const d=document.querySelector("#tb-perf details"); if(d) d.open=true;}')
        await pg.select_option(f'#tb-perf [data-tb-perf-k=standard][data-scope="{A}"]','SFD – FM DS 5-48'); await pg.wait_for_timeout(200)
        await pg.evaluate('()=>{const d=document.querySelector("#tb-perf details"); if(d) d.open=true;}')
        v=await pg.evaluate('s=>document.querySelector(`#tb-perf [data-tb-sfd=value][data-scope="${s}"]`).value', A)
        chk('FM Area override row: FM default 2.50 (UL project target not inherited)', v=='2.50', v)
        await setv(pg,A,'value','2.60'); m=await apply(pg,A)
        chk('FM Area 2.60 rejected (FM 3230 ≤2.50)', 'Rejected' in m and '2.50' in m, m)
        await pg.evaluate('()=>{const d=document.querySelector("#tb-perf details"); if(d) d.open=true;}')
        await (await pg.query_selector(f'#tb-perf .tb-sfd[data-scope="{A}"]')).screenshot(path=os.path.join(SH,'sfd-05-area-fm-rejected.png'))
        await setv(pg,A,'value','2.25'); await setv(pg,A,'ref','FM DS 5-48 / EOR'); await setv(pg,A,'initials','JD'); m=await apply(pg,A)
        lim=await pg.evaluate('s=>MLP.perfLimits(tbPerf(),s).SFD', A)
        chk('FM Area 2.25 saved; FM pass/fail stays 2.50', lim['target']==2.25 and lim['sens']==2.5 and lim['targetSrc']=='area', lim)
        seedA=await pg.evaluate('s=>MLP.configSeed("SFD","detector",tbPerf(),s).values.fire1', A)
        chk('Fire 1 seed in FM Area stays 2.5', seedA==2.5, seedA)
        await pg.evaluate('()=>{const d=document.querySelector("#tb-perf details"); if(d) d.open=true;}')
        await (await pg.query_selector(f'#tb-perf .tb-sfd[data-scope="{A}"]')).screenshot(path=os.path.join(SH,'sfd-06-area-fm-saved.png'))
    # reset
    await pg.click('#tb-perf [data-tb=sfd-reset][data-scope=""]'); await pg.wait_for_timeout(150)
    chk('Reset returns the project to 2.0', await pg.evaluate('!tbPerf().sfdTarget && MLP.sfdTarget(tbPerf(),"").value===2'))
    # export blocked on a stored out-of-range value
    iss=await pg.evaluate('(()=>{tbPerf().sfdTarget={value:2.4,ref:"x",initials:"BW",family:"UL"}; return MLP.perfIssues(tbPerf(),{kinds:tbSfdKinds()})})()')
    chk('stored out-of-range value listed as an issue (export blocked)', any('outside' in i for i in iss), iss)
    await pg.evaluate('(()=>{delete tbPerf().sfdTarget; tbRenderConfig();})()')
    # older project: one-time notice
    await pg.evaluate('(()=>{const P=tbPerf(); delete P.sfdSchema; delete P.sfdNotice; MLP.perfMigrate(P); tbRenderConfig();})()'); await pg.wait_for_timeout(150)
    nt=await pg.query_selector('#tb-perf .tb-sfd-notice'); chk('older project: one-time notice shown', nt is not None)
    if nt:
        await pg.screenshot(path=os.path.join(SH,'sfd-07-notice-and-row.png'), clip=await pg.evaluate('(()=>{const r=document.getElementById("tb-perf").getBoundingClientRect(); return {x:r.x,y:r.y+window.scrollY,width:r.width,height:Math.min(r.height,620)}})()'), full_page=True)
        await pg.click('#tb-perf [data-tb=sfd-notice-ok]'); await pg.wait_for_timeout(150)
        chk('notice dismissed and stays dismissed', await pg.query_selector('#tb-perf .tb-sfd-notice') is None and await pg.evaluate('tbPerf().sfdNotice===false'))
    chk('no page errors', not errs, errs)
    await b.close()
  f=[n for n,c in R if not c]; print(f'\n{len(R)-len(f)} passed, {len(f)} failed'); sys.exit(1 if f else 0)
asyncio.run(main())
