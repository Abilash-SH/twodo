"""The opt-in world: real avatars, two-finger movement/look, paired presence, pause, doors and fallback.
Run test 1 first. Uses its two accounts and the same local Firebase; never production.
"""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright
from helpers import back_home

URL = os.environ.get('COURTYARD_TEST_URL', 'http://localhost:8003/')

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox', '--enable-unsafe-swiftshader'])
        errors = []
        async def phone(state):
            if URL != 'http://localhost:8003/':
                state = json.loads(Path(state).read_text())
                for entry in state['origins']:
                    if entry['origin'] == 'http://localhost:8003':
                        entry['origin'] = URL.rstrip('/')
            ctx = await browser.new_context(storage_state=state, viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, device_scale_factor=1, service_workers='block')
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(str(e)))
            await pg.goto(URL)
            await pg.locator('.world-enter').wait_for(timeout=15000)
            await pg.click('.world-enter')
            await pg.locator('.world-canvas[data-ready="yes"]').wait_for(timeout=45000)
            return ctx, pg
        ca, A = await phone('/tmp/twodo-A.json')
        cb, B = await phone('/tmp/twodo-B.json')
        await A.locator('[data-presence="live"]').wait_for(timeout=12000)
        await B.locator('[data-presence="live"]').wait_for(timeout=12000)
        await A.screenshot(path='/tmp/twodo-courtyard.png')
        canvas = A.locator('.world-canvas')
        print('Portrait render:', await canvas.evaluate('(el) => ({ drawCalls: +el.dataset.drawCalls, triangles: +el.dataset.triangles })'), flush=True)
        async def position(page):
            return await page.locator('.world-canvas').evaluate('(el) => [Number(el.dataset.x), Number(el.dataset.z)]')
        before = await position(A)
        initial_yaw = await canvas.get_attribute('data-camera-yaw')
        stick = await A.locator('.world-stick').bounding_box()
        stage = await A.locator('.world-stage').bounding_box()
        x, y = stick['x'] + stick['width']/2, stick['y'] + stick['height']/2
        lx, ly = stage['x'] + stage['width']*.75, stage['y'] + stage['height']*.45
        cdp = await ca.new_cdp_session(A)
        move = {'x':x+24,'y':y-25,'id':11}
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':11}]})
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':11},{'x':lx,'y':ly,'id':12}]})
        for i in range(1,6):
            await cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[move,{'x':lx+i*8,'y':ly-i*2,'id':12}]})
            await A.wait_for_timeout(80)
        await A.wait_for_timeout(800)
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
        await A.wait_for_timeout(900)
        after = await position(A)
        assert sum((a-b)**2 for a,b in zip(before,after)) > .15, (before, after)
        assert await canvas.get_attribute('data-camera-yaw') != initial_yaw, 'the second finger controls the camera'
        await B.wait_for_function("expected => { const c=document.querySelector('.world-canvas'); return c.dataset.peer==='live' && Math.hypot(Number(c.dataset.peerX)-expected[0],Number(c.dataset.peerZ)-expected[1])<.1; }", arg=after, timeout=6000)
        print('PASS: simultaneous touch movement/look; partner receives position', flush=True)
        # Demand rendering rests rather than spinning the GPU behind unchanged scenery.
        await A.wait_for_timeout(1500)
        f1 = int(await canvas.get_attribute('data-frames'))
        await A.wait_for_timeout(700)
        f2 = int(await canvas.get_attribute('data-frames'))
        assert f2-f1 < 8, ('idle frames',f1,f2)
        # Find has a collision-safe route; use keyboard controls while focused, never global shortcuts.
        await A.locator('.world-find').click()
        await A.locator('.world-bench').click()
        await A.locator('button:has-text("Sit together")').wait_for(timeout=45000)
        await A.locator('button:has-text("Sit together")').click()
        await A.wait_for_timeout(700)
        assert await canvas.get_attribute('data-mode') == 'sit'
        await A.locator('button:has-text("Stand up")').click()
        await A.wait_for_timeout(600)
        assert await canvas.get_attribute('data-mode') != 'sit'
        # Opening a sheet pauses 3D and stops advertising foreground presence.
        await A.locator('.world-doors button:has-text("Moments")').click()
        await A.wait_for_timeout(600)
        f1 = int(await canvas.get_attribute('data-frames'))
        await A.wait_for_timeout(800)
        assert int(await canvas.get_attribute('data-frames')) == f1
        await B.locator('[data-presence="resting"]').wait_for(timeout=15000)
        await A.locator('.sheet.open [data-s="done"]').click()
        await A.locator('[data-presence="live"]').wait_for(timeout=12000)
        await cb.close()
        await A.locator('#boardAdd').click()
        await A.locator('#cta').fill('Water the courtyard plants')
        await A.locator('#cta').press('Enter')
        await A.keyboard.press('Escape')
        await A.locator('.world-doors button:has-text("Task patch")').click()
        tasks = A.locator('.world-task-patch label')
        await tasks.first.wait_for()
        assert await tasks.count() <= 3
        title = (await tasks.first.inner_text()).strip()
        chosen = A.locator('.world-task-patch label', has_text=title).first
        await chosen.click()
        await chosen.wait_for(state='hidden')
        await A.locator('.sheet.open [data-s="done"]').click()
        async with A.expect_file_chooser() as chooser:
            await A.locator('.world-doors button[aria-label="Take a photo"]').click()
        file_chooser = await chooser.value
        assert await file_chooser.element.get_attribute('capture') == 'environment'
        await file_chooser.set_files('/tmp/mo/sunset.jpg')
        await A.locator('.mo-send-btn').click()
        await A.locator('.mo-send').wait_for(state='hidden')
        print('PASS: sit/stand, foreground lease, task completion and Moments camera/send', flush=True)
        # The existing chat and keyboard rules survive the new Home mode.
        await A.locator('.board-tray .tray-btn.chat').click()
        await A.locator('.chatview:not(.offright)').wait_for()
        await A.locator('.cb-in').fill('A little walk together')
        await A.locator('.cb-send').click()
        assert await A.locator('.cb-in').evaluate('(el) => document.activeElement===el')
        await back_home(A)
        assert await A.locator('.world-stage').is_visible()
        await A.locator('.home-dock button[aria-label^="Journal"]').click()
        await A.locator('.jd').wait_for()
        await back_home(A)
        # Landscape keeps every door and exit reachable.
        await A.set_viewport_size({'width':844,'height':390})
        await A.wait_for_timeout(500)
        dimensions = await A.evaluate('''() => ({
            fits: document.documentElement.scrollWidth <= innerWidth,
            bounds: ['.world-toolbar button','.world-doors','.home-dock'].map(selector => {
                const rect = document.querySelector(selector)?.getBoundingClientRect();
                return rect && { top: rect.top, bottom: rect.bottom };
            }),
        })''')
        assert dimensions['fits'] and all(r and r['top'] >= 0 and r['bottom'] <= 390 for r in dimensions['bounds']), dimensions
        await A.screenshot(path='/tmp/twodo-courtyard-landscape.png')
        await A.set_viewport_size({'width':390,'height':844})
        await A.emulate_media(reduced_motion='reduce')
        await A.locator('.world-stick').focus()
        at=await position(A)
        await A.keyboard.down('ArrowUp');await A.wait_for_timeout(700);await A.keyboard.up('ArrowUp')
        assert await position(A)!=at
        await A.locator('.world-toolbar button').click()
        assert await A.locator('.world-enter').is_visible()
        await A.locator('.world-enter').click()
        await A.locator('.world-canvas[data-ready="yes"]').wait_for(timeout=30000)
        await A.locator('.world-canvas').dispatch_event('webglcontextlost')
        await A.locator('.world-fallback button').click()
        await A.locator('.world-canvas[data-ready="yes"]').wait_for(timeout=30000)
        await A.locator('.world-toolbar button').click()
        assert await A.locator('.world-enter').is_visible()
        await ca.close();await browser.close()
        # No WebGL never blanks Home or removes feature shortcuts.
        fallback = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox','--disable-3d-apis'])
        context_state=json.loads(Path('/tmp/twodo-A.json').read_text())
        for entry in context_state['origins']:
            if entry['origin']=='http://localhost:8003': entry['origin']=URL.rstrip('/')
        ctx=await fallback.new_context(storage_state=context_state,viewport={'width':390,'height':844},service_workers='block')
        page=await ctx.new_page();await page.goto(URL);await page.locator('.world-enter').click()
        await page.locator('.world-fallback button').wait_for(timeout=15000)
        assert await page.locator('.board-tray .tray-btn.chat').is_visible()
        await page.locator('.world-toolbar button').click();assert await page.locator('.home-card').is_visible()
        await fallback.close()
        assert not errors,errors
        print('PASS: sit/stand, foreground lease, renderer pause, keyboard, doors, landscape, Reduce Motion and WebGL fallback.',flush=True)
        print('ERRORS: NONE',flush=True)

asyncio.run(main())
