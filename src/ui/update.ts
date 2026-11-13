/* Twodo · app updates.
   A new version downloads in the background and waits (see public/sw.js). It is applied only when you tap "Update",
   or the next time the app is opened from closed. Never by itself while the app is open: you may be typing, editing
   a task, entering a passcode or in the middle of a swipe.
   Before the reload everything pending is saved, and what you were typing (and the screen you were on) comes back. */
import { Chat } from '@/lib/chat';
import { D, SMART, cStr, saveNow } from '@/lib/store';
import { Vault } from '@/lib/vault';
import { alertOpen } from './alert';
import { gateStore } from './gate';
import { focusOpen, island } from './island';
import { menuOpen } from './menu';
import { Nav, boardHome, liveEntries, topSpec, type Spec } from './nav';
import { PhotoView } from './photos';
import { sheetOpen } from './sheet';
import { createStore } from './store';

export const updateStore = createStore<{ ready: boolean; applying: boolean }>({ ready: false, applying: false });

/* What comes back after the reload. sessionStorage: this tab only, read once, never synced, gone when the app closes.
   Text typed inside a secret list is never written here (it may only ever be stored encrypted). */
const KEY = 'twodo:resume';
export interface Resume { chat: string; task: string; stack: Spec[]; updated: boolean }
const NOTHING: Resume = { chat: '', task: '', stack: [], updated: false };
let resumed: Resume | null = null;

let reg: ServiceWorkerRegistration | null = null;
let applying = false, hadController = false, lastOffer = -1e9;

const secretTop = (): boolean => { const s = topSpec(); return s.type === 'list' && !!(D.lists[s.id!] && D.lists[s.id!].private); };
// screens we can reopen: never a secret list (it is locked after a reload, and which list it was stays private)
const resumable = (s: Spec): boolean => s.type === 'todos' || s.type === 'chat' || (s.type === 'smart' && !!s.key && !!SMART[s.key])
  || (s.type === 'list' && !!s.id && !!D.lists[s.id] && !D.lists[s.id].private && !D.lists[s.id].deleted);

/** true while a reload would interrupt something: typing, an open editor or overlay, a passcode, a swipe */
export function interrupting(): boolean {
  const a = document.activeElement;
  if (a && a.matches('input, textarea, select, [contenteditable]')) return true;
  if (sheetOpen() || menuOpen() || alertOpen() || focusOpen.get() || !!PhotoView.close || !!gateStore.get() || Nav.dragging) return true;
  return !!document.querySelector('.view:not(.under) .vault-gate, .fxp, #stack.dragging, .swiping') || document.body.classList.contains('sheet-drag');
}

function announce(): void {
  if (!updateStore.get().ready) updateStore.set(s => ({ ...s, ready: true }));
  offer();
}
/** Offer the update in a quiet moment (at most once in ten minutes). Settings always has the button. */
function offer(): void {
  if (!updateStore.get().ready || applying || document.hidden || interrupting()) return;
  if (performance.now() - lastOffer < 10 * 60e3) return;
  lastOffer = performance.now();
  island({ e: '✨', text: 'Update ready', sub: 'Takes a second · your typing is kept', btn: 'Update', onBtn: () => { void applyUpdate(); }, ms: 7000 });
}

/** The person asked for the update: save everything, remember what was being typed, switch versions, reload. */
export async function applyUpdate(): Promise<void> {
  if (applying) return;
  const task = (document.getElementById('cta') as HTMLTextAreaElement | null)?.value || '';
  if (secretTop() && task.trim()) {
    island({ e: '🔒', text: 'Finish in your secret list first', sub: 'Add or clear what you’re typing, then update', ms: 3600 });
    return;
  }
  applying = true; updateStore.set(s => ({ ...s, applying: true }));
  const keep = { chat: (document.querySelector('.chatview .cb-in') as HTMLTextAreaElement | null)?.value || '', task: secretTop() ? '' : task,
    stack: liveEntries().slice(1).map(e => e.spec).filter(resumable).map(s => ({ type: s.type, key: s.key, id: s.id })), updated: true };
  try {
    (document.activeElement as HTMLElement | null)?.blur?.();  // commits a field being edited (a name, tags)
    await new Promise(r => setTimeout(r, 380));                 // the task editor saves its title and notes 300 ms after the last key
    try { sessionStorage.setItem(KEY, JSON.stringify(keep)); } catch { /* private mode: the update still goes ahead */ }
    saveNow(); Chat.saveNow();
    await Vault.persist();                                      // secret lists: the encrypted save has finished before we go
  } catch (e) { console.warn('update', e); }
  const waiting = reg && reg.waiting;
  if (!waiting) { location.reload(); return; }                  // another tab already switched versions: just load the new files
  setTimeout(() => location.reload(), 4000);                    // safety net: never leave the button spinning
  waiting.postMessage({ type: 'SKIP_WAITING' });                // → the new version takes over → controllerchange → reload (below)
}

/** Call once with the service-worker registration. */
export function watchUpdates(r: ServiceWorkerRegistration): void {
  reg = r;
  const sw = navigator.serviceWorker;
  hadController = !!sw.controller;
  const track = (w: ServiceWorker | null) => {
    if (!w) return;
    const check = () => { if (w.state === 'installed' && sw.controller) announce(); }; // downloaded completely, and there is a version to replace
    w.addEventListener('statechange', check); check();
  };
  if (r.waiting && sw.controller) announce();
  track(r.installing);
  r.addEventListener('updatefound', () => track(r.installing));
  sw.addEventListener('controllerchange', () => {
    if (applying) { location.reload(); return; }          // we asked for it and everything is saved
    if (!hadController) { hadController = true; return; } // first install: nothing changed for this page
    announce();                                           // another tab switched versions: this one follows when you say so
  });
  // look for a new version whenever the app comes back to the screen; offer a waiting one in a quiet moment
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { r.update().catch(() => {}); setTimeout(offer, 1500); } });
  setInterval(offer, 20000);
}

/** What was kept across the update reload (read once; later calls return the same answer). */
export function resume(): Resume {
  if (resumed) return resumed;
  resumed = { ...NOTHING };
  try {
    const raw = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY);
    const o = raw ? JSON.parse(raw) as Record<string, unknown> : null;
    if (o && typeof o === 'object') {
      const stack = Array.isArray(o.stack) ? o.stack.slice(0, 3) : [];
      resumed = { chat: cStr(o.chat, 20000), task: cStr(o.task, 2000), updated: o.updated === true,
        stack: stack.map(s => { const x = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>; return { type: cStr(x.type, 12), key: cStr(x.key, 24) || undefined, id: cStr(x.id, 80) || undefined } as Spec; }).filter(resumable)
          .filter((s, i) => s.type !== 'chat' || (i === 0 && boardHome())) }; // the chat only ever sits directly above the board
    }
  } catch { /* nothing to restore */ }
  return resumed;
}
/** the text that was in a field before the update: handed out once */
export function takeDraft(k: 'chat' | 'task'): string { const r = resume(), v = r[k]; r[k] = ''; return v; }
