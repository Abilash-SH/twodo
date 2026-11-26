"""Home in WebKit, Safari's engine: sign in as Abilash like a new iPhone (iPhone user agent, touch, dark mode) and tap
every door on Home with a finger (pointer and touch events on what is under it, then the mouse events and the click
iOS sends). Nothing may fail: no note, no error page, no page error. The chat must open with its messages.

Playwright's WebKit can't be downloaded in every workspace, so this uses WebKitGTK from Ubuntu's own packages:
  sudo apt-get install libwebkit2gtk-4.1-0 gir1.2-webkit2-4.1 python3-gi python3-gi-cairo xvfb xauth
  xvfb-run -a /usr/bin/python3.12 tests/webkit/test_home_webkit.py      # the system Python, which has those bindings
Run it after tests/e2e/test_1_pair_and_chat.py (it creates the accounts), with the mock and the test build on 8003
(see tests/README.md). WebKitGTK has no touch screen here: `(hover: none)` is answered for the app, and the touch
events are stand-ins with the same fields, so this checks the engine and the code paths, not iOS itself."""
import json, os, sys, time
import gi
gi.require_version('Gtk', '3.0'); gi.require_version('WebKit2', '4.1')
from gi.repository import GLib, Gtk, WebKit2

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'e2e'))
from helpers import TITLES  # noqa: E402

URL = 'http://localhost:8003/'
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
SHOTS = os.environ.get('SHOTS', '')   # a folder to save screenshots in, if set

# Before the app runs: keep every error, and answer like a phone with a touch screen
BOOT = r"""(() => {
  window.__errs = [];
  const fmt = a => Array.from(a).map(x => x && x.stack ? x.name + ': ' + x.message + '\n' + x.stack : String(x)).join(' ').slice(0, 2000);
  addEventListener('error', e => window.__errs.push('error: ' + e.message + (e.error && e.error.stack ? '\n' + e.error.stack : '')), true);
  addEventListener('unhandledrejection', e => window.__errs.push('rejection: ' + fmt([e.reason])));
  for (const k of ['error', 'warn']) { const f = console[k]; console[k] = function () { window.__errs.push('console.' + k + ': ' + fmt(arguments)); return f.apply(this, arguments); }; }
  const mm = window.matchMedia.bind(window);
  const fake = (q, m) => ({ matches: m, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
  window.matchMedia = q => /hover:\s*none|pointer:\s*coarse/.test(q) ? fake(q, true) : /hover:\s*hover|pointer:\s*fine/.test(q) ? fake(q, false) : mm(q);
  window.ontouchstart = null;
  Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 5, configurable: true });
})();"""

# A finger on the middle of an element: pointerdown, touchstart … pointerup, touchend, then (unless the page took the
# touch) mousemove, mousedown, mouseup and click, all on what is under the finger.
TAP = r"""(sel => { const el = document.querySelector(sel); if (!el) return 'missing ' + sel;
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y) || el;
  const touch = document.createTouch(window, t, 7, x + scrollX, y + scrollY, x, y, 11, 11, 0, 1);
  const P = (type, b) => t.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0, buttons: b, width: 22, height: 22, pressure: b ? 0.5 : 0 }));
  const T = (type, list) => { const ev = new Event(type, { bubbles: true, cancelable: true, composed: true }), tl = a => Object.assign(a.slice(), { item: i => a[i] || null });
    Object.defineProperties(ev, { touches: { value: tl(list) }, targetTouches: { value: tl(list) }, changedTouches: { value: tl([touch]) } }); return t.dispatchEvent(ev); };
  const M = type => t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: type === 'mousedown' ? 1 : 0, detail: 1, view: window }));
  P('pointerdown', 1); T('touchstart', [touch]);
  setTimeout(() => { P('pointerup', 0); if (T('touchend', [])) { M('mousemove'); M('mousedown'); M('mouseup'); M('click'); } }, 85);
  return 'ok'; })"""

ucm = WebKit2.UserContentManager()
ucm.add_script(WebKit2.UserScript.new(BOOT, WebKit2.UserContentInjectedFrames.TOP_FRAME, WebKit2.UserScriptInjectionTime.START, None, None))
view = WebKit2.WebView.new_with_user_content_manager(ucm)
view.get_settings().set_user_agent(UA)
Gtk.Settings.get_default().set_property('gtk-application-prefer-dark-theme', True)
win = Gtk.OffscreenWindow(); win.set_default_size(390, 844); win.add(view); win.show_all()
ctx = GLib.MainContext.default()

def pump(until, timeout=30):
    end = time.monotonic() + timeout
    while not until():
        if time.monotonic() > end: raise TimeoutError('WebKit did not answer')
        if not ctx.iteration(False): time.sleep(0.005)

def wait(ms):
    end = time.monotonic() + ms / 1000
    pump(lambda: time.monotonic() >= end, ms / 1000 + 5)

def q(code):
    """the value of a JavaScript expression (plain data only)"""
    box = {}
    def done(v, res):
        try:
            r = v.evaluate_javascript_finish(res); box['v'] = json.loads(r.to_json(0)) if r and not r.is_undefined() else None
        except Exception as e: box['e'] = str(e)
    view.evaluate_javascript(code, -1, None, None, None, done)
    pump(lambda: bool(box))
    if 'e' in box: raise RuntimeError(box['e'])
    return box['v']

def load(url):
    box = {}
    hid = view.connect('load-changed', lambda v, ev: ev == WebKit2.LoadEvent.FINISHED and box.setdefault('done', True))
    view.load_uri(url); pump(lambda: bool(box), 60); view.disconnect(hid)

def shot(name):
    if not SHOTS: return
    box = {}
    def done(v, res):
        v.get_snapshot_finish(res).write_to_png(os.path.join(SHOTS, name + '.png')); box['ok'] = True
    view.get_snapshot(WebKit2.SnapshotRegion.VISIBLE, WebKit2.SnapshotOptions.NONE, None, done); pump(lambda: bool(box))

def tap(sel, ms=1400):
    assert q(f'{TAP}({json.dumps(sel)})') == 'ok', sel
    wait(ms)

def errors():
    return [e for e in q('window.__errs') or [] if 'ResizeObserver loop' not in e]

def healthy(where):
    bad = q("""[document.querySelector('.area-fail, .chat-fail') ? 'a failure note' : '',
      /This page couldn.t load|Twodo stopped for a moment/.test(document.body.innerText) ? 'the error page' : ''].filter(Boolean)""")
    errs = errors()
    assert not bad and not errs, (where, bad, errs)

def back(ms=1100):
    q('history.back()'); wait(ms)

# ---------- sign in on a new phone
load(URL)
q("localStorage.clear(); indexedDB.deleteDatabase('twodo'); navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())); caches.keys().then(ks => ks.forEach(k => caches.delete(k))); 'ok'"); wait(800)   # a new phone: no app saved from an earlier run
load(URL); wait(2500)
q("""[...document.querySelectorAll('button')].find(b => b.textContent.includes('I already have an account')).click()"""); wait(1200)
q("""(() => { const set = (id, v) => { const el = document.querySelector('.ob-page[data-p="signin"] #' + id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  set('gEmail', 'a@x.com'); set('gPass', 'password 123'); document.querySelector('.ob-page[data-p="signin"] [data-submit]').click(); })()""")
pump(lambda: q("!!document.querySelector('.home-hi')"), 40); wait(1500)
assert q("document.querySelector('.home-hi').textContent") == 'Hello, Abilash!'
assert q("[matchMedia('(hover: none)').matches, matchMedia('(prefers-color-scheme: dark)').matches, typeof navigator.vibrate]") == [True, True, 'undefined']
pump(lambda: q("!!document.querySelector('.home-people.ready')"), 40)   # the two realistic 3D people are drawn (WebGL)
healthy('signed in'); shot('home')
print('PASS: signed in on a new phone in WebKit (iPhone, touch, dark mode, no vibration); both 3D people are drawn')

# ---------- every door on Home, with a finger
for sel, want in [('.home-pt', 'Chat'), ('.board-tray .tray-btn.chat', 'Chat'),
                  ('.boardview .fab-btn[aria-label^="Journal"]', 'Journal'), ('.boardview .fab-btn[aria-label="To-dos and reminders"]', 'To-dos')]:
    tap(sel)
    titles = q(TITLES)
    assert titles[-1] == want, (sel, titles)
    if want == 'Chat':
        assert q("document.querySelectorAll('.chatview .msg-row').length") > 0, 'the chat shows its messages'
    healthy(sel); shot('after-' + sel.strip('.').split(' ')[0].split('[')[0])
    back()
    assert q(TITLES) == ['Board'], (sel, q(TITLES))
    healthy(sel + ', then back')
print('PASS: the partner chip, the bar\'s chat, Journal and To-dos open and close with nothing failing')

tap('.home-me')   # Settings
assert q("(document.querySelector('.sheet.open') || {}).getAttribute?.('aria-label')") == 'Settings', 'Settings opened'
healthy('Settings'); back()
assert not q("!!document.querySelector('.sheet.open')") and q(TITLES) == ['Board'], 'Back closes Settings'
healthy('Settings, then back')
print('PASS: Settings from the top-left picture')

errs = errors()
print('ERRORS:', errs or 'NONE')
sys.exit(1 if errs else 0)
