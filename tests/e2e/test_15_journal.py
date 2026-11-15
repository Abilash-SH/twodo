"""The journal: one page a day in two voices. Your half saves itself (weather, a prompt, the words); your partner reads it
on their phone and on their board, and cannot edit it; an empty half is not kept; earlier pages, "a week ago", editing
an earlier half. "Just me": only behind the passcode, never written in plain text, never sent (every request is
checked), never in a backup, gone from memory when locked. The planner's "Write about the week". Contrast, wide screens.
Run test 1 first (it creates Abilash in /tmp/twodo-A.json and Deiva in /tmp/twodo-B.json). Needs the test build on 8003."""
import asyncio, json, os, time
from playwright.async_api import async_playwright
from helpers import TITLES, back_home, contrast_js

TODAY = "(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()"
JOURNAL = "Object.values(JSON.parse(localStorage.getItem('twodo:data')).journal || {})"
# a page from a week ago, written by the partner, put on this phone before the app starts (as if it had synced)
WEEK_AGO = r'''(() => { try { const d = JSON.parse(localStorage.getItem('twodo:data')), me = JSON.parse(localStorage.getItem('twodo:local')).me, pt = me === 'a' ? 'b' : 'a';
  const x = new Date(); x.setDate(x.getDate() - 7); const day = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  const id = 'us-' + day + '-' + pt; d.journal = d.journal || {};
  if (!d.journal[id]) d.journal[id] = { kind: 'journal', id, date: day, who: pt, private: false, text: 'We danced in the kitchen to that old song.', mood: 1, prompt: '', createdAt: 1, updatedAt: 1, deleted: false };
  localStorage.setItem('twodo:data', JSON.stringify(d)); } catch (e) {} })()'''

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        errors, sent = [], []
        async def phone(state, w=390, h=844, seed=None):
            ctx = await b.new_context(storage_state=state, viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=w < 700, has_touch=True, accept_downloads=True)
            if seed: await ctx.add_init_script(seed)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            pg.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
            pg.on('request', lambda r: r.post_data and sent.append(r.post_data))   # everything this phone sends
            await pg.goto('http://localhost:8003/'); await pg.wait_for_timeout(2600)
            return ctx, pg
        async def open_journal(pg):
            await pg.click('.boardview .fab-btn[aria-label="To-dos and reminders"]'); await pg.wait_for_timeout(800)
            await pg.click('.plan-group .cell:has-text("Journal")'); await pg.wait_for_timeout(1000)
        async def until(pg, js, want, ms=10000):
            got = None
            for _ in range(ms // 100):
                got = await pg.evaluate(js)
                if (want(got) if callable(want) else got == want): return got
                await pg.wait_for_timeout(100)
            return got
        stamp = int(time.time()) % 1000000
        mine_words = f'The two of us laughing at the market {stamp}'
        secret_words = f'Planning the surprise for Deiva {stamp}'

        ca, A = await phone('/tmp/twodo-A.json', seed=WEEK_AGO)
        q = A.evaluate
        today = await q(TODAY)
        me = await q("JSON.parse(localStorage.getItem('twodo:local')).me")

        # ---------- the planner's look back leads here (today is in the current week's look back from Friday)
        await A.click('.boardview .fab-btn[aria-label="To-dos and reminders"]'); await A.wait_for_timeout(800)
        await A.click('.plan-group .cell:has-text("This week")'); await A.wait_for_timeout(1200)
        if await A.locator('.wk-write').count():
            had = await q(JOURNAL + f".find(e => e.id === 'us-{today}-{me}' && !e.deleted)")
            await A.click('.wk-write'); await A.wait_for_timeout(1000)
            assert await q(TITLES) == ['Board', 'To-dos', 'Week', 'Journal'], await q(TITLES)
            if not had: assert await q("document.querySelector('.jr-page.today .mine .jr-q span').textContent") == 'How was our week? What was the best part?'
            await q("history.back()"); await A.wait_for_timeout(800); await q("history.back()"); await A.wait_for_timeout(800)
            print('PASS: "Write about the week together" opens the shared journal with the week\'s prompt')
        else:
            await q("history.back()"); await A.wait_for_timeout(800)
            print('SKIP: the look back shows from Friday; today is earlier in the week')
        await back_home(A)

        # ---------- your half: weather, a prompt, words; it saves itself
        await open_journal(A)
        assert await q(TITLES) == ['Board', 'To-dos', 'Journal'] and await q("document.querySelector('.jtab .on').dataset.v") == 'us'
        await q("(() => { const t = document.querySelector('.jr-page.today .mine .jr-ta'); return t; })()")
        if await A.locator('.jr-page.today .mine .jr-qx').count(): await A.click('.jr-page.today .mine .jr-qx'); await A.wait_for_timeout(300)
        await A.fill('.jr-page.today .mine .jr-ta', ''); await A.wait_for_timeout(900)
        await A.click('.jr-page.today .jr-weather button[aria-label="Sunny"]'); await A.wait_for_timeout(300)
        if await A.locator('.jr-page.today .jr-weather button[aria-label="Sunny"][aria-pressed="false"]').count():
            await A.click('.jr-page.today .jr-weather button[aria-label="Sunny"]'); await A.wait_for_timeout(300)   # it was already sunny: tapping turned it off
        prompt = await q("document.querySelector('.jr-page.today .jr-prompt p').textContent")
        await A.click('.jr-page.today .jr-another'); await A.wait_for_timeout(200)
        other = await q("document.querySelector('.jr-page.today .jr-prompt p').textContent")
        assert other != prompt, 'Another gives a different prompt'
        await A.click('.jr-page.today .jr-use'); await A.wait_for_timeout(300)
        assert await q("document.activeElement.classList.contains('jr-ta')"), 'Write about it puts the keyboard on the page inside the tap'
        await A.keyboard.type(mine_words); await A.wait_for_timeout(1200)
        page = await q(JOURNAL + f".find(e => e.id === 'us-{today}-{me}')")
        assert page and page['text'] == mine_words and page['mood'] == 1 and page['prompt'] == other and not page['private'], ('saved while typing', page)
        assert await q("document.querySelector('.jr-page.today .jr-saved').textContent") == 'Saved'
        print('PASS: your half saves itself while you type: weather, the prompt you took, your words')

        # ---------- your partner reads it (journal and board), and cannot edit it
        cb, B = await phone('/tmp/twodo-B.json')
        board = await until(B, "(document.querySelector('.board .n-page .n-page-t') || {}).textContent", mine_words)
        assert board == mine_words and 'wrote today' in await B.evaluate("document.querySelector('.board .n-page .n-h').textContent")
        await B.click('.board .note.n-page'); await B.wait_for_timeout(1000)
        assert await B.evaluate(TITLES) == ['Board', 'Journal']
        theirs = await B.evaluate("(() => { const h = document.querySelector('.jr-page.today .theirs'); return [h.querySelector('.jr-text').textContent, h.querySelector('.jr-q span').textContent, (h.querySelector('.jr-wx') || {}).textContent, !!h.querySelector('textarea, input, [contenteditable]')]; })()")
        assert theirs == [mine_words, other, 'Sunny', False], theirs
        assert await B.locator('.jr-page.today .mine .jr-ta').count() == 1, 'Deiva writes in her own half'
        print('PASS: your partner reads your half on their board and in the journal, and has no way to edit it')

        # ---------- an emptied half is not kept (no words, no weather, no prompt): it goes from the partner's board too
        await A.fill('.jr-page.today .mine .jr-ta', ''); await A.wait_for_timeout(300)
        await A.click('.jr-page.today .jr-weather button[aria-label="Sunny"]'); await A.wait_for_timeout(300)
        assert not await q(JOURNAL + f".find(e => e.id === 'us-{today}-{me}').deleted"), 'a half that still holds the prompt you chose is kept'
        await A.click('.jr-page.today .jr-qx'); await A.wait_for_timeout(1200)
        assert await q(JOURNAL + f".find(e => e.id === 'us-{today}-{me}').deleted"), 'an empty half is removed'
        gone = await until(B, "(document.querySelector('.board .n-page .n-page-t') || {}).textContent || ''", lambda t: mine_words not in t)
        assert mine_words not in gone, gone
        await A.click('.jr-page.today .jr-weather button[aria-label="Sunny"]'); await A.wait_for_timeout(200)
        await A.click('.jr-page.today .jr-use'); await A.wait_for_timeout(200)
        await A.fill('.jr-page.today .mine .jr-ta', mine_words); await A.wait_for_timeout(1200)
        await q("document.activeElement.blur()")
        assert await until(B, "(document.querySelector('.board .n-page .n-page-t') || {}).textContent", mine_words) == mine_words
        print('PASS: emptying your half removes it (and from your partner\'s board); writing again brings it back')

        # ---------- earlier pages: a week ago, read, edit your own earlier half
        assert await q("document.querySelector('.jr-otd .jr-otd-h').textContent") == 'A week ago'
        await A.click('.jr-otd'); await A.wait_for_timeout(900)
        week_ago = await q("(() => { const x = new Date(); x.setDate(x.getDate() - 7); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); })()")
        # it scrolls to that page: to its top, or as far as the screen goes when it is the last page
        top, room = await q(f"""(() => {{ const el = document.getElementById('jr-{week_ago}'), r = el.getBoundingClientRect(), sc = el.closest('.view');
          return [Math.round(r.top), Math.round(sc.scrollHeight - sc.clientHeight - sc.scrollTop)]; }})()""")
        assert 0 <= top < 300 or (0 <= top < 600 and room <= 2), ('the card leads to that page', top, room)
        print('PASS: "A week ago" brings back a page and leads to it')

        # ---------- Just me: behind the passcode, never in plain text, never sent, never in a backup
        await A.click('.jtab button[data-v="me"]'); await A.wait_for_timeout(600)
        assert await A.locator('.jr-gate').count() == 1 and not await A.locator('.jr-page.today').count(), 'no private page before a passcode'
        await A.click('.jr-gate .btn:has-text("passcode")'); await A.wait_for_timeout(700)
        if await A.locator('.keypad').count():
            steps = 2 if await A.locator('.vault-h:has-text("Create")').count() or not await q("!!localStorage.getItem('twodo:vault')") else 1
            for _ in range(steps):
                for d in '271828': await A.click(f'.keypad button:text-is("{d}")'); await A.wait_for_timeout(40)
                await A.wait_for_timeout(1400)
        if await A.get_by_text('Not now', exact=True).count(): await A.get_by_text('Not now', exact=True).click()
        await A.wait_for_timeout(600)
        assert await A.locator('.jr-page.today .mine .jr-ta').count() == 1 and not await A.locator('.jr-page.today .theirs').count(), 'one voice: yours'
        await A.click('.jr-page.today .jr-weather button[aria-label="Rainy"]'); await A.wait_for_timeout(200)
        await A.click('.jr-page.today .mine .jr-ta'); await A.keyboard.type(secret_words); await A.wait_for_timeout(1300)
        await q("document.activeElement.blur()"); await A.wait_for_timeout(800)
        stored = await q("JSON.stringify([localStorage.getItem('twodo:data'), localStorage.getItem('twodo:local'), localStorage.getItem('twodo:chat'), sessionStorage.getItem('twodo:resume'), localStorage.getItem('twodo:vault')])")
        assert secret_words not in stored and 'Planning the surprise' not in stored, 'a private page is only ever stored encrypted'
        assert await q(f"!!JSON.parse(localStorage.getItem('twodo:vault')).data && !JSON.parse(localStorage.getItem('twodo:data')).journal['me-{today}-{me}']")
        await A.wait_for_timeout(1500)
        assert not any(f'me-{today}' in s or secret_words in s for s in sent), 'nothing from the private journal is ever sent'
        assert not await B.evaluate(JOURNAL + ".some(e => e.private || e.id.startsWith('me-'))") and secret_words not in await B.evaluate("document.body.textContent")
        assert secret_words not in await q("document.querySelector('#stack > .boardview').textContent")
        async with A.expect_download() as dl:
            await back_home(A); await A.click('.boardview .fab-btn[aria-label="Settings"]'); await A.wait_for_timeout(900)
            await A.click('.sheet.open .cell:has-text("Export backup")')
        backup = open(await (await dl.value).path()).read()
        assert mine_words in backup and secret_words not in backup and f'me-{today}' not in backup, 'the shared page is in the backup, the private one never'
        await q("history.back()"); await A.wait_for_timeout(800)
        print('PASS: Just me needs the passcode; the private page is never in plain text, never sent, never on the board, never in a backup')

        # ---------- locked: gone from memory and the screen; back with the passcode
        await A.reload(); await A.wait_for_timeout(2600)
        await open_journal(A); await A.click('.jtab button[data-v="me"]'); await A.wait_for_timeout(500)
        assert await A.locator('.jr-gate').count() == 1 and secret_words not in await q("document.body.textContent"), 'locked after a reload'
        await A.click('.jr-gate .btn:has-text("passcode")'); await A.wait_for_timeout(700)
        for d in '271828': await A.click(f'.keypad button:text-is("{d}")'); await A.wait_for_timeout(40)
        await A.wait_for_timeout(1500)
        assert await q("document.querySelector('.jr-page.today .mine .jr-ta').value") == secret_words, 'back after unlocking'
        assert await q("document.querySelector('.jr-page.today .jr-weather button[aria-pressed=true]').getAttribute('aria-label')") == 'Rainy'
        await A.click('.jr-sub .link-btn'); await A.wait_for_timeout(600)   # Lock
        assert await A.locator('.jr-gate').count() == 1 and secret_words not in await q("document.body.textContent")
        print('PASS: the private journal locks (reload or the Lock button) and opens again with the passcode')

        # ---------- contrast on the shared page, every colour, light and dark
        await A.click('.jtab button[data-v="us"]'); await A.wait_for_timeout(600)
        worst = await q(contrast_js('.jr'))
        assert worst['ratio'] >= 4.5, ('journal text contrast', worst)
        print(f"PASS: journal text keeps at least {worst['ratio']}:1 ({worst['measured']} pieces of text x 12 colours x light and dark)")
        await cb.close(); await ca.close()

        # ---------- a wide screen: today's two halves side by side
        cw, W = await phone('/tmp/twodo-A.json', 1180, 820)
        await open_journal(W)
        lay = await W.evaluate("(() => { const h = [...document.querySelectorAll('.jr-page.today > .jr-half')].map(x => x.getBoundingClientRect()); return h.length === 2 && Math.abs(h[0].top - h[1].top) < 2 && h[1].left > h[0].right - 4; })()")
        assert lay, 'the two halves stand side by side'
        print('PASS: on a wide screen the two halves of today stand side by side')
        await cw.close()

        await b.close()
        print('ERRORS:', errors or 'NONE')
        assert not errors, errors

asyncio.run(main())
