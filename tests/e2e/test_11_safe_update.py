"""Safe app updates: a new version downloads and waits; the app never reloads while someone is typing or editing;
"Update" saves everything, brings back what was being typed and the open screen; secret lists stay encrypted and
locked; a failed download changes nothing; the app starts offline before and after.
The test "publishes" new versions by rewriting .test-out/sw.js (restored at the end).
Run test 1 first (it creates /tmp/twodo-A.json). Needs the test build on port 8003."""
import asyncio, os, re, time
from playwright.async_api import async_playwright

# the served build's service worker (TWODO_SW points at another build's file when port 8003 serves one)
SW = os.environ.get('TWODO_SW') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.test-out', 'sw.js')
TITLES = """[...document.querySelectorAll('#stack > .view')].filter(v => !v.classList.contains('offright'))
  .map(v => v.querySelector('.nav-title')?.textContent || (v.classList.contains('chatview') ? 'Chat' : '?'))"""
REG = "navigator.serviceWorker.getRegistration()"
ISLAND = "(() => { const i = document.querySelector('#isl.on.toast'); return i ? i.querySelector('.txt').textContent : ''; })()"
DOT = "!!document.querySelector('.chat-nav .fab-btn[aria-label=\"Settings\"] .fab-dot:not([hidden])')"

async def main():
    original = open(SW).read()
    def publish(version, missing_file=False):
        """a new build on the server: same files, new version (optionally listing a file that can't be downloaded)"""
        s = re.sub(r"const VERSION = '[^']+'", f"const VERSION = '{version}'", original)
        if missing_file: s = s.replace('const SHELL = [', 'const SHELL = ["not-there-' + version + '.js",', 1)
        open(SW, 'w').write(s)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        errors = []
        ctx = await b.new_context(storage_state='/tmp/twodo-A.json', viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        async def page():
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            await pg.goto('http://localhost:8003/'); await pg.wait_for_timeout(2600)
            return pg
        async def until(pg, js, want=True, ms=10000):
            got = None
            for _ in range(ms // 100):
                try: got = await pg.evaluate(js)
                except Exception: got = None  # the page is reloading
                if got == want: return got
                await pg.wait_for_timeout(100)
            return got
        async def download(pg, expect_waiting=True):
            await pg.evaluate(f"{REG}.then(r => r.update()).catch(() => {{}})")
            if expect_waiting: assert await until(pg, f"{REG}.then(r => !!r.waiting)"), 'the new version should download and wait'
            else: await pg.wait_for_timeout(2500)
        try:
            P = await page()
            assert await until(P, "!!navigator.serviceWorker.controller"), 'service worker controls the page'
            first = await P.evaluate("caches.keys()"); assert len(first) == 1, first

            # ---------- a new version arrives while a message is being typed: nothing reloads, nothing interrupts
            await P.click('.cb-in'); await P.keyboard.type('half-written message'); await P.evaluate("window.__mark = 1")
            publish('twodo-v4-testupdate01'); await download(P); await P.wait_for_timeout(2500)
            assert await P.evaluate("window.__mark") == 1, 'the app reloaded while typing'
            assert await P.evaluate("[document.activeElement.className, document.activeElement.value]") == ['cb-in', 'half-written message']
            assert 'Update' not in await P.evaluate(ISLAND), 'no prompt over someone who is typing'
            assert await P.evaluate(DOT), 'Settings shows a dot while an update waits'
            assert sorted(await P.evaluate("caches.keys()")) == sorted(first + ['twodo-v4-testupdate01']), 'the running version keeps its own files'
            print('PASS: an update that arrives while typing waits: no reload, focus and text untouched')

            # ---------- a quiet moment: the prompt appears; "Update" keeps the draft and the open screen
            await P.evaluate("document.activeElement.blur()")
            await P.click('.fab-btn[aria-label="To-dos and reminders"]'); await P.wait_for_timeout(1000)
            await P.click('.group .cell:has-text("Groceries")'); await P.wait_for_timeout(1000)
            await P.click('#cta'); await P.keyboard.type('buy stamps'); await P.evaluate("document.activeElement.blur()"); await P.wait_for_timeout(400)
            await P.evaluate("document.dispatchEvent(new Event('visibilitychange'))")   # e.g. back from another app
            assert await until(P, f"{ISLAND}.startsWith('Update ready')"), ('prompt in a quiet moment', await P.evaluate(ISLAND))
            assert await P.evaluate("window.__mark") == 1
            async with P.expect_navigation(timeout=15000): await P.click('#isl .ib')
            await P.wait_for_timeout(2800)
            assert await P.evaluate("window.__mark") is None, 'the page should have reloaded into the new version'
            assert await P.evaluate(TITLES) == ['Chat', 'To-dos', 'Groceries'], ('back on the same screen', await P.evaluate(TITLES))
            assert await P.evaluate("document.querySelector('#cta').value") == 'buy stamps', 'the task being typed is back'
            assert await until(P, f"{ISLAND}.includes('up to date')"), 'says it updated'
            await P.evaluate("history.back()"); await P.wait_for_timeout(900); await P.evaluate("history.back()"); await P.wait_for_timeout(900)
            assert await P.evaluate("document.querySelector('.cb-in').value") == 'half-written message', 'the message being typed is back'
            assert await P.evaluate("caches.keys()") == ['twodo-v4-testupdate01'], await P.evaluate("caches.keys()")
            assert not await P.evaluate(DOT) and await P.evaluate("sessionStorage.getItem('twodo:resume')") is None
            print('PASS: "Update" reloads once, returns to the same screen and restores both drafts')

            # ---------- offline start on the new version
            await ctx.set_offline(True); await P.reload(); await P.wait_for_timeout(2600)
            assert await P.evaluate("!!document.querySelector('.chatview') && document.getElementById('splash').hidden"), 'offline start after the update'
            await ctx.set_offline(False); await P.wait_for_timeout(1500)
            print('PASS: starts offline on the new version')

            # ---------- an open task editor: the update waits; then "Update" from Settings keeps the edit
            await P.click('.fab-btn[aria-label="To-dos and reminders"]'); await P.wait_for_timeout(1000)
            await P.click('.group .cell:has-text("Groceries")'); await P.wait_for_timeout(1000)
            item = f'Update item {int(time.time()) % 1000000}'   # unique: the test accounts keep their to-dos between runs
            await P.fill('#cta', item); await P.press('#cta', 'Enter'); await P.wait_for_timeout(700)
            await P.evaluate("document.activeElement.blur()"); await P.wait_for_timeout(300)
            await P.click(f'.view:not(.under) .task:has-text("{item}") .tt'); await P.wait_for_timeout(1000)
            assert await P.locator('.sheet.open').count() == 1, 'task editor open'
            await P.click('.sheet.open .d-tt'); await P.keyboard.press('End'); await P.keyboard.type(' edited'); await P.evaluate("window.__mark = 2")
            publish('twodo-v4-testupdate02'); await download(P); await P.wait_for_timeout(2000)
            assert await P.evaluate("window.__mark") == 2 and await P.locator('.sheet.open').count() == 1, 'the editor was interrupted'
            assert await P.evaluate("document.activeElement.classList.contains('d-tt')"), 'the title lost focus'
            await P.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await P.wait_for_timeout(2000)
            assert 'Update' not in await P.evaluate(ISLAND), 'no prompt over an open editor'
            await P.evaluate("document.activeElement.blur(); history.back()"); await P.wait_for_timeout(900)
            await P.evaluate("history.back()"); await P.wait_for_timeout(900); await P.evaluate("history.back()"); await P.wait_for_timeout(900)
            await P.click('.fab-btn[aria-label="Settings"]'); await P.wait_for_timeout(1000)
            assert await P.locator('#applyUpdate').count() == 1, 'Settings offers the update'
            async with P.expect_navigation(timeout=15000): await P.click('#applyUpdate')
            await P.wait_for_timeout(2800)
            assert await P.evaluate("Object.values(JSON.parse(localStorage.getItem('twodo:data')).tasks).some(t => t.title === %r)" % (item + ' edited')), 'the edit was saved before the reload'
            assert await P.evaluate("caches.keys()") == ['twodo-v4-testupdate02']
            print('PASS: an open task editor is never interrupted; updating from Settings keeps the edit')

            # ---------- secret lists: never reopened or written down by an update; typing inside one blocks it
            async def unlock_and_open():
                await P.click('.fab-btn[aria-label="To-dos and reminders"]'); await P.wait_for_timeout(1000)
                assert 'Locked' in await P.evaluate("document.querySelector('.secret-group .cell').textContent"), 'secret lists are locked after an update'
                assert 'Anniversary' not in await P.evaluate("document.body.textContent"), 'nothing secret on screen while locked'
                await P.click('.secret-group .cell'); await P.wait_for_timeout(900)
                await P.get_by_text('Use letters and numbers', exact=True).click()
                await P.fill('.vault-password input', 'Deiva2026surprise'); await P.locator('.vault-pad > .btn').click(); await P.wait_for_timeout(1500)
                if await P.locator('.sheet.open').count(): await P.evaluate("history.back()"); await P.wait_for_timeout(900)
                if not await P.locator('.view:not(.under) .task').count(): await P.click('.secret-group .cell'); await P.wait_for_timeout(900)
                assert await P.locator('.view:not(.under) .task:has-text("Anniversary surprise")').count() == 1, 'the secret task survived the update'
            def in_the_clear(stored): return 'Anniversary surprise' in stored or 'secret half-typed' in stored
            STORED = "JSON.stringify([localStorage.getItem('twodo:data'), localStorage.getItem('twodo:local'), localStorage.getItem('twodo:chat'), sessionStorage.getItem('twodo:resume')])"
            await P.click('.fab-btn[aria-label="To-dos and reminders"]'); await P.wait_for_timeout(1000)
            await P.click('.secret-group .cell'); await P.wait_for_timeout(800)
            await P.click('.vault-gate .btn:has-text("Create passcode")'); await P.wait_for_timeout(700)
            await P.get_by_text('Use letters and numbers', exact=True).click()
            for _ in range(2):
                await P.fill('.vault-password input', 'Deiva2026surprise'); await P.locator('.vault-pad > .btn').click(); await P.wait_for_timeout(1200)
            if await P.get_by_text('Not now', exact=True).count(): await P.get_by_text('Not now', exact=True).click()
            await P.wait_for_timeout(900)
            await P.fill('#cta', 'Anniversary surprise'); await P.press('#cta', 'Enter'); await P.wait_for_timeout(800)
            await P.evaluate("document.activeElement.blur()"); await P.wait_for_timeout(300)
            vault_before = await P.evaluate("localStorage.getItem('twodo:vault')")
            # (a) the unlocked secret list is the open screen, nothing typed: the update goes ahead, the list is not reopened
            publish('twodo-v4-testupdate03'); await download(P)
            await P.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
            assert await until(P, f"{ISLAND}.startsWith('Update ready')"), 'prompt (nothing is focused)'
            async with P.expect_navigation(timeout=15000): await P.click('#isl .ib')
            await P.wait_for_timeout(2800)
            assert await P.evaluate(TITLES) == ['Chat', 'To-dos'], ('a secret list must not be reopened by an update', await P.evaluate(TITLES))
            assert not in_the_clear(await P.evaluate(STORED)), 'secret text outside the vault'
            vault_after = await P.evaluate("localStorage.getItem('twodo:vault')")
            assert vault_after and 'Anniversary' not in vault_after and len(vault_after) >= len(vault_before or '') - 8, 'vault file kept, still encrypted'
            await P.evaluate("history.back()"); await P.wait_for_timeout(900)
            await unlock_and_open()
            # (b) text typed inside the secret list: it can't be carried over (never stored unencrypted), so the update waits
            await P.fill('#cta', 'secret half-typed'); await P.evaluate("document.activeElement.blur(); window.__mark = 3"); await P.wait_for_timeout(300)
            publish('twodo-v4-testupdate03b'); await download(P)
            await P.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
            assert await until(P, f"{ISLAND}.startsWith('Update ready')"), 'prompt again on the next version'
            await P.click('#isl .ib'); await P.wait_for_timeout(1500)
            assert await P.evaluate("window.__mark") == 3, 'update must not go ahead over unsaved text in a secret list'
            assert 'secret list' in await P.evaluate(ISLAND), await P.evaluate(ISLAND)
            assert not in_the_clear(await P.evaluate(STORED)), 'nothing from a secret list may be written down'
            await P.fill('#cta', ''); await P.evaluate("document.activeElement.blur()"); await P.wait_for_timeout(300)
            await P.evaluate("history.back()"); await P.wait_for_timeout(900); await P.evaluate("history.back()"); await P.wait_for_timeout(900)
            await P.click('.fab-btn[aria-label="Settings"]'); await P.wait_for_timeout(1000)
            async with P.expect_navigation(timeout=15000): await P.click('#applyUpdate')
            await P.wait_for_timeout(2800)
            assert not in_the_clear(await P.evaluate(STORED))
            await unlock_and_open()
            print('PASS: secret lists: not reopened or written down by an update, unsaved secret text blocks it; afterwards locked and intact')

            # ---------- a download that fails changes nothing; the next good one applies when the app is reopened from closed
            await P.evaluate("history.back()"); await P.wait_for_timeout(900); await P.evaluate("history.back()"); await P.wait_for_timeout(900)
            publish('twodo-v4-testupdate04', missing_file=True); await download(P, expect_waiting=False)
            assert not await P.evaluate(f"{REG}.then(r => !!r.waiting)") and not await P.evaluate(DOT), 'a broken download must not be offered'
            await ctx.set_offline(True); await P.reload(); await P.wait_for_timeout(2600)
            assert await P.evaluate("!!document.querySelector('.chatview')"), 'still starts offline on the version it has'
            await P.evaluate(f"{REG}.then(r => r.update()).catch(() => 0)"); await P.wait_for_timeout(1200)   # checking for updates with no network: harmless
            await ctx.set_offline(False); await P.wait_for_timeout(1500)
            publish('twodo-v4-testupdate05'); await download(P)
            await P.close(); await asyncio.sleep(1.5)        # the app is closed with an update waiting…
            P = await page()                                 # …and opened again
            assert await until(P, "caches.keys().then(k => k.join())", 'twodo-v4-testupdate05', 12000) == 'twodo-v4-testupdate05', await P.evaluate("caches.keys()")
            assert not await P.evaluate(f"{REG}.then(r => !!r.waiting)") and not await P.evaluate(DOT)
            print('PASS: a failed download is ignored; a waiting update applies by itself when the app is reopened from closed')
        finally:
            open(SW, 'w').write(original)
        await b.close()
        print('ERRORS:', errors or 'NONE')
        assert not errors, errors

asyncio.run(main())
