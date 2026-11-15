"""The board decorated like home: a cork board with a string of lights. The lights are off in the day and glow in the
evening (6 pm to 6 am, the phone's own time); they rest under another screen and with Reduce Motion. Tapping them
offers to send your partner a glow (nothing is sent without the island's Send); a glow is an ordinary message, and
your partner's lights twinkle in your colour until they read it. The polaroid names the next plan for the two of
you; today's to-dos show their time. Nothing new is stored.
Run test 1 first (it creates Abilash in /tmp/twodo-A.json and Deiva in /tmp/twodo-B.json). Needs the test build on 8003."""
import asyncio, os, time
from datetime import datetime
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright
from helpers import TITLES, back_home, open_chat

GLOW = 'Thinking of you ✨'
MSGS = "Object.values(JSON.parse(localStorage.getItem('twodo:chat') || '{}').msgs || {})"
TASKS = "Object.values(JSON.parse(localStorage.getItem('twodo:data')).tasks)"
ZONES = ['UTC', 'Pacific/Auckland', 'Asia/Tokyo', 'Asia/Kolkata', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Pacific/Honolulu']
def zone(evening):
    for z in ZONES:
        h = datetime.now(ZoneInfo(z)).hour
        if (h >= 18 or h < 6) == evening and 1 <= datetime.now(ZoneInfo(z)).minute <= 58: return z
    raise SystemExit('no time zone found')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        errors = []
        async def phone(state, tz='UTC', motion='no-preference'):
            ctx = await b.new_context(storage_state=state, viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id=tz, reduced_motion=motion)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            pg.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
            await pg.goto('http://localhost:8003/'); await pg.wait_for_timeout(2800)
            return ctx, pg
        async def until(pg, js, want, ms=12000):
            got = None
            for _ in range(ms // 100):
                got = await pg.evaluate(js)
                if (want(got) if callable(want) else got == want): return got
                await pg.wait_for_timeout(100)
            return got
        glow_op = "[...document.querySelectorAll('.board .lights .glow')].map(g => +getComputedStyle(g).opacity)"
        stamp = int(time.time()) % 1000000

        # ---------- day and evening, by the phone's own clock
        ca, A = await phone('/tmp/twodo-A.json', zone(False))
        q = A.evaluate
        keys_before = await q("Object.keys(localStorage).sort()")
        assert await q("document.querySelectorAll('.board .lights .bulb').length") == 9
        assert not await q("document.querySelector('.boardview').classList.contains('evening')")
        assert max(await q(glow_op)) < .05, 'in the day the bulbs are off'
        ce, E = await phone('/tmp/twodo-A.json', zone(True))
        assert await E.evaluate("document.querySelector('.boardview').classList.contains('evening')")
        ops = await E.evaluate(glow_op)
        assert min(ops) > .5 and len(set(round(o, 2) for o in ops)) > 1, ('in the evening the bulbs glow, each at its own pace', ops)
        await E.click('.boardview .fab-btn[aria-label="To-dos and reminders"]'); await E.wait_for_timeout(900)
        assert set(await E.evaluate("[...document.querySelectorAll('.board .lights .glow')].map(g => getComputedStyle(g).animationPlayState)")) == {'paused'}, 'they rest under another screen'
        await ce.close()
        cr, R = await phone('/tmp/twodo-A.json', zone(True), 'reduce')
        assert set(await R.evaluate("[...document.querySelectorAll('.board .lights .glow')].map(g => getComputedStyle(g).animationName)")) == {'none'}, 'Reduce Motion: lit, but still'
        await cr.close()
        print('PASS: the lights are off in the day, glow in the evening, rest under another screen and keep still with Reduce Motion')

        # ---------- tapping the lights asks first; nothing is sent without Send
        sent_before = await q(MSGS + f".filter(m => m.t === {GLOW!r}).length")
        await A.tap('.board .lights'); await A.wait_for_timeout(300)
        assert 'Send Deiva a little glow?' in await q("document.body.textContent")
        await A.wait_for_timeout(6500)   # the island leaves by itself
        assert await q(MSGS + f".filter(m => m.t === {GLOW!r}).length") == sent_before, 'a tap alone sends nothing'
        print('PASS: tapping the lights twinkles them and asks; nothing is sent unless you tap Send')

        # ---------- a glow: an ordinary message; the partner's lights take your colour until they read it
        cb, B = await phone('/tmp/twodo-B.json', zone(True))
        await A.tap('.board .lights'); await A.wait_for_timeout(300)
        await A.click('.ib'); await A.wait_for_timeout(1500)
        mine = await q(MSGS + f".filter(m => m.t === {GLOW!r}).sort((x, y) => y.ts - x.ts)[0]")
        assert mine and mine['fx'] == 'gentle' and await q("document.querySelector('.board .n-msg .n-text').textContent") == GLOW
        assert await until(B, "!!document.querySelector('.board .lights.from')", True), "the partner's lights twinkle"
        a_col = await B.evaluate("JSON.parse(localStorage.getItem('twodo:local')).me === 'a' ? 'b' : 'a'")
        style = await B.evaluate("document.querySelector('.board .lights.from').getAttribute('style') || ''")
        want = await B.evaluate(f"(() => {{ const d = JSON.parse(localStorage.getItem('twodo:data')); return d.people && d.people.{a_col} ? d.people.{a_col}.color : ''; }})()")
        assert not want or f'--c-{want}' in style, ('in the colour of who sent it', style, want)
        assert await B.evaluate("document.querySelector('.board .n-msg .n-text').textContent") == GLOW
        await open_chat(B); await B.wait_for_timeout(800); await back_home(B)
        assert not await B.evaluate("!!document.querySelector('.board .lights.from')"), 'read: the lights are back to normal'
        print("PASS: Send puts a glow in the chat; your partner's lights twinkle in your colour until they read it")

        # ---------- the polaroid names the next plan for the two of you; today's to-dos show their time
        await A.click('.boardview .fab-btn[aria-label="To-dos and reminders"]'); await A.wait_for_timeout(900)
        await A.click('#cta'); await A.keyboard.type(f'Movie night {stamp} @us tomorrow 8pm'); await A.keyboard.press('Enter'); await A.wait_for_timeout(700)
        await A.fill('#cta', f'Call the bakery {stamp} today 11:58pm'); await A.press('#cta', 'Enter'); await A.wait_for_timeout(700)
        await q("document.activeElement.blur()"); await back_home(A)
        want = await q(f"""(() => {{ const d = new Date(), t0 = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          const l = JSON.parse(localStorage.getItem('twodo:data')).lists;
          return {TASKS}.filter(t => !t.deleted && !t.done && t.assignee === 'both' && t.due && t.due >= t0 && l[t.listId] && !l[t.listId].private && !l[t.listId].deleted)
            .sort((a, b) => a.due < b.due ? -1 : a.due > b.due ? 1 : (a.time || '99') < (b.time || '99') ? -1 : 1)[0].title; }})()""")
        nxt = await q("(document.querySelector('.board .n-us .n-next') || {}).textContent || ''")
        assert nxt.startswith(f'Next: {want} · '), (nxt, want)
        assert (await q("document.querySelector('.board .n-us').getAttribute('aria-label')")).startswith('Together:')
        times = await q("[...document.querySelectorAll('.board .n-today .bn-task')].map(r => [r.querySelector('.bn-title').textContent, (r.querySelector('.bn-time') || {}).textContent || ''])")
        rows = await q(TASKS + f".filter(t => !t.deleted && !t.done)")
        for title, shown in times:
            t = next((x for x in rows if x['title'] == title), None)
            assert t is None or bool(t.get('time')) == bool(shown), (title, shown, t)
        print(f'PASS: the polaroid names the next plan for the two of you ({nxt!r}); to-dos with a time show it')

        # ---------- nothing new is stored; text on paper keeps its contrast in the evening
        assert await q("Object.keys(localStorage).sort()") == keys_before, 'the board stores nothing'
        await cb.close(); await ca.close()
        await b.close()
        print('ERRORS:', errors or 'NONE')
        assert not errors, errors

asyncio.run(main())
