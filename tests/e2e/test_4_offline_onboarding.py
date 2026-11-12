"""Without accounts (no Firebase config): onboarding, Home = To-dos, tasks work offline, settings say sync is off."""
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=__import__('os').environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        await pg.goto('http://localhost:8004/'); await pg.wait_for_timeout(2200)
        q = lambda s: pg.evaluate(s)
        print('ob', await q("(document.querySelector('#ob h1')||{}).textContent"))
        await pg.click('text=Get started'); await pg.wait_for_timeout(700)
        print('continue disabled', await q("document.querySelector('[data-p=names] .btn').disabled"))
        await pg.fill('#obA', 'Abilash'); await pg.fill('#obB', 'Deiva'); await pg.click('[data-ck=b] button[aria-label=purple]')
        print('continue enabled', await q("!document.querySelector('[data-p=names] .btn').disabled"))
        await pg.click('[data-p=names] .btn:has-text("Continue")'); await pg.wait_for_timeout(700)
        print('ready', await q("document.querySelector('[data-p=ready] h1').textContent"))
        await pg.click('text=Start using Twodo'); await pg.wait_for_timeout(1500)
        print('home', await q("({ ob: !!document.getElementById('ob'), title: document.querySelector('.large-title').textContent, left: document.querySelector('.nav-side.l button').getAttribute('aria-label'), composer: !document.getElementById('composer').classList.contains('hide'), lists: [...document.querySelectorAll('.group .cell .grow')].map(x => x.textContent).join(',') })"))
        await pg.screenshot(path='/tmp/twodo-home.png')
        await pg.click('.nav-side.l button'); await pg.wait_for_timeout(800)
        print('settings', await q("document.querySelector('#syncWrap').innerText.split('\\n')[0]"), await q("!!document.querySelector('[data-seg=me]')"))
        print('ERRORS:', errs or 'NONE')
        await b.close()
asyncio.run(main())
