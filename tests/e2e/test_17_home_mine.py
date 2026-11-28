"""Home and Today show your to-dos and the shared ones (asked for 2026-11-23): "only task under my name and common
ones". Your partner's own to-dos (under their name, or made by them for no one) stay out of Home's count, what your
character says and Today; Today's *All* still shows them, and the To-dos screen counts Today the same way as Home.
Run test 1 first (it creates Abilash and Deiva). Needs the test build on 8003."""
import asyncio, os, time
from playwright.async_api import async_playwright
from helpers import TITLES, back_home

CARD = "(() => { const m = /^(\\d+)/.exec((document.querySelector('.board .home-card-title') || {}).textContent || ''); return m ? +m[1] : 0; })()"
ROWS = "[...document.querySelectorAll('#stack > .view:not(.under):not(.offright) .task .tt, #stack > .view:not(.under):not(.offright) .task .title')].map(e => e.textContent)"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        errors = []
        async def phone(state):
            ctx = await b.new_context(storage_state=state, viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            pg.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
            await pg.goto('http://localhost:8003/'); await pg.wait_for_timeout(2600)
            return ctx, pg
        async def until(pg, js, want, ms=12000):
            got = None
            for _ in range(ms // 100):
                got = await pg.evaluate(js)
                if (want(got) if callable(want) else got == want): return got
                await pg.wait_for_timeout(100)
            return got
        stamp = int(time.time()) % 1000000
        ca, A = await phone('/tmp/twodo-A.json'); cb, B = await phone('/tmp/twodo-B.json')
        before = await A.evaluate(CARD)
        # Deiva adds four to-dos for today from her Home: hers, Abilash's, both of yours, and one for no one
        titles = {'hers': f'Hers only {stamp}', 'his': f'For Abilash {stamp}', 'ours': f'Ours {stamp}', 'loose': f'Loose one {stamp}'}
        for text in (f"{titles['hers']} @me ", f"{titles['his']} @abilash ", f"{titles['ours']} @us ", titles['loose']):
            await B.click('#boardAdd'); await B.wait_for_timeout(300)
            await B.keyboard.type(text); await B.keyboard.press('Enter'); await B.wait_for_timeout(700)
            await B.evaluate("document.activeElement.blur()"); await B.wait_for_timeout(400)
        got = await until(A, CARD, before + 2, 15000)
        assert got == before + 2, ('Home counts the one under your name and the shared one, not Deiva\'s own', before, got)
        await A.wait_for_timeout(1500)
        assert await A.evaluate(CARD) == before + 2, 'and stays so'
        print(f'PASS: Home\'s Today counts your to-dos and the shared ones only ({before} -> {got}; Deiva\'s own two are not there)')

        await A.click('.board .home-card'); await A.wait_for_timeout(1100)
        assert await A.evaluate(TITLES) == ['Board', 'Today']
        rows = ' | '.join(await A.evaluate(ROWS))
        assert titles['his'] in rows and titles['ours'] in rows and titles['hers'] not in rows and titles['loose'] not in rows, rows
        assert await A.evaluate("document.querySelector('[data-seg=who] [aria-selected=true], [data-seg=who] .on').textContent") == 'Abilash', 'Today starts on your own'
        await A.click('[data-seg=who] button[data-v=all]'); await A.wait_for_timeout(700)
        rows = ' | '.join(await A.evaluate(ROWS))
        assert all(t in rows for t in titles.values()), ('All shows Deiva\'s too', rows)
        await A.click('[data-seg=who] button[data-v=me]'); await A.wait_for_timeout(500)
        await back_home(A)
        await A.click('.boardview .fab-btn[aria-label="To-dos and reminders"]'); await A.wait_for_timeout(1000)
        hub = await A.evaluate("+[...document.querySelectorAll('.hub-card')].find(c => c.querySelector('.hub-t').textContent === 'Today').querySelector('.hub-n').textContent")
        assert hub == got, ('the To-dos screen counts Today like Home', hub, got)
        await back_home(A)
        print('PASS: Today opens on your own and shared to-dos; All shows your partner\'s too; the To-dos screen counts Today like Home')

        await cb.close(); await ca.close(); await b.close()
        print('ERRORS:', errors or 'NONE')
        assert not errors, errors

asyncio.run(main())
