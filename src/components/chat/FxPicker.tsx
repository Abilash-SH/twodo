'use client';
/* Twodo · "Send with effect": hold the send arrow, preview a bubble or screen effect, tap ↑ to send it */
import { useEffect, useMemo, useRef, useState } from 'react';
import { haptic } from '@/lib/feedback';
import { FX, Ink, playBubbleFx, playScreenFx } from '@/lib/fx';
import { useStore } from '@/ui/store';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { ChatCtl, fxPickerStore } from './chatCtl';

function Picker({ text, close }: { text: string; close: (send?: string) => void }) {
  const [tab, setTab] = useState<'bubble' | 'screen'>('bubble'), [sel, setSel] = useState<string | null>(null), [on, setOn] = useState(false);
  const prev = useRef<HTMLDivElement>(null), bub = useRef<HTMLDivElement>(null), seq = useRef(0);
  useEffect(() => { const r = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(r); }, []);
  const pick = (k: string) => {
    setSel(k); haptic('light'); seq.current++;
    const b = bub.current!, p = prev.current!;
    Ink.detach(b); b.classList.toggle('ink', k === 'ink');
    if (k === 'ink') Ink.attach(b);
    else if (FX.isBubble(k)) playBubbleFx(p, k, null);
    else playScreenFx(k, { from: ChatCtl.center(p), text, mine: true });
  };
  const rows = useMemo(() => FX[tab], [tab]);
  return (
    <div className={`fxp${on ? ' on' : ''}`}>
      <div className="fxp-bg" onClick={() => close()} />
      <div className="fxp-top"><h3>Send with effect</h3>
        <Segmented name="fxtab" opts={[['bubble', 'Bubble'], ['screen', 'Screen']]} value={tab} onChange={v => { setTab(v as 'bubble' | 'screen'); setSel(null); haptic('light'); }} /></div>
      <div className="fxp-list">{rows.map(([k, l]) => (
        <button key={k} className={`fxp-row${sel === k ? ' on' : ''}`} type="button" onClick={e => {
          if ((e.target as HTMLElement).closest('[data-go]') && sel === k) { close(k); return; }
          pick(k);
        }}><span>{l}</span><span className="fxp-go" data-go={k}><Icon name="arrowUp" /></span></button>))}</div>
      <div className="fxp-prev"><div ref={prev} className="bwrap"><div ref={bub} className="bub me">{text}</div></div></div>
      <button className="fxp-x" type="button" aria-label="Cancel" onClick={() => close()}><Icon name="x" /></button>
    </div>
  );
}
export function FxPicker() {
  const cur = useStore(fxPickerStore);
  const [closing, setClosing] = useState(false);
  if (!cur) return null;
  const close = (send?: string) => {
    if (closing) return;
    setClosing(true);
    document.querySelector('.fxp')?.classList.remove('on');
    setTimeout(() => { fxPickerStore.set(null); setClosing(false); }, 320);
    if (send) ChatCtl.sendNow(cur.text, send);
  };
  return <Picker key={cur.seq} text={cur.text} close={close} />;
}
export const fxPickerOpen = (): boolean => !!fxPickerStore.get();
