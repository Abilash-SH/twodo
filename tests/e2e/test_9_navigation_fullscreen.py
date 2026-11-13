"""One gesture = one navigation (the board, the chat above it, the to-do screens), the browser Back button, the
installed-app (standalone) sizing, the board's buttons and the message bar.
Run test 1 first (it creates the accounts saved in /tmp/twodo-A.json). Needs the test build on port 8003."""
import asyncio, os
from playwright.async_api import async_playwright
from helpers import TITLES, open_chat, back_home

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        errors = []

        async def phone(w=390, h=844, reduced=False):
            ctx = await b.new_context(storage_state='/tmp/twodo-A.json', viewport={'width': w, 'height': h}, device_scale_factor=2,
                                      is_mobile=True, has_touch=True, reduced_motion='reduce' if reduced else 'no-preference')
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            pg.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
            await pg.goto('http://localhost:8003/'); await pg.wait_for_timeout(2300)
            return ctx, pg, await ctx.new_cdp_session(pg)

        async def swipe(pg, cdp, x0, dx, steps=8, ms=16, hold=0, probe=None, y=420):
            """drag right by dx; returns the top screen's offset at the last move and ~40 ms after release"""
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y}]})
            for i in range(1, steps + 1):
                await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + dx * i / steps, 'y': y + i}]})
                if ms: await pg.wait_for_timeout(ms)
            at = await pg.evaluate(probe) if probe else None
            if hold: await pg.wait_for_timeout(hold)
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            after = None
            if probe:
                await pg.wait_for_timeout(40); after = await pg.evaluate(probe)
            return at, after

        async def to_groceries(pg):
            await pg.click('.boardview .fab-btn[aria-label="To-dos and reminders"]'); await pg.wait_for_timeout(1000)
            await pg.click('.group .cell:has-text("Groceries")'); await pg.wait_for_timeout(1000)
            assert await pg.evaluate(TITLES) == ['Board', 'To-dos', 'Groceries'], await pg.evaluate(TITLES)

        # the screen being dragged stays the last child while it slides away (it is marked offright on release)
        TOP_X = """new DOMMatrixReadOnly(getComputedStyle(document.querySelector('#stack > .view:last-child')).transform).m41"""
        state = lambda pg: pg.evaluate("history.state && { t: history.state.t || 0, s: history.state.s || 0 }")

        # ---------- completed swipes: exactly one screen each, the finger is followed 1:1, release continues from there
        ctx, P, cdp = await phone()
        await to_groceries(P)
        at, after = await swipe(P, cdp, 12, 300, probe=TOP_X)
        assert abs(at - 300) < 2, ('the screen must follow the finger 1:1', at)
        assert after > at - 2, ('release must continue from where the finger left it, not snap back first', at, after)
        await P.wait_for_timeout(900)
        assert await P.evaluate(TITLES) == ['Board', 'To-dos'], ('one swipe = one screen', await P.evaluate(TITLES))
        assert (await state(P))['t'] == 1, 'a screen is open: the Back trap must stay armed'
        await swipe(P, cdp, 12, 300); await P.wait_for_timeout(1400)  # an edge swipe leaves the trap for ~0.8 s (see nav.ts)
        assert await P.evaluate(TITLES) == ['Board'], await P.evaluate(TITLES)
        assert not (await state(P) or {}).get('t'), 'home: no Back trap left behind'
        print('PASS: completed swipes pop exactly one screen each; 1:1 tracking; release continues from the finger')

        # ---------- a short, cancelled swipe leaves the screen open and springs back from where it was
        await to_groceries(P)
        at, after = await swipe(P, cdp, 160, 44, steps=4, hold=220, probe=TOP_X)
        assert abs(at - 44) < 2, at
        assert 0 <= after <= at + 1, ('cancel returns from the current position', at, after)
        await P.wait_for_timeout(900)
        assert await P.evaluate(TITLES) == ['Board', 'To-dos', 'Groceries'], ('a cancelled swipe must not navigate', await P.evaluate(TITLES))
        assert await P.evaluate(TOP_X) == 0, 'the screen settles back in place'
        print('PASS: short cancelled swipe stays on the screen')

        # ---------- rapid consecutive swipes: Groceries → To-dos → the board, one each, nothing extra
        await swipe(P, cdp, 12, 260, steps=5, ms=8); await P.wait_for_timeout(120)
        await swipe(P, cdp, 12, 260, steps=5, ms=8); await P.wait_for_timeout(120)
        await swipe(P, cdp, 12, 260, steps=5, ms=8)  # a third swipe at Home must do nothing
        await P.wait_for_timeout(1500)
        assert await P.evaluate(TITLES) == ['Board'], ('rapid swipes', await P.evaluate(TITLES))
        assert not (await state(P) or {}).get('t')
        stale = await P.evaluate("[...document.querySelectorAll('#stack > .view')].filter(v => v.style.transform || v.style.transition).length")
        assert stale == 0, ('no inline transforms or transitions left behind', stale)
        print('PASS: rapid consecutive swipes pop one screen each and leave nothing behind')

        # ---------- the browser Back button (and Android back): one screen per press, the trap re-arms
        await to_groceries(P)
        await P.evaluate("history.back()"); await P.wait_for_timeout(900)
        assert await P.evaluate(TITLES) == ['Board', 'To-dos'], ('Back = one screen', await P.evaluate(TITLES))
        assert (await state(P))['t'] == 1
        await P.evaluate("history.back()"); await P.wait_for_timeout(900)
        assert await P.evaluate(TITLES) == ['Board'], await P.evaluate(TITLES)
        print('PASS: browser Back pops one screen per press')

        # ---------- rapid Back presses: every press counts, however quickly it follows the last navigation
        await to_groceries(P)
        await P.evaluate("history.back(); setTimeout(() => history.back(), 100)"); await P.wait_for_timeout(1300)
        assert 'localhost:8003' in P.url and await P.evaluate(TITLES) == ['Board'], ('two quick Backs = two screens', P.url, await P.evaluate(TITLES))
        await to_groceries(P)  # Back straight after a swipe that began away from the edge
        await swipe(P, cdp, 160, 220, steps=5, ms=8); await P.evaluate("history.back()"); await P.wait_for_timeout(1300)
        assert await P.evaluate(TITLES) == ['Board'], ('Back right after a swipe', await P.evaluate(TITLES))
        await to_groceries(P)  # Back straight after the ‹ button
        await P.evaluate("document.querySelector('.view:not(.under) .nav-btn.back').click(); history.back()"); await P.wait_for_timeout(1300)
        assert await P.evaluate(TITLES) == ['Board'], ('Back right after the back button', await P.evaluate(TITLES))
        print('PASS: rapid Back presses each close one screen (after a Back, a swipe or the back button)')

        # ---------- arriving Home by an edge swipe: with or without the phone's own back, never a step out of the app
        for system_back in (True, False):
            await P.click('.boardview .fab-btn[aria-label="To-dos and reminders"]'); await P.wait_for_timeout(1000)
            await swipe(P, cdp, 10, 300)
            if system_back: await P.evaluate("history.back()")
            await P.wait_for_timeout(1500)
            assert 'localhost:8003' in P.url, ('left the app', system_back, P.url)
            assert await P.evaluate(TITLES) == ['Board'] and not (await state(P) or {}).get('t'), (system_back, await P.evaluate(TITLES), await state(P))
        print('PASS: an edge swipe Home never steps back past the app, with or without the system gesture')

        # ---------- a system back arriving during our own swipe (iOS edge swipe / Android) is the same navigation
        for when in ('before', 'after'):
            await to_groceries(P)
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 10, 'y': 400}]})
            for i in range(1, 9):
                await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': 10 + 30 * i, 'y': 402}]}); await P.wait_for_timeout(16)
            if when == 'before': await P.evaluate("history.back()")
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            if when == 'after': await P.evaluate("history.back()")
            await P.wait_for_timeout(1300)
            assert await P.evaluate(TITLES) == ['Board', 'To-dos'], (f'system back {when} touchend popped twice', await P.evaluate(TITLES))
            assert (await state(P))['t'] == 1
            await P.evaluate("history.back()"); await P.wait_for_timeout(900)
        print('PASS: system back racing our swipe still pops exactly one screen (both orders)')

        # ---------- Back with a layer open closes only that layer
        await to_groceries(P)
        await P.click('.view:not(.under) .nav-side.r .nav-btn'); await P.wait_for_timeout(500)
        assert await P.evaluate("document.querySelector('#menu')?.classList.contains('open') ?? false") or await P.locator('#menu .mi').count(), 'list menu opens'
        await P.evaluate("history.back()"); await P.wait_for_timeout(700)
        assert await P.evaluate(TITLES) == ['Board', 'To-dos', 'Groceries'], ('Back with the menu open must only close the menu', await P.evaluate(TITLES))
        assert (await state(P))['t'] == 1, 'trap re-armed after closing the menu'
        await P.click('.view:not(.under) .task >> nth=0'); await P.wait_for_timeout(900)
        assert await P.locator('.sheet.open').count() == 1, 'task sheet opens'
        await P.evaluate("history.back()"); await P.wait_for_timeout(900)
        assert not await P.locator('.sheet.open').count(), 'Back closes the sheet'
        assert await P.evaluate(TITLES) == ['Board', 'To-dos', 'Groceries'], ('…and only the sheet', await P.evaluate(TITLES))
        await P.evaluate("history.back()"); await P.wait_for_timeout(900)
        assert await P.evaluate(TITLES) == ['Board', 'To-dos'], await P.evaluate(TITLES)
        await P.evaluate("history.back()"); await P.wait_for_timeout(900)
        print('PASS: Back closes the open menu or sheet only')

        # ---------- the chat is a screen above the board: its left edge is Back, a swipe on a message is a reply
        REPLY = "!document.querySelector('.chatview .cb-reply').hidden"
        CHAT_X = "new DOMMatrixReadOnly(getComputedStyle(document.querySelector('#stack > .chatview')).transform).m41"
        last_row = "(() => { const r = [...document.querySelectorAll('.chatview .msg-row[data-id]')].pop().getBoundingClientRect(); return r.top + r.height / 2; })()"
        await open_chat(P)
        assert await P.evaluate(TITLES) == ['Board', 'Chat'] and (await state(P))['t'] == 1, (await P.evaluate(TITLES), await state(P))
        y = await P.evaluate(last_row)
        await swipe(P, cdp, 120, 90, y=y); await P.wait_for_timeout(700)  # starts on a message, away from the edge
        assert await P.evaluate(TITLES) == ['Board', 'Chat'], ('a swipe on a message must not go back', await P.evaluate(TITLES))
        assert await P.evaluate(REPLY), 'a swipe on a message starts a reply'
        await P.click('.chatview .rb-x'); await P.wait_for_timeout(500)
        y = await P.evaluate(last_row)  # the reply bar is gone: the messages moved
        at, after = await swipe(P, cdp, 12, 300, y=y, probe=CHAT_X)  # the same message, from the screen edge
        assert abs(at - 300) < 2, ('the chat follows the finger 1:1 from the edge', at)
        await P.wait_for_timeout(1400)
        assert await P.evaluate(TITLES) == ['Board'] and not (await state(P) or {}).get('t'), (await P.evaluate(TITLES), await state(P))
        assert not await P.evaluate(REPLY), 'the edge belongs to Back: no reply may start there'
        await open_chat(P)
        assert await P.evaluate("!document.elementFromPoint(200, 30).closest('.msg-row') && !!document.elementFromPoint(200, 30).closest('.chatview')")
        await swipe(P, cdp, 200, 170, steps=5, ms=8, y=30); await P.wait_for_timeout(1000)  # a drag that starts off the messages (the header)
        assert await P.evaluate(TITLES) == ['Board'], ('a sideways drag off the messages goes back', await P.evaluate(TITLES))
        print('PASS: in the chat the edge (and a drag off the messages) is Back; a swipe on a message is only ever a reply')

        # ---------- To-dos opened from the chat sits on top of it: each Back closes one screen, the conversation first
        await open_chat(P)
        await P.click('.chatview .fab-btn[aria-label="To-dos and reminders"]'); await P.wait_for_timeout(1000)
        assert await P.evaluate(TITLES) == ['Board', 'Chat', 'To-dos'], await P.evaluate(TITLES)
        assert await P.evaluate("document.querySelector('.view:not(.under):not(.offright) .nav-btn.back').innerText.trim()") == 'Chat'
        await P.evaluate("history.back()"); await P.wait_for_timeout(900)
        assert await P.evaluate(TITLES) == ['Board', 'Chat'] and (await state(P))['t'] == 1, await P.evaluate(TITLES)
        await P.click('.chatview .fab-btn[aria-label="Back to the board"]'); await P.wait_for_timeout(900)
        assert await P.evaluate(TITLES) == ['Board'] and not (await state(P) or {}).get('t'), (await P.evaluate(TITLES), await state(P))
        await open_chat(P)
        await P.click('.chatview .fab-btn[aria-label="To-dos and reminders"]'); await P.wait_for_timeout(1000)
        await P.evaluate("history.back(); setTimeout(() => history.back(), 100)"); await P.wait_for_timeout(1300)
        assert 'localhost:8003' in P.url and await P.evaluate(TITLES) == ['Board'], ('two quick Backs = two screens', P.url, await P.evaluate(TITLES))
        # leaving the chat takes its keyboard along (the screen stays mounted, off to the side)
        await open_chat(P)
        await P.click('.chatview .cb-in'); await P.wait_for_timeout(300)
        assert await P.evaluate("document.activeElement.matches('.cb-in')")
        await swipe(P, cdp, 12, 300); await P.wait_for_timeout(1400)
        assert await P.evaluate(TITLES) == ['Board'] and not await P.evaluate("document.activeElement.matches('.cb-in')"), 'the message box kept the keyboard after the chat closed'
        assert await P.evaluate("(() => { const c = document.querySelector('#stack > .chatview'); return c.inert && getComputedStyle(c).visibility === 'hidden'; })()"), 'a closed chat must not be reachable'
        print('PASS: To-dos over the chat pops back to the conversation, then the board; a closed chat keeps nothing focused')

        # ---------- "open the chat" from deeper (a notification, a tip): the screen on top slides away, Back then leads to the board
        await to_groceries(P)
        await P.evaluate("navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { open: 'chat' } }))"); await P.wait_for_timeout(1100)
        assert await P.evaluate(TITLES) == ['Board', 'Chat'] and (await state(P))['t'] == 1, (await P.evaluate(TITLES), await state(P))
        await P.evaluate("history.back()"); await P.wait_for_timeout(900)
        assert await P.evaluate(TITLES) == ['Board'] and not (await state(P) or {}).get('t'), (await P.evaluate(TITLES), await state(P))
        await open_chat(P)  # …and with the chat already underneath: back down to it, nothing opened twice
        await P.click('.chatview .fab-btn[aria-label="To-dos and reminders"]'); await P.wait_for_timeout(1000)
        await P.click('.group .cell:has-text("Groceries")'); await P.wait_for_timeout(1000)
        await P.evaluate("navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { open: 'chat' } }))"); await P.wait_for_timeout(1100)
        assert await P.evaluate(TITLES) == ['Board', 'Chat'] and await P.locator('#stack > .chatview').count() == 1, await P.evaluate(TITLES)
        await P.evaluate("history.back()"); await P.wait_for_timeout(900)
        assert await P.evaluate(TITLES) == ['Board'] and 'localhost:8003' in P.url, (await P.evaluate(TITLES), P.url)
        stale = await P.evaluate("[...document.querySelectorAll('#stack > .view')].filter(v => v.style.transform || v.style.transition).length")
        assert stale == 0, ('no inline transforms or transitions left behind', stale)
        print('PASS: asking for the chat from a deeper screen reveals it in one step; Back leads to the board')
        await ctx.close()

        # ---------- installed-app sizing: never a viewport unit; the message bar is fully on screen
        sheets_use_lvh = """(() => { const bad = [];
          const walk = rules => { for (const r of rules) { if (r.cssRules && !r.selectorText) walk(r.cssRules);
            else if (r.selectorText && /#app|#layer/.test(r.selectorText) && /(height|top|bottom)\\s*:[^;]*\\b100(l|s|d)?vh\\b/.test(r.style.cssText)) bad.push(r.cssText); } };
          for (const s of document.styleSheets) { try { walk(s.cssRules); } catch {} }
          return bad; })()"""
        for w, h, label in ((390, 844, 'portrait'), (844, 390, 'landscape')):
            ctx, P, cdp = await phone(w, h)
            bad = await P.evaluate(sheets_use_lvh)
            assert not bad, ('the app must not be sized with 100vh/100lvh (WebKit 301994 makes them taller than the screen)', bad)
            for mode in ('browser', 'ios-fullscreen'):
                await P.evaluate(f"document.body.classList.toggle('ios-fullscreen', {str(mode == 'ios-fullscreen').lower()})"); await P.wait_for_timeout(200)
                # the board: its two actions are fully on screen
                await back_home(P)
                r = await P.evaluate("""(() => { const a = document.querySelector('#app').getBoundingClientRect(), t = [...document.querySelectorAll('.board-tray .tray-btn')].map(b => b.getBoundingClientRect());
                  return { top: a.top, bottom: a.bottom, btnTop: Math.min(...t.map(x => x.top)), btnBottom: Math.max(...t.map(x => x.bottom)), ih: innerHeight }; })()""")
                assert r['top'] == 0 and abs(r['bottom'] - r['ih']) < 1, (label, mode, 'app must fill exactly the visible screen', r)
                assert r['btnBottom'] <= r['ih'] + 0.5 and r['btnTop'] > r['ih'] - 120, (label, mode, "the board's buttons must be fully visible at the bottom", r)
                # the chat: its message bar is fully on screen
                await open_chat(P)
                r = await P.evaluate("""(() => { const a = document.querySelector('#app').getBoundingClientRect(), c = document.querySelector('.chatbar').getBoundingClientRect();
                  return { top: a.top, bottom: a.bottom, bar: c.bottom, barTop: c.top, ih: innerHeight }; })()""")
                assert r['top'] == 0 and abs(r['bottom'] - r['ih']) < 1, (label, mode, 'app must fill exactly the visible screen', r)
                assert r['bar'] <= r['ih'] + 0.5 and r['barTop'] < r['ih'] - 30, (label, mode, 'message bar must be fully visible', r)
            print(f'PASS: {label}: app fills the screen exactly; the board\'s buttons and the message bar are fully visible (browser + standalone)')
            await ctx.close()

        # ---------- keyboard open/close: the app follows the visual viewport (simulated), then returns to full height
        ctx, P, cdp = await phone()
        KB_ON = "document.body.classList.add('kb'); document.documentElement.style.setProperty('--vvh', '500px'); document.body.style.setProperty('--vvh', '500px')"
        KB_OFF = "document.body.classList.remove('kb'); document.documentElement.style.removeProperty('--vvh'); document.body.style.removeProperty('--vvh')"
        # "Add a to-do" on the board: the task box comes up focused, above the keyboard, and steps away again when left empty
        await P.click('#boardAdd'); await P.wait_for_timeout(300)
        assert await P.evaluate("document.activeElement.id") == 'cta', 'the task box must take the keyboard inside the tap'
        await P.evaluate(KB_ON); await P.wait_for_timeout(250)
        r = await P.evaluate("(() => { const a = document.querySelector('#app').getBoundingClientRect(), c = document.querySelector('#composer').getBoundingClientRect(); return [a.height, c.bottom, c.top]; })()")
        assert abs(r[0] - 500) < 1 and r[1] <= 500.5 and r[2] > 250, ('keyboard open on the board: the task box sits above the keyboard', r)
        await P.evaluate("document.activeElement.blur()"); await P.evaluate(KB_OFF); await P.wait_for_timeout(500)
        assert await P.evaluate("document.getElementById('composer').classList.contains('hide') && getComputedStyle(document.querySelector('.board-tray')).visibility === 'visible'"), "left empty, the task box goes and the board's buttons return"
        await open_chat(P)
        await P.evaluate(KB_ON)
        await P.wait_for_timeout(200)
        r = await P.evaluate("(() => { const a = document.querySelector('#app').getBoundingClientRect(), c = document.querySelector('.chatbar').getBoundingClientRect(); return [a.height, c.bottom]; })()")
        assert abs(r[0] - 500) < 1 and r[1] <= 500.5, ('keyboard open: app = visible area, bar above the keyboard', r)
        await P.evaluate("document.body.classList.remove('kb'); document.documentElement.style.removeProperty('--vvh'); document.body.style.removeProperty('--vvh')")
        await P.wait_for_timeout(200)
        r = await P.evaluate("document.querySelector('#app').getBoundingClientRect().height")
        assert abs(r - 844) < 1, ('keyboard closed: full height again', r)
        print('PASS: keyboard open/close sizing follows the visible area')
        await ctx.close()

        # ---------- Reduce Motion: navigation still one-per-swipe, without sliding
        ctx, P, cdp = await phone(reduced=True)
        await open_chat(P, wait=60)
        assert await P.evaluate(CHAT_X) == 0, 'Reduce Motion: the chat fades in place'
        await P.wait_for_timeout(600)
        await swipe(P, cdp, 12, 300); await P.wait_for_timeout(900)
        assert await P.evaluate(TITLES) == ['Board'], await P.evaluate(TITLES)
        await to_groceries(P)
        await swipe(P, cdp, 12, 300); await P.wait_for_timeout(500)
        assert await P.evaluate(TITLES) == ['Board', 'To-dos'], await P.evaluate(TITLES)
        cs = await P.evaluate("(() => { const c = getComputedStyle([...document.querySelectorAll('#stack > .view')].pop()); return [c.transitionProperty, c.transform]; })()")
        assert cs[0] == 'opacity' and cs[1] == 'none', ('Reduce Motion: screens fade, never slide', cs)
        await P.click('.group .cell:has-text("Groceries")'); await P.wait_for_timeout(60)
        x = await P.evaluate(TOP_X)
        assert x == 0, ('Reduce Motion: a pushed screen fades in place', x)
        print('PASS: Reduce Motion keeps one-swipe navigation; screens fade instead of sliding')
        await ctx.close()

        await b.close()
        print('ERRORS:', errors or 'NONE')
        assert not errors, errors

asyncio.run(main())
