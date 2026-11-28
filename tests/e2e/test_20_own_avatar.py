"""Your own 3D you (asked for 2026-11-25: realistic 3D people "from selfies", synced to the other phone; docs/own-avatar.md).
Settings → Your character → Your own 3D you: a file that isn't an avatar is refused with a reason; an avatar .glb is
checked, made small and shown at once; it reaches your partner's Home (and their round picture of you) by itself,
encrypted, in pieces under spaces/{space}/av/{uid}/; "Use a Twodo person again" takes it off both phones and the
database. Run test 1 first. Needs the test build on 8003 and an avatar .glb: AVATAR=/path/to/avatar.glb (any Avaturn
export; default /tmp/avt/a/public/default_model.glb, Avaturn's sample, kept out of the repo), and /tmp/mo/sunset.jpg."""
import asyncio, json, os, urllib.request
from playwright.async_api import async_playwright
from helpers import TITLES, back_home

AVATAR = os.environ.get('AVATAR', '/tmp/avt/a/public/default_model.glb')
NOTE = "(() => { const n = document.querySelector('.chv-own-note'); return n && [n.className.replace('chv-own-note', '').trim(), n.textContent]; })()"
SHOWN = "document.querySelector('.home-people').dataset.people"

def pieces():
    d = json.load(urllib.request.urlopen('http://127.0.0.1:9000/__dump'))
    return {u: {v: len(c) for v, c in x.items()} for sp in d.get('spaces', {}).values() for u, x in (sp.get('av') or {}).items()}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        errors = []
        async def phone(state):
            ctx = await b.new_context(storage_state=state, viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            pg.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
            await pg.goto('http://localhost:8003/'); await pg.wait_for_timeout(3000)
            return ctx, pg
        async def until(pg, js, want, ms=20000):
            got = None
            for _ in range(ms // 100):
                got = await pg.evaluate(js)
                if (want(got) if callable(want) else got == want): return got
                await pg.wait_for_timeout(100)
            return got
        async def pick(pg, path):
            async with pg.expect_file_chooser() as fc: await pg.click('.chv-own-btn:has-text("Import")')
            await (await fc.value).set_files(path)

        ca, A = await phone('/tmp/twodo-A.json'); cb, B = await phone('/tmp/twodo-B.json')
        await A.click('.boardview .fab-btn[aria-label="Settings"]'); await A.wait_for_timeout(900)
        await A.click('.sheet.open .me-char'); await A.wait_for_timeout(1300)
        assert await A.evaluate(TITLES) == ['Board', 'Your character']
        if await A.evaluate("!!document.querySelector('.chv-own-off')"):          # left from an earlier run: start from a Twodo person
            await A.click('.chv-own-off'); await A.wait_for_timeout(1500)
        assert await A.evaluate("document.querySelector('.chv-own a').getAttribute('href')") == 'https://avaturn.me' and await A.evaluate("document.querySelector('.chv-own a').rel.includes('noopener')")

        # ---------- not an avatar: refused, with a reason; nothing changes
        await pick(A, '/tmp/mo/sunset.jpg')
        note = await until(A, NOTE, lambda n: n and n[0] == 'failed')
        assert note[0] == 'failed' and '.glb' in note[1], note
        assert await A.evaluate("document.querySelector('.person-preview').dataset.people") != 'own' and all(not v for v in pieces().values())
        print(f'PASS: a photo instead of an avatar is refused: "{note[1]}"')

        # ---------- an avatar: checked, made small, shown here at once, then on your partner's phone by itself
        await pick(A, AVATAR)
        await until(A, NOTE, lambda n: n and n[0] != 'failed', 10000)            # it starts: Checking…
        note = await until(A, NOTE, lambda n: n and n[0] in ('sent', 'failed', 'local'), 60000)
        assert note[0] == 'sent', note
        assert await A.evaluate("document.querySelector('.person-preview').dataset.people") == 'own'
        kept = pieces()
        assert len(kept) == 1 and all(len(v) == 1 and all(1 <= n <= 48 for n in v.values()) for v in kept.values()), ('one version, in pieces', kept)
        n = list(list(kept.values())[0].values())[0]
        mine = await A.evaluate("JSON.parse(localStorage.getItem('twodo:local')).me")
        model = await A.evaluate(f"JSON.parse(localStorage.getItem('twodo:data')).people.{mine}.model")
        assert model and len(model['h']) == 64 and model['n'] == n, model
        d = json.load(urllib.request.urlopen('http://127.0.0.1:9000/__dump'))
        blob = json.dumps(d)
        assert 'glTF' not in blob and 'avaturn' not in blob.lower(), 'only ciphertext in the database'
        await back_home(A)
        assert (await until(A, SHOWN, lambda s: s.split(' ')[0] == 'own')).split(' ')[0] == 'own', 'on your own Home'
        got = await until(B, SHOWN, lambda s: s.split(' ')[1] == 'own', 30000)
        assert got.split(' ')[1] == 'own', ('it reaches your partner by itself', got)
        assert await until(B, "document.querySelector('.home-pt .cv-portrait').dataset.person", 'own') == 'own', 'and their round picture of you'
        assert await until(B, "!!document.querySelector('.home-people.ready')", True, 30000), 'drawn, moving like the others'
        print(f'PASS: your avatar is checked, made small ({n} encrypted pieces), shown at once, and reaches Deiva\'s Home and picture by itself')

        # ---------- back to a Twodo person: off both phones and out of the database
        await A.click('.boardview .fab-btn[aria-label="Settings"]'); await A.wait_for_timeout(900)
        await A.click('.sheet.open .me-char'); await A.wait_for_timeout(1300)
        await A.click('.chv-own-off'); await A.wait_for_timeout(800)
        assert await A.evaluate("document.querySelector('.person-preview').dataset.people") != 'own'
        await back_home(A)
        got = await until(B, SHOWN, lambda s: s.split(' ')[1] != 'own', 20000)
        assert got.split(' ')[1] != 'own' and await until(B, "document.querySelector('.home-pt .cv-portrait').dataset.person", lambda v: v != 'own') != 'own'
        assert all(not v for v in pieces().values()), ('the pieces are gone', pieces())
        print('PASS: "Use a Twodo person again" takes it off both phones and out of the database')

        await cb.close(); await ca.close(); await b.close()
        print('ERRORS:', errors or 'NONE')
        assert not errors, errors

asyncio.run(main())
