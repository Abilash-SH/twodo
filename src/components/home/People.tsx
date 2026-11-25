'use client';
/* Twodo · the 3D people on screen (lib/stage3d.ts): realistic people standing free, not on a card, and moving by
   motion capture. A sideways drag on someone turns them all the way round; a tap and they wave at you. Their
   drawings stand there until the 3D people are ready, and for good without WebGL.
   - Home: you and your partner (`HomePeople`).
   - Your character: the person you're picking, alone (`PersonPreview`).
   The drag has one owner, this file (docs/gesture-ownership.md, "The 3D people"): it is claimed only when it starts on
   a person and goes sideways; anything else scrolls the screen as usual. */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { avatarOf } from '@/lib/characters';
import { haptic } from '@/lib/feedback';
import { modelUrl, personFor } from '@/lib/people';
import type { Act, StageHandle, Vibe, Who } from '@/lib/stage3d';
import { L, partnerKey, person } from '@/lib/store';
import type { AvatarLook, PersonKey } from '@/lib/types';
import { Avatars } from '@/lib/avatar3d';
import { firstWord } from '@/lib/util';
import { navState } from '@/ui/nav';
import { sheetStore } from '@/ui/sheet';
import { useStore } from '@/ui/store';
import { colorVar } from '../ui/Avatar';
import { CharacterSvg } from './Character';

/** For the rest of Home to ask for a movement (a moment is shared: that person takes a photo). Quiet until mounted. */
export const homePeople = { act: (_who: 'me' | 'pt', _a: Act): void => {} };

const SLOP = 6;
const whoFor = (id: string, look: AvatarLook): Who => { const p = personFor(look); return { id, url: modelUrl(p), g: p.look === 'female' ? 'f' : 'm' }; };
/** someone as drawn: their own avatar if they've made one (docs/own-avatar.md), else the Twodo person they picked */
const whoOf = (id: string, k: PersonKey, look = avatarOf(k)): Who => {
  const own = Avatars.url[k];
  return own ? { id, url: own, g: look.look === 'female' ? 'f' : 'm' } : whoFor(id, look);
};
const shownId = (k: PersonKey, look = avatarOf(k)) => (Avatars.url[k] ? 'own' : personFor(look).id);

/** A stage in `box` (drawn into `cv`) with these people, and its gestures; `ready` once the 3D people are drawn */
function useStage(who: Who[], { onReady, active = true }: { onReady?: (h: StageHandle) => void; active?: boolean } = {}) {
  const box = useRef<HTMLElement | null>(null), cv = useRef<HTMLCanvasElement>(null), stage = useRef<StageHandle | null>(null);
  const latest = useRef(who); latest.current = who;
  const ready0 = useRef(onReady); ready0.current = onReady;
  const [ready, setReady] = useState(false);
  const whoKey = who.map(w => w.url).join('|');

  // starts once there is a size for it (the first resize report: no layout read inside a screen's push)
  useEffect(() => {
    const b = box.current, el = cv.current; if (!b || !el) return;
    let gone = false, starting = false;
    // where each person faces after a finger, kept on the element (degrees; tests read it): data-me-yaw, data-me-state…
    const report = (id: string, yaw: number, st: string) => { b.dataset[`${id}Yaw`] = String(Math.round(yaw * 180 / Math.PI)); b.dataset[`${id}State`] = st; };
    const ro = new ResizeObserver(es => {
      const { width, height } = es[es.length - 1].contentRect;
      if (stage.current) { stage.current.resize(width, height); return; }
      if (starting || !width || !height) return;
      starting = true;
      import('@/lib/stage3d').then(m => m.mountStage(el, width, height, latest.current, report)).then(h => {
        if (gone) { h.destroy(); return; }
        stage.current = h; setReady(true); ready0.current?.(h);
      }).catch(() => { /* no WebGL, or the people didn't load: the drawings stay */ });
    });
    ro.observe(b);
    return () => { gone = true; ro.disconnect(); stage.current?.destroy(); stage.current = null; };
  }, []);
  useEffect(() => { if (ready) void stage.current?.setPeople(latest.current); }, [whoKey, ready]);
  useEffect(() => { stage.current?.setActive(active); }, [active, ready]);

  // a finger: sideways on someone turns them (one full turn for about the stage's width), a tap waves
  useEffect(() => {
    const el = box.current; if (!el) return;
    let id: string | null = null, x0 = 0, y0 = 0, xl = 0, tl = 0, t0 = 0, v = 0, claimed = false, moved = false, touchAt = -1e9;
    const at = (x: number, y: number) => { const r = el.getBoundingClientRect(); return stage.current ? stage.current.hit(x - r.left, y - r.top) : null; };
    const begin = (x: number, y: number, t: number) => { id = at(x, y); x0 = xl = x; y0 = y; tl = t0 = t; v = 0; claimed = false; moved = false; return !!id; };
    const follow = (x: number, y: number, t: number): boolean => {
      if (!id || !stage.current) return false;
      if (!claimed) {
        if (Math.abs(x - x0) < SLOP && Math.abs(y - y0) < SLOP) return false;
        moved = true;
        if (Math.abs(x - x0) < Math.abs(y - y0) * .85) { id = null; return false; }      // a scroll: not ours
        claimed = true; stage.current.grab(id);
      }
      const turn = (x - xl) / Math.max(1, el.clientWidth) * Math.PI * 2.2, dt = Math.max(8, t - tl);
      stage.current.turnBy(id, turn); v = v * .4 + (turn / (dt / 1000)) * .6; xl = x; tl = t;
      return true;
    };
    const finish = (t: number, cancel = false) => {
      if (!id || !stage.current) { id = null; return; }
      if (claimed) stage.current.letGo(id, cancel || t - tl > 90 ? 0 : v);                 // held still before letting go: no flick
      else if (!cancel && !moved && t - t0 < 600) { stage.current.tap(id); haptic('light'); }
      id = null;
    };
    const ts = (e: TouchEvent) => { touchAt = e.timeStamp; if (e.touches.length !== 1) { finish(e.timeStamp, true); return; } begin(e.touches[0].clientX, e.touches[0].clientY, e.timeStamp); };
    // once a turn is claimed, Home doesn't scroll under it (when the browser still lets us say so)
    const tm = (e: TouchEvent) => { if (e.touches.length === 1 && follow(e.touches[0].clientX, e.touches[0].clientY, e.timeStamp) && e.cancelable) e.preventDefault(); };
    const te = (e: TouchEvent) => { touchAt = e.timeStamp; finish(e.timeStamp); };
    const tc = (e: TouchEvent) => finish(e.timeStamp, true);
    // a mouse does the same (desktop); the mouse events a phone makes up after a touch are ignored
    const mm = (e: MouseEvent) => { follow(e.clientX, e.clientY, e.timeStamp); };
    const mu = (e: MouseEvent) => { removeEventListener('mousemove', mm); finish(e.timeStamp); };
    const md = (e: MouseEvent) => {
      if (e.button !== 0 || e.timeStamp - touchAt < 900 || !begin(e.clientX, e.clientY, e.timeStamp)) return;
      e.preventDefault(); addEventListener('mousemove', mm); addEventListener('mouseup', mu, { once: true });
    };
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', te); el.addEventListener('touchcancel', tc);
    el.addEventListener('mousedown', md);
    return () => {
      el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te);
      el.removeEventListener('touchcancel', tc); el.removeEventListener('mousedown', md); removeEventListener('mousemove', mm); removeEventListener('mouseup', mu);
    };
  }, []);
  return { box, cv, stage, ready };
}

/** Home: you on the left, your partner on the right */
export function HomePeople({ vibe }: { vibe: Vibe }) {
  const me = L.me, pk = partnerKey(), mine = avatarOf(me), theirs = avatarOf(pk);
  const who = [whoOf('me', me), whoOf('pt', pk)];
  // a screen or a sheet over Home: they wait, undrawn (battery, and nothing competes with that screen's gestures)
  const screens = useStore(navState).entries, sheets = useStore(sheetStore);
  const covered = screens.filter(e => e.phase !== 'out').length > 1 || sheets.some(e => !e.closing);
  const { box, cv, stage, ready } = useStage(who, { active: !covered, onReady: h => { homePeople.act = (w, a) => h.act(w, a); } });
  useEffect(() => () => { homePeople.act = () => {}; }, []);
  useEffect(() => { stage.current?.vibe({ free: vibe.free, unread: vibe.unread, ptDone: vibe.ptDone }); }, [vibe.free, vibe.unread, vibe.ptDone, ready, stage]);
  const names = [firstWord(person(me).name) || 'You', firstWord(person(pk).name) || 'Your partner'];
  return (
    <section className={`home-people no-pan${ready ? ' ready' : ''}`} ref={box as RefObject<HTMLElement>} data-people={`${shownId(me)} ${shownId(pk)}`}
      aria-label={`${names[0]} and ${names[1]}, in 3D. Drag sideways on one of you to turn them round; tap to make them wave.`}>
      <span className="hp-draw" aria-hidden="true">
        <span style={colorVar(person(me).color)}><CharacterSvg look={mine} size={150} still /></span>
        <span style={colorVar(person(pk).color)}><CharacterSvg look={theirs} size={142} flip still /></span>
      </span>
      <canvas ref={cv} className="hp-c" aria-hidden="true" />
      <span className="hp-sr">
        <button type="button" onClick={() => stage.current?.act('me', 'wave')}>Make {names[0]} wave</button>
        <button type="button" onClick={() => stage.current?.act('pt', 'wave')}>Make {names[1]} wave</button>
      </span>
    </section>
  );
}

/** Your character: the person you're picking, alone, to turn round and look at from every side */
export function PersonPreview({ look, name, who = L.me, size }: { look: AvatarLook; name: string; who?: PersonKey; size?: number }) {
  const { box, cv, stage, ready } = useStage([whoOf('me', who, look)]);
  return (
    <div className={`person-preview no-pan${ready ? ' ready' : ''}`} ref={box as RefObject<HTMLDivElement>} data-people={shownId(who, look)}
      style={size ? { width: Math.round(size * .6), height: size } : undefined}
      aria-label={`${name}, in 3D. Drag sideways to turn them round; tap to make them wave.`}>
      <span className="hp-draw" aria-hidden="true"><CharacterSvg look={look} size={150} still /></span>
      <canvas ref={cv} className="hp-c" aria-hidden="true" />
      <span className="hp-sr"><button type="button" onClick={() => stage.current?.act('me', 'wave')}>Make {name} wave</button></span>
    </div>
  );
}
