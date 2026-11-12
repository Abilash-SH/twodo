'use client';
/* Twodo · Love You: when you both say it, the two of you meet in the middle of the screen */
import { useEffect, useMemo, useRef, useState } from 'react';
import { chatSound, haptic } from '@/lib/feedback';
import { L, partnerKey } from '@/lib/store';
import { reducedMotion } from '@/lib/util';
import { useStore } from '@/ui/store';
import { Avatar, cssVars } from '../ui/Avatar';
import { ChatCtl, loveStore } from './chatCtl';

const HEART = 'M12 20.3s-7.6-4.6-9.4-9.3C1.4 7.6 3.7 4.3 7.1 4.3c2 0 3.6 1.1 4.9 2.8 1.3-1.7 2.9-2.8 4.9-2.8 3.4 0 5.7 3.3 4.5 6.7-1.8 4.7-9.4 9.3-9.4 9.3z';
function Layer({ ids, done }: { ids: string[]; done: () => void }) {
  const calm = reducedMotion.matches;
  const [out, setOut] = useState(false);
  const doneRef = useRef(done); doneRef.current = done;
  const parts = useMemo(() => (calm ? [] : Array.from({ length: 28 }, (_, i) => ({
    i, x: (Math.random() * 90 - 45).toFixed(1), dx: (Math.random() * 40 - 20).toFixed(1), s: (0.55 + Math.random() * 1.0).toFixed(2),
    d: (2.1 + Math.random() * 1.7).toFixed(2), dl: (1.25 + Math.random() * 1.1).toFixed(2), r: (Math.random() * 50 - 25).toFixed(0),
  }))), [calm]);
  useEffect(() => {
    // the two messages glow while it plays
    const els = ids.map(id => ChatCtl.el(id)).filter((e): e is HTMLElement => !!e);
    els.forEach(el => el.classList.add('ly-on'));
    const t0 = setTimeout(() => els.forEach(el => el.classList.remove('ly-on')), 3600);
    chatSound('love');
    const hs = [0, 700, 1250, 1800].map((t, i) => setTimeout(() => haptic(i === 0 ? 'success' : 'light'), t + 600));
    const t1 = setTimeout(() => setOut(true), calm ? 1800 : 3900), t2 = setTimeout(() => doneRef.current(), calm ? 2200 : 4500);
    return () => { [t0, t1, t2, ...hs].forEach(clearTimeout); };
  }, [ids, calm]);
  return (
    <div className={`ly-layer${calm ? ' calm' : ''}${out ? ' out' : ''}`}>
      <div className="ly-glow" />
      <div className="ly-stage">
        <div className="ly-av l"><Avatar k={partnerKey()} /></div>
        <div className="ly-heart"><i className="ly-ring" /><i className="ly-ring r2" />
          <svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="lyG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="lb-s1" /><stop offset="1" className="lb-s2" /></linearGradient></defs>
            <path d={HEART} fill="url(#lyG)" /></svg></div>
        <div className="ly-av r"><Avatar k={L.me} /></div>
      </div>
      {parts.map(p => <i key={p.i} className={`ly-p c${p.i % 3}`} style={cssVars({ '--x': p.x + 'vw', '--dx': p.dx + 'vw', '--s': p.s, '--d': p.d + 's', '--dl': p.dl + 's', '--r': p.r + 'deg' })}>♥</i>)}
      <div className="ly-cap">You both said it</div>
    </div>
  );
}
export function LoveYou() {
  const cur = useStore(loveStore);
  if (!cur) return null;
  return <Layer key={cur.seq} ids={cur.ids} done={() => loveStore.set(null)} />;
}
