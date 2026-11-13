"""To-dos through the UI on a phone: composer, chips, swipe to complete + undo, long-press menu, task sheet, lists, search,
tips, swipe back with a finger, settings, focus timer, sync to the partner."""
import asyncio
from playwright.async_api import async_playwright
from helpers import TITLES, open_chat
URL = 'http://localhost:8003/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=__import__('os').environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        errs = []
        async def phone(st, dark=False):
            ctx = await b.new_context(storage_state=st, viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme='dark' if dark else 'light')
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
            pg.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text))
            await pg.goto(URL); await pg.wait_for_timeout(2300)
            return ctx, pg
        ca, A = await phone('/tmp/twodo-A.json'); cb, B = await phone('/tmp/twodo-B.json', dark=True)
        cdp = await ca.new_cdp_session(A)
        async def drag(x0, y0, x1, y1, steps=10):
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0}]})
            for i in range(1, steps + 1):
                await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + (x1 - x0) * i / steps, 'y': y0 + (y1 - y0) * i / steps}]}); await A.wait_for_timeout(16)
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        q = lambda s: A.evaluate(s)
        # Home is the board: open To-dos with its top-right button
        await A.click('.boardview .fab-btn[aria-label="To-dos and reminders"]'); await A.wait_for_timeout(900)
        print('todos', await q("({ open: " + TITLES + ", title: document.querySelector('.view.pushed .large-title').textContent, cards: [...document.querySelectorAll('.hub-card .hub-t')].map(x => x.textContent).join(','), back: document.querySelector('.view.pushed .nav-btn.back').innerText, composer: !document.getElementById('composer').classList.contains('hide') })"))
        await A.screenshot(path='/tmp/twodo-hub.png')
        # composer: natural language → chips → add
        await A.click('#cta'); await A.keyboard.type('Movie night fri 8pm @us !! #dates')
        await A.wait_for_timeout(400)
        print('chips', await q("[...document.querySelectorAll('#chips .chip')].map(c => c.textContent)"), 'pills', await q("document.querySelectorAll('#pills .pill').length"))
        await A.screenshot(path='/tmp/twodo-composer.png')
        await A.keyboard.press('Enter'); await A.wait_for_timeout(1200)
        print('island', await q("document.getElementById('isl').innerText.replace(/\\n/g,' | ')"))
        # Today list
        await A.keyboard.press('Escape'); await A.wait_for_timeout(200)
        await A.click('.hub-card:has-text("Today")'); await A.wait_for_timeout(900)
        print('today', await q("({ title: document.querySelector('.view:not(.under) .large-title').textContent, rows: [...document.querySelectorAll('.view:not(.under) .task .tt')].map(x => x.textContent) })"))
        # add a task here (due today), then swipe it right to complete
        await A.click('#cta'); await A.keyboard.type('Buy flowers 💐'); await A.keyboard.press('Enter'); await A.wait_for_timeout(900)
        await A.evaluate("document.activeElement.blur()")
        r = await q("(() => { const t = [...document.querySelectorAll('.view:not(.under) .task')].find(x => x.textContent.includes('Buy flowers')); const b = t.getBoundingClientRect(); return { x: b.left + 60, y: b.top + b.height / 2, id: t.dataset.id }; })()")
        await A.mouse.move(r['x'], r['y']); await A.mouse.down()
        for dx in (15, 40, 80, 120, 150): await A.mouse.move(r['x'] + dx, r['y']); await A.wait_for_timeout(20)
        armed = await q(f"document.querySelector('.task[data-id=\"{r['id']}\"]').className")
        await A.mouse.up(); await A.wait_for_timeout(1600)
        print('swipe armed', armed, '| done', await q(f"D_done = (JSON.parse(localStorage.getItem('twodo:data')).tasks['{r['id']}']||{{}}).done"), '| island', await q("document.getElementById('isl').innerText.split('\\n')[0]"))
        await A.click('#isl .ib'); await A.wait_for_timeout(900)
        print('undo →', await q(f"(JSON.parse(localStorage.getItem('twodo:data')).tasks['{r['id']}']||{{}}).done"))
        # tap the circle to complete, then long-press a row for the menu
        await A.click(f".task[data-id=\"{r['id']}\"] .chk"); await A.wait_for_timeout(300)
        print('checked anim', await q(f"document.querySelector('.task[data-id=\"{r['id']}\"]').className"))
        await A.click(f".task[data-id=\"{r['id']}\"] .chk"); await A.wait_for_timeout(300)  # tap again quickly = cancel
        print('cancelled', await q(f"document.querySelector('.task[data-id=\"{r['id']}\"]').className"))
        await A.wait_for_timeout(900)
        await A.mouse.move(r['x'], r['y']); await A.mouse.down(); await A.wait_for_timeout(650); await A.mouse.up(); await A.wait_for_timeout(700)
        print('task menu', await q("({ items: [...document.querySelectorAll('#menu .mi')].map(x => x.innerText).join('|'), prev: !!document.querySelector('#menu .mprev .ti'), top: document.querySelector('#menu .mlist').style.top })"))
        await A.screenshot(path='/tmp/twodo-menu.png')
        await A.click('#menu [data-m="move"]'); await A.wait_for_timeout(400)
        print('move list', await q("[...document.querySelectorAll('#menu [data-m=moveto]')].map(x => x.innerText.trim())"))
        await A.click('#menu [data-m="moveto"]:has-text("Groceries")'); await A.wait_for_timeout(800)
        print('moved', await q("document.getElementById('isl').innerText.split('\\n')[0]"))
        # open details sheet by tapping the row
        await A.click('.view:not(.under) .task:has-text("Buy flowers") .tt'); await A.wait_for_timeout(900)
        print('sheet', await q("({ title: document.querySelector('.sheet.open h3').textContent, t: document.querySelector('.d-tt').value, date: document.querySelector('input[type=date]').value, time: document.querySelector('input[type=time]').value, prio: document.querySelector('[data-seg=dprio] .on').textContent, who: document.querySelector('[data-seg=dassign] .on').textContent, list: document.querySelector('select[aria-label=List]').selectedOptions[0].text })"))
        await A.click('[data-seg=dprio] button:has-text("!!!")'); await A.wait_for_timeout(300)
        await A.fill('.sub-add input', 'Popcorn 🍿'); await A.press('.sub-add input', 'Enter'); await A.wait_for_timeout(400)
        print('subtasks', await q("[...document.querySelectorAll('.subs .sub-row:not(.sub-add) input')].map(i => i.value)"))
        await A.screenshot(path='/tmp/twodo-sheet.png')
        await A.click('.sheet.open [data-s="done"]'); await A.wait_for_timeout(700)
        print('row meta', await q("document.querySelector('.view:not(.under) .task:has(.prio)') && document.querySelector('.view:not(.under) .task:has(.prio)').innerText.replace(/\\n/g,' | ')"))
        # swipe back with a finger (pan anywhere on the page)
        await drag(8, 400, 300, 405); await A.wait_for_timeout(900)
        print('after swipe back', await q("[...document.querySelectorAll('#stack > .view')].map(v => v.className).join(' || ')"))
        # new list
        await A.click('.cell.accent:has-text("New List")'); await A.wait_for_timeout(800)
        await A.fill('.name-inp', 'Trip ✈️'); await A.click('#lemoji button:has-text("✈️")'); await A.click('#lcolors button[aria-label=teal]'); await A.wait_for_timeout(200)
        await A.click('.sheet.open [data-s="done"]'); await A.wait_for_timeout(1400)
        print('new list view', await q("document.querySelector('.view:not(.under):not(.offright) .large-title').textContent"))
        await A.click('.view:not(.under):not(.offright) .nav-btn.back'); await A.wait_for_timeout(800)
        # search
        await A.click('.searchbar'); await A.wait_for_timeout(700)
        await A.keyboard.type('movie'); await A.wait_for_timeout(400)
        print('search', await q("[...document.querySelectorAll('.view:not(.under) .task .tt')].map(x => x.textContent)"), await q("document.activeElement.id"))
        await A.click('.view:not(.under) .nav-btn:has-text("Cancel")'); await A.wait_for_timeout(800)
        # back to the board, partner got the shared task
        await A.click('.view:not(.under) .nav-btn.back'); await A.wait_for_timeout(900)
        print('home', await q(TITLES), await q("[...document.querySelectorAll('.board .bn-title')].map(x => x.textContent)"))
        print('B sees', await B.evaluate("Object.values(JSON.parse(localStorage.getItem('twodo:data')).tasks).filter(t => t.title && (t.title.startsWith('Movie') || t.title.startsWith('Buy'))).map(t => [t.title, t.priority, t.assignee, t.listId, t.subtasks.length])"))
        # settings: theme to dark, then focus timer from a task
        await A.click('.boardview .fab-btn[aria-label=Settings]'); await A.wait_for_timeout(800)
        print('settings', await q("({ name: document.querySelector('.me-name').value, handle: document.querySelector('.me-handle').textContent, paired: [...document.querySelectorAll('#syncWrap .cell')].map(c => c.innerText.replace(/\\n/g,' ')).slice(0,4) })"))
        await A.click('[data-seg=theme] button:has-text("Dark")'); await A.wait_for_timeout(400)
        print('theme', await q("document.documentElement.dataset.theme"))
        await A.screenshot(path='/tmp/twodo-settings.png')
        await A.click('[data-seg=theme] button:has-text("Light")'); await A.wait_for_timeout(300)
        await A.click('.sheet.open [data-s="done"]'); await A.wait_for_timeout(700)
        # photo viewer on the partner's picture (in the chat's header)
        await open_chat(A)
        await A.click('.lb-av.pt'); await A.wait_for_timeout(700)
        print('photo viewer', await q("[!!document.querySelector('.pv.on'), (document.querySelector('.pv-name')||{}).textContent, !!document.querySelector('.pv-acts')]"))
        await A.keyboard.press('Escape'); await A.wait_for_timeout(700)
        print('closed', await q("!!document.querySelector('.pv')"))
        print('ERRORS:', errs or 'NONE')
        await ca.storage_state(path='/tmp/twodo-A.json', indexed_db=True)
        await b.close()
asyncio.run(main())
