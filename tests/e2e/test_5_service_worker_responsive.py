"""Service worker (production build): installs, caches the whole build, the app reloads offline. Plus landscape / tablet sizes."""
import asyncio
from playwright.async_api import async_playwright
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
        print('offline reload', await pg.evaluate("({ chat: !!document.querySelector('.chatview'), msgs: document.querySelectorAll('.msg-row').length, splash: document.getElementById('splash').hidden })"))
        await pg.click('.fab-btn[aria-label="To-dos and reminders"]'); await pg.wait_for_timeout(900)
        await pg.click('#cta'); await pg.keyboard.type('Offline task'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(800)
        print('offline add', await pg.evaluate("Object.values(JSON.parse(localStorage.getItem('twodo:data')).tasks).some(t => t.title === 'Offline task')"))
        await ctx.set_offline(False); await pg.wait_for_timeout(3000)
        errs[:] = [e for e in errs if 'ERR_INTERNET_DISCONNECTED' not in e and 'Failed to fetch' not in e]
        for (w, h, name) in [(844, 390, 'landscape'), (1024, 1366, 'ipad'), (1366, 1024, 'ipad-land')]:
            c2 = await b.new_context(storage_state='/tmp/twodo-A.json', viewport={'width': w, 'height': h}, is_mobile=w < 900, has_touch=True)
            p2 = await c2.new_page(); p2.on('pageerror', lambda e: errs.append(str(e)))
            await p2.goto('http://localhost:8003/'); await p2.wait_for_timeout(2300)
            await p2.screenshot(path=f'/tmp/n6_{name}.png')
            print(name, await p2.evaluate("(() => { const h = document.querySelector('.chat-nav').getBoundingClientRect(), bar = document.querySelector('.chatbar').getBoundingClientRect(); return { headH: Math.round(h.height), barBottom: Math.round(bar.bottom), vh: innerHeight, overflowX: document.documentElement.scrollWidth > innerWidth }; })()"))
            await c2.close()
        print('ERRORS:', errs or 'NONE')
        await b.close()
asyncio.run(main())
