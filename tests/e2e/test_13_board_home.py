"""Home when signed in (after the owner's reference): a big hello with what today holds in your character's voice (tap
your character for the next thing), a fanned stack of cards (Today, your partner, the journal, this week) that match
the To-dos screen, swiped or brought up by their dots, each opening one screen; the two of you as characters (your
partner's opens the chat); a floating bar (Home, To-dos, Journal, Chat) with Add a to-do beside it; ticking a to-do
off reaches your partner's Home; picking a character's look, skin, hair and role (it reaches your partner too, and
their character turns to you); nothing from a secret list ever appears or is said (unlocked or locked); "Waiting to
send" while offline; what it says before a partner is connected and with nothing to do; a tip's "Open chat"; signing
out; the chat stays mounted so opening it draws nothing new; text contrast for every colour, light and dark.
Run test 1 first (it creates Abilash in /tmp/twodo-A.json and Deiva in /tmp/twodo-B.json). Needs the test build on 8003."""
import asyncio, os, time
from playwright.async_api import async_playwright
from helpers import OPEN_CHAT, TITLES, open_chat, back_home

# what is on the board, read from the screen
BOARD = """(() => { const t = s => { const e = document.querySelector('.board ' + s); return e ? e.textContent : null; };
  const card = id => document.querySelector(`.board .hc[data-card="${id}"]`), title = id => card(id) ? card(id).querySelector('.hc-title').textContent : null;
  const top = document.querySelector('.board .hc.top'), n = s => { const m = /^(\\d+)/.exec(s || ''); return m ? +m[1] : 0; };
  return { top: top && top.dataset.card, today: n(title('today')), todayTitle: title('today'), todaySub: card('today') && card('today').querySelector('.hc-sub').textContent,
    partner: title('partner'), journal: title('journal'), week: title('week'), say: t('.say'), role: t('.role'), tape: t('.tape'),
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
# what a Calm friend says about the day (Home's line, without the greeting)
CALM = ('A gentle day', 'small thing', 'Rest counts too', 'no rush')
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
        async def open_today(pg):
            """bring the Today card to the top with its dot, then open it"""
            await pg.click('.hc-dot[aria-label="Show Today"]'); await pg.wait_for_timeout(500)
            await pg.click('.board .hc.top'); await pg.wait_for_timeout(1000)
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

        # ---------- Home: hello, then what today holds in your character's voice; the cards say what the To-dos screen counts
        assert await q(TITLES) == ['Board'] and await q("document.querySelector('.home-hi').textContent") == 'Hello, Abilash!'
        assert not await q(COMPOSER_UP) and await q(TRAY_SHOWN), "Home shows its own bar, not the task box"
        bar = await q("[...document.querySelectorAll('.board-tray button')].map(b => b.getAttribute('aria-label'))")
        assert bar[:2] == ['Home', 'To-dos and reminders'] and bar[2].startswith('Journal') and bar[3].startswith('Message Deiva') and bar[4] == 'Add a to-do', bar
        board = await q(BOARD)
        due0 = await q(TASKS + ".filter(t => !t.deleted && !t.done && t.due === (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()).length")
        assert (f'{due0} ' in board['say']) if due0 else ('Nothing new today' in board['say'] or 'Nothing planned' in board['say'] or 'empty page' in board['say'] or 'quiet day' in board['say']), ('it says how many things today', due0, board['say'])
        assert board['role'] in GREET and not any(board['say'].startswith(g) for g in GREET.values()), ('Home says hello itself; the line is what today holds', board)
        cards = await q("[...document.querySelectorAll('.board .hc')].map(c => [c.dataset.card, c.classList.contains('top'), c.inert, c.getAttribute('aria-hidden')])")
        assert sorted(c[0] for c in cards) == ['journal', 'partner', 'today', 'week'] and board['top'] == 'today', cards
        assert all((c[1] and not c[2] and c[3] is None) or (not c[1] and c[2] and c[3] == 'true') for c in cards), ('only the top card can be reached', cards)
        await todos(A)
        hub = await q(HUB)
        assert board['today'] == hub['cards']['Today'], (board, hub)
        assert board['pt'] == 'Deiva' and await q("document.querySelectorAll('.stage svg.cv').length") == 2, 'both of you are there, as your characters'
        assert await q("document.querySelector('.stage .stage-char.pt svg.cv').classList.contains('flip')"), "your partner's character turns to you"
        assert not await q("document.querySelector('.board .n-msg, .board .tiles')"), "no message card, no row of extra doors"
        await back_home(A)
        print(f"PASS: Home says hello and what today holds as a {board['role']}; four cards, only the top one reachable; Today matches the To-dos screen ({board['today']})")

        # ---------- every card and button is a door: one tap, one screen, and Back returns to the board
        async def door(sel, titles):
            await A.click(sel); await A.wait_for_timeout(1000)
            now = await q(TITLES)
            assert len(now) == 2 and now[0] == 'Board' and now[1] in titles and await q(TRAP), (sel, now)
            await q("history.back()"); await A.wait_for_timeout(900)
            assert await q(TITLES) == ['Board'] and not await q(TRAP), (sel, await q(TITLES))
        doors = [('.board .hc.top', ['Today']), ('.board .stage-char.pt', ['Chat']), ('.home-pt', ['Chat']), ('.board .role-change', ['Your character']),
                 ('.boardview .fab-btn[aria-label^="Journal"]', ['Journal']), (OPEN_CHAT, ['Chat'])]
        for sel, titles in doors: await door(sel, titles)
        for dot, card, titles in (('Show the journal', 'journal', ['Journal']), ('Show this week', 'week', ['Week']), ('Show Deiva', 'partner', ['Chat'])):
            await A.click(f'.hc-dot[aria-label="{dot}"]'); await A.wait_for_timeout(600)
            assert (await q(BOARD))['top'] == card and await q(f"document.querySelector('.hc-dot[aria-label=\"{dot}\"]').getAttribute('aria-pressed')") == 'true', dot
            await door('.board .hc.top', titles)
        await A.click('.hc-dot[aria-label="Show Today"]'); await A.wait_for_timeout(500)
        await todos(A)
        assert await q(TITLES) == ['Board', 'To-dos'] and await q(f"document.querySelector('{top} .nav-btn.back').innerText.trim()") == 'Home'
        await A.click(f'{top} .nav-btn.back'); await A.wait_for_timeout(900)
        await A.click('.boardview .fab-btn[aria-label="Settings"]'); await A.wait_for_timeout(900)
        assert await q("document.querySelector('.sheet.open h3').textContent") == 'Settings'
        await q("history.back()"); await A.wait_for_timeout(900)
        assert await q(TITLES) == ['Board'] and not await q(TRAP) and 'localhost:8003' in A.url
        print(f'PASS: {len(doors) + 5} doors on Home each open one screen (or sheet), cards brought up by their dots; Back returns Home')

        # ---------- if part of Home (or the chat) fails to draw, the rest keeps working: a safe note says what failed
        # Home formats dates when it draws; the chat's message bar asks whether this is a touch screen every time it draws
        await q("""(() => { window.__lt = [Date.prototype.toLocaleTimeString, Date.prototype.toLocaleDateString, window.matchMedia];
          const boom = () => { throw new TypeError('broken on purpose "secret words"'); }, mm = window.matchMedia;
          Date.prototype.toLocaleTimeString = Date.prototype.toLocaleDateString = boom;
          window.matchMedia = function (m) { if (/hover:\s*none/.test(m)) boom(); return mm.call(window, m); }; })()""")
        await A.click('.board .stage-char.me'); await A.wait_for_timeout(600)   # Home draws again, and fails
        fail = await q("(() => { const f = document.querySelector('.boardview .area-fail'); return f && [f.querySelector('code').textContent, !!document.querySelector('.home-hi')]; })()")
        assert fail and fail[0].startswith('Home · TypeError: broken on purpose') and 'secret' not in fail[0] and fail[1] is False, ('a failed Home part shows a safe note instead of a blank app', fail)
        assert await q("!!document.querySelector('.home-pt') && !!document.querySelector('.board-tray .tray-btn.chat')"), 'the top and the bar are still there'
        await A.click(OPEN_CHAT); await A.wait_for_timeout(1000)
        assert await q(TITLES) == ['Board', 'Chat'], 'the bar still opens the chat'
        cf = await q("(() => { const c = document.querySelector('.chatview.chat-fail'); return c && [c.querySelector('code').textContent, c.getAttribute('role'), c.inert]; })()")
        assert cf and cf[0].startswith('Chat · TypeError: broken on purpose') and 'secret' not in cf[0] and cf[1] == 'alert' and cf[2] is False, ('the chat says what failed, safely', cf)
        await q("history.back()"); await A.wait_for_timeout(900)
        assert await q(TITLES) == ['Board'], 'back closes the failed chat'
        parked = await q("""(() => { const c = document.querySelector('.chatview'); const b = document.querySelector('.boardview .area-fail .btn').getBoundingClientRect();
          const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return [c.classList.contains('parked'), c.inert, !!(hit && hit.closest('.boardview'))]; })()""")
        assert parked == [True, True, True], ('a failed chat parks like the chat and never covers Home', parked)
        await q("(() => { [Date.prototype.toLocaleTimeString, Date.prototype.toLocaleDateString, window.matchMedia] = window.__lt; })()")
        await A.click('.boardview .area-fail .btn'); await A.wait_for_timeout(600)
        assert await q("!document.querySelector('.boardview .area-fail') && !!document.querySelector('.home-hi')"), 'Try again brings Home back'
        await A.click(OPEN_CHAT); await A.wait_for_timeout(1000)
        assert await q(TITLES) == ['Board', 'Chat'] and await q("!document.querySelector('.chat-fail') && !!document.querySelector('.chatview .cb-in')"), 'the chat tries again when it opens, and works'
        await q("history.back()"); await A.wait_for_timeout(900)
        errors[:] = [e for e in errors if 'broken on purpose' not in e and 'above error occurred' not in e]
        print('PASS: a part of Home or the chat that fails to draw shows a safe note (no quoted text); the bar still works, a failed chat parks on Back, both try again')

        # ---------- a sideways swipe sends the top card to the back; a short one, a scroll or a second finger does nothing
        box = await A.locator('.board .hc.top').bounding_box()
        cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        async def swipe(dx, dy=0, steps=8, hold=0):
            await A.evaluate("""([x, y, dx, dy, steps, hold]) => new Promise(done => {
              const el = document.elementFromPoint(x, y), mk = (cx, cy) => new Touch({ identifier: 7, target: el, clientX: cx, clientY: cy });
              const fire = (type, cx, cy, list = true) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true,
                touches: list ? [mk(cx, cy)] : [], targetTouches: list ? [mk(cx, cy)] : [], changedTouches: [mk(cx, cy)] }));
              fire('touchstart', x, y); let i = 0;
              const step = () => { i++; fire('touchmove', x + dx * i / steps, y + dy * i / steps);
                if (i < steps) setTimeout(step, 16); else setTimeout(() => { fire('touchend', x + dx, y + dy, false); setTimeout(done, 700); }, hold); };
              setTimeout(step, 16); })""", [cx, cy, dx, dy, steps, hold])
        first = (await q(BOARD))['top']
        await swipe(-30, hold=300)
        assert (await q(BOARD))['top'] == first, 'a short drag that is held springs back'
        await swipe(8, 160)
        assert (await q(BOARD))['top'] == first and await q(TITLES) == ['Board'], 'a scroll leaves the cards alone and opens nothing'
        await swipe(-220)
        after_swipe = await q(BOARD)
        assert after_swipe['top'] != first and await q(TITLES) == ['Board'], ('a swipe brings the next card up and opens nothing', first, after_swipe['top'])
        order = await q("[...document.querySelectorAll('.board .hc')].sort((a, b) => b.style.zIndex - a.style.zIndex).map(c => c.dataset.card)")
        assert order[-1] == first, ('the swiped card waits at the back', order)
        await swipe(240)
        assert (await q(BOARD))['top'] != after_swipe['top'], 'a swipe to the right works too'
        await A.click('.hc-dot[aria-label="Show Today"]'); await A.wait_for_timeout(500)
        print('PASS: a sideways swipe sends the top card to the back (either way); a held short drag or a scroll does nothing')

        # ---------- the chat stays mounted while it is closed: opening it builds nothing new, and the board's notes stay as they are
        await q("window.__chat = document.querySelector('#stack > .chatview'); window.__row = window.__chat.querySelector('.msg-row[data-id]'); window.__note = document.querySelector('.board .hc-stack')")
        assert await q("!!window.__row && window.__chat.inert && getComputedStyle(window.__chat).visibility === 'hidden'"), 'closed: the conversation is drawn, hidden and unreachable'
        await open_chat(A)
        assert await q("document.querySelector('#stack > .chatview') === window.__chat && window.__row.isConnected && !window.__chat.inert && getComputedStyle(window.__chat).visibility === 'visible'")
        await back_home(A)
        assert await q("document.querySelector('#stack > .chatview') === window.__chat && window.__row.isConnected && document.querySelector('.board .hc-stack') === window.__note")
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
        assert after['today'] == board['today'] + 1, ('the new to-do counts on the Today card', board['today'], after['today'])
        await A.click('#boardAdd'); await A.wait_for_timeout(300)   # leaving the board while the box is up (the bar steps aside): it belongs to the next screen
        await A.click('.board .hc.top'); await A.wait_for_timeout(1000)
        assert await q(TITLES) == ['Board', 'Today'] and await q(COMPOSER_UP)
        await q("document.activeElement.blur(); history.back()"); await A.wait_for_timeout(900)
        assert await q(TITLES) == ['Board'] and not await q(COMPOSER_UP) and await q(TRAY_SHOWN)
        print('PASS: Add a to-do from the board: focused in the tap, due today, the box leaves when empty')

        # ---------- pin a to-do: your character tells you about it
        await open_today(A)
        await press(A, f'{top} .task:has-text("{item}") .ti', 'pin')
        await back_home(A)
        lines = await said(A)
        assert any(item in l for l in lines) or hub['cards']['Pinned'], ('your character mentions what you pinned', lines)
        assert (await q(BOARD))['say'] == lines[0], 'after going round, it is back at the first thing'
        await open_today(A)   # tidy up: unpin it again
        await press(A, f'{top} .task:has-text("{item}") .ti', 'pin')
        await back_home(A)
        print(f'PASS: your character mentions a pinned to-do (taps went through {len(lines)} things it had to say)')

        # ---------- tick it off on Today: Undo puts it back; done, Home counts one less and your partner's character says who did it
        cb, B = await phone('/tmp/twodo-B.json')
        tid = made['id']; done = TASKS + f".find(t => t.id === {tid!r}).done"
        await open_today(A)
        row = f'{top} .task:has-text("{item}")'
        await A.click(f'{row} .chk')
        assert await until(A, done, True) is True
        assert 'Completed' in await q("document.getElementById('isl').innerText"), 'the usual "Completed" with Undo appears'
        await A.click('#isl .ib'); await A.wait_for_timeout(900)   # Undo
        assert not await q(done), 'Undo puts it back'
        await A.click(f'{row} .chk')
        assert await until(A, done, True) is True
        await A.wait_for_timeout(600)
        await back_home(A)
        ticked = await q(BOARD)
        assert ticked['today'] == after['today'] - 1, ticked
        await B.wait_for_timeout(2500)
        heard = await said(B)
        assert any(f'ticked off {item}' in l and 'Abilash' in l for l in heard), ("Deiva's character tells her who ticked it off", heard)
        await cb.close()
        print("PASS: ticked off on Today (Undo works): Home counts one less; your partner's character tells them who ticked it off")

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
            return all(now[k] == before[k] for k in ('today', 'todayTitle', 'todaySub', 'partner', 'journal', 'week'))
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
        assert await q(f"!!document.querySelector('.stage .stage-char.me svg.cv-{look}')") and home['role'] == 'Calm friend' and any(w in home['say'] for w in CALM), home
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
        await B.click('.hc-dot[aria-label="Show Today"]'); await B.wait_for_timeout(500); await B.click('.board .hc.top'); await B.wait_for_timeout(1000)
        await press(B, f'{top} .task:has-text("Pinned for contrast {stamp}") .ti', 'pin')
        await press(B, f'{top} .task:has-text("Done for contrast {stamp}") .ti', 'done'); await B.wait_for_timeout(1400)
        await back_home(B)
        missing = await B.evaluate("['.home-hi', '.home-me-txt b', '.say', '.say-n', '.role', '.role-change', '.stage-name', '.pt-badge', '.home-n', '.hc.top .hc-title', '.hc.top .hc-sub', '.hc-badge', '.tray-n'].filter(s => !document.querySelector('.boardview ' + s))")
        assert not missing, ('the board under test should show every kind of note', missing)
        worst = await B.evaluate(CONTRAST)
        assert worst['ratio'] >= 4.5, ('board text contrast', worst)
        print(f"PASS: Home text keeps at least {min(worst['ratio'], offline_worst['ratio'])}:1 ({worst['measured']} pieces of text x 12 colours x light and dark, online and offline)")
        await B.click('.hc-dot[aria-label="Show Today"]'); await B.wait_for_timeout(500); await B.click('.board .hc.top'); await B.wait_for_timeout(1000)     # tidy up: unpin it again
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
        assert first['pt'] == 'Add partner' and first['today'] > 0 and first['partner'] == 'Add your partner', first
        assert await C.evaluate("[document.querySelector('.board-tray .tray-btn.chat').getAttribute('aria-label'), document.querySelector('.home-pt').textContent, document.querySelector('.home-me-txt span').textContent]") == ['Add your partner', 'Add partner', 'Just you, for now']
        for sel in ('.board .stage-char.pt', OPEN_CHAT, '.home-pt'):
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
        assert empty['today'] == 0 and empty['todayTitle'] == 'Nothing today', empty
        assert 'Nothing planned today' in heard[0] and any('partner' in l for l in heard), ('with nothing to do it says so, and suggests adding your partner', heard)
        assert await C.evaluate("[...document.querySelectorAll('.board-tray .tray-btn')].map(b => b.getAttribute('aria-label'))") == ['Add your partner', 'Add a to-do']
        worst = await C.evaluate(CONTRAST)
        assert worst['ratio'] >= 4.5, ('empty board text contrast', worst)
        await C.click('#boardAdd'); await C.wait_for_timeout(300)
        await C.keyboard.type('First thing'); await C.keyboard.press('Enter'); await C.wait_for_timeout(700)
        await C.evaluate("document.activeElement.blur()"); await C.wait_for_timeout(500)
        filled = await C.evaluate(BOARD)
        assert filled['today'] == 1 and filled['todayTitle'] == '1 to-do left' and '1 ' in filled['say'], ('one to-do: it is on Today and your character says so', filled)
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
