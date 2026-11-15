"""Shared steps for the browser tests. Home is the board (when signed in): the chat is one tap away."""

OPEN_CHAT = '.board-tray .tray-btn.chat'
# the screens that are open, bottom to top, by name
TITLES = """[...document.querySelectorAll('#stack > .view')].filter(v => !v.classList.contains('offright'))
  .map(v => v.classList.contains('boardview') ? 'Board' : v.classList.contains('chatview') ? 'Chat' : (v.querySelector('.nav-title')?.textContent || '?'))"""

async def open_chat(pg, wait=900):
    """from the board (or anywhere the board's button is reachable): open the chat screen"""
    if not await pg.locator('#stack > .chatview:not(.offright)').count():
        await pg.click(OPEN_CHAT)
    await pg.wait_for_timeout(wait)

async def back_home(pg, wait=900):
    """close every open screen, one Back at a time, until the board (or To-dos without accounts) is on top"""
    for _ in range(6):
        if await pg.evaluate("document.querySelectorAll('#stack > .view:not(.offright)').length") <= 1: break
        await pg.evaluate("history.back()"); await pg.wait_for_timeout(wait)


def contrast_js(root):
    """JS: the lowest text contrast inside `root`, for every colour a person can pick, light and dark. Each piece of text
    is measured against what is actually painted behind it. Returns { ratio, theme, name, what, measured }."""
    return """(() => {
  const NAMES = ['blue', 'indigo', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'mint', 'teal', 'brown', 'gray'];
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = css => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, under) => [0, 1, 2].map(i => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const behind = el => { const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n), c = rgba(s.backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] > .999) break; } }
    return layers.reverse().reduce((under, c) => over(c, under), [255, 255, 255, 1]); };
  const lum = c => { const [r, g, b] = c.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  const texts = [...document.querySelectorAll('ROOT *')].filter(e => !e.closest('.av, .n-ic, .acts, [aria-hidden=true]') && e.getClientRects().length
    && getComputedStyle(e).visibility !== 'hidden' && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
  const root = document.documentElement, was = [root.dataset.theme, root.getAttribute('style')];
  let worst = { ratio: 99 };
  for (const theme of ['light', 'dark']) { root.dataset.theme = theme;
    for (const name of NAMES) {
      root.style.setProperty('--me-c', `var(--c-${name})`); root.style.setProperty('--pt-c', `var(--c-${name})`); root.style.setProperty('--accent', `var(--c-${name})`);
      for (const e of texts) { const bg = behind(e), fg = over(rgba(getComputedStyle(e).color), bg), a = lum(fg), b = lum(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        if (ratio < worst.ratio) worst = { ratio: Math.round(ratio * 100) / 100, theme, name, what: (e.className || e.tagName) + ': ' + e.textContent.trim().slice(0, 24) }; } } }
  if (was[0] === undefined) delete root.dataset.theme; else root.dataset.theme = was[0];
  if (was[1] === null) root.removeAttribute('style'); else root.setAttribute('style', was[1]);
  return { ...worst, measured: texts.length }; })()""".replace('ROOT', root)
