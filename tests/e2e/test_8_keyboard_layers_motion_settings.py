"""Keyboard focus rules, layers, rows sliding into place, Reduce Motion fades and the new Settings layout.
Run test 1 first (it creates the accounts saved in /tmp/twodo-A.json)."""
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=__import__('os').environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        errs = []
        async def phone(w=390, h=844, reduced=False):
            ctx = await b.new_context(storage_state='/tmp/twodo-A.json', viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion='reduce' if reduced else 'no-preference')
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
            pg.on('console', lambda m: m.type in ('error', 'warning') and errs.append('console: ' + m.text))
            await pg.goto('http://localhost:8003/'); await pg.wait_for_timeout(2300)
            return ctx, pg
        ctx, P = await phone()
        q = P.evaluate
        cdp = await ctx.new_cdp_session(P)
        async def tap(x, y, hold=40):
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]}); await P.wait_for_timeout(hold)
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); await P.wait_for_timeout(300)
        async def center(sel):
            r = await q(f"(() => {{ const r = document.querySelector({sel!r}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }})()")
            return r[0], r[1]

        # ---------- composer: tapping pills keeps the field focused; adding keeps focus and never scrolls the page
        await P.click('.fab-btn[aria-label="To-dos and reminders"]'); await P.wait_for_timeout(1200)
        await P.click('.group .cell:has-text("Groceries")'); await P.wait_for_timeout(1100)
        await P.click('#cta'); await P.wait_for_timeout(500)
        await P.fill('#cta', 'Bread'); await P.wait_for_timeout(300)
        x, y = await center('#pills .pill')
        await tap(x, y)
        print('pill tap keeps focus', await q("[document.activeElement && document.activeElement.id, document.querySelector('#cta').value]"))
        await P.press('#cta', 'Enter'); await P.wait_for_timeout(900)
        print('after add', await q("[document.activeElement && document.activeElement.id, scrollY, document.scrollingElement.scrollTop]"))
        # rows slide: complete the first row; the one below gets a slide animation
        await q("document.activeElement.blur()"); await P.wait_for_timeout(400)
        n0 = await q("document.querySelectorAll('.view:not(.under) .task').length")
        await P.click('.view:not(.under) .task .chk >> nth=0'); await P.wait_for_timeout(940)
        print('rows slide up', n0, '→', await q("document.querySelectorAll('.view:not(.under) .task').length"),
              await q("[...document.querySelectorAll('.view:not(.under) .task')].some(t => t.getAnimations().length > 0)"))
        await q("document.querySelector('.nav-btn.back').click()"); await P.wait_for_timeout(900)

        # ---------- no surprise keyboard: a new list doesn't focus its name on a phone; search focuses inside the tap
        await P.click('.cell.accent:has-text("New List")'); await P.wait_for_timeout(1000)
        print('new list focused on phone', await q("document.activeElement && document.activeElement.className"))
        await q("document.querySelector('.sheet.open .nav-btn').click()"); await P.wait_for_timeout(1200)
        await q("document.querySelector('.view:not(.under)').scrollTop = 0"); await P.wait_for_timeout(300)
        x, y = await center('.view:not(.under) .searchbar')
        await tap(x, y); await P.wait_for_timeout(300)
        print('search focused in the tap', await q("[document.activeElement && document.activeElement.id, [...document.querySelectorAll('#stack > .view')].length, document.elementFromPoint(%f, %f)?.className]" % (x, y)))
        await q("document.querySelector('.view:not(.under) .nav-side.r .nav-btn').click()"); await P.wait_for_timeout(900)

        # ---------- layers and the island
        z = await q("""(() => { const z = s => +getComputedStyle(document.querySelector(s)).zIndex || 0; return { layer: z('#layer'), menu: z('#menu'), island: z('#island') }; })()""")
        tok = await q("""(() => { const cs = getComputedStyle(document.documentElement); return ['--z-sheet','--z-menu','--z-overlay','--z-fx','--z-alert','--z-island'].map(k => +cs.getPropertyValue(k)); })()""")
        print('layers', z, 'scale ascending', tok == sorted(tok), tok)
        await P.click('.hub-card:has-text("Today")'); await P.wait_for_timeout(1100)
        await P.click('.view:not(.under) .task .chk >> nth=0'); await P.wait_for_timeout(1300)
        print('island under the header', await q("(() => { const i = document.querySelector('#isl').getBoundingClientRect(), n = document.querySelector('.view:not(.under) .nav').getBoundingClientRect(); return [Math.round(i.top), Math.round(n.bottom), i.top >= n.bottom - 1]; })()"))

        # ---------- Settings: inset-grouped cards, danger group last, tall segmented controls
        await q("document.querySelector('.view:not(.under) .nav-btn.back').click()"); await P.wait_for_timeout(900)
        await q("document.querySelector('.view:not(.under) .nav-btn.back').click()"); await P.wait_for_timeout(900)
        await P.click('.fab-btn[aria-label="Settings"]'); await P.wait_for_timeout(1000)
        print('settings', await q("""(() => {
          const groups = [...document.querySelectorAll('.sheet.open .sheet-body > .group')];
          const segs = [...document.querySelectorAll('.sheet.open .cell .seg')].map(s => Math.round(s.getBoundingClientRect().height));
          const last = groups[groups.length - 1];
          return { cards: groups.every(g => getComputedStyle(g).backgroundColor !== 'rgba(0, 0, 0, 0)' && parseFloat(getComputedStyle(g).borderTopLeftRadius) >= 12),
                   danger: last.classList.contains('danger') ? [...last.querySelectorAll('.cell')].map(c => c.textContent.trim()) : null, segs,
                   unpairInTogether: !!document.querySelector('#syncWrap .cell.red') };
        })()"""))
        await ctx.close()

        # ---------- iPhone SE width: nothing in Settings is cut off
        ctx, S = await phone(320, 568)
        await S.click('.fab-btn[aria-label="Settings"]'); await S.wait_for_timeout(1000)
        print('320 cut off', await S.evaluate("""[...document.querySelectorAll('.sheet.open .sheet-body *')].filter(e => { const r = e.getBoundingClientRect();
          return r.width && e.scrollWidth > e.clientWidth + 1 && !['INPUT', 'TEXTAREA', 'svg', 'path'].includes(e.tagName) && getComputedStyle(e).overflowX !== 'auto'; }).map(e => e.textContent.trim().slice(0, 20))"""))
        await ctx.close()

        # ---------- Reduce Motion: screens fade instead of sliding
        ctx, R = await phone(reduced=True)
        await R.click('.fab-btn[aria-label="To-dos and reminders"]'); await R.wait_for_timeout(1200)
        print('reduce motion', await R.evaluate("(() => { const v = document.querySelector('.view.pushed'), u = document.querySelector('.view.under'); return [getComputedStyle(v).transitionProperty, getComputedStyle(u).transform]; })()"))
        await ctx.close()
        print('ERRORS:', errs or 'NONE')
        await b.close()
asyncio.run(main())
