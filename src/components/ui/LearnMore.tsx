'use client';
/* Twodo · a "Learn more" row at the end of a settings group: the long explanation stays one tap away */
import { useState } from 'react';
import { haptic } from '@/lib/feedback';
import { Icon } from './Icon';

export function LearnMore({ label = 'Learn more', children }: { label?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (<>
    <button className={`cell learn${open ? ' open' : ''}`} type="button" aria-expanded={open} onClick={() => { setOpen(o => !o); haptic('light'); }}>
      <span className="grow">{label}</span><Icon name="chevD" cls="chev" /></button>
    {open ? <div className="learn-body">{children}</div> : null}
  </>);
}
