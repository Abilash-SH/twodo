/* Twodo · navigation stack. Home is the chat (or To-dos without accounts); everything else slides in on top.
   Screens animate like iOS: push slides in from the right, back slides out (or follows your finger). */
import { cloudReady } from '@/lib/config';
import { haptic } from '@/lib/feedback';
import { Auth } from '@/lib/firebase';
import { Push } from '@/lib/push';
import { renderNow, scheduleRender } from '@/lib/render';
import { D, L, SMART, person, type SmartKey } from '@/lib/store';
import type { ViewPrefs } from '@/lib/types';
import { firstWord } from '@/lib/util';
import { closeMenu } from './menu';
import { createStore } from './store';

export type ViewType = 'home' | 'todos' | 'smart' | 'list' | 'search' | 'tips';
export interface Spec { type: ViewType; key?: SmartKey; id?: string }
export interface Entry { id: number; spec: Spec; phase: 'in' | 'idle' | 'out' }
export const navState = createStore<{ entries: Entry[] }>({ entries: [] });
export const Nav = { dragging: false, ignorePops: 0, edgeCancelAt: -1e9, afterPop: null as null | (() => void), noAnim: new Set<number>(), entering: new Set<number>() };
let seq = 0;

export const liveEntries = (): Entry[] => navState.get().entries.filter(e => e.phase !== 'out');
export const depth = (): number => liveEntries().length;
export const topEntry = (): Entry | undefined => { const l = liveEntries(); return l[l.length - 1]; };
export const topSpec = (): Spec => topEntry()?.spec || { type: 'home' };
export const specKey = (s: Spec): string => s.type === 'list' ? 'l:' + s.id : s.type === 'smart' ? 's:' + s.key : s.type;
export const viewPrefs = (key: string): ViewPrefs => (L.view[key] = L.view[key] || {});
// Home is your chat once you're signed in; without accounts it shows today's to-dos instead.
export const homeIsChat = (): boolean => cloudReady() && !!Auth.user();
export const alertsOn = (): boolean => !!L.settings.notify || (Push.configured() && Push.on());
export function viewTitle(spec: Spec): string {
  if (spec.type === 'home') return homeIsChat() ? 'Chat' : 'To-dos';
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
}
export function pushView(spec: Spec, { replace = false } = {}): number {
  closeMenu();
  const e: Entry = { id: ++seq, spec, phase: 'in' };
  Nav.entering.add(e.id); setTimeout(() => { Nav.entering.delete(e.id); scheduleRender(); }, 1100); // contents rise in one after another
  navState.set(s => ({ entries: [...s.entries, e] }));
  if (replace) history.replaceState({ d: depth() }, ''); else history.pushState({ d: depth() }, '');
  haptic('light');
  return e.id;
}
export function popView(): void {
  if (depth() < 2) return;
  const syncHistory = history.state && history.state.d === depth() && !history.state.s;
  doPop();
  if (syncHistory) { Nav.ignorePops++; history.back(); } // keep history in step without animating twice
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
  setTimeout(() => navState.set(s => ({ entries: s.entries.filter(x => x.id !== top.id) })), 560);
}
// Go somewhere from a button: replace whatever is open (Back always leads Home)
export function navTo(spec: Spec): void {
  closeMenu();
  const N = depth();
  if (spec.type === 'home') {
    if (N < 2) { const v = topEntry(); if (v) viewEl(v.id)?.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    while (depth() > 2) doPop({ instant: true });
    doPop(); Nav.ignorePops++; history.go(-(N - 1)); return;
  }
  if (N > 1 && specKey(topSpec()) === specKey(spec)) return;
  if (N === 1) { pushView(spec); return; }
  if (N === 2) { doPop({ instant: true }); pushView(spec, { replace: true }); return; }
  while (depth() > 1) doPop({ instant: true });
  Nav.ignorePops++; Nav.afterPop = () => pushView(spec, { replace: true });
  history.go(-(N - 2));
}
export const openSmart = (key: SmartKey): void => { pushView({ type: 'smart', key }); };
export const composerState = createStore<{ listPick: string | null }>({ listPick: null });
export const openList = (id: string): void => { composerState.set({ listPick: null }); pushView({ type: 'list', id }); };
export function openSearch(): void {
  if (topSpec().type === 'search') return;
  pushView({ type: 'search' });
  requestAnimationFrame(() => (document.querySelector('#q') as HTMLInputElement | null)?.focus({ preventScroll: true }));
}
export function openTips(cat?: string): void {
  if (cat) viewPrefs('tips').cat = cat;
  if (topSpec().type === 'tips') { renderNow(); return; }
  pushView({ type: 'tips' });
}
