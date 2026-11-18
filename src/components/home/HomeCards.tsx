'use client';
/* Twodo · Home's fanned stack of cards (after the owner's reference): the top card upright, the next ones tilted and
   peeking out to the left. Swipe the top card sideways to send it to the back; tap it to open what it's about. The
   dots bring any card to the top (and are how a keyboard or VoiceOver moves through them).
   The swipe follows the rules in hooks/swipe.ts (touch events, decided after 6 px, 1:1, `flung` to finish) and is
   listed in docs/gesture-ownership.md. Only transform and opacity move; with Reduce Motion cards change places with a
   fade, and nothing flies. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { haptic } from '@/lib/feedback';
import { reducedMotion } from '@/lib/util';
import { SLOP, Velocity, flung, touchById } from '@/hooks/swipe';

export interface HomeCard {
  id: string;
  /** small capitals in the corner pill ("TODAY") */
  badge: string;
  /** big capitals at the bottom ("3 TO-DOS LEFT") */
  title: string;
  sub: string;
  /** the wash behind it: a class in 42-home.css */
  tone: string;
  /** the characters in the middle; `top` is false while the card waits in the fan (draw them still there) */
  art: (top: boolean) => ReactNode;
  /** the dot's name ("Show Today") */
  label: string;
  /** what opening it does, for VoiceOver ("Opens Today") */
  hint: string;
  onOpen: () => void;
}

const FAN = { x: -22, rotate: -6.5, scale: 0.045, shift: 14, shown: 3 };
const fan = (k: number) => `translate3d(${FAN.shift + FAN.x * k}px,0,0) rotate(${FAN.rotate * k}deg) scale(${1 - FAN.scale * k})`;

export function HomeCards({ cards }: { cards: HomeCard[] }) {
  const [order, setOrder] = useState(() => cards.map(c => c.id));
  const stack = useRef<HTMLDivElement>(null), swiped = useRef(0);
  const byId = new Map(cards.map(c => [c.id, c]));
  const ids = order.filter(id => byId.has(id)).concat(cards.map(c => c.id).filter(id => !order.includes(id)));

  const sendBack = useCallback(() => setOrder(o => [...o.slice(1), o[0]]), []);
  const bring = (id: string) => {
    if (ids[0] === id) return;
    haptic('light'); setOrder(o => [id, ...o.filter(x => x !== id)]);
  };

  useEffect(() => { // the swipe: touch only (a mouse uses the dots)
    const el = stack.current; if (!el) return;
    let S: { id: number; x0: number; y0: number; axis: null | 'x' | 'y'; dx: number; v: Velocity; card: HTMLElement } | null = null;
    const reset = (card: HTMLElement) => { card.classList.remove('dragging'); card.style.transform = fan(0); };
    const cancel = () => { if (S && S.axis === 'x') reset(S.card); S = null; };
    const start = (e: TouchEvent) => {
      const card = (e.target as Element).closest<HTMLElement>('.hc.top');
      if (!card || e.touches.length !== 1 || card.classList.contains('flying')) { cancel(); return; }
      const t = e.changedTouches[0];
      S = { id: t.identifier, x0: t.clientX, y0: t.clientY, axis: null, dx: 0, v: new Velocity(), card };
      S.v.add(t.clientX, t.clientY);
    };
    const move = (e: TouchEvent) => {
      if (!S) return;
      if (e.touches.length > 1) { cancel(); return; }
      const t = touchById(e, S.id); if (!t) return;
      const dx = t.clientX - S.x0, dy = t.clientY - S.y0;
      S.v.add(t.clientX, t.clientY);
      if (!S.axis) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        S.axis = Math.abs(dx) >= Math.abs(dy) * 0.85 ? 'x' : 'y';
        if (S.axis === 'y') { S = null; return; } // a scroll: the page has it
        S.card.classList.add('dragging');
      }
      e.preventDefault();
      S.dx = dx;
      S.card.style.transform = `translate3d(${FAN.shift + dx}px,0,0) rotate(${dx / 18}deg)`;
    };
    const end = (e: TouchEvent) => {
      if (!S) return;
      const t = touchById(e, S.id); if (!t) return;
      const s = S; S = null;
      if (s.axis !== 'x') return;
      swiped.current = performance.now();
      const { vx } = s.v.get(), dir = s.dx < 0 ? -1 : 1;
      const card = s.card;
      if (!flung(Math.abs(s.dx), Math.max(0, vx * dir), card.offsetWidth)) { reset(card); return; }
      haptic('light');
      card.classList.remove('dragging');
      if (reducedMotion.matches) { card.style.transform = ''; sendBack(); return; }
      card.classList.add('flying');
      card.style.transform = `translate3d(${dir * (card.offsetWidth + 160)}px,0,0) rotate(${dir * 14}deg)`;
      let done = false;
      const land = () => {
        if (done) return; done = true;
        card.classList.add('jump'); card.classList.remove('flying');
        flushSync(sendBack); // it is drawn at the back of the fan, hidden, with no transition
        void getComputedStyle(card).opacity; // a style flush (no layout read), so the jump isn't animated
        card.classList.remove('jump');
      };
      card.addEventListener('transitionend', land, { once: true });
      setTimeout(land, 500); // in case the transition never ends (tab hidden)
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', cancel);
    return () => {
      el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', cancel);
    };
  }, [sendBack]);

  return (
    <div className="hc-wrap">
      <div className="hc-stack" ref={stack}>
        {[...ids].reverse().map(id => {
          const c = byId.get(id)!, k = ids.indexOf(id), top = k === 0;
          return (
            <button
              key={id} type="button" className={`hc ${c.tone}${top ? ' top' : ''}`} data-card={id}
              style={{ transform: fan(k), opacity: k >= FAN.shown ? 0 : 1, zIndex: ids.length - k }}
              tabIndex={top ? 0 : -1} aria-hidden={top ? undefined : true} inert={!top}
              aria-label={`${c.badge}: ${c.title}. ${c.sub}. ${c.hint}`}
              onClick={() => { if (top && performance.now() - swiped.current > 450) { haptic('light'); c.onOpen(); } }}
            >
              <span className="hc-art" aria-hidden="true">{c.art(top)}</span>
              <span className="hc-badge" aria-hidden="true">{c.badge}</span>
              <span className="hc-words" aria-hidden="true"><b className="hc-title">{c.title}</b><span className="hc-sub">{c.sub}</span></span>
            </button>
          );
        })}
      </div>
      <div className="hc-dots" role="group" aria-label="Cards">
        {cards.map(c => (
          <button key={c.id} type="button" className={`hc-dot dot-${c.id}${ids[0] === c.id ? ' on' : ''}`} aria-label={c.label}
            aria-pressed={ids[0] === c.id} onClick={() => bring(c.id)} />
        ))}
      </div>
    </div>
  );
}

/** The class that plays a moment on the top card's characters each time a card arrives (never on the first draw). */
export function useArrival(top: boolean, mood: string): string {
  const was = useRef(top), [cls, setCls] = useState('');
  useEffect(() => {
    if (top && !was.current && !reducedMotion.matches) { setCls(''); requestAnimationFrame(() => setCls(mood)); }
    was.current = top;
  }, [top, mood]);
  return top ? cls : '';
}
