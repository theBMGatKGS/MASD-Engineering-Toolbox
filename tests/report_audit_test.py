"""Report 02.00.001 audit-trail regression (QA 2026-10-13 §2c): real calc export + changes/approvals/unknown key."""
import asyncio, json, copy, os, sys
from playwright.async_api import async_playwright
URL=os.environ.get('RPT_URL','http://localhost:8765/index.html'); OUT='/workspace/tb/tests/out-rpt/'; os.makedirs(OUT,exist_ok=True)
SH='/workspace/toolbox-shots/'; os.makedirs(SH,exist_ok=True)
R=[]
def chk(n,c,i=''): R.append((n,bool(c))); print('PASS' if c else 'FAIL', n, i)
base=json.load(open('/workspace/mlpbuild/calc-export.mlproj.json'))
doc=copy.deepcopy(base)
doc['changes']=[{'id':'fc-qa-1','dev':doc['design']['devices'][1]['id'],'devName':doc['design']['devices'][1]['name'],'field':'cfg.fan','label':'Fan speed','design':'5','value':'6','by':'QA tech','at':'2026-10-13T12:00:00Z','why':'qa','photo':'','pipecad':True,'status':'verified','verify':{'by':'Designer','at':'2026-10-13T13:00:00Z','note':'ok'}}]
doc['approvals']={'technician':{'name':'QA tech','date':'2026-10-13','status':'submitted'},'designer':{'name':'Designer','date':'2026-10-13','status':'approved'}}
doc['futureKey']={'keep':'me'}
doc['design']['performance']={'market':'UL','basis':'UL 268','statement':'Complies with UL 268, 7th Edition','limits':{},'areas':{},'narrative':'QA narrative: very early warning for the data hall.','narrativeEdited':True,'narrativeConfirmed':True,'eorName':'J. Engineer, PE','specRef':'Section 28 31 00, 2.4.B'}
open(OUT+'in.mlproj.json','w').write(json.dumps(doc))
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1440,'height':900},accept_downloads=True); pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(URL); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_function('typeof saveProject==="function"')
    await pg.set_input_files('#importProj', OUT+'in.mlproj.json'); await pg.wait_for_selector('#dlg.show'); await pg.click('#dlgApply')
    await pg.wait_for_function('state.modules.length>0')
    await pg.evaluate("sessionStorage.setItem('mfr-technician','Pat Field')")
    i=await pg.evaluate("state.modules.findIndex(m=>m.design && m.design['cfg.fan'])")
    dv=await pg.evaluate(f"state.modules[{i}].design['cfg.fan']")
    nv=str(int(dv)+1)
    await pg.evaluate(f"s('modules.{i}.cfg.fan','{nv}')"); await pg.evaluate(f"s('modules.{i}.cfg.fan','{int(nv)+1}')")
    log=await pg.evaluate("state.editLog")
    chk('edit log entry has who/when/old/new', log and log[-1]['by']=='Pat Field' and log[-1]['old']==dv and log[-1]['new']==str(int(nv)+1) and log[-1]['at'], log[-1] if log else None)
    ch=await pg.evaluate(f"state.changes.filter(c=>c.status==='logged')")
    chk('field change logged against design value', len(ch)==1 and ch[0]['design']==dv and ch[0]['value']==str(int(nv)+1) and ch[0]['pipecad'], ch)
    j=await pg.evaluate("state.modules.findIndex(m=>m.type==='det')")
    await pg.evaluate(f"(()=>{{const m=state.modules[{j}]; m.perf.target=m.perf.target||'EWFD'; Object.keys(m.cfg).forEach(k=>{{}}); m.typical={{'cfg.alert':true,'cfg.action':true}}; confirmTypical(m);}})()")
    c=await pg.evaluate("state.editLog.filter(e=>e.kind==='confirm-typical')")
    chk('typical confirmation logged with who/keys', c and c[-1]['by']=='Pat Field' and 'cfg.alert' in c[-1]['keys'], c)
    await pg.evaluate("openFieldChanges()"); await pg.screenshot(path=SH+'rpt-field-changes-dialog.png')
    await pg.fill('#fcTech','Pat Field'); await pg.click('#fcSign'); await pg.screenshot(path=SH+'rpt-field-changes-signed.png')
    async with pg.expect_download() as d: await pg.evaluate('saveProject()')
    v=await d.value; pth=OUT+'out.mlproj.json'; await v.save_as(pth); o=json.load(open(pth))
    chk('Save keeps imported field change (verified)', any(x['id']=='fc-qa-1' and x['status']=='verified' for x in o.get('changes',[])))
    chk('Save keeps new logged change', any(x['status']=='logged' for x in o.get('changes',[])))
    chk('Save keeps designer approval', o.get('approvals',{}).get('designer',{}).get('name')=='Designer')
    chk('technician sign-off stored', o['approvals'].get('technician',{}).get('name')=='Pat Field')
    chk('unknown top-level key kept', o.get('futureKey')=={'keep':'me'})
    chk('savedBy has the user name', o['savedBy'].get('name')=='Pat Field', o['savedBy'])
    chk('design hash is SHA-256', o['design']['hash'].startswith('sha256:') and len(o['design']['hash'])==71, o['design']['hash'])
    chk('Save keeps Performance Criteria (EOR, spec, narrative)', o['design'].get('performance',{}).get('eorName')=='J. Engineer, PE' and o['design']['performance'].get('specRef')=='Section 28 31 00, 2.4.B' and 'QA narrative' in o['design']['performance'].get('narrative',''))
    txt=await pg.evaluate("JSON.stringify(buildBlocks({}))")
    chk('Report summary prints UL statement, EOR, spec ref and narrative', all(k in txt for k in ['UL 268, 7th Edition','J. Engineer, PE','Section 28 31 00','QA narrative','2.18']), '')
    lim=await pg.evaluate("limits(state.modules.find(m=>m.type==='det'))")
    chk('Report limits use project Performance Criteria', lim is not None, lim)
    chk('site hash present', o['site'].get('hash','').startswith('sha256:'))
    chk('edit log in site', len(o['site']['state'].get('editLog',[]))>=2)
    chk('revision 02.00.001', '02.00.001' in o['savedBy']['rev'], o['savedBy'])
    chk('no page errors', not errs, errs)
    await b.close()
asyncio.run(main())
print('SUMMARY',sum(r[1] for r in R),'/',len(R)); sys.exit(0 if all(r[1] for r in R) else 1)
