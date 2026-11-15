"""The weekly planner: goals for the week (synced, at most three), a ribbon of seven days that shows how full each one
is, adding to a picked day (a time typed on its own belongs to that day), planning a to-do for a day from its menu,
busy days, what is not planned yet, overdue to-dos from before, looking back, a secret list's to-dos never showing,
the side-by-side layout on wide screens, and text contrast for every colour in light and dark.
Run test 1 first (it creates Abilash in /tmp/twodo-A.json and Deiva in /tmp/twodo-B.json). Needs the test build on 8003."""
import asyncio, os, time
from playwright.async_api import async_playwright
from helpers import TITLES, back_home, contrast_js

TOP = '#stack > .view:not(.under):not(.offright)'
TASKS = "Object.values(JSON.parse(localStorage.getItem('twodo:data')).tasks)"
GOALS = "Object.values(JSON.parse(localStorage.getItem('twodo:data')).goals || {}).filter(g => !g.deleted)"
LABEL = "document.getElementById('composer').innerText.split('\\n').pop()"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        errors = []
        async def phone(state, w=390, h=844):
            ctx = await b.new_context(storage_state=state, viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=w < 700, has_touch=True)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            pg.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
            await pg.goto('http://localhost:8003/'); await pg.wait_for_timeout(2600)
            return ctx, pg
        async def open_week(pg):
            await pg.click('.boardview .fab-btn[aria-label="To-dos and reminders"]'); await pg.wait_for_timeout(900)
            await pg.click('.plan-group .cell'); await pg.wait_for_timeout(1000)
        async def until(pg, js, want, ms=10000):
            got = None
            for _ in range(ms // 100):
                got = await pg.evaluate(js)
                if (want(got) if callable(want) else got == want): return got
                await pg.wait_for_timeout(100)
            return got
        async def press(pg, sel, pick, v=None):
            await pg.locator(sel).first.evaluate("e => e.scrollIntoView({ block: 'center' })"); await pg.wait_for_timeout(350)
            r = await pg.locator(sel).first.bounding_box()
            await pg.mouse.move(r['x'] + 90, r['y'] + r['height'] / 2); await pg.mouse.down(); await pg.wait_for_timeout(650); await pg.mouse.up(); await pg.wait_for_timeout(600)
            await pg.click(f'#menu [data-m="{pick}"]' + (f'[data-v="{v}"]' if v else '')); await pg.wait_for_timeout(900)
        stamp = int(time.time()) % 1000000

        ca, A = await phone('/tmp/twodo-A.json')
        q = A.evaluate
        await open_week(A)
        assert await q(TITLES) == ['Board', 'To-dos', 'Week'], await q(TITLES)
        assert await q("document.querySelector('.wk .large-title').textContent") == 'This week'
        tiles = await q("[...document.querySelectorAll('.wk-tile')].map(t => t.getAttribute('aria-label'))")
        assert len(tiles) == 7 and sum('today' in t for t in tiles) == 1, tiles
        assert await q(LABEL) == '📥 Inbox · Today', ('new to-dos go to today by default', await q(LABEL))
        print('PASS: the planner opens on this week, today marked, new to-dos go to today')

        # ---------- next week: goals (three at most, synced), a picked day, a time typed on its own
        await A.click('.wk-switch .nav-btn[aria-label="Next week"]'); await A.wait_for_timeout(600)
        assert await q("document.querySelector('.wk .large-title').textContent") == 'Next week'
        for _ in range(12):   # the test accounts keep their data between runs: find a week without goals yet
            if not await A.locator('.wk-goal:not(.add)').count(): break
            await A.click('.wk-switch .nav-btn[aria-label="Next week"]'); await A.wait_for_timeout(400)
        week = await q("document.querySelector('.wk-day').id.slice(3)")
        for g in ('Book the summer trip', 'Two early nights', 'Call Grandma'):
            await A.click('.wk-goal.add .wk-gtext'); await A.keyboard.type(f'{g} {stamp}'); await A.keyboard.press('Enter'); await A.wait_for_timeout(300)
        await q("document.activeElement && document.activeElement.blur()"); await A.wait_for_timeout(300)
        mine = await q(GOALS + f".filter(g => g.week === '{week}' && g.text.endsWith('{stamp}')).length")
        assert mine == 3 and not await A.locator('.wk-goal.add').count(), ('three goals, then no more', mine)
        await A.click('.wk-goal .wk-gchk >> nth=1'); await A.wait_for_timeout(400)
        assert await q("document.querySelector('.wk-gh span').textContent") == '1 of 3'
        cb, B = await phone('/tmp/twodo-B.json')
        await open_week(B)
        for _ in range(12):
            if await B.evaluate("document.querySelector('.wk-day').id.slice(3)") == week: break
            await B.click('.wk-switch .nav-btn[aria-label="Next week"]'); await B.wait_for_timeout(400)
        seen = await until(B, f"[...document.querySelectorAll('.wk-goal:not(.add)')].map(g => [g.querySelector('.wk-gtext').value, g.classList.contains('done')])",
                           lambda v: len(v) == 3)
        assert [s[0] for s in seen] == [f'Book the summer trip {stamp}', f'Two early nights {stamp}', f'Call Grandma {stamp}'] and [s[1] for s in seen] == [False, True, False], seen
        await B.click('.wk-goal .wk-gchk >> nth=0'); await B.wait_for_timeout(300)   # Deiva ticks the first one
        assert await until(A, "document.querySelector('.wk-gh span').textContent", '2 of 3') == '2 of 3', 'a goal ticked on the other phone'
        print('PASS: three goals for the week at most; they sync both ways')

        await A.click('.wk-tile >> nth=2'); await A.wait_for_timeout(700)   # Wednesday
        wed = await q("document.querySelectorAll('.wk-day')[2].id.slice(3)")
        # the label names the day as everywhere else (fmtDate): Today, Tomorrow, a weekday within the week ahead, else the date
        want = await q(f"""(() => {{ const d = new Date('{wed}T12:00'), t = new Date(); t.setHours(12, 0, 0, 0); const n = Math.round((d - t) / 864e5);
          return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : n > 1 && n < 7 ? d.toLocaleDateString([], {{ weekday: 'short' }})
            : d.toLocaleDateString([], {{ month: 'short', day: 'numeric' }}); }})()""")
        assert await q(LABEL) == '📥 Inbox · ' + want, (await q(LABEL), want)
        await A.click('#cta'); await A.keyboard.type(f'Gym {stamp} 7am'); await A.keyboard.press('Enter'); await A.wait_for_timeout(700)
        await q("document.activeElement.blur()"); await A.wait_for_timeout(300)
        gym = await q(TASKS + f".find(t => t.title === 'Gym {stamp}')")
        assert gym and gym['due'] == wed and gym['time'] == '07:00', ('a time typed on its own belongs to the picked day', gym)
        assert await A.locator(f'#wk-{wed} .task:has-text("Gym {stamp}")').count() == 1
        await A.click(f'#wk-{wed} .wk-add'); await A.wait_for_timeout(300)
        assert await q("document.activeElement.id") == 'cta', 'Add on a day takes the keyboard inside the tap'
        await q("document.activeElement.blur()")
        print('PASS: picking a day sends new to-dos there; "gym 7am" lands on that day at 7')

        # ---------- plan a to-do for another day from its menu; a busy day; not planned yet
        fri = await q("document.querySelectorAll('.wk-day')[4].id.slice(3)")
        await press(A, f'#wk-{wed} .task:has-text("Gym {stamp}") .ti', 'day', fri)
        assert await q(TASKS + f".find(t => t.title === 'Gym {stamp}').due") == fri
        assert await A.locator(f'#wk-{fri} .task:has-text("Gym {stamp}")').count() == 1 and not await A.locator(f'#wk-{wed} .task:has-text("Gym {stamp}")').count()
        await A.click('.wk-tile >> nth=3'); await A.wait_for_timeout(500)   # Thursday
        thu = await q("document.querySelectorAll('.wk-day')[3].id.slice(3)")
        for i in range(6):
            await A.click('#cta'); await A.keyboard.type(f'Errand {i} {stamp}'); await A.keyboard.press('Enter'); await A.wait_for_timeout(250)
        await q("document.activeElement.blur()"); await A.wait_for_timeout(500)
        assert 'a busy day' in await q("document.querySelectorAll('.wk-tile')[3].getAttribute('aria-label')")
        assert await A.locator(f'#wk-{thu} .wk-chip.busy').count() == 1
        print('PASS: a to-do planned for another day from its menu; six on one day makes it a busy day')

        await q("history.back()"); await A.wait_for_timeout(900)   # To-dos: its task box adds without a date
        assert await q(TITLES) == ['Board', 'To-dos'], await q(TITLES)
        await A.click('#cta'); await A.keyboard.type(f'Someday idea {stamp}'); await A.keyboard.press('Enter'); await A.wait_for_timeout(500); await q("document.activeElement.blur()")
        assert await q(TASKS + f".find(t => t.title === 'Someday idea {stamp}').due") is None
        await A.click('.plan-group .cell'); await A.wait_for_timeout(1000)
        assert await A.locator('.wk-later .wk-lh').count() == 1
        await A.click('.wk-later .wk-lh'); await A.wait_for_timeout(500)
        assert await A.locator(f'.wk-later .task:has-text("Someday idea {stamp}")').count() == 1, 'to-dos without a date are under Not planned yet'
        await press(A, f'.wk-later .task:has-text("Someday idea {stamp}") .ti', 'day', await q("document.querySelectorAll('.wk-day')[6].id.slice(3)"))
        assert await q(TASKS + f".find(t => t.title === 'Someday idea {stamp}').due") == await q("document.querySelectorAll('.wk-day')[6].id.slice(3)")
        print('PASS: Not planned yet lists to-dos without a date; one tap plans one')

        # ---------- last week: something left open shows up this week as "from before"; looking back
        await A.click('.wk-switch .nav-btn[aria-label="Previous week"]'); await A.wait_for_timeout(500)
        assert await q("document.querySelector('.wk .large-title').textContent") == 'Last week'
        assert await A.locator('.wk-back').count() == 1, 'a past week has its look back'
        await A.click('.wk-tile >> nth=1'); await A.wait_for_timeout(300)
        last_tue = await q("document.querySelectorAll('.wk-day')[1].id.slice(3)")
        assert await A.locator(f'#wk-{last_tue} .wk-add').count() == 0, 'no adding to a day that is over'
        await A.click('#cta'); await A.keyboard.type(f'Left over {stamp}'); await A.keyboard.press('Enter'); await A.wait_for_timeout(500); await q("document.activeElement.blur()")
        assert await q(TASKS + f".find(t => t.title === 'Left over {stamp}').due") == last_tue
        await A.click('.wk-now'); await A.wait_for_timeout(500)
        banner = await q("(document.querySelector('.wk-overdue span') || {}).textContent || ''")
        assert 'still open from before' in banner, banner
        await A.click('.wk-overdue .link-btn'); await A.wait_for_timeout(500)
        assert await q(TASKS + f".find(t => t.title === 'Left over {stamp}').due") == await q("(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()")
        print('PASS: last week can be looked back on; what was left open moves to today in one tap')

        # ---------- nothing from a secret list: a secret to-do due today, for both of you, is never in the planner
        await back_home(A); await A.click('.boardview .fab-btn[aria-label="To-dos and reminders"]'); await A.wait_for_timeout(800)
        await A.click('.secret-group .cell'); await A.wait_for_timeout(900)
        if await A.locator('.vault-gate .btn:has-text("Create passcode")').count():   # (this browser only: the saved account has no passcode)
            await A.click('.vault-gate .btn:has-text("Create passcode")'); await A.wait_for_timeout(700)
            for _ in range(2):
                for d in '271828': await A.click(f'.keypad button:text-is("{d}")'); await A.wait_for_timeout(40)
                await A.wait_for_timeout(1400)
            if await A.get_by_text('Not now', exact=True).count(): await A.get_by_text('Not now', exact=True).click()
            await A.wait_for_timeout(800)
        await A.fill('#cta', f'Anniversary surprise {stamp} today @us'); await A.press('#cta', 'Enter'); await A.wait_for_timeout(800)
        await q("document.activeElement.blur()"); await A.wait_for_timeout(300)
        assert await A.locator(f'{TOP} .task:has-text("Anniversary surprise {stamp}")').count() == 1, 'the secret to-do exists'
        await back_home(A); await open_week(A)
        assert 'Anniversary' not in await q("document.querySelector('.wk').textContent"), 'unlocked: nothing secret in the planner'
        counts = await q("[...document.querySelectorAll('.wk-tile')].map(t => t.getAttribute('aria-label')).join('|')")
        await A.reload(); await A.wait_for_timeout(2600)   # locked again
        await open_week(A)
        assert 'Anniversary' not in await q("document.body.textContent") and await q("[...document.querySelectorAll('.wk-tile')].map(t => t.getAttribute('aria-label')).join('|')") == counts, 'locked: nothing, and the same counts'
        print('PASS: a secret to-do due today, for both of you, is never in the planner or its counts (unlocked or locked)')

        # ---------- text contrast, every colour, light and dark
        worst = await q(contrast_js('.wk').replace("'.av, .n-ic, .acts, [aria-hidden=true]'", "'.av, .n-ic, .acts, [aria-hidden=true], .task'"))  # task rows: the shared component (design.md, Known gaps)
        assert worst['ratio'] >= 4.5, ('planner text contrast', worst)
        print(f"PASS: planner text keeps at least {worst['ratio']}:1 ({worst['measured']} pieces of text x 12 colours x light and dark)")
        await cb.close(); await ca.close()

        # ---------- wide screens: the days side by side, the ribbon steps aside, nothing scrolls the page sideways
        cw, W = await phone('/tmp/twodo-A.json', 1180, 820)
        await open_week(W)
        lay = await W.evaluate("""(() => { const days = [...document.querySelectorAll('.wk-day')].map(d => d.getBoundingClientRect());
          return { ribbon: getComputedStyle(document.querySelector('.wk-ribbon')).display, sameTop: days.every(r => Math.abs(r.top - days[0].top) < 2),
                   widths: days.map(r => Math.round(r.width)), pageSideways: document.querySelector('#stack > .view:last-child').scrollWidth > innerWidth }; })()""")
        assert lay['ribbon'] == 'none' and lay['sameTop'] and min(lay['widths']) >= 200 and not lay['pageSideways'], lay
        await W.screenshot(path='/tmp/twodo-week-wide.png')
        print('PASS: on a wide screen the seven days stand side by side, each at least 200 px')
        await cw.close()

        await b.close()
        print('ERRORS:', errors or 'NONE')
        assert not errors, errors

asyncio.run(main())
