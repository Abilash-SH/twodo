'use client';
/* Twodo · first run without accounts: your two names and colours, then a few tips */
import { useRef, useState } from 'react';
import { haptic } from '@/lib/feedback';
import { L, save, seedLists, setPeople } from '@/lib/store';
import { applyTheme } from '@/lib/theme';
import { PALETTE, firstWord, type Color } from '@/lib/util';
import { boot, gateStore } from '@/ui/gate';
import { seedTasks } from '@/ui/seed';
import { colorVar } from '../ui/Avatar';
import { Logo, ObPages, useObPages } from './ObPages';

export function Onboarding() {
  const wrap = useRef<HTMLDivElement>(null);
  const { pages, setPages, show } = useObPages('welcome', ['welcome', 'names', 'ready']);
  const [st, setSt] = useState({ a: { name: '', color: 'blue' as Color }, b: { name: '', color: 'pink' as Color } });
  const [out, setOut] = useState(false);
  const go = (p: string) => { show(p); haptic('light'); };
  const colors = (k: 'a' | 'b') => <div className="colors sm" data-ck={k}>{PALETTE.slice(0, 10).map(c => <button key={c} type="button" style={colorVar(c)} className={c === st[k].color ? 'on' : ''} aria-label={c}
    onClick={() => { setSt(s => ({ ...s, [k]: { ...s[k], color: c } })); if (k === 'a') document.documentElement.style.setProperty('--accent', `var(--c-${c})`); haptic('light'); }} />)}</div>;
  const page = (name: string) => {
    if (name === 'welcome') return (<>
      <div className="ob-hero"><Logo /><h1>Twodo</h1><p className="lead">Your to-dos, together.<br />A little app made for the two of you.</p></div>
      <div className="ob-actions"><button className="btn" type="button" onClick={() => go('names')}>Get started</button></div></>);
    if (name === 'names') return (<>
      <h1>Who’s this for?</h1><p className="lead">Twodo is made for two. Add you both — you can change this any time.</p>
      <div className="ob-field"><label htmlFor="obA">Your name</label><input id="obA" placeholder="e.g. Alex" autoComplete="given-name" maxLength={24} defaultValue={st.a.name} onInput={e => { const v = e.currentTarget.value.trim(); setSt(s => ({ ...s, a: { ...s.a, name: v } })); }} />{colors('a')}</div>
      <div className="ob-field"><label htmlFor="obB">Your partner’s name</label><input id="obB" placeholder="e.g. Sam" maxLength={24} defaultValue={st.b.name} onInput={e => { const v = e.currentTarget.value.trim(); setSt(s => ({ ...s, b: { ...s.b, name: v } })); }} />{colors('b')}</div>
      <div className="spacer" /><button className="btn" type="button" disabled={!(st.a.name && st.b.name)} onClick={() => go('ready')}>Continue</button>
      <button className="btn ghost" type="button" onClick={() => go('welcome')}>Back</button></>);
    return (<>
      <h1>You’re all set, {firstWord(st.a.name)} 💞</h1><p className="lead">A few things that make Twodo feel like magic:</p>
      <ul className="tips">
        <li><span className="e">⌨️</span><div>Just type naturally<small>“Dinner with @{firstWord(st.b.name).toLowerCase()} fri 8pm !!” sets the person, date, time and priority.</small></div></li>
        <li><span className="e">👉</span><div>Swipe right to complete<small>Swipe left to pin or delete. Long-press for more.</small></div></li>
        <li><span className="e">💌</span><div>Pair with {firstWord(st.b.name)}<small>Settings → Together. Create accounts, then invite by username.</small></div></li>
        <li><span className="e">🎁</span><div>A Secret list<small>Never syncs — perfect for planning surprises.</small></div></li>
      </ul><div className="spacer" />
      <button className="btn" type="button" onClick={() => {
        L.me = 'a';
        setPeople({ name: st.a.name, color: st.a.color }, { name: st.b.name, color: st.b.color });
        seedLists(); seedTasks(); applyTheme(); haptic('success');
        setOut(true); setTimeout(() => gateStore.set(null), 600);
        L.onboarded = true; save(); boot.run();
      }}>Start using Twodo</button></>);
  };
  return <div id="ob" ref={wrap} className={out ? 'out' : undefined}><ObPages pages={pages} setPages={setPages} render={page} wrap={wrap} /></div>;
}
