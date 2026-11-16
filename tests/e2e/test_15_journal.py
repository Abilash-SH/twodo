"""The journal: one raw thread for the two of you. Write, Post; the post is at the top for both of you, newest first,
with who wrote it and when. Your partner sees it live (and on their board) and can't edit it. Your own posts: ⋯ →
Edit or Delete (deleted on both phones, the words gone from storage). A draft waits if you leave. Nothing else: no
prompts, weather, tabs or private posts. Contrast for every colour, light and dark; the wide layout.
Run test 1 first (it creates Abilash in /tmp/twodo-A.json and Deiva in /tmp/twodo-B.json). Needs the test build on 8003."""
import asyncio, os, time
from playwright.async_api import async_playwright
from helpers import TITLES, back_home, contrast_js

JOURNAL = "Object.values(JSON.parse(localStorage.getItem('twodo:data')).journal || {})"
FIRST = "(() => { const p = document.querySelector('.jt-feed .jt-post'); return p && [p.querySelector('.jt-meta b').textContent, p.querySelector('.jt-text').textContent, !!p.querySelector('.jt-dots'), !!p.querySelector('time')]; })()"

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
        stamp = int(time.time()) % 1000000
        mine = f'Market with you this morning, the giant pumpkin {stamp}'
        reply = f'Best Sunday in ages {stamp}'
        edited = f'Market with you this morning, the giant pumpkin and the soup {stamp}'

        ca, A = await phone('/tmp/twodo-A.json')
        q = A.evaluate
        await open_journal(A)
        assert await q(TITLES) == ['Board', 'To-dos', 'Journal'], await q(TITLES)
        raw = await q("['.jtab', '.jr-weather', '.jr-prompt', '.jr-gate', '.segmented'].filter(s => document.querySelector('.jt ' + s) || document.querySelector(s + '.jtab'))")
        assert not raw and 'Just me' not in await q("document.querySelector('.jt').textContent"), ('raw: no tabs, weather, prompts or private journal', raw)
        assert await q("document.querySelector('.jt-post-btn').disabled"), 'nothing to post yet'

        # ---------- post: it goes to the top, with your name and the time; the box empties
        await A.click('.jt-compose .jt-ta'); await A.keyboard.type(mine)
        await A.click('.jt-post-btn'); await A.wait_for_timeout(700)
        assert await q("document.querySelector('.jt-compose .jt-ta').value") == '' and await q("document.querySelector('.jt-post-btn').disabled")
        assert await q(FIRST) == ['You', mine, True, True], await q(FIRST)
        rec = await q(JOURNAL + f".find(e => e.text === {mine!r})")
        assert rec and rec['id'].startswith('us-p') and not rec['private'] and rec['mood'] == 0 and rec['prompt'] == '', rec
        print('PASS: Post puts it at the top of the thread with your name and the time; the box empties')

        # ---------- your partner sees it live, on their board too, and can't edit it
        cb, B = await phone('/tmp/twodo-B.json')
        assert await until(B, "document.querySelector('.boardview .fab-btn[aria-label^=\"Journal\"]').getAttribute('aria-label')", 'Journal, new today') == 'Journal, new today', 'Home says there is something new in the journal'
        await B.click('.boardview .fab-btn[aria-label^="Journal"]'); await B.wait_for_timeout(1000)
        assert await B.evaluate(TITLES) == ['Board', 'Journal']
        assert await until(B, FIRST, ['Abilash', mine, False, True]) == ['Abilash', mine, False, True], 'read only for the partner'
        await B.click('.jt-compose .jt-ta'); await B.keyboard.type(reply); await B.click('.jt-post-btn'); await B.wait_for_timeout(500)
        assert await until(A, FIRST, ['Deiva', reply, False, True]) == ['Deiva', reply, False, True], 'newest first, live on the other phone'
        assert await q("document.querySelectorAll('.jt-feed .jt-post')[1].querySelector('.jt-text').textContent") == mine
        print('PASS: your partner sees it live (and Home says so) without a way to edit it; their reply goes on top')

        # ---------- compact, and every post hangs on a love thread to the next one, her colour into yours
        THREAD = """(() => [...document.querySelectorAll('.jt-feed .jt-post')].map(p => { const t = p.querySelector(':scope > .jt-thread'), r = p.getBoundingClientRect();
          return { thread: !!t, heart: !!(t && t.querySelector('.jt-hs')), c: p.style.getPropertyValue('--c'), cn: p.style.getPropertyValue('--cn'), h: Math.round(r.height),
                   av: Math.round(p.querySelector('.jt-av').getBoundingClientRect().width) }; }))()"""
        rows = await q(THREAD)
        colours = await q("(() => { const d = JSON.parse(localStorage.getItem('twodo:data')).people; return [d.a.color, d.b.color]; })()")
        assert all(r['thread'] and r['heart'] for r in rows[:-1]) and not rows[-1]['thread'], ('a thread with a heart from each post to the next, none after the last', rows)
        assert rows[0]['c'] == f'var(--c-{colours[1]})' and rows[0]['cn'] == f'var(--c-{colours[0]})', ("Deiva's colour runs into yours", rows[0], colours)
        assert all(r['av'] <= 40 for r in rows) and rows[0]['h'] <= 120 and rows[1]['h'] <= 120, ('compact rows: a small character, a short post stays under 120 px', rows)
        top = await q("(() => { const t = document.querySelector('.jt-feed .jt-post .jt-thread').getBoundingClientRect(), a = document.querySelector('.jt-feed .jt-post .jt-av').getBoundingClientRect(), b = document.querySelectorAll('.jt-feed .jt-post .jt-av')[1].getBoundingClientRect(); return [Math.round(t.left + t.width / 2 - (a.left + a.width / 2)), Math.round(t.top - a.bottom), Math.round(b.top - t.bottom)]; })()")
        assert abs(top[0]) <= 1 and 0 <= top[1] <= 20 and 0 <= top[2] <= 20, ('the thread runs from one character down to the next', top)
        print('PASS: compact posts, each on a love thread with a heart that runs from its character to the next, in both colours')

        # ---------- hearts: your partner gives your post a heart (double tap, or the heart); you see who loved it
        post_b = f'.jt-post[data-id="{rec["id"]}"]'
        assert await B.locator(f'{post_b} .jt-heart').count() == 1 and not await B.locator(f'{post_b} .jt-dots').count(), "a heart on your partner's post, no menu"
        assert not await A.locator(f'.jt-post[data-id="{rec["id"]}"] .jt-heart').count(), 'no heart on your own post'
        await B.locator(post_b).evaluate("e => e.scrollIntoView({ block: 'center' })"); await B.wait_for_timeout(300)
        box = await B.locator(f'{post_b} .jt-text').bounding_box()
        await B.mouse.click(box['x'] + 20, box['y'] + 10); await B.wait_for_timeout(90); await B.mouse.click(box['x'] + 20, box['y'] + 10)
        await B.wait_for_timeout(400)
        assert await B.evaluate(f"document.querySelector('{post_b} .jt-heart').getAttribute('aria-pressed')") == 'true', 'a double tap gives it your heart'
        hid = f"us-h-{rec['id']}-" + await B.evaluate("JSON.parse(localStorage.getItem('twodo:local')).me")
        assert await B.evaluate(JOURNAL + f".some(e => e.id === {hid!r} && !e.deleted && e.text === '')"), 'a heart is its own record, with no text'
        await B.mouse.click(box['x'] + 20, box['y'] + 10); await B.wait_for_timeout(90); await B.mouse.click(box['x'] + 20, box['y'] + 10); await B.wait_for_timeout(300)
        assert await B.evaluate(f"document.querySelector('{post_b} .jt-heart').getAttribute('aria-pressed')") == 'true', 'a second double tap never takes it back'
        loved = await until(A, f"(document.querySelector('.jt-post[data-id=\"{rec['id']}\"] .jt-loved') || {{}}).textContent || ''", 'Deiva loved this')
        assert loved == 'Deiva loved this', loved
        await B.click(f'{post_b} .jt-heart'); await B.wait_for_timeout(400)
        assert await B.evaluate(f"document.querySelector('{post_b} .jt-heart').getAttribute('aria-pressed')") == 'false', 'the heart button takes it back'
        assert await until(A, f"!document.querySelector('.jt-post[data-id=\"{rec['id']}\"] .jt-loved')", True), 'and it goes on the other phone'
        await B.click(f'{post_b} .jt-heart'); await B.wait_for_timeout(300)   # and gives it again
        assert await until(A, f"!!document.querySelector('.jt-post[data-id=\"{rec['id']}\"] .jt-loved')", True)
        print('PASS: your partner gives your post a heart with a double tap or the heart button (a second double tap keeps it); you see "Deiva loved this"; the button takes it back')

        # ---------- a draft waits while you look elsewhere
        await A.click('.jt-compose .jt-ta'); await A.keyboard.type('half a thought')
        await q("document.activeElement.blur()"); await q("history.back()"); await A.wait_for_timeout(800)
        await A.click('.plan-group .cell:has-text("Journal")'); await A.wait_for_timeout(900)
        assert await q("document.querySelector('.jt-compose .jt-ta').value") == 'half a thought'
        await A.fill('.jt-compose .jt-ta', ''); await A.wait_for_timeout(200)
        print('PASS: what you were writing is still there when you come back')

        # ---------- edit and delete your own post
        own = f'.jt-post[data-id="{rec["id"]}"]'
        await A.click(f'{own} .jt-dots'); await A.wait_for_timeout(200)
        await A.click(f'{own} .jt-menu button:has-text("Edit")'); await A.wait_for_timeout(200)
        await A.fill(f'{own} .jt-edit .jt-ta', edited); await A.click(f'{own} .jt-edit .jt-post-btn'); await A.wait_for_timeout(600)
        assert await q("document.querySelectorAll('.jt-feed .jt-post')[1].querySelector('.jt-text').textContent") == edited
        assert await until(B, "document.querySelectorAll('.jt-feed .jt-post')[1].querySelector('.jt-text').textContent", edited) == edited, 'the edit reaches the other phone'
        await A.click(f'{own} .jt-dots'); await A.wait_for_timeout(200)
        await A.click(f'{own} .jt-menu button:has-text("Delete")'); await A.wait_for_timeout(400)
        await A.click('.alert button[data-r="1"]'); await A.wait_for_timeout(800)
        assert not await q(f"[...document.querySelectorAll('.jt-text')].some(t => t.textContent === {edited!r})")
        gone = await q(JOURNAL + f".find(e => e.id === {rec['id']!r})")
        assert gone['deleted'] and gone['text'] == '' and edited not in await q("localStorage.getItem('twodo:data')"), 'deleted, and the words are gone from storage'
        assert await until(B, f"[...document.querySelectorAll('.jt-text')].some(t => t.textContent === {edited!r})", False) is False, 'gone on the other phone too'
        print('PASS: ⋯ on your own post edits or deletes it, on both phones; a deleted post leaves no words behind')

        # ---------- contrast, every colour, light and dark
        worst = await q(contrast_js('.jt'))
        assert worst['ratio'] >= 4.5, ('journal text contrast', worst)
        print(f"PASS: journal text keeps at least {worst['ratio']}:1 ({worst['measured']} pieces of text x 12 colours x light and dark)")
        await cb.close(); await ca.close()

        # ---------- a wide screen: a readable column in the middle
        cw, W = await phone('/tmp/twodo-A.json', 1180, 820)
        await open_journal(W)
        r = await W.evaluate("(() => { const r = document.querySelector('.jt').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.left + r.width / 2)]; })()")
        assert r[0] <= 680 and abs(r[1] - 590) < 4, r
        print('PASS: on a wide screen the thread is a readable column in the middle')
        await cw.close()

        await b.close()
        print('ERRORS:', errors or 'NONE')
        assert not errors, errors

asyncio.run(main())
