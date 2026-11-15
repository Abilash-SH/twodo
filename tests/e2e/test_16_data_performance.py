"""Held network writes, atomic field patches and real lazy profile photos.
Run after test 1, with the fake Firebase and online export. Never uses production.
"""
import asyncio, json, os, re, time
from urllib.parse import urlsplit
from playwright.async_api import async_playwright, expect
from helpers import open_chat, back_home

URL = 'http://localhost:8003/'
PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGN42b3xPwAHqwMlDdymZgAAAABJRU5ErkJggg=='

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
        errors, record_reads = [], []
        async def phone(state, photo=False):
            ctx = await browser.new_context(storage_state=state, viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
            if photo:
                await ctx.add_init_script('''(() => {
                  const d=JSON.parse(localStorage.getItem('twodo:data') || 'null');
                  if (!d || !d.people) return;
                  d.people.a.photo=d.people.b.photo=PHOTO;
                  d.people.updatedAt=Date.now();
                  localStorage.setItem('twodo:data',JSON.stringify(d));
                })()'''.replace('PHOTO', json.dumps(PHOTO)))
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.on('request', lambda r: record_reads.append(r.url) if r.method == 'GET' and re.search(r'/r/[^/]+\.json|/c/m/[^/]+\.json', urlsplit(r.url).path) else None)
            await pg.goto(URL); await pg.wait_for_timeout(2600)
            return ctx, pg

        ca, A = await phone('/tmp/twodo-A.json', True)
        cb, B = await phone('/tmp/twodo-B.json')
        for pg in (A, B):
            await pg.click('.n-today .n-h'); await pg.wait_for_timeout(900)
        held, release = asyncio.Event(), asyncio.Event()
        captured = {}
        async def hold_task(route):
            r = route.request
            body = json.loads(r.post_data or '{}') if r.method != 'GET' else {}
            if any(k.startswith('t:') for k in body):
                captured.update(body=body, url=r.url)
                held.set(); await release.wait()
                # The equivalent atomic field-patch shape sent by Firebase clients.
                fields = {f'{key}/{field}': value for key, record in body.items() for field, value in record.items()}
                await route.continue_(post_data=json.dumps(fields))
            else:
                await route.continue_()
        await A.route('**/r.json?*', hold_task)
        title = f'Before the server answers {int(time.time())}'
        await A.click('#cta'); await A.fill('#cta', title); await A.press('#cta', 'Enter')
        try:
            await asyncio.wait_for(held.wait(), 10)
            await expect(A.locator('.view:not(.under) .task', has_text=title)).to_be_visible()
            assert not await B.locator('.view:not(.under) .task', has_text=title).count(), 'partner cannot see an unacknowledged write'
            print('PASS: new task is visible locally while its network request is held')
        finally:
            release.set()
        await expect(B.locator('.view:not(.under) .task', has_text=title)).to_be_visible(timeout=10000)
        await A.unroute('**/r.json?*', hold_task)
        # A nested field put previously issued a GET for each notification.
        key, envelope = next((k, v) for k, v in captured['body'].items() if k.startswith('t:'))
        config = await A.evaluate("JSON.parse(localStorage.getItem('twodo:local'))")
        db = urlsplit(captured['url'])
        result = await A.request.put(f'{db.scheme}://{db.netloc}{db.path[:-5]}/{key}/d.json',
                                     params={'auth': config['auth']['idToken']}, data=json.dumps(envelope['d']))
        assert result.ok, await result.text()
        await A.wait_for_timeout(700)
        assert not record_reads, record_reads
        print('PASS: partner applies atomic field patches; nested field notifications trigger zero record GETs')

        await back_home(A); await back_home(B)
        await open_chat(A); await open_chat(B)
        send_held, send_release = asyncio.Event(), asyncio.Event()
        async def hold_send(route):
            send_held.set(); await send_release.wait(); await route.continue_()
        await A.route('**/c/m/*.json?*', hold_send)
        message = f'Optimistic message {int(time.time())}'
        await A.fill('.cb-in', message); await A.click('.cb-send')
        try:
            await asyncio.wait_for(send_held.wait(), 10)
            await expect(A.locator('.msg-row.me .bub', has_text=message)).to_be_visible()
            assert await A.locator('.cb-in').input_value() == ''
            assert await A.locator('.cb-in').evaluate('(e) => document.activeElement === e'), 'sending keeps typing focus'
            assert not await B.locator('.msg-row.them .bub', has_text=message).count()
            print('PASS: message appears and composer clears before acknowledgement; focus stays in typing field')
        finally:
            send_release.set()
        await expect(B.locator('.msg-row.them .bub', has_text=message)).to_be_visible(timeout=10000)

        await expect(A.locator('.lb-av img')).to_have_count(2)
        await A.wait_for_function("[...document.querySelectorAll('.lb-av img')].every(e => e.complete && e.naturalWidth > 0)")
        for image in await A.locator('.lb-av img').all():
            assert await image.get_attribute('loading') == 'eager'
        images = await A.locator('.c-av img').all()
        assert images, 'test fixture should exercise repeated history photos'
        for image in images:
            assert await image.get_attribute('loading') == 'lazy'
            assert await image.get_attribute('decoding') == 'async'
            assert await image.evaluate('(e) => e.width > 0 && e.height > 0 && getComputedStyle(e).objectFit === "cover"')
        await A.evaluate('document.activeElement.blur()')
        await A.click('.lb-av.me'); await expect(A.locator('.pv-img img')).to_be_visible()
        assert await A.locator('.pv-img img').get_attribute('loading') == 'eager'
        print('PASS: history photos use native lazy loading with reserved dimensions; header and photo viewer are eager')
        assert not errors, errors
        print('ERRORS: NONE')
        await browser.close()

asyncio.run(main())
