/* Twodo · the Dynamic Island: short toasts with an optional button, or the focus timer's live activity */
import type { IslandMsg } from '@/lib/bridge';
import { L } from '@/lib/store';
import { createStore } from './store';

export interface IslandState { mode: 'off' | 'toast' | 'live'; msg: Required<Omit<IslandMsg, 'onBtn' | 'ms'>> & { onBtn: (() => void) | null }; seq: number }
export const islandStore = createStore<IslandState>({ mode: 'off', msg: { e: '', text: '', sub: '', btn: '', onBtn: null }, seq: 0 });
let timer: ReturnType<typeof setTimeout> | undefined;
export const focusOpen = createStore(false);

export function island({ e = '✨', text = '', sub = '', btn = '', onBtn = null, ms = 2800 }: IslandMsg = {}): void {
  clearTimeout(timer);
  islandStore.set(s => ({ mode: 'toast', msg: { e, text, sub, btn, onBtn }, seq: s.seq + 1 }));
  timer = setTimeout(hideIsland, ms + (btn ? 1800 : 0));
}
export function hideIsland(): void {
  clearTimeout(timer);
  if (L.focus && L.focus.running && !focusOpen.get()) return showLive();
  islandStore.set(s => ({ ...s, mode: 'off', msg: { ...s.msg, onBtn: null } }));
}
export function showLive(): void {
  if (!L.focus) return;
  islandStore.set(s => ({ ...s, mode: 'live' }));
}
