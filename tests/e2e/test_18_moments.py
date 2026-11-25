"""Moments (asked for 2026-11-25: "something like Instagram's Instants or Locket, to share images at one tap").
The shutter on Home opens the camera; the picture (made small, re-encoded) is shown once with an optional caption and
sent. It appears on your partner's Home with who, when and the caption, and a line on their island. A newer one replaces
it; the phone keeps the ones it saw (IndexedDB), not the saved data. Removing your latest takes it off both phones.
Run test 1 first (it creates Abilash and Deiva). Needs the test build on 8003, and three photos:
  python3 -c "import os; from PIL import Image as I; os.makedirs('/tmp/mo', exist_ok=True); \
  [I.new('RGB', (3024, 4032), c).save(f'/tmp/mo/{n}.jpg') for n, c in (('sunset', (240, 140, 90)), ('coffee', (120, 80, 50)))]; \
  I.frombytes('RGB', (4032, 3024), os.urandom(4032 * 3024 * 3)).save('/tmp/mo/noise.jpg', quality=95)"
"""
import asyncio, json, os, time, urllib.request
from playwright.async_api import async_playwright
from helpers import TITLES, back_home, contrast_js

THEIRS = "(() => { const c = document.querySelector('.home-moments .mo-card'); return c && [!!c.querySelector('img'), (c.querySelector('.mo-who b') || {}).textContent || null, (c.querySelector('.mo-cap') || {}).textContent || null]; })()"
KEPT = """new Promise(res => { const r = indexedDB.open('twodo-moments', 1); r.onupgradeneeded = () => r.result.createObjectStore('m');
  r.onsuccess = () => { const q = r.result.transaction('m').objectStore('m').getAll(); q.onsuccess = () => res(q.result.map(m => [m.who, m.caption, m.img.length])); }; })"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        errors = []
        async def phone(state):
            ctx = await b.new_context(storage_state=state, viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            pg.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
            await pg.goto('http://localhost:8003/'); await pg.wait_for_timeout(2600)
            return ctx, pg
        async def until(pg, js, want, ms=15000):
            got = None
            for _ in range(ms // 100):
                got = await pg.evaluate(js)
                if (want(got) if callable(want) else got == want): return got
                await pg.wait_for_timeout(100)
            return got
        async def share(pg, path, caption, camera=True):
            async with pg.expect_file_chooser() as fc:
                await pg.click('.home-moments .mo-shutter' if camera else '.home-moments .mo-lib')
            chooser = await fc.value
            assert chooser.element and (await chooser.element.get_attribute('capture') == 'environment') == camera, 'the shutter opens the camera; the other button your photos'
            await chooser.set_files(path); await pg.wait_for_timeout(1200)
            assert await pg.evaluate("(document.querySelector('.sheet.open') || {}).getAttribute?.('aria-label')") == 'Share a moment'
            if caption: await pg.fill('.sheet.open .mo-caption', caption)
            await pg.click('.sheet.open .mo-send-btn'); await pg.wait_for_timeout(900)
        stamp = int(time.time()) % 100000
        first, second = f'Sunset walk {stamp}', f'Coffee for two {stamp}'

        ca, A = await phone('/tmp/twodo-A.json'); cb, B = await phone('/tmp/twodo-B.json')
        assert await A.evaluate("document.querySelector('.home-moments .home-h').textContent") == 'Moments with Deiva'

        # ---------- one tap: the camera, then the picture once with a caption, and Send
        await share(A, '/tmp/mo/sunset.jpg', first)
        assert await A.evaluate("!document.querySelector('.sheet.open') && (document.getElementById('isl') || {}).textContent.includes('Sent to Deiva')"), 'sent, and the island says so'
        assert await A.evaluate("!!document.querySelector('.home-moments .mo-mine img')"), 'your last moment sits beside the shutter'
        kept = await until(A, KEPT, lambda k: any(c == first for _, c, _l in k))
        assert any(c == first and l <= 140000 for _, c, l in kept), ('kept on this phone, small', kept)
        assert first not in await A.evaluate("localStorage.getItem('twodo:data')"), 'not in the saved data'
        print(f'PASS: the shutter opens the camera; the moment (made small: {max(l for _, _c, l in kept)} characters) is sent with its caption and kept on this phone, not in the saved data')

        # ---------- it appears on your partner's Home, with who, when and the caption, and a line on their island
        got = await until(B, THEIRS, lambda t: t and t[2] == first)
        assert got == [True, 'Abilash', first], got
        assert await until(B, "(document.getElementById('isl') || {}).textContent?.includes('Abilash shared a moment') || false", True, 6000), 'a line on the island'
        print('PASS: Deiva sees it on her Home within seconds: the photo, "Abilash", when and the caption, and a line on her island')

        # ---------- a newer one replaces it on Home; the earlier stays to look back at (from your photos this time)
        await share(A, '/tmp/mo/coffee.jpg', second, camera=False)
        assert await until(B, THEIRS, lambda t: t and t[2] == second) == [True, 'Abilash', second]
        await B.click('.home-moments .mo-card'); await B.wait_for_timeout(900)
        items = await B.evaluate("[...document.querySelectorAll('.sheet.open .mo-item')].map(f => [f.querySelector('b').textContent, (f.querySelector('q') || {}).textContent || ''])")
        assert [i for i in items if i[0] == 'Abilash'][:2] == [['Abilash', second], ['Abilash', first]], ('both, newest first', items)
        assert not await B.evaluate("[...document.querySelectorAll('.sheet.open .mo-item')].some(f => f.querySelector('b').textContent === 'Abilash' && f.querySelector('.mo-remove'))"), 'only the one who shared it can remove it'
        await B.evaluate("history.back()"); await B.wait_for_timeout(700)
        print('PASS: a newer moment replaces the last on Home; the moments sheet keeps both, newest first; Deiva can\'t remove Abilash\'s')

        # ---------- removing your latest takes it off both phones; the one before comes back
        await A.click('.home-moments .mo-mine'); await A.wait_for_timeout(900)
        worst = await A.evaluate(contrast_js('.sheet.open .mo-list'))  # the sheet's own header: design.md, Known gaps
        assert worst['ratio'] >= 4.5 and worst['measured'] >= 4, ('the moments sheet\'s text contrast', worst)
        assert await A.evaluate("document.querySelector('.sheet.open .mo-remove').getBoundingClientRect().height") >= 44
        await A.click('.sheet.open .mo-remove'); await A.wait_for_timeout(400)
        await A.click('.alert button[data-r="1"]'); await A.wait_for_timeout(900)
        assert await until(B, THEIRS, lambda t: t and t[2] == first) == [True, 'Abilash', first], 'gone from Deiva\'s phone; the earlier one shows again'
        assert not any(c == second for _, c, _l in await A.evaluate(KEPT)), 'and from this phone'
        print(f"PASS: removing your latest moment takes it off both phones; the one before shows again (the sheet's text keeps {worst['ratio']}:1 or more over every colour, light and dark)")

        # ---------- the worst case still fits: a 12 MP photo of pure noise (14 MB), with the longest caption
        long_cap = ('Ünïcödé ✨ ' * 10)[:79] + '!'  # 80, the most a caption takes
        await share(A, '/tmp/mo/noise.jpg', long_cap, camera=False)
        assert await until(B, THEIRS, lambda t: t and t[2] == long_cap) == [True, 'Abilash', long_cap], 'the noisy one arrives'
        dump = json.load(urllib.request.urlopen('http://127.0.0.1:9000/__dump'))
        sizes = [len(v['d']) for sp in dump.get('spaces', {}).values() for k, v in (sp.get('r') or {}).items() if k.startswith('o:')]
        kept = await A.evaluate(KEPT)
        assert sizes and max(sizes) < 200000, ('the encrypted record stays under the 200,000 the database allows', sizes)
        assert all(l <= 140000 for _, _c, l in kept), kept
        await A.click('.home-moments .mo-mine'); await A.wait_for_timeout(900)
        await A.click('.sheet.open .mo-remove'); await A.wait_for_timeout(400)
        await A.click('.alert button[data-r="1"]'); await A.wait_for_timeout(900)
        assert await until(B, THEIRS, lambda t: t and t[2] == first) == [True, 'Abilash', first]
        print(f'PASS: a 14 MB photo of pure noise with an 80-character caption is made small enough: {max(sizes)} characters encrypted, under the 200,000 limit')

        await cb.close(); await ca.close(); await b.close()
        print('ERRORS:', errors or 'NONE')
        assert not errors, errors

asyncio.run(main())
