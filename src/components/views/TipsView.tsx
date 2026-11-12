'use client';
/* Twodo · Tips: every tip in one place, with little animated demos */
import { Fragment, useEffect, useRef } from 'react';
import { cloudReady } from '@/lib/config';
import { haptic } from '@/lib/feedback';
import { Auth } from '@/lib/firebase';
import { renderNow } from '@/lib/render';
import { L, myName, ptName, save } from '@/lib/store';
import { reducedMotion, shortName } from '@/lib/util';
import { navTo, viewPrefs } from '@/ui/nav';
import { colorVar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { rich } from '../ui/Rich';
import { openInviteSheet } from '../settings/AccountSheets';
import { openSettings } from '../settings/Settings';

const TIP_CATS: [string, string, string, string][] = [
  ['basics', '✨', 'Basics', 'blue'], ['typing', '⌨️', 'Type naturally', 'indigo'], ['gestures', '👆', 'Gestures', 'orange'],
  ['organize', '🗂️', 'Organize', 'teal'], ['together', '💞', 'Together', 'pink'], ['messages', '💬', 'Messages', 'green'],
  ['focus', '⏱️', 'Focus & reminders', 'purple'], ['app', '🔒', 'App & privacy', 'gray'], ['keys', '💻', 'Keyboard', 'brown'],
];
type Act = 'invite' | 'chat' | 'settings';
interface Tip { c: string; e: string; t: string; d: string | (() => string); demo?: keyof typeof DEMOS; act?: [Act, string] }
const TIPS: Tip[] = [
  // Basics
  { c: 'basics', e: '🏠', t: 'Home is your chat', d: 'Your conversation fills the screen. The small button at the **top right** opens To-dos & reminders; the one at the **top left** opens Settings.' },
  { c: 'basics', e: '➕', t: 'Add a task by typing', d: 'Open To-dos (top right), type in the box at the bottom and tap ↑. It goes into the list you’re in, or your Inbox.' },
  { c: 'basics', e: '📥', t: 'Choose where it goes', d: 'Tap the list name inside the box (like **📥 Inbox ⌄**) to pick another list, or just type **#groceries**.' },
  { c: 'basics', e: '📋', t: 'Paste a whole list', d: 'Paste several lines and Twodo adds one task per line. Perfect for groceries.' },
  { c: 'basics', e: '📝', t: 'Tap a task for details', d: 'Notes, date, time, repeat, priority, who it’s for, list, tags and subtasks. Everything saves instantly.' },
  { c: 'basics', e: '↩️', t: 'Undo anything', d: 'Completed or deleted something by mistake? Tap **Undo** in the black pill at the top.' },
  // Typing
  { c: 'typing', e: '🪄', t: 'Just say it', d: 'Twodo reads dates, times, people, priority, lists and repeats straight from your words.', demo: 'chips' },
  { c: 'typing', e: '🧾', t: 'Cheat sheet', d: 'Mix and match any of these in one line:', demo: 'sheet' },
  { c: 'typing', e: '🙅', t: 'Tap a chip to ignore it', d: 'Wrong guess, like “Watch _Friday_ Night Lights”? Tap the date chip and the word stays in the title.' },
  { c: 'typing', e: '💊', t: 'Quick pills', d: 'While you type, pills above the box add a date, person, priority, list or repeat with one tap.' },
  // Gestures
  { c: 'gestures', e: '👉', t: 'Swipe right to complete', d: 'Swipe a task to the right. Changed your mind? Tap the circle again right away.', demo: 'swipeR' },
  { c: 'gestures', e: '👈', t: 'Swipe left to pin or delete', d: 'A short swipe shows Pin and Delete; a long swipe deletes straight away.', demo: 'swipeL' },
  { c: 'gestures', e: '👆', t: 'Long-press for quick actions', d: 'Move to Today, Tomorrow or the weekend, set priority or person, move list, duplicate or start a focus timer.', demo: 'press' },
  { c: 'gestures', e: '⬅️', t: 'Swipe right to go back', d: 'Drag to the right from the left edge, or anywhere that isn’t a task, to slide back to the chat. On a computer, use ‹ or Esc.', demo: 'edge' },
  { c: 'gestures', e: '↩️', t: 'Swipe a message to reply', d: 'In the chat, drag a message to the right and let go. Your reply quotes it. Tap the quote to jump back to the original.' },
  { c: 'gestures', e: '⬇️', t: 'Drag sheets down to close', d: 'Task details, Settings and other cards close when you pull them down.', demo: 'sheetdown' },
  // Organize
  { c: 'organize', e: '☀️', t: 'Today, sorted for you', d: 'Today splits into Overdue, Morning, Afternoon and Tonight. Upcoming groups tasks by day, then by month.' },
  { c: 'organize', e: '👥', t: 'Filter by person', d: () => `Every list has an **All · ${shortName(myName())} · ${shortName(ptName())} · Us** switch at the top.` },
  { c: 'organize', e: '⋯', t: 'Sort, show completed, share', d: 'The ⋯ button sorts a list and shows or clears completed tasks. On your own lists it also edits the list or shares it as text.' },
  { c: 'organize', e: '🔁', t: 'Repeating tasks', d: 'Type **daily**, **weekdays** or **every mon**. When you finish one, the next appears automatically.' },
  { c: 'organize', e: '🔎', t: 'Search everything', d: 'In To-dos, tap Search to find titles, notes, subtasks and #tags. On a computer, press ⌘K.' },
  { c: 'organize', e: '📌', t: 'Pin what matters', d: 'Pinned tasks stay at the top of every list and in Pinned in To-dos.' },
  { c: 'organize', e: '🔔', t: 'Reminders', d: 'Every to-do with a time shows up in **Reminders** in To-dos, missed ones first.' },
  // Together
  { c: 'together', e: '💌', t: 'Add your partner like a friend', d: 'Tap **＋ Add partner**, search their @username and tap Add. They accept and your lists sync.', act: ['invite', 'Add partner'] },
  { c: 'together', e: '🔢', t: 'Check the safety code', d: 'When you send or accept a request, both phones show the same 8-digit code. If they match, nobody tampered with your connection.' },
  { c: 'together', e: '🫶', t: 'Share tasks with @', d: '**@us** puts a task in Together for both of you; **@name** gives it to them. You’ll get a nudge when they finish it.' },
  { c: 'together', e: '🎁', t: 'The Secret list', d: 'Anything in a Secret list stays on your phone and never syncs. Perfect for planning surprises.' },
  { c: 'together', e: '🔥', t: 'Streaks & progress', d: 'The top of To-dos shows your streak and how much you’ve done together this week.' },
  // Messages
  { c: 'messages', e: '😂', t: 'React to a message', d: 'Press and hold a message, then pick ❤️ 😂 😮 🥹 🔥 or 👍. Double-tap sends a ❤️ straight away.' },
  { c: 'messages', e: '💞', t: 'Say it together', d: 'When you both say “love you” within a few minutes, you two meet in the middle of the screen. Try it.' },
  { c: 'messages', e: '💬', t: 'Message your partner', d: 'Your chat is Home. Under their name you’ll see **online**, **typing…** or when they were last seen. Everything is end-to-end encrypted.', act: ['chat', 'Open chat'] },
  { c: 'messages', e: '🤍', t: 'Hearts, not ticks', d: 'Under your last message: an outline ♡ means sent, a filled ♥ means they’ve seen it.' },
  { c: 'messages', e: '🖼️', t: 'Tap a photo', d: 'Tap either picture at the top to see it big. On yours you can change or remove it — only you can change your own.' },
  { c: 'messages', e: '💥', t: 'Send with effect', d: 'Hold the ↑ arrow. Bubble: Slam, Loud, Gentle, Invisible Ink. Screen: Echo, Spotlight, Balloons, Confetti, Love, Lasers, Fireworks, Celebration.', demo: 'slam' },
  { c: 'messages', e: '🎈', t: 'Automatic effects', d: '“Happy birthday” → balloons · “Congrats” → confetti · “Happy new year” → fireworks · “Pew pew” → lasers · “Love you” → hearts.' },
  { c: 'messages', e: '❤️', t: 'Double-tap to love it', d: 'Double-tap any message for a ❤️. Long-press to react, **Reply**, Copy, **Make it a task** or **Undo Send** (15 minutes).', demo: 'heart' },
  { c: 'messages', e: '📎', t: 'Share a task in chat', d: 'Tap **＋** next to the message box to send a task card they can tick off right in the chat.' },
  { c: 'messages', e: '🫥', t: 'Invisible ink', d: 'Messages sent with Invisible Ink stay hidden until tapped.' },
  // Focus & reminders
  { c: 'focus', e: '🍅', t: 'Focus timer', d: 'Long-press a task → **Focus Timer** for 25 minutes of focus and a 5-minute break. Minimise it to the pill at the top.' },
  { c: 'focus', e: '⏰', t: 'Reminders', d: 'Give a task a time (“6pm”). Turn on **In-app reminders** in Settings, or push reminders once they’re set up.' },
  { c: 'focus', e: '📅', t: 'Alerts that always fire', d: 'In a task’s details, tap **Add to Calendar** to get your phone’s own calendar alert.' },
  { c: 'focus', e: '🎉', t: 'Clear the day', d: 'Finish everything due today for a little celebration.' },
  // App & privacy
  { c: 'app', e: '📲', t: 'Add to Home Screen', d: 'In Safari: Share → **Add to Home Screen**. You get full screen, push reminders and a faster launch. Always open Twodo from that icon.' },
  { c: 'app', e: '✈️', t: 'Works offline', d: 'Keep going without signal. Everything syncs as soon as you’re back online.' },
  { c: 'app', e: '🎨', t: 'Make it yours', d: 'Settings → your photo, name and colour (it’s your message colour and the app’s accent), theme, haptics, sounds and celebrations.', act: ['settings', 'Open Settings'] },
  { c: 'app', e: '🔐', t: 'Private by design', d: 'Tasks and messages are encrypted on your phones before they’re saved. Your password never leaves your phone.' },
  { c: 'app', e: '💾', t: 'Back up', d: 'Settings → **Export backup** saves everything to a file you can import later.' },
  // Keyboard
  { c: 'keys', e: '⌨️', t: 'Shortcuts on a computer', d: '`N` or `/` new task · `⌘K` search · `Esc` back or close · `↵` add · `⇧↵` new line · right-click a task for quick actions.' },
];

/* ---------- demos (pure CSS loops) ---------- */
const DEMOS = {
  chips: () => <div className="demo d-chips"><div className="d-line">Dinner fri 8pm @us !!</div>
    <div className="d-chiprow"><span style={{ ...colorVar('blue'), ['--d' as string]: '0s' }}><Icon name="cal" />Fri</span><span style={{ ...colorVar('indigo'), ['--d' as string]: '.35s' }}><Icon name="clock" />8:00 PM</span>
      <span style={{ ...colorVar('orange'), ['--d' as string]: '.7s' }}><Icon name="flag" />Medium</span><span style={{ ...colorVar('pink'), ['--d' as string]: '1.05s' }}><Icon name="person" />Both of you</span></div></div>,
  sheet: () => <div className="demo d-table">{[
    ['tomorrow · fri · next week · in 3 days · dec 24', 'Date'], ['6pm · 18:30 · noon · tonight', 'Time'], ['! · !! · !!! · !high', 'Priority'],
    ['@me · @us · @name', 'Who it’s for'], ['#groceries · #work', 'List or tag'], ['daily · weekdays · every mon · monthly', 'Repeat']]
    .map(([a, b]) => <div key={b}><code>{a}</code><span>{b}</span></div>)}</div>,
  swipeR: () => <div className="demo d-swipe r"><div className="d-under"><Icon name="check" />Done</div><div className="d-row"><span className="d-chk" />Buy flowers 💐</div><span className="d-finger" /></div>,
  swipeL: () => <div className="demo d-swipe l"><div className="d-under"><span className="d-pin"><Icon name="pin" />Pin</span><span className="d-del"><Icon name="trash" />Delete</span></div><div className="d-row"><span className="d-chk" />Call the plumber</div><span className="d-finger" /></div>,
  press: () => <div className="demo d-press"><div className="d-row"><span className="d-chk" />Book date night</div>
    <div className="d-menu"><div><Icon name="cal" />Today</div><div><Icon name="sunrise" />Tomorrow</div><div><Icon name="timer" />Focus</div></div><span className="d-finger" /></div>,
  edge: () => <div className="demo d-edge"><div className="d-page back"><i /><i /><i /></div><div className="d-page front"><b /><i /><i /></div><span className="d-finger" /></div>,
  sheetdown: () => <div className="demo d-sheetdn"><div className="d-page back"><i /><i /><i /></div><div className="d-card"><span className="d-grab" /><i /><i /></div><span className="d-finger" /></div>,
  slam: () => <div className="demo d-chat"><div className="bub them">Guess what?</div><div className="bub me d-slam">I passed!! 🎉</div></div>,
  heart: () => <div className="demo d-chat"><div className="bub them d-hearted">Dinner at 8? 🍝<span className="d-tb">❤️</span></div></div>,
};

const TIP_ACT_OK: Record<Act, () => boolean> = {
  invite: () => cloudReady() && !!Auth.user() && !(L.pair && L.pair.status === 'paired'),
  chat: () => cloudReady() && !!Auth.user(),
  settings: () => true,
};
const runAct = (a: Act) => (a === 'invite' ? openInviteSheet() : a === 'chat' ? navTo({ type: 'home' }) : openSettings());

function Sections({ cat }: { cat: string }) {
  return <>{TIP_CATS.filter(([k]) => cat === 'all' || cat === k).map(([k, e, n, col]) => (
    <Fragment key={k}>
      <div className="sec-h tip-sec"><span className="tip-sec-e">{e}</span>{n}</div>
      <div className="tip-list">{TIPS.filter(t => t.c === k).map(t => {
        const Demo = t.demo ? DEMOS[t.demo] : null;
        return (
          <div key={t.t} className="tip"><span className="tip-ic" style={colorVar(col)}>{t.e}</span>
            <div className="tip-b"><h4>{t.t}</h4><p>{rich(typeof t.d === 'function' ? t.d() : t.d)}</p>{Demo ? <Demo /> : null}
              {t.act && TIP_ACT_OK[t.act[0]]() ? <button className="btn-s tip-act" type="button" onClick={() => runAct(t.act![0])}>{t.act[1]}</button> : null}</div></div>
        );
      })}</div>
    </Fragment>))}</>;
}

export function TipsView({ viewRef }: { viewRef: React.RefObject<HTMLElement | null> }) {
  const cat = viewPrefs('tips').cat || 'all';
  const row = useRef<HTMLDivElement>(null), secs = useRef<HTMLDivElement>(null), first = useRef(true);
  useEffect(() => {
    const r = row.current, on = r && r.querySelector<HTMLElement>('.on'); if (!r || !on) return;
    const x = on.offsetLeft - (r.clientWidth - on.offsetWidth) / 2;
    r.scrollTo({ left: Math.max(0, x), behavior: !first.current && !reducedMotion.matches ? 'smooth' : 'auto' });
    if (!first.current && secs.current && viewRef.current) { // the pills are stuck at the top: bring the new tips up under them
      const gap = secs.current.getBoundingClientRect().top - r.getBoundingClientRect().bottom;
      if (gap < 0) viewRef.current.scrollTop += gap;
    }
    first.current = false;
  }, [cat, viewRef]);
  const pick = (k: string) => { viewPrefs('tips').cat = k; save(); haptic('light'); renderNow(); };
  return (<>
    <h1 className="large-title">Tips</h1><div className="subtitle">Little things that make Twodo feel like magic ✨</div>
    <div ref={row} className="tip-pills">{([['all', '💡', 'All']] as string[][]).concat(TIP_CATS).map(([k, e, n]) => (
      <button key={k} className={`tip-pill${k === cat ? ' on' : ''}`} type="button" onClick={() => pick(k)}>{e} {n}</button>))}</div>
    <div ref={secs} className="tip-secs"><Sections cat={cat} /></div>
    <div className="foot">That’s everything! Made with 💞 for two.</div>
  </>);
}
