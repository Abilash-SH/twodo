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
