'use client';
/* Twodo · photo viewer: the picture flies up from where you tapped it; drag it away or tap outside to close */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSwipeAway } from '@/hooks/swipe';
import { L, person } from '@/lib/store';
import { reducedMotion } from '@/lib/util';
import { PhotoView, photoStore, pickPhoto, setPhoto } from '@/ui/photos';
import { useStore } from '@/ui/store';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';

const ease = 'cubic-bezier(.32,.72,0,1)';
export function PhotoViewer() {
  const cur = useStore(photoStore);
  const [on, setOn] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useSwipeAway(root, { enabled: !!cur, down: true, onClose: () => { PhotoView.close = null; setOn(false); photoStore.set(null); } });
  const img = useRef<HTMLDivElement>(null), bg = useRef<HTMLDivElement>(null), closing = useRef(false), drag = useRef<{ x0: number; y0: number; id: number; d: number } | null>(null);
  const fromT = () => {
    const el = cur && cur.from, i = img.current;
    if (!el || !el.isConnected || !i) return 'scale(.6)';
    const a = el.getBoundingClientRect(), b = i.getBoundingClientRect();
    return `translate(${a.left + a.width / 2 - (b.left + b.width / 2)}px, ${a.top + a.height / 2 - (b.top + b.height / 2)}px) scale(${a.width / b.width})`;
  };
  const close = (after?: () => void) => {
    if (closing.current) return; closing.current = true; PhotoView.close = null;
    setOn(false);
    const i = img.current;
    const t = i ? getComputedStyle(i).transform : 'none';
    const anim = reducedMotion.matches || !i ? null : i.animate([{ transform: t === 'none' ? 'none' : t }, { transform: fromT() }], { duration: 380, easing: ease, fill: 'forwards' });
    const done = () => { photoStore.set(null); if (after) after(); };
    if (anim) anim.onfinish = done; else setTimeout(done, 200);
  };
  useLayoutEffect(() => {
    if (!cur) return;
    closing.current = false;
    if (!reducedMotion.matches && img.current) img.current.animate([{ transform: fromT() }, { transform: 'none' }], { duration: 480, easing: ease });
    const r = requestAnimationFrame(() => setOn(true));
    PhotoView.close = () => close();
    return () => cancelAnimationFrame(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur && cur.seq]);
  useEffect(() => () => { PhotoView.close = null; }, []);
  if (!cur) return null;
  const k = cur.k, p = person(k), mine = k === L.me;
  return (
    <div ref={root} className={`pv${on ? ' on' : ''}`} role="dialog" aria-label={p.name}
      onClick={e => { if (!(e.target as HTMLElement).closest('.pv-acts, .pv-img, .pv-x')) close(); }}
      onPointerDown={e => { if (e.pointerType !== 'mouse') return; if (!(e.target as HTMLElement).closest('button')) drag.current = { x0: e.clientX, y0: e.clientY, id: e.pointerId, d: 0 }; }}
      onPointerMove={e => { // drag it away in any direction (down, or right like going back)
        const d = drag.current; if (e.pointerType !== 'mouse' || !d || e.pointerId !== d.id || !img.current) return;
        const x = e.clientX - d.x0, y = e.clientY - d.y0; d.d = Math.hypot(x, y);
        img.current.style.transform = `translate(${x}px, ${y}px) scale(${1 - Math.min(d.d, 300) / 1200})`;
        if (bg.current) bg.current.style.opacity = String(1 - Math.min(d.d, 300) / 400);
      }}
      onPointerUp={e => { if (e.pointerType === 'mouse') endDrag(e.pointerId); }} onPointerCancel={e => { if (e.pointerType === 'mouse') endDrag(e.pointerId, true); }}>
      <div ref={bg} className="pv-bg" />
      <button className="pv-x" type="button" aria-label="Close" onClick={() => close()}><Icon name="x" /></button>
      <div className="pv-main"><div ref={img} className="pv-img"><Avatar k={k} /></div><div className="pv-name">{p.name}</div>
        {mine ? <div className="pv-acts">
          <button className="pv-b" type="button" onClick={() => close(() => pickPhoto(k))}><Icon name="camera" /><span>{p.photo ? 'Change' : 'Add photo'}</span></button>
          {p.photo ? <button className="pv-b red" type="button" onClick={() => close(() => setPhoto(k, null))}><Icon name="trash" /><span>Remove</span></button> : null}
        </div> : null}</div>
    </div>
  );
  function endDrag(id: number, cancel = false) {
    const d = drag.current; if (!d || id !== d.id) return;
    const dist = d.d; drag.current = null;
    const i = img.current; if (!i) return;
    if (!cancel && dist > 80) { i.style.transform = ''; close(); return; }
    i.style.transition = 'transform .35s cubic-bezier(.34,1.56,.64,1)'; i.style.transform = ''; if (bg.current) bg.current.style.opacity = '';
    setTimeout(() => { i.style.transition = ''; }, 360);
  }
}
