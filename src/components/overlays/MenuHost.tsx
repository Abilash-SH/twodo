'use client';
/* Twodo · context menus: a lifted preview with a menu under it, kept fully on screen together (like iOS) */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { haptic } from '@/lib/feedback';
import { useTapKeepWithin } from '@/hooks/useTapKeep';
import { clamp } from '@/lib/util';
import { Menu, closeMenu, menuStore } from '@/ui/menu';
import { useStore } from '@/ui/store';
import { openTaskSheet } from '../sheets/TaskSheet';

// Notch / home-indicator insets in px (env() values resolved by the browser)
let insetEl: HTMLDivElement | null = null;
export function safeInsets() {
  if (!insetEl || !insetEl.isConnected) {
    insetEl = document.createElement('div');
    insetEl.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left)';
    document.body.append(insetEl);
  }
  const cs = getComputedStyle(insetEl), n = (v: string) => parseFloat(v) || 0;
  return { top: n(cs.paddingTop), right: n(cs.paddingRight), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft) };
}

export function MenuHost() {
  const { open, desc, seq } = useStore(menuStore);
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const listRef = useRef<HTMLDivElement>(null), prevRef = useRef<HTMLDivElement>(null), shift = useRef(0), rootRef = useRef<HTMLDivElement>(null);
  useTapKeepWithin(rootRef); // picking from a menu while typing keeps the keyboard up

  useEffect(() => {
    if (open) { setMounted(true); const r = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(r); }
    setShow(false);
    const t = setTimeout(() => { if (!menuStore.get().open) setMounted(false); }, 320);
    return () => clearTimeout(t);
  }, [open, seq]);

  // Place the menu (and clip a very tall preview) so both fit on screen
  useLayoutEffect(() => {
    const list = listRef.current; if (!list || !desc || !open) return;
    const rect = desc.rect, prev = prevRef.current, withPreview = !!desc.preview;
    // the part of the screen you can see: above the keyboard, below the status bar (iOS may have scrolled the view)
    const vv = window.visualViewport, vh = vv ? vv.height : innerHeight, off = vv ? vv.offsetTop : 0, vw = innerWidth, ins = safeInsets();
    const gap = 10, margin = 10, topMin = off + ins.top + margin, botMax = off + vh - (document.body.classList.contains('kb') ? 0 : ins.bottom) - margin, room = botMax - topMin;
    list.style.maxHeight = 'none';
    let mh = list.offsetHeight; const mw = list.offsetWidth;
    let top: number; shift.current = 0;
    if (withPreview && prev) {
      let ph = rect.height;
      if (ph + gap + mh > room) {
        ph = Math.min(ph, Math.max(Math.max(56, room * 0.4), room - gap - mh));
        mh = Math.min(mh, room - gap - ph);
        if (ph < rect.height) { prev.style.maxHeight = ph + 'px'; prev.classList.add('clip'); }
      }
      const pTop = Math.max(topMin, Math.min(rect.top, botMax - mh - gap - ph));
      shift.current = pTop - rect.top;
      top = pTop + ph + gap;
    } else {
      mh = Math.min(mh, room);
      top = rect.bottom + 6;
      if (top + mh > botMax) top = rect.top - 6 - mh;
      top = Math.max(topMin, Math.min(top, botMax - mh));
    }
    list.style.maxHeight = mh + 'px';
    let left = desc.align === 'right' ? rect.right - mw : rect.left;
    left = clamp(left, ins.left + margin, vw - ins.right - mw - margin);
    list.style.top = top + 'px'; list.style.left = left + 'px';
    list.style.transformOrigin = `${desc.align === 'right' ? 'right' : 'left'} ${top < rect.top ? 'bottom' : 'top'}`;
  }, [desc, open, seq, mounted]);
  useEffect(() => { if (prevRef.current) prevRef.current.style.transform = show ? `translateY(${shift.current}px) scale(1.02)` : ''; }, [show]);

  if (!mounted || !desc) return <div ref={rootRef} id="menu" />;
  return (
    <div ref={rootRef} id="menu" className={`on${desc.preview ? '' : ' plain'}${show ? ' show' : ''}`} onClick={e => {
      if (performance.now() < Menu.armAt) return;
      const t = e.target as HTMLElement, b = t.closest<HTMLElement>('[data-m]');
      if (b) {
        const res = desc.onPick ? desc.onPick(b.dataset.m!, b.dataset.v, b) : null;
        if (res !== 'keep') closeMenu();
        haptic('light');
        return;
      }
      if (t.closest('.mprev') && desc.taskId) { const id = desc.taskId; closeMenu(); openTaskSheet(id); return; }
      if (!t.closest('.mlist')) closeMenu();
    }}>
      <div className="mbg" />
      {desc.preview ? <div ref={prevRef} key={seq} className={`mprev${desc.previewBare ? ' bare' : ''}`} style={{ left: desc.rect.left, top: desc.rect.top, width: desc.rect.width }}>{desc.preview}</div> : null}
      <div ref={listRef} className="mlist" role="menu">{desc.content}</div>
    </div>
  );
}
