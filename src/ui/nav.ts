/* Twodo · navigation stack. Home is the shared board (or To-dos without accounts); the chat and everything else
   slide in on top. Screens animate like iOS: push slides in from the right, back slides out (or follows your finger). */
import { cloudReady } from '@/lib/config';
import { haptic } from '@/lib/feedback';
import { MS } from '@/lib/motion';
import { Auth } from '@/lib/firebase';
import { Push } from '@/lib/push';
import { renderNow, scheduleRender } from '@/lib/render';
import { D, L, SMART, person, type SmartKey } from '@/lib/store';
import type { ViewPrefs } from '@/lib/types';
import { firstWord } from '@/lib/util';
import { flushSync } from 'react-dom';
import { closeMenu } from './menu';
import { createStore } from './store';

export type ViewType = 'home' | 'chat' | 'todos' | 'smart' | 'list' | 'search' | 'tips';
export interface Spec { type: ViewType; key?: SmartKey; id?: string }
export interface Entry { id: number; spec: Spec; phase: 'in' | 'idle' | 'out' }
export const navState = createStore<{ entries: Entry[] }>({ entries: [] });
/* Browser history, kept deliberately simple: Home is the base entry, and while any screen is open there is exactly
   ONE extra "trap" entry above it. Every Back (the browser button, Android's gesture, iOS's own edge swipe) lands on
   popstate and closes exactly one screen; the trap is then re-armed if screens remain. In-app back (our swipe, the
   ‹ button, Escape) never calls history.back() except to remove the trap when you arrive Home.
   seq changes on every navigation, so a gesture that started before one can't trigger another.
   echoUntil is set only by OUR touch swipe from the screen edge, the one gesture the phone's own back swipe may
   answer as well: the single popstate that follows it is the same navigation, not a second one. Every other Back
   counts, however quickly it is pressed. */
export const Nav = {
  dragging: false, edgeCancelAt: -1e9, noAnim: new Set<number>(), entering: new Set<number>(),
  seq: 0, trap: false, ignoreNextPop: false, echoUntil: -1e9,
};
const ECHO_MS = 800;
let echoT: ReturnType<typeof setTimeout> | undefined;
export function armTrap(): void { if (!Nav.trap) { history.pushState({ d: 2, t: 1 }, ''); Nav.trap = true; } }
// back to Home: remove the trap, unless the phone's own Back already did (never step back past Twodo's first entry)
function dropTrap(): void {
  if (!Nav.trap) return;
  Nav.trap = false;
  if (history.state && history.state.t) { Nav.ignoreNextPop = true; history.back(); }
}
/** popstate: one Back = one screen */
export function onHistoryBack(e: PopStateEvent): void {
  if (Nav.ignoreNextPop) { Nav.ignoreNextPop = false; return; } // the trap we removed ourselves
  Nav.trap = false; // whatever this Back was, it consumed the trap
  // the phone's own back gesture answering our edge swipe: the same navigation, counted once
  const echo = performance.now() < Nav.echoUntil;
  Nav.echoUntil = -1e9; clearTimeout(echoT);
  if (!echo && depth() > 1) {
    // the iPhone's edge swipe already animated the page away: switch without a second animation
    const instant = !!(e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition || performance.now() - Nav.edgeCancelAt < 2500;
    doPop({ instant }); Nav.seq++;
  }
  if (depth() > 1) armTrap(); // the next Back still belongs to the app
}
let seq = 0;

export const liveEntries = (): Entry[] => navState.get().entries.filter(e => e.phase !== 'out');
export const depth = (): number => liveEntries().length;
export const topEntry = (): Entry | undefined => { const l = liveEntries(); return l[l.length - 1]; };
export const topSpec = (): Spec => topEntry()?.spec || { type: 'home' };
export const specKey = (s: Spec): string => s.type === 'list' ? 'l:' + s.id : s.type === 'smart' ? 's:' + s.key : s.type;
export const viewPrefs = (key: string): ViewPrefs => (L.view[key] = L.view[key] || {});
// Home is the board the two of you share once you're signed in; without accounts it is the To-dos screen.
export const boardHome = (): boolean => cloudReady() && !!Auth.user();
/** "Add a to-do" on the board: the task box is showing over it */
export const boardAdd = createStore(false);
/** Bring the task box up over the board. It takes the keyboard inside the same tap: the only way an iPhone shows it. */
export function openBoardAdd(): void {
  flushSync(() => boardAdd.set(true));
  (document.getElementById('cta') as HTMLTextAreaElement | null)?.focus({ preventScroll: true });
}
export const alertsOn = (): boolean => !!L.settings.notify || (Push.configured() && Push.on());
export function viewTitle(spec: Spec): string {
  if (spec.type === 'home') return boardHome() ? 'Board' : 'To-dos';
  if (spec.type === 'chat') return 'Chat';
  if (spec.type === 'search') return 'Search';
  if (spec.type === 'tips') return 'Tips';
  if (spec.type === 'todos') return 'To-dos';
  if (spec.type === 'list') { const l = D.lists[spec.id!]; return l ? l.name : 'Secret'; } // a locked secret list isn't loaded
  if (spec.key === 'us') return `${firstWord(person('a').name)} & ${firstWord(person('b').name)}`;
  return SMART[spec.key!].title;
}
export const viewEl = (id: number): HTMLElement | null => document.querySelector(`#stack > [data-vid="${id}"]`);

export function bootNav(): void {
  navState.set({ entries: [{ id: ++seq, spec: { type: 'home' }, phase: 'idle' }] });
  history.replaceState({ d: 1 }, '');
  Nav.trap = false; Nav.ignoreNextPop = false; Nav.echoUntil = -1e9; clearTimeout(echoT);
}
export function pushView(spec: Spec, { replace = false } = {}): number {
  closeMenu();
  if (boardAdd.get()) boardAdd.set(false);
  const e: Entry = { id: ++seq, spec, phase: 'in' };
  // contents rise in one after another (not the chat: it is already drawn, and marking it would restyle every message inside the tap)
  if (spec.type !== 'chat') { Nav.entering.add(e.id); setTimeout(() => { Nav.entering.delete(e.id); scheduleRender(); }, 1100); }
  navState.set(s => ({ entries: [...s.entries, e] }));
  Nav.seq++;
  if (!replace) armTrap();
  // the tick lands with the screen, not before it moves (and not at all if it was already closed again)
  setTimeout(() => { if (liveEntries().some(x => x.id === e.id)) haptic('light'); }, MS.page - 80);
  return e.id;
}
/** In-app back (swipe, ‹ button, Escape): closes exactly one screen.
 *  systemToo: a touch swipe from the screen edge, which the phone's own back gesture may answer with a popstate too.
 *  That popstate then removes the trap itself; only if none comes do we remove it (never two steps back). */
export function popView({ systemToo = false } = {}): void {
  if (depth() < 2) return;
  doPop(); Nav.seq++;
  if (!systemToo) { if (depth() < 2) dropTrap(); return; }
  Nav.echoUntil = performance.now() + ECHO_MS;
  clearTimeout(echoT);
  echoT = setTimeout(() => { Nav.echoUntil = -1e9; if (depth() < 2) dropTrap(); }, ECHO_MS);
}
export function doPop({ instant = false } = {}): void {
  const live = liveEntries(); if (live.length < 2) return;
  const top = live[live.length - 1], prev = live[live.length - 2];
  if (instant) { // the phone already showed its own back animation: just switch, don't animate again
    Nav.noAnim.add(prev.id);
    navState.set(s => ({ entries: s.entries.filter(x => x.id !== top.id) }));
    return;
  }
  navState.set(s => ({ entries: s.entries.map(x => (x.id === top.id ? { ...x, phase: 'out' } : x)) }));
  setTimeout(() => navState.set(s => ({ entries: s.entries.filter(x => x.id !== top.id) })), MS.page + 120);
}
/** Keep the bottom `keep` screens and the one you're looking at: the ones in between leave without a trace. */
function dropBetween(keep: number): void {
  const live = liveEntries(); if (live.length <= keep + 1) return;
  const gone = new Set(live.slice(keep, -1).map(e => e.id));
  navState.set(s => ({ entries: s.entries.filter(e => !gone.has(e.id)) }));
}
// Go somewhere from a button. Back always leads Home, one screen at a time.
export function navTo(spec: Spec): void {
  closeMenu();
  const N = depth();
  if (spec.type === 'home') {
    if (N < 2) { const v = topEntry(); if (v) viewEl(v.id)?.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    dropBetween(1); popView(); return;
  }
  if (spec.type === 'chat' && !boardHome()) return; // no chat screen without an account
  if (N > 1 && specKey(topSpec()) === specKey(spec)) return;
  if (N === 1) { pushView(spec); return; }
  if (spec.type === 'chat') { revealChat(); return; }
  if (topSpec().type === 'chat') { pushView(spec); return; } // from the chat: on top of it, so Back returns to the conversation
  while (depth() > 1) doPop({ instant: true }); // anywhere else: replace what is open
  Nav.seq++;
  pushView(spec, { replace: true }); // still one screen above Home: the trap stays as it is
}
/* The chat, asked for from a screen above the board (a tip's "open the chat", a notification while a list is open).
   The chat only ever sits directly above Home, so it is put there (or already is) and the screen you're looking at
   slides away to show it: the same motion as Back, and from the chat Back leads to the board. */
function revealChat(): void {
  const live = liveEntries();
  if (live[1].spec.type !== 'chat') {
    const e: Entry = { id: ++seq, spec: { type: 'chat' }, phase: 'idle' };
    Nav.noAnim.add(e.id); // it takes its place underneath without moving: only the screen above it will
    flushSync(() => navState.set(s => { const i = s.entries.indexOf(live[0]) + 1; return { entries: [...s.entries.slice(0, i), e, ...s.entries.slice(i)] }; }));
  }
  dropBetween(2);
  popView(); // Home and the chat stay open: the trap stays as it is
}
export const openSmart = (key: SmartKey): void => { pushView({ type: 'smart', key }); };
export const composerState = createStore<{ listPick: string | null }>({ listPick: null });
export const openList = (id: string): void => { composerState.set({ listPick: null }); pushView({ type: 'list', id }); };
// The search field is focused inside the same tap that opened it: that's the only way an iPhone shows the keyboard
// (focusing a moment later just leaves a blinking cursor and no keyboard)
export function openSearch(): void {
  if (topSpec().type === 'search') return;
  flushSync(() => { pushView({ type: 'search' }); });
  (document.querySelector('#q') as HTMLInputElement | null)?.focus({ preventScroll: true });
}
export function openTips(cat?: string): void {
  if (cat) viewPrefs('tips').cat = cat;
  if (topSpec().type === 'tips') { renderNow(); return; }
  pushView({ type: 'tips' });
}
