"""The journal by day: a page each per day, and only today's can be written. A week strip (today ringed, days to come
shut) and a calendar sheet pick the day; earlier days are read-only. Your page: type, Save (it changes the same
record all day), a draft waits if you leave, an emptied page is deleted on both phones (after a question). Your
partner sees it live (and on Home), can't edit it, and gives it a heart (a double tap or the button; a second double
tap keeps it); you see "Deiva loved your page". Nothing else: no prompts, weather, tabs or private pages. Contrast for
every colour, light and dark; the wide layout.
Run test 1 first (it creates Abilash in /tmp/twodo-A.json and Deiva in /tmp/twodo-B.json). Needs the test build on 8003."""
import asyncio, os, time
from playwright.async_api import async_playwright
from helpers import TITLES, contrast_js

JOURNAL = "Object.values(JSON.parse(localStorage.getItem('twodo:data')).journal || {})"
DAY = "(n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })"
MINE = "[...document.querySelectorAll('.jd-block:not(.theirs) .jd-text')].map(t => t.textContent)"
THEIRS = "[...document.querySelectorAll('.jd-block.theirs .jd-text')].map(t => t.textContent)"
BADGE = "document.querySelector('.jd-badge').textContent"

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
        async def open_journal(pg):
            await pg.click('.boardview .fab-btn[aria-label="To-dos and reminders"]'); await pg.wait_for_timeout(800)
            await pg.click('.plan-group .cell:has-text("Journal")'); await pg.wait_for_timeout(1000)
        async def until(pg, js, want, ms=12000):
            got = None
            for _ in range(ms // 100):
                got = await pg.evaluate(js)
                if (want(got) if callable(want) else got == want): return got
                await pg.wait_for_timeout(100)
            return got
        async def double_tap(pg, sel):
            box = await pg.locator(sel).bounding_box()
            await pg.mouse.click(box['x'] + 20, box['y'] + 10); await pg.wait_for_timeout(90); await pg.mouse.click(box['x'] + 20, box['y'] + 10)
            await pg.wait_for_timeout(400)
        stamp = int(time.time()) % 1000000
        mine = f'Market with you this morning, the giant pumpkin {stamp}'
        edited = f'Market with you this morning, the giant pumpkin and the soup {stamp}'
        reply = f'Best Sunday in ages {stamp}'
        older = f'Rain all day, soup and a film {stamp}'

        ca, A = await phone('/tmp/twodo-A.json')
        q = A.evaluate
        today, yesterday, tomorrow = await q(DAY + '(0)'), await q(DAY + '(-1)'), await q(DAY + '(1)')
        await open_journal(A)
        assert await q(TITLES) == ['Board', 'To-dos', 'Journal'], await q(TITLES)
        if await q("document.querySelector('.jd-ta').value"):   # a page left by an earlier run that stopped half way: clear it
            await A.fill('.jd-ta', ''); await A.click('.jd-btn'); await A.wait_for_timeout(400); await A.click('.alert button[data-r="1"]'); await A.wait_for_timeout(800)
        raw = await q("['.jtab', '.jr-weather', '.jr-prompt', '.jr-gate', '.segmented', '.jt-feed'].filter(s => document.querySelector('.jd ' + s))")
        assert not raw and 'Just me' not in await q("document.querySelector('.jd').textContent"), ('raw: no tabs, weather, prompts, thread or private journal', raw)
        week = await q("[...document.querySelectorAll('.jd-day')].map(d => [d.dataset.day, d.classList.contains('today'), d.classList.contains('on'), d.disabled])")
        assert len(week) == 7 and [d[0] for d in week if d[1] and d[2]] == [today], ('seven days, today chosen and ringed', week)
        assert all(d[3] == (d[0] > today) for d in week), ('days to come are shut, the others open', week)
        assert await q("document.querySelector('.jd-arrow[aria-label=\"Next week\"]').disabled"), 'no going to weeks to come'
        assert await q(BADGE) == 'Today' and await q("document.querySelectorAll('.jd-stage .jd-char').length") == 2, 'the stage: today, both of you'
        assert await q("document.querySelector('.jd-ta').value") == '' and await q("document.querySelector('.jd-btn').disabled"), 'nothing to save yet'
        print('PASS: the journal opens on today: a week strip (days to come shut), both characters, an empty page; no tabs, prompts or private pages')

        # ---------- write today's page, then change it: one record for the day
        await A.click('.jd-ta'); await A.keyboard.type(mine)
        assert await q("[document.querySelector('.jd-btn').disabled, document.querySelector('.jd-btn').textContent]") == [False, 'Save page']
        await A.click('.jd-btn'); await A.wait_for_timeout(600)
        assert await q("[document.querySelector('.jd-btn').disabled, document.querySelector('.jd-btn').textContent, (document.querySelector('.jd-saved') || {}).textContent]") == [True, 'Saved', 'Saved']
        rec = await q(JOURNAL + f".find(e => e.text === {mine!r})")
        assert rec and rec['id'].startswith('us-p') and rec['date'] == today and not rec['private'] and rec['mood'] == 0 and rec['prompt'] == '', rec
        tl = await q("document.querySelector('.jd-day.today').getAttribute('aria-label')")
        assert ('You wrote.' in tl or 'You and ' in tl) and await q("document.querySelectorAll('.jd-day.today .jd-dots i').length") >= 1, ('today shows that you wrote', tl)
        await A.fill('.jd-ta', edited); await A.click('.jd-btn'); await A.wait_for_timeout(600)
        me = await q("JSON.parse(localStorage.getItem('twodo:local')).me")
        todays = await q(JOURNAL + f".filter(e => e.date === {today!r} && e.who === {me!r} && !e.deleted && !e.id.startsWith('us-h-'))")
        assert len(todays) == 1 and todays[0]['id'] == rec['id'] and todays[0]['text'] == edited, ('Save changes the same page all day', todays)
        print('PASS: Save writes today\'s page (Saved, a dot on today); saving again changes the same record')

        # ---------- your partner sees it live (and Home says so), can't edit it, and writes theirs
        cb, B = await phone('/tmp/twodo-B.json')
        assert await until(B, "document.querySelector('.boardview .fab-btn[aria-label^=\"Journal\"]').getAttribute('aria-label')", 'Journal, new today') == 'Journal, new today', 'Home says there is something new in the journal'
        await B.click('.boardview .fab-btn[aria-label^="Journal"]'); await B.wait_for_timeout(1000)
        assert await B.evaluate(TITLES) == ['Board', 'Journal']
        assert await until(B, THEIRS, [edited]) == [edited], "Abilash's page, on Deiva's phone"
        assert await B.evaluate("[!!document.querySelector('.jd-block.theirs textarea'), document.querySelector('.jd-block.theirs .jd-who b').textContent]") == [False, 'Abilash’s page'], 'read only for the partner'
        await B.fill('.jd-ta', reply); await B.click('.jd-btn'); await B.wait_for_timeout(500)
        assert await until(A, THEIRS, [reply]) == [reply], "Deiva's page arrives live"
        print('PASS: your partner sees your page live (and Home says so) without a way to edit it; theirs arrives on yours')

        # ---------- hearts: a double tap or the button, on your partner's page only
        entry = f'.jd-block.theirs .jd-entry[data-id="{rec["id"]}"]'
        assert await B.locator(f'{entry} .jd-heart').count() == 1 and not await q("document.querySelectorAll('.jd-block:not(.theirs) .jd-heart').length"), 'a heart on your partner\'s page, none on yours'
        await B.locator(entry).evaluate("e => e.scrollIntoView({ block: 'center' })"); await B.wait_for_timeout(300)
        await double_tap(B, f'{entry} .jd-text')
        assert await B.evaluate(f"document.querySelector('{entry} .jd-heart').getAttribute('aria-pressed')") == 'true', 'a double tap gives it your heart'
        hid = f"us-h-{rec['id']}-" + await B.evaluate("JSON.parse(localStorage.getItem('twodo:local')).me")
        assert await B.evaluate(JOURNAL + f".some(e => e.id === {hid!r} && !e.deleted && e.text === '')"), 'a heart is its own record, with no text'
        await double_tap(B, f'{entry} .jd-text')
        assert await B.evaluate(f"document.querySelector('{entry} .jd-heart').getAttribute('aria-pressed')") == 'true', 'a second double tap never takes it back'
        LOVED = "(document.querySelector('.jd-loved') || {}).textContent || ''"
        assert await until(A, LOVED, 'Deiva loved your page') == 'Deiva loved your page'
        await B.click(f'{entry} .jd-heart'); await B.wait_for_timeout(400)
        assert await B.evaluate(f"document.querySelector('{entry} .jd-heart').getAttribute('aria-pressed')") == 'false', 'the button takes it back'
        assert await until(A, LOVED, '') == '', 'and it goes on the other phone'
        await B.click(f'{entry} .jd-heart'); await B.wait_for_timeout(300)   # and gives it again
        assert await until(A, LOVED, 'Deiva loved your page') == 'Deiva loved your page'
        print('PASS: your partner gives your page a heart with a double tap or the button (a second double tap keeps it); you see "Deiva loved your page"; the button takes it back')

        # ---------- a draft waits while you look elsewhere
        await A.fill('.jd-ta', 'half a thought'); await q("document.activeElement.blur()")
        await q("history.back()"); await A.wait_for_timeout(800)
        await A.click('.plan-group .cell:has-text("Journal")'); await A.wait_for_timeout(900)
        assert await q("[document.querySelector('.jd-ta').value, document.querySelector('.jd-btn').disabled]") == ['half a thought', False]
        await A.fill('.jd-ta', edited); await A.wait_for_timeout(200)
        assert await q("[document.querySelector('.jd-btn').disabled, document.querySelector('.jd-btn').textContent]") == [True, 'Saved'], 'back to what is saved'
        print('PASS: what you were writing is still there when you come back')

        # ---------- earlier days are read-only; the calendar picks any of them
        if not await q(f"!!document.querySelector('.jd-day[data-day=\"{yesterday}\"]')"):
            await A.click('.jd-arrow[aria-label="Previous week"]'); await A.wait_for_timeout(300)
        await A.click(f'.jd-day[data-day="{yesterday}"]'); await A.wait_for_timeout(400)
        assert await q(BADGE) == 'Read only' and not await q("!!document.querySelector('.jd-ta')"), 'yesterday: read only, no writing box'
        assert await q("[document.querySelector('.jd-lock').textContent, document.querySelector('.jd-block:not(.theirs) .jd-none').textContent]") == ['Only today’s page can be written.', 'You didn’t write this day.']
        await A.click('.jd-calbtn'); await A.wait_for_timeout(700)
        cal = await q(f"""(() => {{ const s = document.querySelector('.sheet.open'); return s && [s.getAttribute('aria-label'), (s.querySelector('.jd-cd.on') || {{}}).dataset?.day,
          (s.querySelector('.jd-cd[data-day="{tomorrow}"]') || {{ disabled: true }}).disabled, (s.querySelector('.jd-cd[data-day="{today}"]') || {{}}).className]; }})()""")
        assert cal and cal[0] == 'Pick a day' and cal[1] == yesterday and cal[2] is True and 'today' in cal[3], ('the calendar: the chosen day, today ringed, days to come shut', cal)
        await A.click('.sheet.open .jd-go'); await A.wait_for_timeout(700)
        assert await q("!document.querySelector('.sheet.open')") and await q(BADGE) == 'Today' and await q("document.querySelector('.jd-ta').value") == edited, 'Go to today'
        print('PASS: an earlier day (from the strip) is read-only; the calendar shows the chosen day and shuts days to come; Go to today comes back')

        # ---------- a page written on an earlier day shows under it, read-only (written there directly: only today can be written)
        three = await q(DAY + '(-3)')
        # (put in before the app starts again: on leaving, the app saves what it has over anything written meanwhile)
        await ca.add_init_script(f"""(() => {{ if (sessionStorage.getItem('olden')) return; sessionStorage.setItem('olden', '1');
          const d = JSON.parse(localStorage.getItem('twodo:data')), t = Date.now() - 3 * 864e5, id = 'us-polden0000000';
          d.journal[id] = {{ kind: 'journal', id, date: {three!r}, who: {me!r}, private: false, text: {older!r}, mood: 0, prompt: '', createdAt: t, updatedAt: t, deleted: false }};
          localStorage.setItem('twodo:data', JSON.stringify(d)); }})()""")
        await A.reload(); await A.wait_for_timeout(2600); await open_journal(A)
        if not await q(f"!!document.querySelector('.jd-day[data-day=\"{three}\"]')"):
            await A.click('.jd-arrow[aria-label="Previous week"]'); await A.wait_for_timeout(300)
        assert 'You wrote' in await q(f"document.querySelector('.jd-day[data-day=\"{three}\"]').getAttribute('aria-label')"), 'the strip says you wrote that day'
        await A.click(f'.jd-day[data-day="{three}"]'); await A.wait_for_timeout(400)
        assert await q(MINE) == [older] and await q(BADGE) == 'Read only' and not await q("!!document.querySelector('.jd-ta')"), 'an earlier page shows, read-only'
        await A.click(f'.jd-day[data-day="{today}"]') if await q(f"!!document.querySelector('.jd-day[data-day=\"{today}\"]')") else await A.click('.jd-calbtn')
        if await q("!!document.querySelector('.sheet.open')"): await A.click('.sheet.open .jd-go')
        await A.wait_for_timeout(500)
        print('PASS: a page from an earlier day shows under that day, read-only, and the strip marks it')

        # ---------- an emptied page is deleted, on both phones, after a question
        await until(A, "!!document.querySelector('.jd-ta')", True)
        await A.fill('.jd-ta', ''); await A.click('.jd-btn'); await A.wait_for_timeout(400)
        assert 'Clear today’s page?' in await q("document.querySelector('.alert').textContent")
        await A.click('.alert button[data-r="1"]'); await A.wait_for_timeout(800)
        gone = await q(JOURNAL + f".find(e => e.id === {rec['id']!r})")
        assert gone['deleted'] and gone['text'] == '' and edited not in await q("localStorage.getItem('twodo:data')"), 'deleted, and the words are gone from storage'
        assert await until(B, THEIRS, []) == [], 'gone on the other phone too'
        print('PASS: an emptied page is deleted after a question, on both phones, with no words left behind')

        # ---------- contrast, every colour, light and dark (the page and the calendar)
        worst = await q(contrast_js('.jd'))
        assert worst['ratio'] >= 4.5, ('journal text contrast', worst)
        await A.click('.jd-calbtn'); await A.wait_for_timeout(700)
        cal_worst = await q(contrast_js('.jd-cal'))
        assert cal_worst['ratio'] >= 4.5, ('calendar text contrast', cal_worst)
        print(f"PASS: journal text keeps at least {min(worst['ratio'], cal_worst['ratio'])}:1 ({worst['measured'] + cal_worst['measured']} pieces of text x 12 colours x light and dark)")
        # tidy up: Deiva's page goes too, so the next run starts clean
        await B.fill('.jd-ta', ''); await B.click('.jd-btn'); await B.wait_for_timeout(400); await B.click('.alert button[data-r="1"]'); await B.wait_for_timeout(600)
        await cb.close(); await ca.close()

        # ---------- a wide screen: a readable column in the middle
        cw, W = await phone('/tmp/twodo-A.json', 1180, 820)
        await open_journal(W)
        r = await W.evaluate("(() => { const r = document.querySelector('.jd').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.left + r.width / 2)]; })()")
        assert r[0] <= 680 and abs(r[1] - 590) < 4, r
        print('PASS: on a wide screen the journal is a readable column in the middle')
        await cw.close()

        await b.close()
        print('ERRORS:', errors or 'NONE')
        assert not errors, errors

asyncio.run(main())
