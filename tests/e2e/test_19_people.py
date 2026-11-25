"""The two of you on Home as realistic 3D people that move (asked for 2026-11-25: "realistic 3D where it turns 360 degree,
like that. Don't stand on the card, I want them to have some animations, movements like that").
They stand free on Home, not on the Today card; their drawings show until the 3D people are ready. A sideways drag on
one of you turns them round with the finger (a flick keeps them turning, then they turn back); up and down still
scrolls Home; a tap and they wave. With Reduce Motion they stand still and only the finger turns them. When your
partner shares a moment, theirs takes a photo. The character screen has the same person to turn round, alone.
Without WebGL the drawings stay and nothing fails.
Run test 1 first (it creates Abilash and Deiva). Needs the test build on 8003 and /tmp/mo/sunset.jpg (test 18)."""
import asyncio, os
from playwright.async_api import async_playwright
from helpers import TITLES, back_home

ST = "(() => { const d = document.querySelector('.home-people').dataset; return { me: [+d.meYaw, d.meState], pt: [+d.ptYaw, d.ptState] }; })()"
BOX = "(() => { const r = document.querySelector('.home-people').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()"
rest = lambda deg: abs(((deg + 180) % 360) - 180) == 20   # facing you, turned a little to the other (0.35 rad)

async def main():
    async with async_playwright() as p:
        chrome = os.environ.get('CHROME', '/usr/bin/google-chrome')
        b = await p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
        errors = []
        async def phone(browser, state, reduce=False):
            ctx = await browser.new_context(storage_state=state, viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True,
                                            reduced_motion='reduce' if reduce else 'no-preference')
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            pg.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
            await pg.goto('http://localhost:8003/')
            return ctx, pg
        async def until(pg, js, want, ms=15000):
            got = None
            for _ in range(ms // 100):
                got = await pg.evaluate(js)
                if (want(got) if callable(want) else got == want): return got
                await pg.wait_for_timeout(100)
            return got
        def finger(ctx, pg):
            cdp = None
            async def drag(x0, y0, x1, y1, steps=10, ms=16):
                nonlocal cdp
                cdp = cdp or await ctx.new_cdp_session(pg)
                await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0}]})
                for i in range(1, steps + 1):
                    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + (x1 - x0) * i / steps, 'y': y0 + (y1 - y0) * i / steps}]}); await pg.wait_for_timeout(ms)
                await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            return drag

        # ---------- they stand free on Home: drawings first, then the 3D people; the card is only Today
        ca, A = await phone(b, '/tmp/twodo-A.json')
        assert await until(A, "document.querySelectorAll('.home-people .hp-draw svg.cv').length", 2, 8000) == 2, 'their drawings stand there first'
        assert await until(A, "!!document.querySelector('.home-people.ready')", True, 30000), 'the 3D people are drawn'
        await A.wait_for_timeout(1600)   # their other movements load in the background; they start moving about after 4 s
        drag = finger(ca, A)
        x, y, w, h = await A.evaluate(BOX)
        await drag(x + w * .33, y + h * .6, x + w * .33 + 150, y + h * .6 + 4, steps=5, ms=10)          # a flick on you, at once
        assert (await until(A, ST, lambda s: s['me'][1] in ('spinning', 'free')))['me'][1] in ('spinning', 'free'), 'your finger turns you'
        freed = await until(A, ST, lambda s: s['me'][1] == 'free', 8000)
        assert freed['me'][1] == 'free' and freed['me'][0] - 20 > 180, ('a flick keeps you turning: more than half a turn', freed)
        back = await until(A, ST, lambda s: s['me'][1] == 'rest', 9000)
        assert back['me'][1] == 'rest' and rest(back['me'][0]), ('then you turn back to face the front', back)
        assert await A.evaluate("!document.querySelector('.home-card canvas, .home-card svg.cv')") and await A.evaluate("document.querySelector('.home-people').dataset.people.split(' ').length") == 2
        print(f"PASS: you two stand free on Home (drawings first, then 3D); a flick turned you {freed['me'][0] - 20}° and you turned back to the front")

        await A.focus('.home-people .hp-sr button >> nth=1'); await A.keyboard.press('Enter')             # the keyboard's way to a wave
        assert (await until(A, ST, lambda s: s['pt'][1] == 'act:wave', 6000))['pt'][1] == 'act:wave', 'Deiva waves'
        print('PASS: Deiva waves when asked (a tap, or the button for a keyboard or screen reader)')

        # ---------- when your partner shares a moment, theirs takes a photo
        cb, B = await phone(b, '/tmp/twodo-B.json'); await B.wait_for_timeout(3000)
        async with B.expect_file_chooser() as fc: await B.click('.home-moments .mo-shutter')
        await (await fc.value).set_files('/tmp/mo/sunset.jpg'); await B.wait_for_timeout(1200)
        await B.click('.sheet.open .mo-send-btn'); await B.wait_for_timeout(600)
        assert (await until(A, ST, lambda s: s['pt'][1] == 'act:photo', 20000))['pt'][1] == 'act:photo', 'Deiva takes a photo on your Home'
        await B.click('.home-moments .mo-mine'); await B.wait_for_timeout(900)                          # tidy up: take it back
        await B.click('.sheet.open .mo-remove'); await B.wait_for_timeout(400); await B.click('.alert button[data-r="1"]'); await B.wait_for_timeout(600)
        print('PASS: when Deiva shares a moment, her person on your Home takes a photo')

        # ---------- covered by the chat, nothing on Home is drawn; back on Home they carry on
        await A.click('.home-pt'); await A.wait_for_timeout(1200)
        assert await A.evaluate(TITLES) == ['Board', 'Chat']
        await back_home(A); await A.wait_for_timeout(600)
        await cb.close(); await ca.close()

        # ---------- Reduce Motion: they stand still; the finger turns them exactly, and they stay; up and down scrolls Home
        ca, A = await phone(b, '/tmp/twodo-A.json', reduce=True)
        assert await until(A, "!!document.querySelector('.home-people.ready')", True, 30000)
        drag = finger(ca, A)
        x, y, w, h = await A.evaluate(BOX)
        await drag(x + w * .33, y + h * .6, x + w * .33 + 120, y + h * .6 + 3, steps=12, ms=30)
        s1 = await until(A, ST, lambda s: s['me'][1] == 'free', 3000)
        want = 20 + 120 / w * 2.2 * 180
        assert s1['me'][1] == 'free' and abs(s1['me'][0] - want) <= 6, ('turned with the finger, no flick', s1, want)
        await A.wait_for_timeout(3500)
        assert (await A.evaluate(ST))['me'] == s1['me'], 'and stays where your finger left it'
        top0 = await A.evaluate("document.querySelector('.boardview').scrollTop")
        await drag(x + w * .7, y + h * .75, x + w * .7 + 4, y + h * .75 - 160, steps=10, ms=16)        # up the screen, over the people
        await A.wait_for_timeout(500)
        assert await A.evaluate("document.querySelector('.boardview').scrollTop") > top0 + 40 and (await A.evaluate(ST))['me'] == s1['me'], 'up and down still scrolls Home'
        print(f"PASS: with Reduce Motion they stand still; a slow drag turned you {round(s1['me'][0] - 20)}° exactly and you stayed; up and down scrolls Home")

        # ---------- the character screen: the person you're picking, alone, to turn round
        await A.evaluate("document.querySelector('.boardview').scrollTop = 0")
        await A.click('.boardview .fab-btn[aria-label="Settings"]'); await A.wait_for_timeout(900)
        await A.click('.sheet.open .me-char'); await A.wait_for_timeout(1300)
        assert await A.evaluate(TITLES) == ['Board', 'Your character']
        assert await until(A, "!!document.querySelector('.person-preview.ready')", True, 30000), 'the person, in 3D'
        x, y, w, h = await A.evaluate("(() => { const r = document.querySelector('.person-preview').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
        await drag(x + w * .5, y + h * .55, x + w * .5 + 60, y + h * .55, steps=10, ms=30)
        yaw = await until(A, "+document.querySelector('.person-preview').dataset.meYaw", lambda v: v and v > 60, 3000)
        assert yaw and yaw > 60, ('turned round on the character screen too', yaw)
        await back_home(A)
        await ca.close()
        print(f'PASS: on the character screen the person you pick turns round with your finger ({yaw}°)')

        # ---------- without WebGL the drawings stay and nothing fails
        b2 = await p.chromium.launch(executable_path=chrome, args=['--no-sandbox', '--disable-3d-apis'])
        cc, C = await phone(b2, '/tmp/twodo-A.json')
        await C.wait_for_timeout(6000)
        assert await C.evaluate("!document.querySelector('.home-people.ready') && getComputedStyle(document.querySelector('.home-people .hp-draw')).opacity === '1'"), 'the drawings stay'
        assert await C.evaluate("document.querySelectorAll('.home-people .hp-draw svg.cv').length") == 2 and await C.evaluate(TITLES) == ['Board']
        await cc.close(); await b2.close()
        print('PASS: without WebGL their drawings stay and Home works')

        await b.close()
        print('ERRORS:', errors or 'NONE')
        assert not errors, errors

asyncio.run(main())
