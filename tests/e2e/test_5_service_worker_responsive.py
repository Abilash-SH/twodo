"""Service worker (production build): installs, caches the whole build, the app reloads offline. Plus landscape / tablet sizes."""
import asyncio
from playwright.async_api import async_playwright
from helpers import TITLES, open_chat, back_home
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=__import__('os').environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        ctx = await b.new_context(storage_state='/tmp/twodo-A.json', viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        await pg.goto('http://localhost:8003/'); await pg.wait_for_timeout(2500)
        print('sw', await pg.evaluate("navigator.serviceWorker.getRegistration().then(r => r && [r.scope, !!r.active])"))
        await pg.reload(); await pg.wait_for_timeout(2000)
        print('controlled', await pg.evaluate("!!navigator.serviceWorker.controller"), await pg.evaluate("caches.keys()"),
              await pg.evaluate("caches.keys().then(k => caches.open(k[0])).then(c => c.keys()).then(r => r.length)"))
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_timeout(2500)
        # offline: the board opens from this phone's copy and says so; the conversation is there too
        print('offline reload', await pg.evaluate("({ open: " + TITLES + ", tape: (document.querySelector('.board .tape')||{}).textContent, notes: document.querySelectorAll('.board .note').length, splash: document.getElementById('splash').hidden })"))
        await open_chat(pg)
        print('offline chat', await pg.evaluate("document.querySelectorAll('.chatview .msg-row').length"))
        await back_home(pg)
        await pg.click('.boardview .fab-btn[aria-label="To-dos and reminders"]'); await pg.wait_for_timeout(900)
        await pg.click('#cta'); await pg.keyboard.type('Offline task'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(800)
        print('offline add', await pg.evaluate("Object.values(JSON.parse(localStorage.getItem('twodo:data')).tasks).some(t => t.title === 'Offline task')"))
        await ctx.set_offline(False); await pg.wait_for_timeout(3000)
        errs[:] = [e for e in errs if 'ERR_INTERNET_DISCONNECTED' not in e and 'Failed to fetch' not in e]
        for (w, h, name) in [(844, 390, 'landscape'), (1024, 1366, 'ipad'), (1366, 1024, 'ipad-land')]:
            c2 = await b.new_context(storage_state='/tmp/twodo-A.json', viewport={'width': w, 'height': h}, is_mobile=w < 900, has_touch=True)
            p2 = await c2.new_page(); p2.on('pageerror', lambda e: errs.append(str(e)))
            await p2.goto('http://localhost:8003/'); await p2.wait_for_timeout(2300)
            await p2.screenshot(path=f'/tmp/n6_{name}.png')
            # the board: its two actions stay on screen, every note stays inside the board, nothing scrolls sideways
            print(name, 'board', await p2.evaluate("(() => { const v = document.querySelector('.boardview'), bd = document.querySelector('.board').getBoundingClientRect(), tray = document.querySelector('.board-tray').getBoundingClientRect(); return { trayBottom: Math.round(tray.bottom), vh: innerHeight, boardW: Math.round(bd.width), notesInside: [...document.querySelectorAll('.board .note, .board .strip')].every(n => { const r = n.getBoundingClientRect(); return r.left >= bd.left - 1 && r.right <= bd.right + 1; }), overflowX: v.scrollWidth > v.clientWidth || document.documentElement.scrollWidth > innerWidth }; })()"))
            await open_chat(p2)
            await p2.screenshot(path=f'/tmp/n6_{name}_chat.png')
            print(name, 'chat', await p2.evaluate("(() => { const h = document.querySelector('.chat-nav').getBoundingClientRect(), bar = document.querySelector('.chatbar').getBoundingClientRect(); return { headH: Math.round(h.height), barBottom: Math.round(bar.bottom), vh: innerHeight, overflowX: document.documentElement.scrollWidth > innerWidth }; })()"))
            await c2.close()
        print('ERRORS:', errs or 'NONE')
        await b.close()
asyncio.run(main())
