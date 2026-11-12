/* Twodo · sheets: iOS card modals with drag-to-dismiss. One at a time; opening another replaces it. */
import type { ReactNode } from 'react';
import { islandStore, hideIsland } from './island';
import { MS } from '@/lib/motion';
import { isTouch } from '@/lib/util';
import { createStore } from './store';
import { navState } from './nav';

export interface SheetDesc {
  title: string; body: ReactNode; left?: ReactNode; right?: string; tall?: boolean;
  onClose?: () => void; onRight?: () => void; key?: string;
}
export interface SheetEntry { id: number; desc: SheetDesc; closing: boolean }
export const sheetStore = createStore<SheetEntry[]>([]);
export const Sheet = { ignorePop: false };
let seq = 0;
const current = () => { const l = sheetStore.get().filter(s => !s.closing); return l[l.length - 1]; };
export const sheetOpen = (): boolean => !!current();
/** Put the cursor in a sheet's first field once the sheet has finished rising, on a computer only. On a phone the
    keyboard should only come up when you tap the field yourself (never by surprise, never mid-animation). */
export function focusWhenOpen(el: HTMLElement | null): void {
  if (!el || isTouch()) return;
  setTimeout(() => { if (el.isConnected && el.closest('.sheet.open')) el.focus({ preventScroll: true }); }, MS.sheet + 40);
}

export function openSheet(desc: SheetDesc): void {
  (document.activeElement as HTMLElement | null)?.blur?.();
  if (islandStore.get().mode === 'toast') hideIsland();
  const replacing = sheetOpen();
  if (replacing) closeSheet({ history: false, keepApp: true });
  document.body.style.setProperty('--sp', '1');
  document.body.classList.add('sheet-open');
  sheetStore.set(list => [...list, { id: ++seq, desc, closing: false }]);
  if (!replacing) history.pushState({ d: navState.get().entries.filter(e => e.phase !== 'out').length, s: 1 }, '');
}
export function closeSheet({ history: h = true, keepApp = false }: { history?: boolean; keepApp?: boolean } = {}): void {
  const cur = current(); if (!cur) return;
  const el = document.querySelector('.sheet.open');
  if (el && el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  sheetStore.set(list => list.map(s => (s.id === cur.id ? { ...s, closing: true } : s)));
  if (!keepApp) document.body.classList.remove('sheet-open');
  setTimeout(() => sheetStore.set(list => list.filter(s => s.id !== cur.id)), 560);
  cur.desc.onClose?.();
  if (h && history.state && history.state.s) { Sheet.ignorePop = true; history.back(); }
  setTimeout(() => sheetEvents.onClosed(), 350); // the chat underneath is visible again
}
export const sheetEvents = { onClosed: (): void => {} };
