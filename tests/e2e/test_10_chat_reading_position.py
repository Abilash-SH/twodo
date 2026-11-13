"""Chat reading position: a message only counts as read once it has been on screen, a "New messages" line shows where
unread messages start, and opening the chat (from the board, from another screen, or with the pill) takes you there.
The board says what is new without marking anything read.
Run test 1 first (it creates Abilash in /tmp/twodo-A.json and Deiva in /tmp/twodo-B.json). Needs the test build on 8003."""
import asyncio, os
from playwright.async_api import async_playwright
from helpers import TITLES, open_chat, back_home

GAP = "(() => { const b = document.querySelector('.chatbody'); return Math.round(b.scrollHeight - b.scrollTop - b.clientHeight); })()"
UNREAD = """(() => { const c = JSON.parse(localStorage.getItem('twodo:chat') || '{}'), me = JSON.parse(localStorage.getItem('twodo:local')).auth.uid;
  return Object.values(c.msgs || {}).filter(m => m.f !== me && !m.del && m.ts > c.read).length; })()"""
STATUS = "(document.querySelector('.c-status') || {}).className || ''"
# what the board says about the conversation: [the first note's badge, the number on its "Message" button]
BOARD_NEW = "[(document.querySelector('.board .n-msg .n-badge') || {}).textContent || null, (document.querySelector('.board-tray .tray-n') || {}).textContent || null]"
PILL = "(() => { const p = document.querySelector('.c-jump'); return p && !p.hidden ? p.textContent.trim() : null; })()"
# the "New messages" line: [text of the message under it, its distance below the header, its distance above the message box]
LINE = """(() => { const l = document.querySelector('.chatlist > .c-new'); if (!l) return null;
  const head = document.querySelector('.chat-nav').getBoundingClientRect().bottom, bar = document.querySelector('.chatbar').getBoundingClientRect().top, r = l.getBoundingClientRect();
  return [l.nextElementSibling.querySelector('.bub')?.textContent || '', Math.round(r.top - head), Math.round(bar - r.bottom), l.getAttribute('role')]; })()"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        errors = []

        async def phone(state):
            ctx = await b.new_context(storage_state=state, viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            return ctx, await page(ctx)
        async def page(ctx):
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            pg.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
            await pg.goto('http://localhost:8003/'); await pg.wait_for_timeout(2600)
            return pg
        async def say(pg, text, wait=140):
            await pg.fill('.cb-in', text); await pg.click('.cb-send'); await pg.wait_for_timeout(wait)
        async def until(pg, js, want, ms=5000):
            got = None
            for _ in range(ms // 100):
                got = await pg.evaluate(js)
                if (want(got) if callable(want) else got == want): return got
                await pg.wait_for_timeout(100)
            return got
        seen = lambda s: 'seen' in s
        delivered = lambda s: 'sent' in s and 'seen' not in s

        ca, A = await phone('/tmp/twodo-A.json'); cb, B = await phone('/tmp/twodo-B.json')
        await open_chat(A); await open_chat(B)
        await A.evaluate("document.querySelector('.chatbody').scrollTop = 1e9"); await B.evaluate("document.querySelector('.chatbody').scrollTop = 1e9")
        for i in range(26): await say(A, f'history line {i}', 80)   # enough history to scroll through
        await say(B, 'catching up')                                  # both are at the bottom and have read everything
        assert seen(await until(B, STATUS, seen)), 'baseline: a message read at the bottom is seen'
        await say(A, 'ok')                                           # answering removes any "New messages" line
        await A.wait_for_timeout(900)
        assert await A.evaluate(LINE) is None and await A.evaluate(UNREAD) == 0

        # ---------- reading older history: a new message is NOT read, the line and the pill say where it is
        await A.evaluate("document.activeElement && document.activeElement.blur(); document.querySelector('.chatbody').scrollTop = 0"); await A.wait_for_timeout(500)
        gap = await A.evaluate(GAP); assert gap > 400, gap
        await say(B, 'are you there?'); await B.wait_for_timeout(2600)
        assert delivered(await B.evaluate(STATUS)), ('read while in older history', await B.evaluate(STATUS))
        assert await A.evaluate(UNREAD) == 1 and await A.evaluate(PILL) == 'New message', (await A.evaluate(UNREAD), await A.evaluate(PILL))
        assert await A.evaluate("document.querySelector('.chatbody').scrollTop") < 5, 'the reader was moved while reading older messages'
        line = await A.evaluate(LINE); assert line and line[0] == 'are you there?' and line[3] == 'separator', line
        await A.click('.c-jump')
        assert seen(await until(B, STATUS, seen)), 'after jumping to the new message it is seen'
        assert await until(A, UNREAD, 0) == 0 and await until(A, PILL, None) is None and await A.evaluate(GAP) < 140
        print('PASS: a message arriving while you read older history stays unread until you go to it')

        # ---------- coming back to the chat with more unread than fits: start at the first one, read as you scroll
        await say(A, 'back in a minute'); await A.wait_for_timeout(600)
        await A.click('.chatview .fab-btn[aria-label="To-dos and reminders"]'); await A.wait_for_timeout(1000)
        for i in range(12): await say(B, f'note {i}\nsecond line\nthird line', 110)
        await B.wait_for_timeout(1800)
        assert delivered(await B.evaluate(STATUS)), 'another screen is on top: nothing is read'
        await A.click('.view:not(.under) .nav-btn.back'); await A.wait_for_timeout(1500)
        line = await A.evaluate(LINE); n = await A.evaluate(UNREAD)
        assert line and line[0].startswith('note 0') and 0 <= line[1] <= 40, ('should open at the first unread message', line)
        assert await A.evaluate(GAP) > 140 and 1 <= n < 12, ('some read, the rest not yet', await A.evaluate(GAP), n)
        assert await A.evaluate(PILL) == (f'{n} new messages' if n > 1 else 'New message'), (await A.evaluate(PILL), n)
        assert delivered(await B.evaluate(STATUS)), 'the last message has not been on screen yet'
        await A.evaluate("document.querySelector('.chatbody').scrollBy(0, 260)"); await A.wait_for_timeout(700)
        n2 = await A.evaluate(UNREAD); assert n2 < n, ('scrolling down reads more', n, n2)
        await A.evaluate("document.querySelector('.chatbody').scrollTop = 1e9")
        assert seen(await until(B, STATUS, seen)) and await until(A, UNREAD, 0) == 0
        print(f'PASS: back to the chat with 12 unread: opens at the first, {12 - n} read at once, the rest as they scroll into view')

        # ---------- unread that fits on screen: straight to the bottom, with the line above it
        await say(A, 'reading all of these'); await A.wait_for_timeout(600)
        await A.click('.chatview .fab-btn[aria-label="To-dos and reminders"]'); await A.wait_for_timeout(1000)
        await say(B, 'just one'); await B.wait_for_timeout(1200)
        await A.click('.view:not(.under) .nav-btn.back')
        assert seen(await until(B, STATUS, seen)), 'visible at once, so read at once'
        line = await A.evaluate(LINE); assert line and line[0] == 'just one' and await A.evaluate(GAP) < 80, (line, await A.evaluate(GAP))
        print('PASS: back to the chat with one unread: at the bottom, line above it, read')

        # ---------- on the board (the chat closed): the board says what is new, nothing is read until the chat is opened
        await say(A, 'off to the board'); await A.wait_for_timeout(600)
        await back_home(A)
        assert await A.evaluate(TITLES) == ['Board'] and await A.evaluate(BOARD_NEW) == [None, None], (await A.evaluate(TITLES), await A.evaluate(BOARD_NEW))
        for i in range(3): await say(B, f'board note {i}', 110)
        await B.wait_for_timeout(1800)
        assert delivered(await B.evaluate(STATUS)), 'the chat is closed: nothing is read'
        assert await A.evaluate(UNREAD) == 3 and await until(A, BOARD_NEW, ['3 new', '3']) == ['3 new', '3'], (await A.evaluate(UNREAD), await A.evaluate(BOARD_NEW))
        assert await A.evaluate("document.querySelector('.board .n-msg .n-text').textContent") == 'board note 2', 'the note shows the latest message'
        await A.click('.board .note.n-msg')  # the note is a door to the conversation
        assert seen(await until(B, STATUS, seen)), 'opened from the board with all of it on screen: read'
        line = await A.evaluate(LINE); assert line and line[0] == 'board note 0' and await A.evaluate(GAP) < 80, (line, await A.evaluate(GAP))
        await A.wait_for_timeout(700); await back_home(A)
        assert await A.evaluate(BOARD_NEW) == [None, None], ('read: the board has nothing new to announce', await A.evaluate(BOARD_NEW))
        for i in range(12): await say(B, f'pile {i}\nsecond line\nthird line', 110)   # more than fits on one screen
        await B.wait_for_timeout(1800)
        assert delivered(await B.evaluate(STATUS)) and await until(A, BOARD_NEW, ['9+ new', '9+']) == ['9+ new', '9+'], await A.evaluate(BOARD_NEW)
        await open_chat(A, wait=1500)
        line = await A.evaluate(LINE); n = await A.evaluate(UNREAD)
        assert line and line[0].startswith('pile 0') and 0 <= line[1] <= 40, ('from the board the chat opens at the first unread message', line)
        assert await A.evaluate(GAP) > 140 and 1 <= n < 12, ('some read, the rest not yet', await A.evaluate(GAP), n)
        assert delivered(await B.evaluate(STATUS)), 'the last message has not been on screen yet'
        await A.evaluate("document.querySelector('.chatbody').scrollTop = 1e9")
        assert seen(await until(B, STATUS, seen)) and await until(A, UNREAD, 0) == 0
        print(f'PASS: on the board nothing is read; it shows what is new, and the chat opens at the first unread ({12 - n} of 12 read at once)')

        # ---------- behind a sheet, and with the app in the background: not read until you can see it
        await say(A, 'one moment'); await A.wait_for_timeout(500)
        await A.click('.chatview .cb-plus'); await A.wait_for_timeout(500)     # share a to-do, then open it: its sheet covers the chat
        await A.click('#menu [data-m="share"] >> nth=0'); await A.wait_for_timeout(900)
        await A.locator('.chatview .tcard .tc-t').last.click(); await A.wait_for_timeout(1200)
        assert await A.locator('.sheet.open').count() == 1, 'the shared to-do opens in a sheet'
        await say(B, 'behind the sheet'); await B.wait_for_timeout(2200)
        assert delivered(await B.evaluate(STATUS)), 'a sheet covers the chat: not read'
        await A.evaluate("history.back()")
        assert seen(await until(B, STATUS, seen)), 'sheet closed: read'
        await A.evaluate("Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))")
        await say(B, 'while you were away'); await B.wait_for_timeout(2200)
        assert delivered(await B.evaluate(STATUS)), 'app in the background: not read'
        await A.evaluate("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))")
        assert seen(await until(B, STATUS, seen)), 'back in the app: read'
        line = await A.evaluate(LINE); assert line and line[0] in ('behind the sheet', 'while you were away'), line
        print('PASS: nothing is read behind a sheet or while the app is in the background')

        # ---------- answering removes the line; live messages at the bottom are read as they arrive, without a line
        await say(A, 'here now'); await A.wait_for_timeout(500)
        assert await A.evaluate(LINE) is None, 'answering removes the line'
        await say(B, 'good')
        assert seen(await until(B, STATUS, seen)) and await A.evaluate(LINE) is None
        print('PASS: answering clears the line; live messages at the bottom are read without one')

        # ---------- closing and reopening the app: messages sent meanwhile get the line; a visit with nothing new has none
        await A.wait_for_timeout(700); await A.close()
        await say(B, 'sent while closed 1'); await say(B, 'sent while closed 2'); await B.wait_for_timeout(1200)
        assert delivered(await B.evaluate(STATUS))
        A = await page(ca)
        assert await until(A, BOARD_NEW, ['2 new', '2']) == ['2 new', '2'], ('reopened on the board: it says what arrived', await A.evaluate(BOARD_NEW))
        await A.wait_for_timeout(1200)
        assert delivered(await B.evaluate(STATUS)), 'reopening the app shows the board: nothing is read yet'
        await open_chat(A)
        assert seen(await until(B, STATUS, seen)), 'the chat opened at the bottom: read'
        line = await A.evaluate(LINE); assert line and line[0] == 'sent while closed 1', line
        await A.wait_for_timeout(700); await A.reload(); await A.wait_for_timeout(2600)
        assert await A.evaluate(BOARD_NEW) == [None, None] and await A.evaluate(UNREAD) == 0, 'nothing new: the board announces nothing'
        await open_chat(A)
        assert await A.evaluate(LINE) is None, 'nothing new: no line'
        print('PASS: reopening the app shows what arrived on the board, the line above it in the chat, and none when nothing is new')

        # ---------- the line keeps readable contrast for every colour a partner can pick, light and dark
        worst = await A.evaluate("""(() => {
          const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
          const rgb = css => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = css; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3); };
          const probe = document.createElement('div'); probe.className = 'c-new'; probe.textContent = 'New messages'; document.querySelector('.chatlist').append(probe);
          const root = document.documentElement, cs = getComputedStyle(root), was = [root.dataset.theme, root.style.getPropertyValue('--pt-c')];
          let worst = 99;
          for (const theme of ['light', 'dark']) { root.dataset.theme = theme;
            for (const name of ['red', 'orange', 'yellow', 'green', 'mint', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'brown']) {
              const v = cs.getPropertyValue('--c-' + name).trim(); if (!v) continue;
              root.style.setProperty('--pt-c', v);
              const fg = lum(rgb(getComputedStyle(probe).color)), bg = lum(rgb(getComputedStyle(root).getPropertyValue('--bg').trim()));
              worst = Math.min(worst, (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05)); } }
          root.dataset.theme = was[0]; if (was[1]) root.style.setProperty('--pt-c', was[1]); else root.style.removeProperty('--pt-c'); probe.remove();
          return Math.round(worst * 100) / 100; })()""")
        assert worst >= 4.5, ('"New messages" contrast', worst)
        print(f'PASS: "New messages" keeps at least {worst}:1 contrast on every colour, light and dark')

        await b.close()
        errors[:] = [e for e in errors if 'ERR_ABORTED' not in e]
        print('ERRORS:', errors or 'NONE')
        assert not errors, errors

asyncio.run(main())
