"""Assert native-motion regressions. Run after test_1, with online/offline builds on 8003/8004.
VisualViewport is simulated; physical iPhone keyboard/Face ID/frame pacing still need device checks.
"""
import asyncio, os
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/chromium'), args=['--no-sandbox'])
        errors = []
        async def phone(port, state=None):
            ctx = await b.new_context(storage_state=state, viewport={'width':390, 'height':844}, is_mobile=True, has_touch=True)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(str(e)))
            await pg.goto(f'http://localhost:{port}/'); await pg.wait_for_timeout(2400)
            return ctx, pg
        async def finger(ctx, pg, x, y, points, hold=0, selector=None):
            cdp = await ctx.new_cdp_session(pg)
            await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
            for dx, dy in points:
                await cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x+dx,'y':y+dy}]})
            value = await pg.locator(selector).evaluate('(e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).m41') if selector else None
            if hold: await pg.wait_for_timeout(hold)
            await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
            await cdp.detach()
            return value

        ctx, pg = await phone(8004)
        await pg.get_by_text('Get started', exact=True).click()
        await pg.fill('#obA','Abilash'); await pg.fill('#obB','Deiva')
        await pg.click('[data-p=names] .btn:has-text("Continue")')
        await pg.get_by_text('Start using Twodo', exact=True).click(); await pg.wait_for_timeout(1200)
        await pg.click('.hub-card:has-text("Today")'); await pg.wait_for_timeout(650)
        top = '#stack > .view:last-child'
        d = await finger(ctx, pg, 160, 360, [(8,2),(20,5),(40,10)], hold=160, selector=top)
        assert abs(d-40) < 1, ('back must track full distance',d)
        await pg.wait_for_timeout(650)
        assert await pg.locator('#stack > .view').count() == 2, 'held short swipe must spring back'
        d = await finger(ctx, pg, 160, 360, [(10,3),(24,6),(42,11)], selector=top)
        assert abs(d-42) < 1
        await pg.wait_for_timeout(800)
        assert await pg.locator('#stack > .view').count() == 1, 'short diagonal flick must pop'
        await pg.click('.hub-card:has-text("Today")'); await pg.wait_for_timeout(650)
        await finger(ctx, pg, 5, 360, [(10,4),(25,8),(48,15)])
        await pg.wait_for_timeout(800)
        assert await pg.locator('#stack > .view').count() == 1, 'edge flick must pop'
        print('PASS: edge/anywhere diagonal back, 1:1 tracking, held-swipe cancellation')

        await pg.click('.secret-group .cell:has-text("Secret")'); await pg.wait_for_timeout(650)
        await pg.click('.vault-gate .btn:has-text("Create passcode")'); await pg.wait_for_timeout(650)
        await pg.get_by_text('Use letters and numbers', exact=True).click()
        field = pg.locator('.vault-password input')
        await field.fill('lettersOnly')
        await expect(pg.locator('.vault-pad > .btn')).to_be_disabled()
        for _ in range(2):
            await field.fill('Deiva2026surprise'); await pg.locator('.vault-pad > .btn').click(); await pg.wait_for_timeout(800)
        if await pg.get_by_text('Not now', exact=True).count(): await pg.get_by_text('Not now', exact=True).click()
        await pg.wait_for_timeout(800)
        v = await pg.evaluate("JSON.parse(localStorage.getItem('twodo:vault'))")
        assert v['v'] == 1 and v['iter'] == 600000
        assert 'Deiva2026surprise' not in str(v)
        await pg.fill('#cta','Surprise for Deiva'); await pg.press('#cta','Enter'); await pg.wait_for_timeout(650)
        assert not await pg.evaluate("localStorage.getItem('twodo:data').includes('Surprise for Deiva')")
        await pg.reload(); await pg.wait_for_timeout(2000)
        await pg.click('.secret-group .cell'); await pg.wait_for_timeout(650)
        await pg.get_by_text('Use letters and numbers', exact=True).click()
        await pg.fill('.vault-password input','Wrong2026code'); await pg.locator('.vault-pad > .btn').click()
        await expect(pg.locator('.vault-p')).to_contain_text('Wrong passcode')
        await pg.fill('.vault-password input','Deiva2026surprise'); await pg.locator('.vault-pad > .btn').click(); await pg.wait_for_timeout(1000)
        assert not await pg.locator('.sheet.open').count()
        await pg.click('.secret-group .cell:has-text("Secret")'); await pg.wait_for_timeout(650)
        await expect(pg.locator('#stack > .view:last-child')).to_contain_text('Surprise for Deiva')
        print('PASS: alphanumeric KDF roundtrip, wrong-code rejection, ciphertext-only secret storage')
        await pg.locator('#stack > .view:last-child .nav-btn.back').click(); await pg.wait_for_timeout(650)
        await pg.locator('#stack > .view:last-child .nav-side.l .nav-btn').click(); await pg.wait_for_timeout(650)
        await pg.get_by_text('Change passcode',exact=True).click(); await pg.wait_for_timeout(650)
        await pg.get_by_text('Use letters and numbers',exact=True).click()
        await pg.fill('.vault-password input','Deiva2026surprise'); await pg.locator('.vault-pad > .btn').click()
        await expect(pg.locator('.vault-h')).to_contain_text('Choose a new passcode')
        await pg.get_by_text('Use 6 digits',exact=True).click()
        old=await pg.evaluate("JSON.parse(localStorage.getItem('twodo:vault'))")
        for _ in range(2):
            for d in '654321': await pg.locator(f'.keypad button:text-is("{d}")').click()
            await pg.wait_for_timeout(800)
        await pg.wait_for_timeout(650)
        changed=await pg.evaluate("JSON.parse(localStorage.getItem('twodo:vault'))")
        assert old['wk'] != changed['wk'] and old['data'] == changed['data'], 'Passcode change must only rewrap the vault key'
        await pg.reload(); await pg.wait_for_timeout(2000)
        await pg.locator('.secret-group .cell').click(); await pg.wait_for_timeout(650)
        for d in '654321': await pg.locator(f'.keypad button:text-is("{d}")').click()
        await pg.wait_for_timeout(1000)
        assert not await pg.locator('.sheet.open').count()
        print('PASS: change long passcode to 6 digits, unchanged vault data, unlock after reload')
        await ctx.close()

        ctx, pg = await phone(8003,'/tmp/twodo-A.json')
        # Home is the board; the chat is one tap away and slides in already drawn
        assert await pg.locator('.board-title').text_content() == 'Our board'
        await pg.locator('.board-tray .tray-btn.chat').tap(); await pg.wait_for_timeout(900)
        assert await pg.locator('.lb-name').text_content() == 'Deiva'
        await pg.fill('.cb-in','Native regression message')
        await pg.evaluate("delete Navigator.prototype.vibrate")
        await pg.locator('.cb-send').tap()
        assert await pg.locator('.c-send-heart').count() == 1, 'Send heart did not pop'
        await pg.wait_for_timeout(1000)
        assert await pg.evaluate("document.activeElement.matches('.cb-in')"), 'send stole keyboard focus'
        await pg.fill('.cb-in','And another')
        await pg.locator('.cb-send').tap(); await pg.wait_for_timeout(800)
        assert await pg.evaluate("document.activeElement.matches('.cb-in')")
        assert await pg.evaluate("getComputedStyle(document.querySelector('.chatview'),'::before').animationName") == 'none'
        for sel in ['.ch-pill','.cb-pill','.cb-plus','.chat-nav::before']:
            assert await pg.evaluate("s => { const [a,p] = s.split('::'); return getComputedStyle(document.querySelector(a),p ? '::'+p : null).backdropFilter; }",sel) == 'none'
        # Simulate the geometry sequence, without pretending desktop Chrome has an iPhone keyboard.
        await pg.evaluate("window.__height = 844; Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>window.__height})")
        for i, height in enumerate([790,700,580,520,580,700,790,844]):
            await pg.evaluate('(h)=>{window.__height=h;visualViewport.dispatchEvent(new Event("resize"));}',height)
            await pg.wait_for_timeout(35)
            if height == 520:
                await pg.evaluate('document.activeElement.blur()'); await pg.wait_for_timeout(35)
            if 3 <= i < 7:
                assert await pg.evaluate("document.body.classList.contains('kb')"), 'Blur must not restore full height before keyboard finishes closing'
            box = await pg.locator('#app').bounding_box()
            assert abs(box['height']-height) < 1 and box['width'] > 0
            assert await pg.evaluate("getComputedStyle(document.querySelector('#app')).display") != 'none'
        await pg.evaluate("delete visualViewport.height")
        print('PASS: repeated touch send preserves focus, static scene, no chat blur, viewport never hidden')
        partner=await b.new_context(storage_state='/tmp/twodo-B.json',viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        other=await partner.new_page(); await other.goto('http://localhost:8003/'); await other.wait_for_timeout(2400)
        # opening the app shows the board, with what is new on its first note: nothing is "seen" until the chat is opened
        assert 'new' in await other.locator('.note.n-msg .n-badge').text_content()
        assert not await pg.locator('.c-status.seen').count(), 'messages were marked seen from the board'
        await other.locator('.board-tray .tray-btn.chat').tap()
        await expect(pg.locator('.c-status.seen .hs')).to_have_count(2)
        await partner.close()
        print('PASS: send heart pop and two overlapping seen hearts')
        await pg.evaluate('document.activeElement.blur()'); await pg.wait_for_timeout(100)
        row = pg.locator('.msg-row[data-id]').last
        r = await row.bounding_box(); x,y=90,r['y']+r['height']/2
        await finger(ctx, pg, x,y,[(7,2),(20,5),(38,10)])
        await pg.wait_for_timeout(500)
        assert not await pg.locator('.cb-reply').is_hidden(), 'short angled reply flick did not catch'
        await pg.locator('.rb-x').tap(); await pg.wait_for_timeout(500)
        await pg.locator('.lb-av.pt').tap(); await pg.wait_for_timeout(650)
        d = await finger(ctx, pg, 130,350,[(10,3),(25,6),(45,10)],selector='.pv')
        assert abs(d-45)<1
        await pg.wait_for_timeout(700)
        assert not await pg.locator('.pv').count(), 'photo flick failed'
        print('PASS: reply flick and touch photo dismissal')
        # Settings lives on the board: back with the chat's own button, then return to the chat
        await pg.locator('.chatview .fab-btn[aria-label="Back to the board"]').tap(); await pg.wait_for_timeout(700)
        assert await pg.locator('#stack > .view:not(.offright)').count() == 1, 'the chat did not close'
        await pg.locator('.boardview .fab-btn[aria-label=Settings]').tap(); await pg.wait_for_timeout(650)
        h = await pg.locator('.sheet.open .sheet-head').bounding_box()
        d = await finger(ctx, pg, 130,h['y']+30,[(10,3),(25,6),(45,10)],selector='.sheet.open')
        assert abs(d-45)<1
        await pg.wait_for_timeout(850)
        assert not await pg.locator('.sheet.open').count(), 'Settings swipe failed'
        await pg.locator('.board-tray .tray-btn.chat').tap(); await pg.wait_for_timeout(900)
        await pg.fill('.cb-in','Effects swipe test'); await pg.wait_for_timeout(450)
        send = await pg.locator('.cb-send').bounding_box()
        cdp=await ctx.new_cdp_session(pg)
        await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':send['x']+15,'y':send['y']+15}]})
        await pg.wait_for_timeout(550)
        await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]}); await cdp.detach()
        await pg.wait_for_timeout(500)
        assert await pg.locator('.fxp').count(), 'Hold for effects failed'
        await finger(ctx, pg, 100,350,[(10,3),(25,6),(45,10)])
        await pg.wait_for_timeout(850)
        assert not await pg.locator('.fxp').count(), 'Effects swipe failed'
        await pg.locator('.chatview .fab-btn[aria-label="To-dos and reminders"]').tap(); await pg.wait_for_timeout(650)
        count=await pg.evaluate("[...document.querySelectorAll('#stack > .view:last-child .hub-card, #stack > .view:last-child .cell, #stack > .view:last-child .group')].filter(e=>getComputedStyle(e).animationName==='riseIn').length")
        assert count == 6, ('entrance budget',count)
        await pg.locator('.hub-card:has-text("Today")').tap(); await pg.wait_for_timeout(650)
        task=await pg.locator('#stack > .view:last-child .task .ti').first.bounding_box()
        await pg.mouse.move(task['x']+80,task['y']+task['height']/2); await pg.mouse.down()
        await pg.wait_for_timeout(600); await pg.mouse.up(); await pg.wait_for_timeout(350)
        await pg.locator('#menu [data-m=focus]').click(); await pg.wait_for_timeout(650)
        assert await pg.locator('#focus.on').count()
        ring=await pg.locator('.f-ring').bounding_box()
        await finger(ctx, pg, ring['x']+ring['width']/2,ring['y']+ring['height']/2,[(10,3),(25,6),(45,10)])
        await pg.wait_for_timeout(850)
        assert not await pg.locator('#focus.on').count(), 'Focus ring swipe failed'
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(650)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(650)
        print('PASS: Settings, effects picker, focus timer dismiss with short angled touch flicks')
        # Resolve every gradient stop through the actual browser, across all 12×12 profile colour pairs.
        contrast = await pg.evaluate('''() => {
          const root=document.documentElement, old=root.getAttribute('style'), theme=root.dataset.theme;
          const colors=['blue','indigo','purple','pink','red','orange','yellow','green','mint','teal','brown','gray'];
          const canvas=document.createElement('canvas'); canvas.width=canvas.height=1; const c=canvas.getContext('2d');
          const probe=document.createElement('span'); document.body.append(probe);
          const lum=(v)=>v.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
          let min=100;
          for(const t of ['light','dark']) { root.dataset.theme=t;
            for(const me of colors) for(const pt of colors) {
              root.style.setProperty('--me-c',`var(--c-${me})`);root.style.setProperty('--pt-c',`var(--c-${pt})`);
              for(const stop of ['me-top','me-end','me-tip','them','them-tip']) {
                probe.style.backgroundColor=`var(--bub-${stop})`;c.fillStyle=getComputedStyle(probe).backgroundColor;c.fillRect(0,0,1,1);
                const l=lum([...c.getImageData(0,0,1,1).data].slice(0,3)), ink=t==='dark'?1:lum([36,29,43]);
                min=Math.min(min,(Math.max(l,ink)+.05)/(Math.min(l,ink)+.05));
              }
            }
          }
          probe.remove();root.dataset.theme=theme;old===null?root.removeAttribute('style'):root.setAttribute('style',old);return min;
        }''')
        assert contrast >= 4.5, contrast
        print(f'PASS: minimum text contrast {contrast:.2f}:1 across 1,440 gradient stops')
        await pg.emulate_media(reduced_motion='reduce')
        assert await pg.evaluate("getComputedStyle(document.querySelector('.bub')).animationName") == 'none'
        await pg.screenshot(path='/tmp/twodo-native-chat.png')
        await pg.evaluate("document.documentElement.dataset.theme='dark'"); await pg.wait_for_timeout(100)
        await pg.screenshot(path='/tmp/twodo-native-chat-dark.png')
        assert not errors, errors
        print('ERRORS: NONE')
        await b.close()

asyncio.run(main())
