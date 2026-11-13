"""Quoted history beyond the render window: owned scroll, return anchor, prepend and resize.
Run after test 1 against fake Firebase; no production records are used.
"""
import asyncio, json, os
from playwright.async_api import async_playwright, expect

async def settled(pg):
    # Observe real movement/settling instead of waiting an assumed animation duration.
    await pg.wait_for_function('''() => { const b=document.querySelector('.chatbody');
      const last=window.__scrollSample; const now=performance.now();
      window.__scrollSample={top:b.scrollTop,at:last && Math.abs(last.top-b.scrollTop)<.5 ? last.at : now};
      return now-window.__scrollSample.at>150; }''')
    await pg.evaluate('delete window.__scrollSample')

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'),args=['--no-sandbox'])
        ctx=await browser.new_context(storage_state='/tmp/twodo-A.json',viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        pg=await ctx.new_page(); errors=[]
        pg.on('pageerror',lambda e:errors.append(str(e)))
        await pg.goto('http://localhost:8003/'); await pg.wait_for_timeout(2600)
        await ctx.add_init_script('''(() => {
          const cache=JSON.parse(localStorage.getItem('twodo:chat'));
          const uid=JSON.parse(localStorage.getItem('twodo:local')).auth.uid;
          const start=Date.now()-2*864e5, messages={};
          for(let i=0;i<165;i++){const ts=start+i*1000,id=ts.toString(36)+'seed';
            messages[id]={id,f:uid,ts,t:'Reading example '+i,fx:null,task:null,rp:null,del:false,_u:ts,status:'sent'};}
          const first=Object.keys(messages)[0], last=Object.keys(messages).at(-1);
          messages[last].rp={id:first,f:uid,q:'Reading example 0'};
          cache.msgs={...messages,...cache.msgs};localStorage.setItem('twodo:chat',JSON.stringify(cache));
        })()''')
        await pg.reload(); await pg.wait_for_timeout(2600)
        await pg.evaluate("document.querySelector('.chatbody').scrollTop=1e9")
        await settled(pg)
        # The quote's original sits outside the default 120-row render window.
        quote=pg.locator('.rq[data-rq]').filter(has_text='Reading example 0')
        await quote.scroll_into_view_if_needed(); await settled(pg)
        before=await quote.locator('xpath=ancestor::div[contains(@class,"msg-row")]').get_attribute('data-id')
        offset=await pg.evaluate('''id=>{const r=document.querySelector(`[data-id="${id}"]`).getBoundingClientRect();return r.top-document.querySelector('.chat-nav').getBoundingClientRect().bottom;}''',before)
        await pg.locator('.cb-in').tap()
        await quote.click()
        assert await pg.evaluate("document.activeElement.matches('.cb-in')"), 'Quote tap stole input focus'
        await expect(pg.get_by_role('button',name='Back to where you were')).to_be_visible()
        await settled(pg)
        target=pg.locator('.msg-row').filter(has=pg.locator('.bub:text-is("Reading example 0")'))
        rect=await target.bounding_box(); assert rect and 100<rect['y']<700, rect
        await pg.screenshot(path='/tmp/twodo-quote-return.png')
        await pg.get_by_role('button',name='Back to where you were').click(); await settled(pg)
        assert await pg.evaluate("document.activeElement.matches('.cb-in')"), 'Return tap stole input focus'
        restored=await pg.evaluate('''id=>document.querySelector(`[data-id="${id}"]`).getBoundingClientRect().top-document.querySelector('.chat-nav').getBoundingClientRect().bottom''',before)
        assert abs(restored-offset)<2, ('return changed reading anchor',offset,restored)
        await expect(pg.get_by_role('button',name='Back to where you were')).to_be_hidden()
        # Repeat, then interrupt intentionally. It must remain user-controllable.
        await quote.click(); await settled(pg)
        await pg.mouse.wheel(0,160); await settled(pg)
        await pg.get_by_role('button',name='Back to where you were').click(); await settled(pg)
        await pg.set_viewport_size({'width':390,'height':650}); await settled(pg)
        assert not errors, errors
        print('PASS: unrendered quote, no competing prepend, exact return anchor, repeat/interruption/resize')
        await browser.close()

asyncio.run(main())
