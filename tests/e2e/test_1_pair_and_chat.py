"""Two people, everything through the UI: pair by username, chat (send, reply by swipe, react, love you), to-dos, sync."""
import asyncio, json
from playwright.async_api import async_playwright
URL = 'http://localhost:8003/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=__import__('os').environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        errs = []
        async def phone(st=None, dark=False):
            ctx = await b.new_context(storage_state=st, viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme='dark' if dark else 'light')
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
            pg.on('console', lambda m: m.type in ('error',) and errs.append('console: ' + m.text))
            await pg.goto(URL); await pg.wait_for_timeout(2200)
            return ctx, pg
        ca, A = await phone()
        cb, B = await phone(dark=True)
        async def signup(P, name, partner, email, user):
            await P.click('text=Create account'); await P.wait_for_timeout(600)
            await P.fill('#gName', name); await P.fill('#gPartner', partner); await P.fill('#gEmail', email); await P.fill('#gPass', 'password 123')
            await P.click('[data-p="create"] [data-submit]'); await P.wait_for_timeout(3500)
            await P.fill('#gUser', user); await P.click('[data-p="username"] [data-submit]'); await P.wait_for_timeout(2000)
            await P.click('text=Start using Twodo'); await P.wait_for_timeout(1200)
        await signup(A, 'Abilash', 'Deiva', 'a@x.com', 'abilash')
        await signup(B, 'Deiva', 'Abilash', 'd@x.com', 'deiva')
        # B finds @abilash and sends a request
        await B.click('.c-cta'); await B.wait_for_timeout(700)
        await B.fill('input[aria-label="Partner username"]', 'abilash'); await B.click('text=Search'); await B.wait_for_timeout(1500)
        print('B found', await B.evaluate("[...document.querySelectorAll('.fr-card b')].map(x => x.textContent)"))
        await B.screenshot(path='/tmp/twodo-find.png')
        await B.click('.fr-card button:has-text("Add")'); await B.wait_for_timeout(1500)
        print('B sent', await B.evaluate("[...document.querySelectorAll('.fr-card span')].map(x => x.textContent)"))
        await B.click('.sheet.open [data-s="done"]'); await B.wait_for_timeout(700)
        # A sees the request on Home and accepts it
        await A.wait_for_timeout(2500)
        print('A home', await A.evaluate("(document.querySelector('.c-empty h3')||{}).textContent"))
        await A.click('.c-cta'); await A.wait_for_timeout(800)
        await A.click('.fr-card button:has-text("Accept")'); await A.wait_for_timeout(1200)
        print('confirm', await A.evaluate("(document.querySelector('.alert p')||{}).textContent"))
        await A.click('.alert button[data-r="1"]'); await A.wait_for_timeout(2500)
        print('A island after accept', await A.evaluate("document.getElementById('isl').innerText"), await A.evaluate("JSON.stringify(JSON.parse(localStorage.getItem('twodo:local')).pair)"))
        await A.wait_for_timeout(1500)
        print('A paired', await A.evaluate("({ name: document.querySelector('.lb-name').textContent, sub: document.querySelector('.c-sub').textContent, empty: (document.querySelector('.c-empty h3')||{}).textContent })"))
        await B.wait_for_timeout(2500)
        print('B paired', await B.evaluate("({ name: document.querySelector('.lb-name').textContent, sub: document.querySelector('.c-sub').textContent })"))
        # chat: A types and sends with a real tap; the keyboard (focus) stays
        await A.click('.cb-in'); await A.keyboard.type('Hey you 👋 how was your day?')
        box = await A.evaluate("(() => { const r = document.querySelector('.cb-send').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
        await A.touchscreen.tap(*box); await A.wait_for_timeout(1200)
        print('A sent; focus kept', await A.evaluate("[document.activeElement.className, document.querySelectorAll('.msg-row.me').length, document.querySelector('.c-status').className]"))
        await B.wait_for_timeout(1500)
        print('B got', await B.evaluate("[...document.querySelectorAll('.msg-row.them .bub')].map(x => x.textContent)"))
        print('A seen', await A.evaluate("document.querySelector('.c-status').className"))
        # B replies by swiping A's message
        r = await B.evaluate("(() => { const w = document.querySelector('.msg-row.them .bwrap').getBoundingClientRect(); return { x: w.left + w.width / 2, y: w.top + w.height / 2 }; })()")
        await B.mouse.move(r['x'], r['y']); await B.mouse.down()
        for dx in (12, 30, 50, 70, 85): await B.mouse.move(r['x'] + dx, r['y']); await B.wait_for_timeout(25)
        await B.mouse.up(); await B.wait_for_timeout(500)
        print('B reply bar', await B.evaluate("[document.querySelector('.cb-reply').hidden, document.querySelector('.cb-reply b').textContent]"))
        await B.fill('.cb-in', 'Long! But I made it 😩'); await B.press('.cb-in', 'Enter')  # touch device: Enter = newline → use the button
        await B.click('.cb-send'); await B.wait_for_timeout(1500)
        print('B quote', await B.evaluate("(document.querySelector('.bub.me .rq')||{}).textContent"))
        await A.wait_for_timeout(1500)
        print('A sees quote', await A.evaluate("(document.querySelector('.bub.them .rq')||{}).textContent"))
        # A reacts with 😂 via long-press
        rr = await A.evaluate("(() => { const w = [...document.querySelectorAll('.msg-row.them .bwrap')].pop().getBoundingClientRect(); return { x: w.left + 30, y: w.top + w.height / 2 }; })()")
        await A.mouse.move(rr['x'], rr['y']); await A.mouse.down(); await A.wait_for_timeout(650); await A.mouse.up(); await A.wait_for_timeout(700)
        print('picker', await A.evaluate("[...document.querySelectorAll('.mpal.tbp button')].map(b => b.dataset.v).join(' ')"))
        await A.screenshot(path='/tmp/twodo-picker.png')
        await A.click('.mpal.tbp button[data-v="😂"]'); await A.wait_for_timeout(1500)
        print('A tapb', await A.evaluate("[...document.querySelectorAll('.tapb')].map(t => t.textContent)"))
        await B.wait_for_timeout(1200)
        print('B tapb', await B.evaluate("[...document.querySelectorAll('.tapb')].map(t => t.textContent)"))
        # Love you
        await A.fill('.cb-in', 'love you 😘'); await A.click('.cb-send'); await A.wait_for_timeout(1500)
        await B.fill('.cb-in', 'I love you too ❤️'); await B.click('.cb-send'); await B.wait_for_timeout(1600)
        print('love', await A.evaluate("[!!document.querySelector('.ly-layer'), document.querySelectorAll('.ly-p').length]"), await B.evaluate("!!document.querySelector('.ly-layer')"))
        await A.screenshot(path='/tmp/twodo-love.png')
        await A.wait_for_timeout(5000)
        print('love gone', await A.evaluate("!!document.querySelector('.ly-layer')"))
        await A.screenshot(path='/tmp/twodo-chat.png'); await B.screenshot(path='/tmp/twodo-chat_dark.png')
        await ca.storage_state(path='/tmp/twodo-A.json', indexed_db=True); await cb.storage_state(path='/tmp/twodo-B.json', indexed_db=True)
        print('ERRORS:', errs or 'NONE')
        await b.close()
asyncio.run(main())
