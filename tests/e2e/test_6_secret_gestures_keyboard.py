"""v5: secret lists behind a passcode (encrypted at rest, hidden everywhere else, auto-lock), finger swipes that start
at an angle (back, sheets, reply), and the message box keeping focus after send even with the iPhone haptic path."""
import asyncio, json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=__import__('os').environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        errs = []
        async def phone(url, st=None):
            ctx = await b.new_context(storage_state=st, viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
            pg.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text))
            await pg.goto(url); await pg.wait_for_timeout(2300)
            return ctx, pg
        def swiper(ctx, pg):
            cdp = None
            async def drag(x0, y0, x1, y1, steps=8, ms=16):
                nonlocal cdp
                cdp = cdp or await ctx.new_cdp_session(pg)
                await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0}]})
                for i in range(1, steps + 1):
                    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + (x1 - x0) * i / steps, 'y': y0 + (y1 - y0) * i / steps}]}); await pg.wait_for_timeout(ms)
                await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            return drag

        # ---------- secret lists (no accounts) ----------
        ctx, P = await phone('http://localhost:8004/')
        q = lambda s: P.evaluate(s)
        await P.click('text=Get started'); await P.wait_for_timeout(600)
        await P.fill('#obA', 'Abilash'); await P.fill('#obB', 'Deiva')
        await P.click('[data-p=names] .btn:has-text("Continue")'); await P.wait_for_timeout(600)
        await P.click('text=Start using Twodo'); await P.wait_for_timeout(1400)
        sec_id = await q("Object.values(JSON.parse(localStorage.getItem('twodo:data')).lists).find(l => l.private).id")
        await P.click('.secret-group .cell:has-text("Secret")'); await P.wait_for_timeout(900)
        print('gate', await q("[document.querySelector('.vault-gate h3').textContent, !!document.querySelector('#composer.hide')]"))
        await P.click('.vault-gate .btn:has-text("Create passcode")'); await P.wait_for_timeout(700)
        async def pin(code):
            for d in code: await P.click(f'.keypad button:text-is("{d}")'); await P.wait_for_timeout(40)
            await P.wait_for_timeout(1400)
        print('pad', await q("document.querySelector('.vault-h').textContent"))
        await pin('123456'); print('confirm', await q("document.querySelector('.vault-h').textContent"))
        await pin('654321'); print('mismatch', await q("[document.querySelector('.vault-h').textContent, document.querySelector('.vault-p').textContent]"))
        await pin('123456'); await pin('123456')
        st = await q(f"(() => {{ const d = JSON.parse(localStorage.getItem('twodo:data')), v = JSON.parse(localStorage.getItem('twodo:vault') || 'null');"
                     f" return {{ inPlain: !!d.lists['{sec_id}'], vault: !!v, keys: v && Object.keys(v).join(','), iter: v && v.iter }}; }})()")
        print('vault made', st)
        # add a secret to-do from inside the unlocked list
        await P.wait_for_timeout(500)
        print('unlocked list', await q("[document.querySelector('.view:not(.under) .nav-title').textContent, !!document.querySelector('.vault-gate'), !document.querySelector('#composer').classList.contains('hide')]"))
        await P.fill('#cta', 'Ring for Deiva 💍 today'); await P.press('#cta', 'Enter'); await P.wait_for_timeout(900)
        await P.evaluate("document.activeElement && document.activeElement.blur()"); await P.wait_for_timeout(400)
        print('secret rows', await q("[...document.querySelectorAll('.view:not(.under) .task .tt, .view:not(.under) .task .title')].map(x => x.textContent)"))
        raw = await q("localStorage.getItem('twodo:data') + localStorage.getItem('twodo:vault')")
        print('plaintext leak', 'Ring for' in raw)
        # not in Today / search / counts
        await P.click('.nav-btn.back'); await P.wait_for_timeout(800)
        print('hub today count', await q("document.querySelector('.hub-card .hub-n').textContent"), '| secret row val', await q("[...document.querySelectorAll('.secret-group .val')].map(x => x.textContent)"))
        await P.click('.hub-card:has-text("Today")'); await P.wait_for_timeout(800)
        print('today has secret', await q("document.querySelector('.view:not(.under)').innerText.includes('Ring for')"))
        await P.click('.nav-btn.back'); await P.wait_for_timeout(700)
        # lock from the hub, then a wrong and a right passcode
        await P.click('.secret-h .link-btn'); await P.wait_for_timeout(600)
        print('locked hub', await q("[...document.querySelectorAll('.secret-group .cell')].map(x => x.innerText.replace(/\\n/g, ' '))"))
        await P.click('.secret-group .cell'); await P.wait_for_timeout(700)
        await pin('000000'); print('wrong', await q("document.querySelector('.vault-p').textContent"))
        await pin('123456'); await P.wait_for_timeout(300)
        print('unlocked hub', await q("[...document.querySelectorAll('.secret-group .cell')].map(x => x.innerText.replace(/\\n/g, ' '))"))
        # reload: locked again, secret list page shows the lock screen
        await P.reload(); await P.wait_for_timeout(2200)
        print('after reload', await q("[...document.querySelectorAll('.secret-group .cell')].map(x => x.innerText.replace(/\\n/g, ' '))"))
        # leaving the app locks it (another tab in front)
        await P.click('.secret-group .cell'); await P.wait_for_timeout(700); await pin('123456')
        # (headless Chrome never hides a tab, so pretend the app went to the background)
        await q("Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))")
        await P.wait_for_timeout(300)
        await q("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))"); await P.wait_for_timeout(500)
        print('backgrounded → locked', await q("!!document.querySelector('.secret-group .cell .val') && document.querySelector('.secret-group .cell .val').textContent"))
        # export never includes secret lists
        print('export has secret', await q(f"(() => {{ const d = JSON.parse(localStorage.getItem('twodo:data')); return !!d.lists['{sec_id}']; }})()"))
        await P.screenshot(path='/tmp/v5-hub-locked.png')
        await P.click('.secret-group .cell'); await P.wait_for_timeout(700)
        await P.screenshot(path='/tmp/v5-keypad.png')
        await P.click('.vault-forgot'); await P.wait_for_timeout(500)
        await P.click('.alert button:has-text("Erase"), [role=alertdialog] button:has-text("Erase")'); await P.wait_for_timeout(800)
        print('erased', await q("[localStorage.getItem('twodo:vault'), document.querySelectorAll('.secret-group').length]"))

        # ---------- finger gestures that start at an angle ----------
        drag = swiper(ctx, P)
        await P.click('.group .cell:has-text("Groceries")'); await P.wait_for_timeout(800)
        await drag(150, 300, 290, 345, steps=7); await P.wait_for_timeout(800)  # diagonal-ish drag from mid-screen
        print('angled back', await q("document.querySelectorAll('#stack > .view').length"))
        await P.click('.group .cell:has-text("Groceries")'); await P.wait_for_timeout(800)
        await drag(200, 420, 245, 428, steps=3, ms=10); await P.wait_for_timeout(800)  # a short quick flick
        print('flick back', await q("document.querySelectorAll('#stack > .view').length"))
        await P.click('.nav-side.l button'); await P.wait_for_timeout(900)  # Settings sheet
        h = await q("(() => { const r = document.querySelector('.sheet.open .sheet-head').getBoundingClientRect(); return r.top + r.height / 2; })()")
        await drag(60, h, 260, h + 30, steps=8); await P.wait_for_timeout(900)
        print('sheet swiped away', await q("!document.querySelector('.sheet.open')"))
        await ctx.close()

        # ---------- chat: angled swipe to reply, and focus after send on the iPhone haptic path ----------
        ctx, A = await phone('http://localhost:8003/', '/tmp/twodo-A.json')
        q = lambda s: A.evaluate(s)
        drag = swiper(ctx, A)
        r = await q("(() => { const b = [...document.querySelectorAll('.msg-row[data-id] .bub')].pop().getBoundingClientRect(); return { x: b.left + 20, y: b.top + b.height / 2 }; })()")
        await drag(r['x'], r['y'], r['x'] + 70, r['y'] + 28, steps=6); await A.wait_for_timeout(700)  # 22° off horizontal
        print('angled reply', await q("!!document.querySelector('.cb-reply:not([hidden])')"))
        await A.click('.rb-x'); await A.wait_for_timeout(500)
        r = await q("(() => { const b = [...document.querySelectorAll('.msg-row[data-id] .bub')].pop().getBoundingClientRect(); return { x: b.left + 20, y: b.top + b.height / 2 }; })()")
        await drag(r['x'], r['y'], r['x'] + 36, r['y'] + 4, steps=3, ms=10); await A.wait_for_timeout(700)  # short quick flick
        assert await q("!!document.querySelector('.cb-reply:not([hidden])')"), 'Short angled reply flick must catch'
        print('flick reply', await q("!!document.querySelector('.cb-reply:not([hidden])')"))
        await A.click('.rb-x'); await A.wait_for_timeout(500)
        await drag(r['x'], r['y'], r['x'] + 8, r['y'] + 90, steps=6); await A.wait_for_timeout(700)  # scrolling: no reply
        print('scroll is not reply', await q("!document.querySelector('.cb-reply:not([hidden])')"))
        # iPhone path: no vibrate → the switch trick. The field must keep focus and nothing may stay in the page.
        await q("delete Navigator.prototype.vibrate")
        await A.click('.cb-in'); await A.fill('.cb-in', 'still typing?'); await A.click('.cb-send'); await A.wait_for_timeout(900)
        print('after send', await q("[document.activeElement && document.activeElement.className, document.querySelectorAll('head label, #haptic').length, document.querySelector('.cb-in').placeholder]"))
        print('heart tail', await q("getComputedStyle(document.querySelector('.msg-row.me.end .bub'), '::after').maskImage.slice(0, 22)"))
        await A.screenshot(path='/tmp/v5-chat.png')
        print('ERRORS:', [e for e in errs if 'status of 400' not in e] or 'NONE')
        await b.close()
asyncio.run(main())
