/* Twodo · Tips: every tip in one place, with little animated demos */
'use strict';

const TIP_CATS = [
  ['basics', '✨', 'Basics', 'blue'], ['typing', '⌨️', 'Type naturally', 'indigo'], ['gestures', '👆', 'Gestures', 'orange'],
  ['organize', '🗂️', 'Organize', 'teal'], ['together', '💞', 'Together', 'pink'], ['messages', '💬', 'Messages', 'green'],
  ['focus', '⏱️', 'Focus & reminders', 'purple'], ['app', '🔒', 'App & privacy', 'gray'], ['keys', '💻', 'Keyboard', 'brown'],
];
const kb = s => `<kbd>${s}</kbd>`;
const TIPS = [
  // Basics
  { c: 'basics', e: '🏠', t: 'Home is your chat', d: 'You two sit at the top, your conversation below. Tap <b>✓</b> (top right) for your to-dos; everything else is in the <b>☰ menu</b> — tap it or swipe in from the left edge.' },
  { c: 'basics', e: '➕', t: 'Add a task by typing', d: 'Open your to-dos (✓), type in the box at the bottom and tap ↑. It goes into the list you’re in, or your Inbox.' },
  { c: 'basics', e: '📥', t: 'Choose where it goes', d: 'Tap the list name inside the box (like <b>📥 Inbox ⌄</b>) to pick another list, or just type <b>#groceries</b>.' },
  { c: 'basics', e: '📋', t: 'Paste a whole list', d: 'Paste several lines and Twodo adds one task per line. Perfect for groceries.' },
  { c: 'basics', e: '📝', t: 'Tap a task for details', d: 'Notes, date, time, repeat, priority, who it’s for, list, tags and subtasks. Everything saves instantly.' },
  { c: 'basics', e: '↩️', t: 'Undo anything', d: 'Completed or deleted something by mistake? Tap <b>Undo</b> in the black pill at the top.' },
  // Typing
  { c: 'typing', e: '🪄', t: 'Just say it', d: 'Twodo reads dates, times, people, priority, lists and repeats straight from your words.', demo: 'chips' },
  { c: 'typing', e: '🧾', t: 'Cheat sheet', d: 'Mix and match any of these in one line:', demo: 'sheet' },
  { c: 'typing', e: '🙅', t: 'Tap a chip to ignore it', d: 'Wrong guess, like “Watch <i>Friday</i> Night Lights”? Tap the date chip and the word stays in the title.' },
  { c: 'typing', e: '💊', t: 'Quick pills', d: 'While you type, pills above the box add a date, person, priority, list or repeat with one tap.' },
  // Gestures
  { c: 'gestures', e: '👉', t: 'Swipe right to complete', d: 'Swipe a task to the right. Changed your mind? Tap the circle again right away.', demo: 'swipeR' },
  { c: 'gestures', e: '👈', t: 'Swipe left to pin or delete', d: 'A short swipe shows Pin and Delete; a long swipe deletes straight away.', demo: 'swipeL' },
  { c: 'gestures', e: '👆', t: 'Long-press for quick actions', d: 'Move to Today, Tomorrow or the weekend, set priority or person, move list, duplicate or start a focus timer.', demo: 'press' },
  { c: 'gestures', e: '⬅️', t: 'Swipe from the edge to go back', d: 'Slide from the left edge of the screen to go back, just like iPhone apps.', demo: 'edge' },
  { c: 'gestures', e: '⬇️', t: 'Drag sheets down to close', d: 'Task details, Settings and other cards close when you pull them down.', demo: 'sheetdown' },
  // Organize
  { c: 'organize', e: '☀️', t: 'Today, sorted for you', d: 'Today splits into Overdue, Morning, Afternoon and Tonight. Upcoming groups tasks by day, then by month.' },
  { c: 'organize', e: '👥', t: 'Filter by person', d: () => `Every list has an <b>All · ${esc(shortName(myName()))} · ${esc(shortName(ptName()))} · Us</b> switch at the top.` },
  { c: 'organize', e: '⋯', t: 'Sort, show completed, share', d: 'The ⋯ button sorts a list and shows or clears completed tasks. On your own lists it also edits the list or shares it as text.' },
  { c: 'organize', e: '🔁', t: 'Repeating tasks', d: 'Type <b>daily</b>, <b>weekdays</b> or <b>every mon</b>. When you finish one, the next appears automatically.' },
  { c: 'organize', e: '🔎', t: 'Search everything', d: 'Open the ☰ menu and tap Search to find titles, notes, subtasks and #tags. On a computer, press ⌘K.' },
  { c: 'organize', e: '📌', t: 'Pin what matters', d: 'Pinned tasks stay at the top of every list and in Pinned in the ☰ menu.' },
  // Together
  { c: 'together', e: '💌', t: 'Add your partner like a friend', d: 'Tap <b>＋ Add partner</b>, search their @username and tap Add. They accept and your lists sync.', act: ['invite', 'Add partner'] },
  { c: 'together', e: '🔢', t: 'Check the safety code', d: 'When you send or accept a request, both phones show the same 8-digit code. If they match, nobody tampered with your connection.' },
  { c: 'together', e: '🫶', t: 'Share tasks with @', d: '<b>@us</b> puts a task in Together for both of you; <b>@name</b> gives it to them. You’ll get a nudge when they finish it.' },
  { c: 'together', e: '🎁', t: 'The Secret list', d: 'Anything in a Secret list stays on your phone and never syncs. Perfect for planning surprises.' },
  { c: 'together', e: '🔥', t: 'Streaks & progress', d: 'The top of the ☰ menu shows your streak and how much you’ve done together this week.' },
  // Messages
  { c: 'messages', e: '💬', t: 'Message your partner', d: 'Your chat is Home. Under their name you’ll see <b>online</b>, <b>typing…</b> or when they were last seen. Everything is end-to-end encrypted.', act: ['chat', 'Open chat'] },
  { c: 'messages', e: '🤍', t: 'Hearts, not ticks', d: 'Under your last message: an outline ♡ means sent, a filled ♥ means they’ve seen it.' },
  { c: 'messages', e: '🖼️', t: 'Tap a photo', d: 'Tap either picture at the top to see it big. On yours you can change or remove it — only you can change your own.' },
  { c: 'messages', e: '💥', t: 'Send with effect', d: 'Hold the ↑ arrow. Bubble: Slam, Loud, Gentle, Invisible Ink. Screen: Echo, Spotlight, Balloons, Confetti, Love, Lasers, Fireworks, Celebration.', demo: 'slam' },
  { c: 'messages', e: '🎈', t: 'Automatic effects', d: '“Happy birthday” → balloons · “Congrats” → confetti · “Happy new year” → fireworks · “Pew pew” → lasers · “Love you” → hearts.' },
  { c: 'messages', e: '❤️', t: 'Double-tap to love it', d: 'Double-tap any message for a ❤️. Long-press for 👍 👎 😂 ‼️ ❓, Copy, <b>Make it a task</b> or <b>Undo Send</b> (15 minutes).', demo: 'heart' },
  { c: 'messages', e: '📎', t: 'Share a task in chat', d: 'Tap <b>＋</b> next to the message box to send a task card they can tick off right in the chat.' },
  { c: 'messages', e: '🫥', t: 'Invisible ink', d: 'Messages sent with Invisible Ink stay hidden until tapped.' },
  // Focus & reminders
  { c: 'focus', e: '🍅', t: 'Focus timer', d: 'Long-press a task → <b>Focus Timer</b> for 25 minutes of focus and a 5-minute break. Minimise it to the pill at the top.' },
  { c: 'focus', e: '⏰', t: 'Reminders', d: 'Give a task a time (“6pm”). Turn on <b>In-app reminders</b> in Settings, or push reminders once they’re set up.' },
  { c: 'focus', e: '📅', t: 'Alerts that always fire', d: 'In a task’s details, tap <b>Add to Calendar</b> to get your phone’s own calendar alert.' },
  { c: 'focus', e: '🎉', t: 'Clear the day', d: 'Finish everything due today for a little celebration.' },
  // App & privacy
  { c: 'app', e: '📲', t: 'Add to Home Screen', d: 'In Safari: Share → <b>Add to Home Screen</b>. You get full screen, push reminders and a faster launch. Always open Twodo from that icon.' },
  { c: 'app', e: '🖥️', t: 'Big screen, two panes', d: 'On an iPad in landscape or on a computer, the ☰ menu stays open on the left and whatever you open shows on the right.' },
  { c: 'app', e: '✈️', t: 'Works offline', d: 'Keep going without signal. Everything syncs as soon as you’re back online.' },
  { c: 'app', e: '🎨', t: 'Make it yours', d: 'Settings → your photo, name and colour (it’s your message colour and the app’s accent), theme, haptics, sounds and celebrations.', act: ['settings', 'Open Settings'] },
  { c: 'app', e: '🔐', t: 'Private by design', d: 'Tasks and messages are encrypted on your phones before they’re saved. Your password never leaves your phone.' },
  { c: 'app', e: '💾', t: 'Back up', d: 'Settings → <b>Export backup</b> saves everything to a file you can import later.' },
  // Keyboard
  { c: 'keys', e: '⌨️', t: 'Shortcuts on a computer', d: `${kb('N')} or ${kb('/')} new task · ${kb('⌘K')} search · ${kb('Esc')} back or close · ${kb('↵')} add · ${kb('⇧↵')} new line · right-click a task for quick actions.` },
];

/* ---------- demos (pure CSS loops) ---------- */
const DEMOS = {
  chips: () => `<div class="demo d-chips"><div class="d-line">Dinner fri 8pm @us !!</div>
    <div class="d-chiprow"><span style="--c:var(--c-blue);--d:0s">${ic('cal')}Fri</span><span style="--c:var(--c-indigo);--d:.35s">${ic('clock')}8:00 PM</span><span style="--c:var(--c-orange);--d:.7s">${ic('flag')}Medium</span><span style="--c:var(--c-pink);--d:1.05s">${ic('person')}Both of you</span></div></div>`,
  sheet: () => `<div class="demo d-table">${[
    ['tomorrow · fri · next week · in 3 days · dec 24', 'Date'], ['6pm · 18:30 · noon · tonight', 'Time'], ['! · !! · !!! · !high', 'Priority'],
    ['@me · @us · @name', 'Who it’s for'], ['#groceries · #work', 'List or tag'], ['daily · weekdays · every mon · monthly', 'Repeat']]
    .map(([a, b]) => `<div><code>${a}</code><span>${b}</span></div>`).join('')}</div>`,
  swipeR: () => `<div class="demo d-swipe r"><div class="d-under">${ic('check')}Done</div><div class="d-row"><span class="d-chk"></span>Buy flowers 💐</div><span class="d-finger"></span></div>`,
  swipeL: () => `<div class="demo d-swipe l"><div class="d-under"><span class="d-pin">${ic('pin')}Pin</span><span class="d-del">${ic('trash')}Delete</span></div><div class="d-row"><span class="d-chk"></span>Call the plumber</div><span class="d-finger"></span></div>`,
  press: () => `<div class="demo d-press"><div class="d-row"><span class="d-chk"></span>Book date night</div>
    <div class="d-menu"><div>${ic('cal')}Today</div><div>${ic('sunrise')}Tomorrow</div><div>${ic('timer')}Focus</div></div><span class="d-finger"></span></div>`,
  edge: () => `<div class="demo d-edge"><div class="d-page back"><i></i><i></i><i></i></div><div class="d-page front"><b></b><i></i><i></i></div><span class="d-finger"></span></div>`,
  sheetdown: () => `<div class="demo d-sheetdn"><div class="d-page back"><i></i><i></i><i></i></div><div class="d-card"><span class="d-grab"></span><i></i><i></i></div><span class="d-finger"></span></div>`,
  slam: () => `<div class="demo d-chat"><div class="bub them">Guess what?</div><div class="bub me d-slam">I passed!! 🎉</div></div>`,
  heart: () => `<div class="demo d-chat"><div class="bub them d-hearted">Dinner at 8? 🍝<span class="d-tb">❤️</span></div></div>`,
};

const TIP_ACT_OK = {
  invite: () => cloudReady() && !!Auth.user() && !(L.pair && L.pair.status === 'paired'),
  chat: () => cloudReady() && !!Auth.user(),
  settings: () => true,
};

/* ---------- view ---------- */
function tipSectionsHTML(cat) {
  return TIP_CATS.filter(([k]) => cat === 'all' || cat === k).map(([k, e, n, col]) => {
    const cards = TIPS.filter(t => t.c === k).map(t => {
      const act = t.act && TIP_ACT_OK[t.act[0]]() ? `<button class="btn-s tip-act" data-a="tipact" data-v="${t.act[0]}" type="button">${esc(t.act[1])}</button>` : '';
      return `<div class="tip"><span class="tip-ic" style="--c:var(--c-${col})">${t.e}</span>
        <div class="tip-b"><h4>${esc(t.t)}</h4><p>${typeof t.d === 'function' ? t.d() : t.d}</p>${t.demo ? DEMOS[t.demo]() : ''}${act}</div></div>`;
    }).join('');
    return `<div class="sec-h tip-sec"><span class="tip-sec-e">${e}</span>${esc(n)}</div><div class="tip-list">${cards}</div>`;
  }).join('');
}
function renderTips(v) {
  const cat = viewPrefs('tips').cat || 'all';
  const pills = [['all', '💡', 'All']].concat(TIP_CATS)
    .map(([k, e, n]) => `<button class="tip-pill${k === cat ? ' on' : ''}" data-a="tipcat" data-v="${k}" type="button">${e} ${esc(n)}</button>`).join('');
  v.lastElementChild.innerHTML = `<h1 class="large-title">Tips</h1><div class="subtitle">Little things that make Twodo feel like magic ✨</div>
    <div class="tip-pills">${pills}</div><div class="tip-secs">${tipSectionsHTML(cat)}</div><div class="foot">That’s everything! Made with 💞 for two.</div>`;
  requestAnimationFrame(() => showTipPill(v, false));
}
function showTipPill(v, smooth) {
  const row = v.querySelector('.tip-pills'), on = row && row.querySelector('.on'); if (!on) return;
  const x = on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
  row.scrollTo({ left: Math.max(0, x), behavior: smooth && !reducedMotion.matches ? 'smooth' : 'auto' });
}
function pickTipCat(v, cat) {
  viewPrefs('tips').cat = cat; save(); haptic('light');
  v.querySelectorAll('.tip-pill').forEach(b => b.classList.toggle('on', b.dataset.v === cat));
  const secs = v.querySelector('.tip-secs'), row = v.querySelector('.tip-pills');
  secs.innerHTML = tipSectionsHTML(cat);
  const gap = secs.getBoundingClientRect().top - row.getBoundingClientRect().bottom;
  if (gap < 0) v.scrollTop += gap; // the pills are stuck at the top: bring the new tips up under them
  showTipPill(v, true);
}
function openTips(cat) {
  if (cat) viewPrefs('tips').cat = cat;
  const v = topView();
  if (v && v._spec.type === 'tips') return cat && pickTipCat(v, cat);
  pushView({ type: 'tips' });
}
