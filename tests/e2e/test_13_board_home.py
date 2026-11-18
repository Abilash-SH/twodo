"""Home when signed in: your character tells you about your day in its role's voice (tap it for the next thing), then
your partner's character (the way into your chat), and today's to-dos with the week one tap away; its two buttons (message your partner, add a to-do)
never move; to-dos are added and ticked off in place and your partner's Home follows; picking a character's look, skin,
hair and role (it reaches your partner too, and their character turns to you); nothing from a secret list ever appears or is said (unlocked or locked); "Waiting to
send" while offline; what it says before a partner is connected and with nothing to do; a tip's "Open chat"; signing
out; the chat stays mounted so opening it draws nothing new; text contrast for every colour, light and dark.
Run test 1 first (it creates Abilash in /tmp/twodo-A.json and Deiva in /tmp/twodo-B.json). Needs the test build on 8003."""
import asyncio, os, time
from playwright.async_api import async_playwright
from helpers import OPEN_CHAT, TITLES, open_chat, back_home

# what is on the board, read from the screen
BOARD = """(() => { const t = s => { const e = document.querySelector('.board ' + s); return e ? e.textContent : null; };
  const rows = [...document.querySelectorAll('.board .bn-task')].map(r => r.querySelector('.bn-title').textContent), more = t('.n-today button.n-go');
  return { rows, more, today: rows.length + (more ? parseInt(more) : 0), say: t('.say'), role: t('.role'), tape: t('.tape'),
    pt: t('.stage-char.pt .stage-name'), badge: t('.stage-char.pt .pt-badge') }; })()"""
# what the To-dos screen counts (it must be open)
HUB = """(() => { const v = document.querySelector('#stack > .view.pushed:not(.parked):not(.under)');
  return { cards: Object.fromEntries([...v.querySelectorAll('.hub-card')].map(c => [c.querySelector('.hub-t').textContent, +c.querySelector('.hub-n').textContent || 0])),
    lists: [...v.querySelectorAll('.group:not(.secret-group):not(.plan-group) .cell:not(.accent)')].map(c => [c.querySelector('.grow').textContent, +c.querySelector('.val').textContent || 0]) }; })()"""
TASKS = "Object.values(JSON.parse(localStorage.getItem('twodo:data')).tasks)"
TRAP = "!!(history.state && history.state.t)"
COMPOSER_UP = "!document.getElementById('composer').classList.contains('hide')"
TRAY_SHOWN = "getComputedStyle(document.querySelector('.board-tray')).visibility === 'visible'"
GREET = {'Cheerleader': ('Morning, ', 'Afternoon, ', 'Evening, ', 'Still up, '), 'Calm friend': ('Good morning.', 'Good afternoon.', 'Good evening.', 'It’s late.'),
         'Cheeky': ('Up already?', 'Oh, hi.', 'Evening, ', 'Can’t sleep?'), 'Poet': ('The morning opens.', 'The afternoon hums along.', 'Evening settles in.', 'The night is quiet.')}
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
        async def said(pg):
            """every line your character has for you: tap it until it comes back to the first"""
            n = int((await pg.evaluate("(document.querySelector('.say-n') || { textContent: '1/1' }).textContent")).split('/')[1])
            out = []
            for _ in range(n):
                out.append(await pg.evaluate("document.querySelector('.say').textContent")); await pg.click('.stage-char'); await pg.wait_for_timeout(120)
            return out
        top = '#stack > .view:not(.under):not(.offright)'
        stamp = int(time.time()) % 1000000   # the test accounts keep their to-dos between runs

        ca, A = await phone('/tmp/twodo-A.json')
        q = A.evaluate

        # ---------- Home: your character speaks first; the cards say what the To-dos screen counts
        assert await q(TITLES) == ['Board'] and await q("document.querySelector('.board-title').textContent") == 'Home'
        assert not await q(COMPOSER_UP) and await q(TRAY_SHOWN), "Home shows its own two buttons, not the task box"
        assert await q("[...document.querySelectorAll('.board-tray .tray-btn')].map(b => b.textContent)") == ['Message Deiva', 'Add a to-do']
        board = await q(BOARD)
        assert board['role'] in GREET and board['say'].startswith(GREET[board['role']]), ('it greets you in its role\'s voice', board['say'], board['role'])
        due0 = await q(TASKS + ".filter(t => !t.deleted && !t.done && t.due === (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()).length")
        assert (f'{due0} ' in board['say']) if due0 else ('Nothing new today' in board['say'] or 'Nothing planned' in board['say'] or 'empty page' in board['say'] or 'quiet day' in board['say']), ('and how many things today', due0, board['say'])
        await todos(A)
        hub = await q(HUB)
        assert board['today'] == hub['cards']['Today'] and len(board['rows']) == min(3, hub['cards']['Today']), (board, hub)
        assert board['pt'] == 'Deiva' and await q("document.querySelectorAll('.stage svg.cv').length") == 2, 'both of you are there, as your characters'
        assert await q("document.querySelector('.stage .stage-char.pt svg.cv').classList.contains('flip')"), "your partner's character turns to you"
        assert not await q("document.querySelector('.board .n-msg, .board .tiles')"), "no message card, no row of extra doors"
        await back_home(A)
        print(f"PASS: your character greets you as a {board['role']} and says what's on today; the cards match the To-dos screen ({board['today']} today)")

        # ---------- every note is a door: one tap, one screen, and Back returns to the board
        doors = [('.board .stage-char.pt', ['Chat']), ('.board .n-today .n-h.link', ['Today']), ('.board .n-today .n-week', ['Week']),
                 ('.boardview .fab-btn[aria-label^="Journal"]', ['Journal']), ('.board .role-change', ['Your character'])]
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
        assert await q(TITLES) == ['Board', 'To-dos'] and await q(f"document.querySelector('{top} .nav-btn.back').innerText.trim()") == 'Home'
        await A.click(f'{top} .nav-btn.back'); await A.wait_for_timeout(900)
        await A.click('.boardview .fab-btn[aria-label="Settings"]'); await A.wait_for_timeout(900)
        assert await q("document.querySelector('.sheet.open h3').textContent") == 'Settings'
        await q("history.back()"); await A.wait_for_timeout(900)
        assert await q(TITLES) == ['Board'] and not await q(TRAP) and 'localhost:8003' in A.url
        print(f'PASS: {len(doors) + 3} doors on Home each open one screen (or sheet); Back returns Home')

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

        # ---------- pin a to-do: it leads Today, and your character tells you about it
        await A.click('.board .n-today .n-h.link'); await A.wait_for_timeout(1000)
        await press(A, f'{top} .task:has-text("{item}") .ti', 'pin')
        await back_home(A)
        pinned = await q(BOARD)
        assert item in pinned['rows'], ('a pinned to-do is on Today', pinned)
        if not hub['cards']['Pinned']: assert pinned['rows'][0] == item, pinned
        lines = await said(A)
        assert any(item in l for l in lines) or hub['cards']['Pinned'], ('your character mentions what you pinned', lines)
        assert (await q(BOARD))['say'] == lines[0], 'after going round, it is back at the first thing'
        print(f'PASS: a pinned to-do leads Today and your character mentions it (taps went through {len(lines)} things it had to say)')

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
        assert item not in ticked['rows'] and ticked['today'] == after['today'] - 1, ticked
        assert 'Completed' in await q("document.getElementById('isl').innerText"), 'the usual "Completed" with Undo appears'
        await B.wait_for_timeout(2500)
        heard = await said(B)
        assert any(f'ticked off {item}' in l and 'Abilash' in l for l in heard), ("Deiva's character tells her who ticked it off", heard)
        await A.click('#isl .ib'); await A.wait_for_timeout(900)   # Undo
        undone = await q(BOARD)
        assert not await q(done) and item in undone['rows'], ('Undo puts it back', undone)
        await A.click('.board .n-today .n-h.link'); await A.wait_for_timeout(1000)   # tidy up: unpin it again
        await press(A, f'{top} .task:has-text("{item}") .ti', 'pin')
        await back_home(A)
        await cb.close()
        print("PASS: tick on Home: cancel with a second tap, complete, Undo; your partner's character tells them who ticked it off")

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
            return all(now[k] == before[k] for k in ('rows', 'more', 'today'))
        hidden = "(() => { const t = document.querySelector('.boardview').textContent; return !t.includes('Anniversary') && !t.includes('Secret'); })()"
        async def says_nothing_secret():
            return not any('Anniversary' in l or 'Secret' in l for l in await said(A))
        await back_home(A)
        now = await q(BOARD)
        assert same_board(now) and await q(hidden) and await says_nothing_secret(), ('unlocked: a secret to-do (today, for both, pinned) must not reach Home or be said', before, now)
        assert await q("document.querySelector('.boardview .fab-btn[aria-label=\"To-dos and reminders\"] .fab-dot').hidden") == (before['today'] == 0), 'nor the dot on the To-dos button'
        await todos(A); await A.click('.secret-group .cell:has-text("Secret")'); await A.wait_for_timeout(900)
        await A.click(f'{top} .task:has-text("Anniversary surprise") .chk'); await A.wait_for_timeout(1600)   # ticked off inside the secret list
        await back_home(A)
        now = await q(BOARD)
        assert same_board(now) and await q(hidden) and await says_nothing_secret(), ('a secret to-do ticked off must not be announced on Home', before, now)
        await A.reload(); await A.wait_for_timeout(2600)   # locked again
        now = await q(BOARD)
        assert same_board(now) and 'Anniversary' not in await q("document.body.textContent") and await says_nothing_secret(), ('locked: nothing secret anywhere on Home', before, now)
        assert 'Anniversary' not in await q("localStorage.getItem('twodo:data') + localStorage.getItem('twodo:local') + localStorage.getItem('twodo:chat')"), 'and it is only stored encrypted'
        print('PASS: a secret to-do that is due today, for both of you and pinned never reaches Home or what your character says: unlocked, ticked off or locked')

        # ---------- offline: the board says so, and an unsent message says it is waiting
        cb, B = await phone('/tmp/twodo-B.json')
        unread = "(() => { const c = JSON.parse(localStorage.getItem('twodo:chat') || '{}'), me = JSON.parse(localStorage.getItem('twodo:local')).auth.uid; return Object.values(c.msgs || {}).filter(m => m.f !== me && !m.del && m.ts > c.read).length; })()"
        n0 = await B.evaluate(unread)
        await open_chat(A)
        await ca.set_offline(True); await A.wait_for_timeout(300)
        await A.fill('.chatview .cb-in', f'no signal {stamp}'); await A.click('.chatview .cb-send'); await A.wait_for_timeout(1200)
        await q("document.activeElement.blur()"); await back_home(A)
        off = await q("({ tape: (document.querySelector('.board .tape') || {}).textContent, text: document.querySelector('.boardview').textContent.includes('no signal') })")
        assert off == {'tape': 'Offline. Everything is saved here.', 'text': False}, off
        offline_worst = await q(CONTRAST)   # the tape and "Waiting to send" are text too
        assert offline_worst['ratio'] >= 4.5, ('offline board text contrast', offline_worst)
        await ca.set_offline(False)
        assert await until(A, "!document.querySelector('.board .tape')", True, 15000), 'back online: the tape goes'
        n1 = n0 + 1; shown = '9+' if n1 > 9 else str(n1)
        assert await until(B, "[(document.querySelector('.board .stage-char.pt .pt-badge') || {}).textContent, (document.querySelector('.board-tray .tray-n') || {}).textContent]", [shown, shown], 15000) == [shown, shown], "it reaches your partner: their Home says one more is new"
        print('PASS: offline Home says so; the message goes when the connection returns, and your partner sees one more new')

        # ---------- your character and its role: picked on its own screen, shown on Home, seen by your partner
        await A.click('.board .role-change'); await A.wait_for_timeout(1000)
        assert await q(TITLES) == ['Board', 'Your character']
        before = await q("[document.querySelector('.chv-pick.on').dataset.look, ...[...document.querySelectorAll('.chv-dot.on')].map(d => d.getAttribute('aria-label'))]")
        other = 'Male' if before[0] == 'female' else 'Female'
        await A.click(f'.chv-pick[data-look="{other.lower()}"]'); await A.wait_for_timeout(300)
        skin, hair = ('Peach', 'Golden') if before[1:] == ['Cocoa', 'Auburn'] else ('Cocoa', 'Auburn')
        await A.click(f'.chv-dot[aria-label="{skin}"]'); await A.wait_for_timeout(200)
        await A.click(f'.chv-dot[aria-label="{hair}"]'); await A.wait_for_timeout(200)
        await A.click('.chv-role:has-text("Calm friend")'); await A.wait_for_timeout(500)
        look = other.lower()
        assert await q("[document.querySelector('.chv-pick.on').textContent, [...document.querySelectorAll('.chv-dot.on')].map(d => d.getAttribute('aria-label')).join('/'), document.querySelector('.chv-role.on b').textContent, !!document.querySelector('.chv-preview svg.cv-" + look + "')]") == [other, f'{skin}/{hair}', 'Calm friend', True]
        assert (await q("document.querySelector('.chv-preview .say').textContent")).startswith(GREET['Calm friend'])
        assert await q("[...document.querySelectorAll('.chv [role=radiogroup] [role=radio]')].every(b => b.getAttribute('aria-checked') === 'true' || b.getAttribute('aria-checked') === 'false') && document.querySelectorAll('.chv-dot').length === 11"), 'skin and hair are labelled radio buttons'
        await back_home(A)
        home = await q(BOARD)
        assert await q(f"!!document.querySelector('.stage .stage-char.me svg.cv-{look}')") and home['role'] == 'Calm friend' and home['say'].startswith(GREET['Calm friend']), home
        mine = await q("JSON.parse(localStorage.getItem('twodo:local')).me")
        want = f"{look}/{skin.lower()}/{hair.lower()}/calm"
        assert await until(B, f"(() => {{ const p = JSON.parse(localStorage.getItem('twodo:data')).people, m = p && p.{mine}; return m && m.avatar && [m.avatar.look, m.avatar.skin, m.avatar.hair, m.role].join('/'); }})()", want, 12000) == want, 'it reaches your partner'
        assert await until(B, f"!!document.querySelector('.board .stage-char.pt svg.cv-{look}')", True), "your partner's Home shows your new character next to theirs"
        await A.click('.boardview .fab-btn[aria-label="Settings"]'); await A.wait_for_timeout(900)
        assert await q("document.querySelector('.sheet.open .me-char .sub').textContent") == f'{other} · Calm friend'
        assert await q("!!document.querySelector('.sheet.open .me-char .cv-portrait svg')"), 'the row shows your character'
        await A.click('.sheet.open .me-char'); await A.wait_for_timeout(1300)
        assert await q(TITLES) == ['Board', 'Your character'], 'Settings leads to it too'
        await A.click(f'.chv-pick[data-look="{before[0]}"]'); await A.wait_for_timeout(200)   # tidy up
        for label in before[1:]: await A.click(f'.chv-dot[aria-label="{label}"]'); await A.wait_for_timeout(150)
        await A.click('.chv-role:has-text("Cheerleader")'); await A.wait_for_timeout(300)
        await back_home(A)
        print("PASS: picking a look, skin, hair and role changes Home at once and reaches your partner (it stands next to theirs, turned to them); Settings leads there too")

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
        missing = await B.evaluate("['.say', '.role', '.role-change', '.stage-name', '.pt-badge', '.n-today .bn-title', '.n-today .n-date', '.n-today .n-week', '.n-today button.n-go', '.tray-n'].filter(s => !document.querySelector('.boardview ' + s))")
        assert not missing, ('the board under test should show every kind of note', missing)
        worst = await B.evaluate(CONTRAST)
        assert worst['ratio'] >= 4.5, ('board text contrast', worst)
        print(f"PASS: Home text keeps at least {min(worst['ratio'], offline_worst['ratio'])}:1 ({worst['measured']} pieces of text x 12 colours x light and dark, online and offline)")
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
        await C.click('text=Get started'); await C.wait_for_timeout(1500)
        first = await C.evaluate(BOARD)
        assert first['pt'] == 'Add partner' and first['rows'], first
        assert await C.evaluate("document.querySelector('.board-tray .tray-btn.chat').textContent") == 'Add partner'
        for sel in ('.board .stage-char.pt', OPEN_CHAT):
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
        empty = await C.evaluate(BOARD)
        heard = await said(C)
        assert empty['rows'] == [] and await C.evaluate("document.querySelector('.n-today > .n-sub').textContent") == 'Nothing planned today.', empty
        assert 'Nothing planned today' in heard[0] and any('partner' in l for l in heard), ('with nothing to do it says so, and suggests adding your partner', heard)
        assert await C.evaluate("[...document.querySelectorAll('.board-tray .tray-btn')].map(b => b.textContent)") == ['Add partner', 'Add a to-do']
        worst = await C.evaluate(CONTRAST)
        assert worst['ratio'] >= 4.5, ('empty board text contrast', worst)
        await C.click('#boardAdd'); await C.wait_for_timeout(300)
        await C.keyboard.type('First thing'); await C.keyboard.press('Enter'); await C.wait_for_timeout(700)
        await C.evaluate("document.activeElement.blur()"); await C.wait_for_timeout(500)
        filled = await C.evaluate(BOARD)
        assert filled['rows'] == ['First thing'] and '1 ' in filled['say'], ('one to-do: it is on Today and your character says so', filled)
        print(f"PASS: before pairing Home leads to Add partner; with nothing to do your character says so (text at least {worst['ratio']}:1); the first to-do fills Today")

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
        print('PASS: a tip opens the chat in one step; signed out, Home and the chat are gone and one screen is left')
        await cc.close()

        await b.close()
        errors[:] = [e for e in errors if 'ERR_INTERNET_DISCONNECTED' not in e and 'Failed to fetch' not in e and 'ERR_ABORTED' not in e]
        print('ERRORS:', errors or 'NONE')
        assert not errors, errors

asyncio.run(main())
