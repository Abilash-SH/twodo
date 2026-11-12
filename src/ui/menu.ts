/* Twodo · context menus and popovers (long-press menus, "…" menus). Items are buttons with data-m / data-v. */
import type { ReactNode } from 'react';
import { createStore } from './store';

export type PickResult = 'keep' | void | undefined | Promise<unknown> | unknown;
export interface MenuDesc {
  rect: DOMRect; preview?: ReactNode; content: ReactNode; align?: 'left' | 'right';
  onPick?: (m: string, v: string | undefined, el: HTMLElement) => PickResult; taskId?: string | null; previewBare?: boolean;
}
export const menuStore = createStore<{ open: boolean; desc: MenuDesc | null; seq: number }>({ open: false, desc: null, seq: 0 });
export const Menu = { armAt: 0 };
export function showMenu(desc: MenuDesc): void {
  Menu.armAt = performance.now() + 300;
  menuStore.set(s => ({ open: true, desc, seq: s.seq + 1 }));
}
/** swap what an open menu shows (e.g. "Move to List…") */
export function setMenuContent(content: ReactNode): void { menuStore.set(s => (s.desc ? { ...s, desc: { ...s.desc, content } } : s)); }
export function closeMenu(): void { if (menuStore.get().open) menuStore.set(s => ({ ...s, open: false })); }
export const menuOpen = (): boolean => menuStore.get().open;
