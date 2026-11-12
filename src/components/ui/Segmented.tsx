/* Twodo · segmented control (iOS style, with a sliding thumb) */
import { useEffect, useState, type ReactNode } from 'react';
import { haptic } from '@/lib/feedback';
import { cssVars } from './Avatar';

export function Segmented({ name, opts, value, onChange, cls = '' }: {
  name: string; opts: [string, ReactNode][]; value: string; onChange: (v: string) => void; cls?: string;
}) {
  const [cur, setCur] = useState(value);
  useEffect(() => { setCur(value); }, [value]);
  const i = Math.max(0, opts.findIndex(o => o[0] === cur));
  return (
    <div className={`seg ${cls}`.trim()} data-seg={name} role="tablist" style={cssVars({ '--n': opts.length, '--i': i })}>
      <span className="thumb" />
      {opts.map(([v, l]) => (
        <button key={v} type="button" role="tab" data-v={v} className={v === cur ? 'on' : ''} aria-selected={v === cur}
          onClick={() => { setCur(v); haptic('light'); onChange(v); }}>{l}</button>
      ))}
    </div>
  );
}
