"""Home when signed in: the board. Its notes fill themselves from what already exists and each one is a door; its two
buttons (message your partner, add a to-do) never move; to-dos are added and ticked off in place and your partner's
board follows; nothing from a secret list ever appears on it (unlocked or locked); "Waiting to send" while offline;
what it says before a partner is connected and with nothing to show; a tip's "Open chat"; signing out; the chat stays
mounted so opening it draws nothing new; text contrast for every colour two people can pick, light and dark.
Run test 1 first (it creates Abilash in /tmp/twodo-A.json and Deiva in /tmp/twodo-B.json). Needs the test build on 8003."""
import asyncio, os, time
from playwright.async_api import async_playwright
from helpers import OPEN_CHAT, TITLES, open_chat, back_home

# what is on the board, read from the screen
BOARD = """(() => { const t = s => { const e = document.querySelector('.board ' + s); return e ? e.textContent : null; };
  const rows = [...document.querySelectorAll('.board .bn-task')].map(r => r.querySelector('.bn-title').textContent), more = t('.n-today button.n-go');
  return { empty: !!document.querySelector('.board.empty'), msg: t('.n-msg'), rows, more, today: rows.length + (more ? parseInt(more) : 0),
    us: t('.n-us .n-sub'), list: [t('.n-list .n-h'), t('.n-list .n-sub')], pin: t('.n-pin .n-h'), pinSlot: !!document.querySelector('.board .slot.s-pin'),
    strip: t('.strip'), tape: t('.tape') }; })()"""
# what the To-dos screen counts (it must be open)
HUB = """(() => { const v = document.querySelector('#stack > .view.pushed:not(.parked):not(.under)');
  return { cards: Object.fromEntries([...v.querySelectorAll('.hub-card')].map(c => [c.querySelector('.hub-t').textContent, +c.querySelector('.hub-n').textContent || 0])),
    lists: [...v.querySelectorAll('.group:not(.secret-group) .cell:not(.accent)')].map(c => [c.querySelector('.grow').textContent, +c.querySelector('.val').textContent || 0]) }; })()"""
TASKS = "Object.values(JSON.parse(localStorage.getItem('twodo:data')).tasks)"
TRAP = "!!(history.state && history.state.t)"
COMPOSER_UP = "!document.getElementById('composer').classList.contains('hide')"
TRAY_SHOWN = "getComputedStyle(document.querySelector('.board-tray')).visibility === 'visible'"
# Lowest text contrast on the board over every colour a person can pick, light and dark. Each piece of text is measured
# against what is actually painted behind it. (Initials in a profile picture are the app-wide avatar: design.md lists
# that gap separately. Emoji carry their own colours.)
CONTRAST = """(() => {
  const NAMES = ['blue', 'indigo', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'mint', 'teal', 'brown', 'gray'];
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = css => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, under) => [0, 1, 2].map(i => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const behind = el => { const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0) { layers.push(c); if (c[3] > .999) break; } }
    return layers.reverse().reduce((under, c) => over(c, under), [255, 255, 255, 1]); };
  const lum = c => { const [r, g, b] = c.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  const texts = [...document.querySelectorAll('.boardview *')].filter(e => !e.closest('.av, .n-ic') && e.getClientRects().length
    && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
  const root = document.documentElement, was = [root.dataset.theme, root.getAttribute('style')];
  const tinted = [...document.querySelectorAll('.boardview [style*="--c"]')].map(e => [e, e.getAttribute('style')]);
  let worst = { ratio: 99 };
  for (const theme of ['light', 'dark']) { root.dataset.theme = theme;
    for (const name of NAMES) {
      root.style.setProperty('--me-c', `var(--c-${name})`); root.style.setProperty('--pt-c', `var(--c-${name})`);
      for (const [e] of tinted) e.style.setProperty('--c', `var(--c-${name})`);
      for (const e of texts) { const bg = behind(e), fg = over(rgba(getComputedStyle(e).color), bg), a = lum(fg), b = lum(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        if (ratio < worst.ratio) worst = { ratio: Math.round(ratio * 100) / 100, theme, name, what: (e.className || e.tagName) + ': ' + e.textContent.trim().slice(0, 24) }; } } }
  if (was[0] === undefined) delete root.dataset.theme; else root.dataset.theme = was[0];
  if (was[1] === null) root.removeAttribute('style'); else root.setAttribute('style', was[1]);
  for (const [e, st] of tinted) e.setAttribute('style', st);
  return { ...worst, measured: texts.length }; })()"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        errors = []

        async def phone(state=None):
            ctx = await b.new_context(storage_state=state, viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            pg.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
            await pg.goto('http://localhost:8003/'); await pg.wait_for_timeout(2600)
            return ctx, pg
        async def until(pg, js, want, ms=8000):
            got = None
            for _ in range(ms // 100):
                got = await pg.evaluate(js)
                if (want(got) if callable(want) else got == want): return got
                await pg.wait_for_timeout(100)
            return got
        async def press(pg, sel, pick):
            """long-press a row (brought to the middle of the screen first), then pick from its menu"""
            await pg.locator(sel).first.evaluate("e => e.scrollIntoView({ block: 'center' })"); await pg.wait_for_timeout(350)
            r = await pg.locator(sel).first.bounding_box()
            await pg.mouse.move(r['x'] + 90, r['y'] + r['height'] / 2); await pg.mouse.down(); await pg.wait_for_timeout(650); await pg.mouse.up(); await pg.wait_for_timeout(600)
            await pg.click(f'#menu [data-m="{pick}"]'); await pg.wait_for_timeout(900)
        async def todos(pg):
            await pg.click('.boardview .fab-btn[aria-label="To-dos and reminders"]'); await pg.wait_for_timeout(1000)
        top = '#stack > .view:not(.under):not(.offright)'
        stamp = int(time.time()) % 1000000   # the test accounts keep their to-dos between runs

        ca, A = await phone('/tmp/twodo-A.json')
        q = A.evaluate

        # ---------- Home is the board: what its notes say is what the To-dos screen counts
        assert await q(TITLES) == ['Board'] and await q("document.querySelector('.board-title').textContent") == 'Our board'
        assert not await q(COMPOSER_UP) and await q(TRAY_SHOWN), "the board shows its own two buttons, not the task box"
        assert await q("[...document.querySelectorAll('.board-tray .tray-btn')].map(b => b.textContent)") == ['Message Deiva', 'Add a to-do']
        board = await q(BOARD)
        await todos(A)
        hub = await q(HUB)
        assert board['today'] == hub['cards']['Today'] and len(board['rows']) == min(3, hub['cards']['Today']), (board, hub)
        assert board['us'] == (f"{hub['cards']['Together']} to do as a pair" if hub['cards']['Together'] else 'Nothing for the two of you yet'), (board['us'], hub)
        open_lists = [l for l in hub['lists'] if l[1] > 0]
        want = sorted(open_lists, key=lambda l: (l[0] == 'Inbox', -l[1]))[0] if open_lists else None   # most left to do, your own lists first
        assert board['list'] == ([want[0], f'{want[1]} to do'] if want else [None, None]), (board['list'], hub['lists'])
        assert (board['pin'] is None and board['pinSlot']) if not hub['cards']['Pinned'] else (board['pin'] and not board['pinSlot']), (board, hub)
        await back_home(A)
        print(f"PASS: the board matches the To-dos screen ({board['today']} today, {board['us']!r}, list {board['list'][0]!r})")

        # ---------- every note is a door: one tap, one screen, and Back returns to the board
        doors = [('.board .note.n-msg', ['Chat']), ('.board .n-today .n-h.link', ['Today']), ('.board .note.n-us', ['Abilash & Deiva', 'Deiva & Abilash']), ('.board .note.n-list', [board['list'][0]])]
        if board['more']: doors.append(('.board .n-today button.n-go', ['Today']))
        for sel, titles in doors:
            await A.click(sel); await A.wait_for_timeout(1000)
            now = await q(TITLES)
            assert len(now) == 2 and now[0] == 'Board' and now[1] in titles and await q(TRAP), (sel, now)
            await q("history.back()"); await A.wait_for_timeout(900)
            assert await q(TITLES) == ['Board'] and not await q(TRAP), (sel, await q(TITLES))
        await A.click('.board .bn-task .bn-title'); await A.wait_for_timeout(900)
        assert await q("document.querySelector('.sheet.open .d-tt').value") == board['rows'][0], 'a to-do on the board opens its details'
        await q("history.back()"); await A.wait_for_timeout(900)
        assert not await A.locator('.sheet.open').count() and await q(TITLES) == ['Board']
        await todos(A)
        assert await q(TITLES) == ['Board', 'To-dos'] and await q(f"document.querySelector('{top} .nav-btn.back').innerText.trim()") == 'Board'
        await A.click(f'{top} .nav-btn.back'); await A.wait_for_timeout(900)
        await A.click('.boardview .fab-btn[aria-label="Settings"]'); await A.wait_for_timeout(900)
        assert await q("document.querySelector('.sheet.open h3').textContent") == 'Settings'
        await q("history.back()"); await A.wait_for_timeout(900)
        assert await q(TITLES) == ['Board'] and not await q(TRAP) and 'localhost:8003' in A.url
        print(f'PASS: {len(doors) + 3} doors on the board each open one screen (or sheet); Back returns to the board')

        # ---------- the chat stays mounted while it is closed: opening it builds nothing new, and the board's notes stay as they are
        await q("window.__chat = document.querySelector('#stack > .chatview'); window.__row = window.__chat.querySelector('.msg-row[data-id]'); window.__note = document.querySelector('.board .n-today')")
        assert await q("!!window.__row && window.__chat.inert && getComputedStyle(window.__chat).visibility === 'hidden'"), 'closed: the conversation is drawn, hidden and unreachable'
        await open_chat(A)
        assert await q("document.querySelector('#stack > .chatview') === window.__chat && window.__row.isConnected && !window.__chat.inert && getComputedStyle(window.__chat).visibility === 'visible'")
        await back_home(A)
        assert await q("document.querySelector('#stack > .chatview') === window.__chat && window.__row.isConnected && document.querySelector('.board .n-today') === window.__note")
        print('PASS: opening and closing the chat reuses the same screen and the same messages; the board is not rebuilt')

        # ---------- "Add a to-do": the task box comes up over the board, the to-do is for today, the buttons come back
        await A.click('#boardAdd'); await A.wait_for_timeout(400)
        assert await q("document.activeElement.id") == 'cta' and await q(COMPOSER_UP) and not await q(TRAY_SHOWN), 'the task box takes the keyboard in the same tap'
        assert 'Inbox · Today' in await q("document.getElementById('composer').textContent"), 'it says where the to-do will go'
        item = f'Board item {stamp}'
        await A.keyboard.type(item); await A.keyboard.press('Enter'); await A.wait_for_timeout(900)
        made = await q(TASKS + f".find(t => t.title === {item!r})")
        assert made and made['due'] == await q("(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()") and made['listId'] == 'inbox', made
        assert await q("document.activeElement.id") == 'cta', 'the box keeps the keyboard for the next one'
        await A.keyboard.type('not finished'); await q("document.activeElement.blur()"); await A.wait_for_timeout(500)
        assert await q(COMPOSER_UP) and not await q(TRAY_SHOWN), 'something half-typed keeps the box where it is'
        await A.fill('#cta', ''); await q("document.activeElement.blur()"); await A.wait_for_timeout(500)
        assert not await q(COMPOSER_UP) and await q(TRAY_SHOWN), "left empty, the box goes and the board's buttons return"
        after = await q(BOARD)
        assert after['today'] == board['today'] + 1, ('the new to-do counts on the Today note', board['today'], after['today'])
        await A.click('#boardAdd'); await A.wait_for_timeout(300)   # leaving the board while the box is up: it belongs to the next screen
        await todos(A)
        assert await q(TITLES) == ['Board', 'To-dos'] and await q(COMPOSER_UP)
        await q("document.activeElement.blur(); history.back()"); await A.wait_for_timeout(900)
        assert await q(TITLES) == ['Board'] and not await q(COMPOSER_UP) and await q(TRAY_SHOWN)
        print('PASS: Add a to-do from the board: focused in the tap, due today, the box leaves when empty')

        # ---------- pin a to-do and it stays on the board
        await A.click('.board .n-today .n-h.link'); await A.wait_for_timeout(1000)
        await press(A, f'{top} .task:has-text("{item}") .ti', 'pin')
        await back_home(A)
        pinned = await q(BOARD)
        assert pinned['pin'] and not pinned['pinSlot'] and item in pinned['rows'], ('a pinned to-do has a note of its own and leads Today', pinned)
        only = not hub['cards']['Pinned']   # nothing else was pinned (always so on a fresh test database)
        if only: assert pinned['pin'] == item and pinned['rows'][0] == item, pinned
        await A.click('.board .n-pin .n-open'); await A.wait_for_timeout(900)
        assert await q("document.querySelector('.sheet.open .d-tt').value") == pinned['pin']
        await q("history.back()"); await A.wait_for_timeout(900)
        print('PASS: a pinned to-do gets its own note')

        # ---------- tick in place: a second tap cancels; a tick completes, the others move up, your partner's board says who did it
        cb, B = await phone('/tmp/twodo-B.json')
        tid = made['id']; row = f'.board .bn-task[data-id="{tid}"]'
        done = TASKS + f".find(t => t.id === {tid!r}).done"
        await A.click(f'{row} .bn-chk'); await A.wait_for_timeout(150)
        assert await q(f"document.querySelector('{row}').classList.contains('checked')"), 'the circle fills at once'
        await A.click(f'{row} .bn-chk'); await A.wait_for_timeout(1300)
        assert not await q(done) and not await q(f"document.querySelector('{row}').classList.contains('checked')"), 'a second tap straight away cancels it'
        await A.click(f'{row} .bn-chk')
        assert await until(A, done, True) is True
        await A.wait_for_timeout(600)
        ticked = await q(BOARD)
        assert item not in ticked['rows'] and ticked['today'] == after['today'] - 1 and ticked['strip'] == f'You ticked off {item}', ticked
        assert ticked['pin'] != item, 'a finished to-do leaves its note'
        assert 'Completed' in await q("document.getElementById('isl').innerText"), 'the usual "Completed" with Undo appears'
        assert await until(B, "(document.querySelector('.board .strip') || {}).textContent || ''", f'Abilash ticked off {item}', 12000) == f'Abilash ticked off {item}', "the partner's board says who ticked it off"
        await A.click('#isl .ib'); await A.wait_for_timeout(900)   # Undo
        undone = await q(BOARD)
        assert not await q(done) and item in undone['rows'] and undone['strip'] != f'You ticked off {item}', ('Undo puts it back', undone)
        await A.click('.board .n-today .n-h.link'); await A.wait_for_timeout(1000)   # tidy up: unpin it again
        await press(A, f'{top} .task:has-text("{item}") .ti', 'pin')
        await back_home(A)
        assert (await q(BOARD))['pin'] != item
        await cb.close()
        print('PASS: tick on the board: cancel with a second tap, complete, Undo; the partner sees who ticked it off')

        # ---------- nothing from a secret list is ever on the board: not its to-dos, not its name, not a count
        before = await q(BOARD)
        await todos(A)
        await A.click('.secret-group .cell'); await A.wait_for_timeout(900)
        await A.click('.vault-gate .btn:has-text("Create passcode")'); await A.wait_for_timeout(700)
        for _ in range(2):
            for d in '271828': await A.click(f'.keypad button:text-is("{d}")'); await A.wait_for_timeout(40)
            await A.wait_for_timeout(1400)
        if await A.get_by_text('Not now', exact=True).count(): await A.get_by_text('Not now', exact=True).click()
        await A.wait_for_timeout(900)
        assert await q(TITLES) == ['Board', 'To-dos', 'Secret'], await q(TITLES)
        await A.fill('#cta', 'Anniversary surprise today @us'); await A.press('#cta', 'Enter'); await A.wait_for_timeout(900)
        await q("document.activeElement.blur()"); await A.wait_for_timeout(400)
        await press(A, f'{top} .task:has-text("Anniversary surprise") .ti', 'pin')
        assert await A.locator(f'{top} .task:has-text("Anniversary surprise")').count() == 1, 'the secret to-do exists: due today, for both, pinned'
        def same_board(now):
            return all(now[k] == before[k] for k in ('rows', 'more', 'today', 'us', 'list', 'pin', 'pinSlot', 'strip'))
        hidden = "(() => { const t = document.querySelector('.boardview').textContent; return !t.includes('Anniversary') && !t.includes('Secret'); })()"
        await back_home(A)
        now = await q(BOARD)
        assert same_board(now) and await q(hidden), ('unlocked: a secret to-do (today, for both, pinned) must not reach the board', before, now)
        assert await q("document.querySelector('.boardview .fab-btn[aria-label=\"To-dos and reminders\"] .fab-dot').hidden") == (before['today'] == 0), 'nor the dot on the To-dos button'
        await todos(A); await A.click('.secret-group .cell:has-text("Secret")'); await A.wait_for_timeout(900)
        await A.click(f'{top} .task:has-text("Anniversary surprise") .chk'); await A.wait_for_timeout(1600)   # ticked off inside the secret list
        await back_home(A)
        now = await q(BOARD)
        assert same_board(now) and await q(hidden), ('a secret to-do ticked off must not be announced on the board', before, now)
        await A.reload(); await A.wait_for_timeout(2600)   # locked again
        now = await q(BOARD)
        assert same_board(now) and 'Anniversary' not in await q("document.body.textContent"), ('locked: nothing secret anywhere on Home', before, now)
        assert 'Anniversary' not in await q("localStorage.getItem('twodo:data') + localStorage.getItem('twodo:local') + localStorage.getItem('twodo:chat')"), 'and it is only stored encrypted'
        print('PASS: a secret to-do that is due today, for both of you and pinned never reaches the board: unlocked, ticked off or locked')

        # ---------- offline: the board says so, and an unsent message says it is waiting
        cb, B = await phone('/tmp/twodo-B.json')
        unread = "(() => { const c = JSON.parse(localStorage.getItem('twodo:chat') || '{}'), me = JSON.parse(localStorage.getItem('twodo:local')).auth.uid; return Object.values(c.msgs || {}).filter(m => m.f !== me && !m.del && m.ts > c.read).length; })()"
        n0 = await B.evaluate(unread)
        await open_chat(A)
        await ca.set_offline(True); await A.wait_for_timeout(300)
        await A.fill('.chatview .cb-in', f'no signal {stamp}'); await A.click('.chatview .cb-send'); await A.wait_for_timeout(1200)
        await q("document.activeElement.blur()"); await back_home(A)
        off = await q("({ tape: (document.querySelector('.board .tape') || {}).textContent, stuck: !!document.querySelector('.board .n-msg.stuck'), text: document.querySelector('.board .n-msg .n-text').textContent, meta: (document.querySelector('.board .n-msg .n-meta') || {}).textContent })")
        assert off == {'tape': 'Offline. Your board is saved here.', 'stuck': True, 'text': f'no signal {stamp}', 'meta': 'Waiting to send'}, off
        offline_worst = await q(CONTRAST)   # the tape and "Waiting to send" are text too
        assert offline_worst['ratio'] >= 4.5, ('offline board text contrast', offline_worst)
        await ca.set_offline(False)
        assert await until(A, "!document.querySelector('.board .tape') && !document.querySelector('.board .n-msg.stuck')", True, 15000), 'back online: the tape goes and the message is sent'
        assert await until(B, "(document.querySelector('.board .n-msg .n-text') || {}).textContent", f'no signal {stamp}', 15000) == f'no signal {stamp}', "it reaches the partner's board"
        n1 = n0 + 1; shown = '9+' if n1 > 9 else str(n1)
        assert await B.evaluate("[(document.querySelector('.board .n-msg .n-badge') || {}).textContent, (document.querySelector('.board-tray .tray-n') || {}).textContent]") == [f'{shown} new', shown]
        print('PASS: offline the board says so and shows the unsent message as waiting; it is sent when the connection returns')

        # ---------- contrast: every piece of text on the board, for every colour two people can pick, light and dark
        # Deiva's board gets one of each kind of note first: something new, today, together, a list, a pin, something ticked off
        for title in (f'Pinned for contrast {stamp}', f'Done for contrast {stamp}'):
            await B.click('#boardAdd'); await B.wait_for_timeout(300)
            await B.keyboard.type(title); await B.keyboard.press('Enter'); await B.wait_for_timeout(700)
            await B.evaluate("document.activeElement.blur()"); await B.wait_for_timeout(500)
        await B.click('.board .n-today .n-h.link'); await B.wait_for_timeout(1000)
        await press(B, f'{top} .task:has-text("Pinned for contrast {stamp}") .ti', 'pin')
        await press(B, f'{top} .task:has-text("Done for contrast {stamp}") .ti', 'done'); await B.wait_for_timeout(1400)
        await back_home(B)
        missing = await B.evaluate("['.n-msg .n-badge', '.n-today .bn-title', '.n-today button.n-go', '.n-us .n-sub', '.n-list .n-sub', '.n-pin .n-tag', '.strip', '.tray-n'].filter(s => !document.querySelector('.boardview ' + s))")
        assert not missing, ('the board under test should show every kind of note', missing)
        worst = await B.evaluate(CONTRAST)
        assert worst['ratio'] >= 4.5, ('board text contrast', worst)
        print(f"PASS: board text keeps at least {min(worst['ratio'], offline_worst['ratio'])}:1 ({worst['measured']} pieces of text x 12 colours x light and dark, online and offline)")
        await B.click('.board .n-today .n-h.link'); await B.wait_for_timeout(1000)     # tidy up: unpin it again
        await press(B, f'{top} .task:has-text("Pinned for contrast {stamp}") .ti', 'pin')
        await back_home(B)
        await cb.close(); await ca.close()

        # ---------- before a partner is connected, and with nothing to show
        cc, C = await phone()
        await C.click('text=Create account'); await C.wait_for_timeout(600)
        await C.fill('#gName', 'Kavin'); await C.fill('#gPartner', 'Deiva'); await C.fill('#gEmail', f'k{stamp}@x.com'); await C.fill('#gPass', 'password 123')
        await C.click('[data-p="create"] [data-submit]'); await C.wait_for_timeout(3500)
        await C.fill('#gUser', f'kavin{stamp}'); await C.click('[data-p="username"] [data-submit]'); await C.wait_for_timeout(2000)
        await C.click('text=Start using Twodo'); await C.wait_for_timeout(1500)
        first = await C.evaluate(BOARD)
        assert await C.evaluate("document.querySelector('.board .n-msg .n-h').textContent") == 'Add your partner' and not first['empty'] and first['rows'], first
        assert await C.evaluate("document.querySelector('.board-tray .tray-btn.chat').textContent") == 'Add partner'
        for sel in ('.board .note.n-msg', OPEN_CHAT):
            await C.click(sel); await C.wait_for_timeout(900)
            assert await C.evaluate("document.querySelector('.sheet.open h3').textContent") == 'Add partner', sel
            await C.evaluate("history.back()"); await C.wait_for_timeout(900)
        assert await C.evaluate(TITLES) == ['Board'], 'no chat screen opens before there is someone to talk to'
        await todos(C); await C.click('.hub-card:has-text("All")'); await C.wait_for_timeout(1000)
        for _ in range(12):   # remove the examples a new account starts with
            if not await C.locator(f'{top} .task').count(): break
            await press(C, f'{top} .task .ti', 'del')
        assert not await C.locator(f'{top} .task').count()
        await back_home(C)
        empty = await C.evaluate("({ empty: !!document.querySelector('.board.empty'), h: (document.querySelector('.board .n-empty .n-h') || {}).textContent, sub: (document.querySelector('.board .n-empty .n-sub') || {}).textContent, slots: document.querySelectorAll('.board .slot').length, tray: [...document.querySelectorAll('.board-tray .tray-btn')].map(b => b.textContent) })")
        assert empty['empty'] and empty['h'] == 'Nothing pinned yet' and 'Connect with your partner' in empty['sub'] and empty['slots'] == 2 and empty['tray'] == ['Add partner', 'Add a to-do'], empty
        worst = await C.evaluate(CONTRAST)
        assert worst['ratio'] >= 4.5, ('empty board text contrast', worst)
        await C.click('#boardAdd'); await C.wait_for_timeout(300)
        await C.keyboard.type('First thing'); await C.keyboard.press('Enter'); await C.wait_for_timeout(700)
        await C.evaluate("document.activeElement.blur()"); await C.wait_for_timeout(500)
        filled = await C.evaluate(BOARD)
        assert not filled['empty'] and filled['rows'] == ['First thing'], ('one to-do and the board has its notes', filled)
        print(f"PASS: before pairing the board leads to Add partner; with nothing to show it says so (text at least {worst['ratio']}:1); the first to-do fills it")

        # ---------- a tip's "Open chat" from above the board: the tip slides away and the chat is there; then signing out
        await C.click('.boardview .fab-btn[aria-label="Settings"]'); await C.wait_for_timeout(900)
        await C.click('.sheet.open .cell:has-text("Tips")'); await C.wait_for_timeout(1500)
        assert await C.evaluate(TITLES) == ['Board', 'Tips'], await C.evaluate(TITLES)
        await C.click('.tip-act:has-text("Open chat")'); await C.wait_for_timeout(1100)
        assert await C.evaluate(TITLES) == ['Board', 'Chat'] and await C.evaluate(TRAP), ('one step: the tip is gone and the chat is open', await C.evaluate(TITLES))
        await C.click('.chatview .lb-av.pt'); await C.wait_for_timeout(900)          # nobody to chat with yet: it offers Add partner
        assert await C.evaluate("document.querySelector('.sheet.open h3').textContent") == 'Add partner'
        await C.evaluate("history.back()"); await C.wait_for_timeout(900)
        await C.evaluate("history.back()"); await C.wait_for_timeout(900)
        assert await C.evaluate(TITLES) == ['Board'] and not await C.evaluate(TRAP), await C.evaluate(TITLES)
        await C.click('.boardview .fab-btn[aria-label="Settings"]'); await C.wait_for_timeout(900)
        await C.click('.sheet.open .group.danger .cell:has-text("Sign out")'); await C.wait_for_timeout(500)
        await C.click('.alert button[data-r="1"]'); await C.wait_for_timeout(1800)
        out = await C.evaluate("({ gate: !!document.getElementById('ob'), views: document.querySelectorAll('#stack > .view').length, chat: !!document.querySelector('#stack > .chatview'), board: !!document.querySelector('.boardview'), trap: !!(history.state && history.state.t) })")
        assert out == {'gate': True, 'views': 1, 'chat': False, 'board': False, 'trap': False}, ('signed out: only the To-dos screen is left under the sign-in page', out)
        print('PASS: a tip opens the chat in one step; signed out, the board and the chat are gone and one screen is left')
        await cc.close()

        await b.close()
        errors[:] = [e for e in errors if 'ERR_INTERNET_DISCONNECTED' not in e and 'Failed to fetch' not in e and 'ERR_ABORTED' not in e]
        print('ERRORS:', errors or 'NONE')
        assert not errors, errors

asyncio.run(main())
