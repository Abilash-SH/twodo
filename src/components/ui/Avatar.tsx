/* Twodo · round avatars: your photo, or your initial on your colour */
import type { CSSProperties } from 'react';
import { person } from '@/lib/store';
import type { Assignee, PersonKey } from '@/lib/types';
import { initial } from '@/lib/util';

export const cssVars = (v: Record<string, string | number>): CSSProperties => v as CSSProperties;
export const colorVar = (c: string): CSSProperties => cssVars({ '--c': `var(--c-${c})` });

export function Avatar({ k, cls = '', eager = false }: { k: PersonKey; cls?: string; eager?: boolean }) {
  const p = person(k);
  return (
    <span className={`av ${cls}${p.photo ? ' ph' : ''}`} style={colorVar(p.color)} title={p.name}>
      {initial(p.name)}
      {/* Photos are sanitized data URLs. Lazy loading defers offscreen decoding;
          the envelope was already synced, so it cannot save network bytes. */}
      {p.photo ? <img src={p.photo} alt="" width={96} height={96} loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} /> : null}
    </span>
  );
}
/** an avatar for someone who isn't one of you two yet (a partner request) */
export function PlainAvatar({ name, color, style }: { name: string; color: string; style?: CSSProperties }) {
  return <span className="av" style={{ ...colorVar(color), ...style }}>{initial(name)}</span>;
}
export function AssigneeBadge({ a }: { a: Assignee | undefined }) {
  if (!a) return null;
  if (a === 'both') return <span className="av-pair" title="Both of you"><Avatar k="a" /><Avatar k="b" /></span>;
  return <Avatar k={a} />;
}
export function Sq({ c, i }: { c: string; i: string }) {
  return <span className="sq" style={colorVar(c)}><IconLazy name={i} /></span>;
}
import { Icon as IconLazy } from './Icon';
