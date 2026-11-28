"""Routines (docs/routines.md): the owner's five to start with, punching today's hole (and an earlier day this week,
never a day to come), your partner seeing your punches as a dot in your colour within seconds and the other way round,
a routine only your partner keeps being read-only for you, the island when your card is full for the day, the week's
quilt (a patch you both kept is stitched) and its receipt, forged or damaged cards being dropped or cut down when read,
and text contrast for every colour in light and dark.
Run test 1 first (it creates Abilash in /tmp/twodo-A.json and Deiva in /tmp/twodo-B.json). Needs the test build on 8003."""
import asyncio, os, time
from playwright.async_api import async_playwright
from helpers import TITLES, contrast_js

DATA = "JSON.parse(localStorage.getItem('twodo:data'))"
ME = "JSON.parse(localStorage.getItem('twodo:local')).me"
# this week's Monday and today's index (Monday 0), as the app counts them
WEEK = """(() => { const d = new Date(); d.setHours(12, 0, 0, 0); const i = (d.getDay() + 6) % 7; d.setDate(d.getDate() - i);
  const p = n => String(n).padStart(2, '0'); return [`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, i]; })()"""
STARTERS = ['Gym', 'Steps', 'No sugar', 'Walk', 'Home food']

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
        async def open_routines(pg):
            await pg.click('.boardview .fab-btn[aria-label="To-dos and reminders"]'); await pg.wait_for_timeout(900)
            await pg.click('.plan-group .cell:has-text("Routines")'); await pg.wait_for_timeout(1000)
        async def until(pg, js, want, ms=10000):
            got = None
            for _ in range(ms // 100):
                got = await pg.evaluate(js)
                if (want(got) if callable(want) else got == want): return got
                await pg.wait_for_timeout(100)
            return got
        def card(name): return f'.rt-card[data-name="{name}"]'
        stamp = int(time.time()) % 1000000

        ca, A = await phone('/tmp/twodo-A.json')
        q = A.evaluate
        await open_routines(A)
        assert await q(TITLES) == ['Board', 'To-dos', 'Routines'], await q(TITLES)
        if await A.locator('.rt-empty').count():   # the test accounts keep their data between runs
            assert 'Gym, Steps, No sugar, Walk, Home food' in await q("document.querySelector('.rt-start').textContent")
            await A.click('.rt-start'); await A.wait_for_timeout(700)
        names = await q("[...document.querySelectorAll('.rt-card:not(.theirs) .rt-name')].map(n => n.textContent)")
        assert all(n in names for n in STARTERS), names
        week, today = await q(WEEK)
        holes = await q(f"[...document.querySelectorAll('{card('Gym')} .rt-hole')].map(h => [h.disabled, h.classList.contains('today')])")
        assert len(holes) == 7 and [h[1] for h in holes].index(True) == today, holes
        assert all(not h[0] for h in holes[:today + 1]) and all(h[0] for h in holes[today + 1:]), ('today and earlier this week only', holes)
        print('PASS: the five to start with; seven holes a card, today and earlier this week can be punched, days to come cannot')

        # ---------- punch today (and un-punch), stored on your own card only
        me = await q(ME); pt = 'b' if me == 'a' else 'a'
        gym = await q(DATA + ".routines && Object.values(" + DATA + ".routines).find(r => r.name === 'Gym' && !r.deleted).id")
        today_hole = f"{card('Gym')} .rt-hole.today"
        if await q(f"document.querySelector('{today_hole}').getAttribute('aria-pressed')") == 'true':
            await A.click(today_hole); await A.wait_for_timeout(400)
        await A.click(today_hole); await A.wait_for_timeout(500)
        assert await q(f"document.querySelector('{today_hole}').getAttribute('aria-pressed')") == 'true'
        mask = await q(DATA + f".punches['{week}-{me}'].days['{gym}']")
        assert mask >> today & 1 == 1, mask
        assert not await q(DATA + f".punches['{week}-{pt}'] && " + DATA + f".punches['{week}-{pt}'].who !== '{pt}'"), 'never writes the other card'
        if today:   # forgot to tick yesterday: still allowed
            y = f"{card('Walk')} .rt-hole >> nth={today - 1}"
            was = await A.locator(y).get_attribute('aria-pressed')
            await A.click(y); await A.wait_for_timeout(300)
            assert await A.locator(y).get_attribute('aria-pressed') != was
            await A.click(y); await A.wait_for_timeout(300)
        print('PASS: a tap punches today\'s hole on your own card; yesterday can still be fixed')

        # ---------- the other phone: your punch shows as a dot in your colour; theirs comes back the same way
        cb, B = await phone('/tmp/twodo-B.json')
        await open_routines(B)
        assert await until(B, f"!document.querySelector('{today_hole} .rt-pt').hidden", True), 'Deiva sees the punch'
        assert 'kept it too' in await B.locator(today_hole).get_attribute('aria-label')
        if await B.locator(today_hole).get_attribute('aria-pressed') != 'true':
            await B.click(today_hole); await B.wait_for_timeout(400)
        assert await until(A, f"!document.querySelector('{today_hole} .rt-pt').hidden", True), 'and Abilash sees hers'
        assert 'punched' in await q("document.querySelector('.rt-ptline').textContent")
        print('PASS: punches reach the other phone within seconds, as a dot in that person\'s colour')

        # ---------- a routine only your partner keeps: read-only for you
        await A.click('.rt-addg .cell'); await A.wait_for_timeout(800)
        await A.fill('.sheet.open .name-inp', f'Stretch {stamp}')
        await A.click(f'.sheet.open [data-seg="rtwho"] button[data-v="{pt}"]'); await A.wait_for_timeout(200)
        await A.click('.sheet.open [data-s="done"]'); await A.wait_for_timeout(900)
        theirs = card(f'Stretch {stamp}')
        assert await A.locator(theirs + '.theirs').count() == 1, 'shown as your partner\'s'
        assert await q(f"[...document.querySelectorAll('{theirs} .rt-hole')].every(h => h.disabled)"), 'you cannot punch your partner\'s routine'
        assert await until(B, f"!!document.querySelector('{theirs}:not(.theirs) .rt-hole.today:not(:disabled)')", True), 'Deiva can'
        await B.click(f'{theirs} .rt-hole.today'); await B.wait_for_timeout(300)
        assert await until(A, f"document.querySelector('{theirs} .rt-hole.today').classList.contains('on')", True), 'her punch shows on her card'
        await B.click(f'{theirs} .rt-hole.today'); await B.wait_for_timeout(300)   # and takes it back, so the week stays tidy
        assert await until(A, f"!document.querySelector('{theirs} .rt-hole.today').classList.contains('on')", True)
        await A.click(f'{theirs} .rt-edit'); await A.wait_for_timeout(800)
        await A.click('.sheet.open .cell.red'); await A.wait_for_timeout(500); await A.click('.alert button[data-r="1"]'); await A.wait_for_timeout(900)
        assert not await A.locator(theirs).count()
        print('PASS: a routine only Deiva keeps is read-only for Abilash; removing one works')

        # ---------- a full card for the day: one island
        punched_any = False
        for n in await q("[...document.querySelectorAll('.rt-card:not(.theirs)')].map(c => c.querySelector('.rt-name').textContent)"):
            h = f"{card(n)} .rt-hole.today"
            if await A.locator(h).get_attribute('aria-pressed') != 'true':
                await A.click(h); await A.wait_for_timeout(250); punched_any = True
        if punched_any:
            assert 'punched today' in await until(A, "document.getElementById('island').textContent", lambda t: 'punched today' in t, 3000)
        done, of = await q("document.querySelector('.rt-sub').textContent.match(/(\\d+) of (\\d+)/).slice(1).map(Number)")
        assert done == of, (done, of)
        print('PASS: every routine punched today, the count says so')

        # ---------- the week: quilt first, then the receipt
        await A.click('.rt-wrap'); await A.wait_for_timeout(1000)
        assert await q(TITLES) == ['Board', 'To-dos', 'Routines', 'Your week'], await q(TITLES)
        await A.click('[data-seg="rw"] button[data-v="quilt"]'); await A.wait_for_timeout(400)   # it remembers the last tab
        rows = await q("document.querySelectorAll('.ql-row:not(.ql-head)').length")
        assert rows >= 5, rows
        gym_patch = f"[...document.querySelectorAll('.ql-row')].find(r => r.textContent.includes('Gym')).querySelectorAll('.ql-p')[{today}]"
        cls = (await q(gym_patch + ".className")).split()
        assert all(c in cls for c in ('ql-p', 'm', 'p', 'ab')), cls
        assert 'both of you' in await q(gym_patch + ".getAttribute('aria-label')")
        together = int(await q("document.querySelectorAll('.rw-tile b')[1].textContent"))
        assert together >= 1, together
        await A.click('.rw-moreg .cell'); await A.wait_for_timeout(500)
        paper = await q("document.querySelector('.rr-paper').innerText")
        assert paper.startswith('TWODO') and 'GYM' in paper and 'DONE TOGETHER' in paper and 'STREAK' not in paper, paper
        await A.click('.rw-switch .nav-btn[aria-label="The week before"]'); await A.wait_for_timeout(500)
        assert await q("document.querySelector('.rw .large-title').textContent") != 'This week'
        print('PASS: the quilt stitches a patch you both kept; the receipt sums up the week, with no streaks')

        # ---------- forged or damaged cards: dropped or cut down when read
        await A.click('.rw-switch .nav-btn[aria-label="The week after"]'); await A.wait_for_timeout(300)
        # written before the app starts (it saves its own copy as the page goes away)
        await ca.add_init_script(f"""(() => {{ if (sessionStorage.getItem('forged')) return; sessionStorage.setItem('forged', '1'); const d = {DATA}; d.punches = d.punches || {{}};
          d.punches['2020-01-06-{me}'] = {{ kind: 'punch', id: '2020-01-06-{me}', week: '2020-01-06', who: '{me}', updatedAt: 1, deleted: false,
            days: {{ ok1: 5, big: 999, neg: -1, frac: 2.5, '<img src=x>': 3 }} }};
          d.punches['2020-01-07-{me}'] = {{ kind: 'punch', id: '2020-01-07-{me}', week: '2020-01-07', who: '{me}', updatedAt: 1, days: {{}} }};
          d.punches['2020-01-13-{pt}'] = {{ kind: 'punch', id: '2020-01-13-{me}', week: '2020-01-13', who: '{pt}', updatedAt: 1, days: {{}} }};
          d.routines['evil'] = {{ kind: 'routine', id: 'evil', name: 'x'.repeat(500), emoji: '<b>', color: 'javascript:1', who: 'everyone', order: 1, createdAt: 1, updatedAt: 1, deleted: true }};
          localStorage.setItem('twodo:data', JSON.stringify(d)); }})()""")
        await A.reload(); await A.wait_for_timeout(2600)
        # the app reads and cleans everything on load; the stored copy is rewritten on the next save, so punch and un-punch
        await open_routines(A)
        await A.click(today_hole); await A.wait_for_timeout(400); await A.click(today_hole); await A.wait_for_timeout(600)
        kept = await q(f"""(() => {{ const d = {DATA}; return [d.punches['2020-01-06-{me}'] && d.punches['2020-01-06-{me}'].days,
          !!d.punches['2020-01-07-{me}'], !!d.punches['2020-01-13-{pt}'], d.routines.evil]; }})()""")
        assert kept[0] == {'ok1': 5}, kept[0]
        assert kept[1] is False and kept[2] is False, ('a card for a Tuesday, or one claiming the other person, is dropped', kept)
        ev = kept[3]
        assert ev and len(ev['name']) == 40 and ev['emoji'] != '<b>' and ev['color'] == 'green' and ev['who'] == 'both', ev
        print('PASS: damaged cards are cut down, forged ones dropped, a routine\'s fields clamped')

        # ---------- contrast, every colour, light and dark
        worst = await q(contrast_js('.rt'))
        assert worst['measured'] > 10 and worst['ratio'] >= 4.5, worst
        assert await q("document.getElementById('composer').classList.contains('hide')"), 'no task box over routines'
        await A.click('.rt-wrap'); await A.wait_for_timeout(1000)
        for tab in ('quilt', 'receipt'):
            await A.click(f'[data-seg="rw"] button[data-v="{tab}"]'); await A.wait_for_timeout(500)
            w = await q(contrast_js('.rw'))
            assert w['measured'] > 10 and w['ratio'] >= 4.5, (tab, w)
            worst['ratio'] = min(worst['ratio'], w['ratio'])
        print(f"PASS: text contrast at least 4.5:1 for every colour, light and dark, cards, quilt and receipt (lowest {worst['ratio']})")

        assert not errors, errors
        print('PASS: no errors')
        await ca.close(); await cb.close(); await b.close()

asyncio.run(main())
