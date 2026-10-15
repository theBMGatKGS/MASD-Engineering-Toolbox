"""Regression (00.01.001 QA F1): a file saved by this Toolbox must re-import without an 'Older revision' warning,
and an older Toolbox file (00.01.000) must still warn. Also checks the calc lineage written into .mlproj.json."""
import asyncio, os, sys, re, tempfile
from playwright.async_api import async_playwright
URL=os.environ.get('APP','file:///workspace/MASD-Engineering-Toolbox/index.html'); TMP=tempfile.mkdtemp()
R=[]
def chk(n,c,i=''): R.append(bool(c)); print('PASS' if c else 'FAIL',n,str(i)[:300])
async def first_prompt(pg, path):
    await pg.set_input_files('#import-calc-file', path); await pg.wait_for_timeout(900)
    t=await pg.evaluate("(document.querySelector('#prompt-title')||{}).textContent||''")
    bt=await pg.evaluate("[...document.querySelectorAll('#prompt-actions button')].filter(b=>b.offsetParent).map(b=>b.textContent.trim())")
    for b in bt:
        if re.search('Cancel',b): await pg.click(f'#prompt-actions >> text={b}'); break
    await pg.wait_for_timeout(200); return t, bt
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(accept_downloads=True); pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(URL); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_function('typeof tbSetMode==="function"')
    run=await pg.evaluate('runningRevisionFull()')
    async with pg.expect_download() as d:
        await pg.evaluate("document.getElementById('save-as-copy-btn').click()"); await pg.wait_for_timeout(600)
        await pg.click('.saveas-actions .btn-primary, #prompt-actions .btn-primary')
    v=await d.value; own=os.path.join(TMP,'self.html'); await v.save_as(own)
    parsed=await pg.evaluate("t=>{const r=parseImportedCalculatorHtml(t);return [r.revision,r.toolboxRevision]}", open(own).read())
    chk('self-saved file parses as running Toolbox revision', parsed[1] and parsed[1].startswith(run[:9]), [run, parsed])
    t,bt=await first_prompt(pg, own)
    chk('save then import: no Older revision warning', 'Older revision' not in t and not any('Import anyway' in x for x in bt), [t,bt])
    old=open(own).read().replace(run[:9]+'_', '00.01.000_')
    op=os.path.join(TMP,'old.html'); open(op,'w').write(old)
    t,bt=await first_prompt(pg, op)
    chk('older Toolbox file (00.01.000) still warns', 'Older revision' in t, [t,bt])
    lin=await pg.evaluate("TB_CALC_LINEAGE")
    chk('calc lineage is 02.00.004', lin=='02.00.004', lin)
    chk('no page errors', not errs, errs)
    await b.close()
  print('SUMMARY',sum(R),'/',len(R)); sys.exit(0 if all(R) else 1)
asyncio.run(main())
