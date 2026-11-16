'use client';
/* Twodo · full-screen pages that slide left and right (onboarding and the sign-in gate) */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface Page { name: string; id: number; cls: '' | 'left' | 'right'; leaving: boolean }
export function useObPages(first: string, order: string[]) {
  const [pages, setPages] = useState<Page[]>([{ name: first, id: 1, cls: '', leaving: false }]);
  const seq = useRef(1), cur = pages.filter(p => !p.leaving).slice(-1)[0];
  const show = (name: string) => {
    const back = order.indexOf(name) < order.indexOf(cur.name);
    setPages(ps => [...ps.filter(p => !p.leaving).map(p => ({ ...p, cls: (back ? 'right' : 'left') as Page['cls'], leaving: true })), { name, id: ++seq.current, cls: back ? 'left' : 'right', leaving: false }]);
    setTimeout(() => setPages(ps => ps.filter(p => !p.leaving)), 600);
  };
  return { pages, setPages, cur: cur.name, show };
}
export function ObPages({ pages, setPages, render, wrap }: {
  pages: Page[]; setPages: (f: (p: Page[]) => Page[]) => void; render: (name: string) => ReactNode; wrap: React.RefObject<HTMLDivElement | null>;
}) {
  // a new page starts off to one side; once the browser has seen it there, it slides in
  useLayoutEffect(() => {
    if (!pages.some(p => !p.leaving && p.cls)) return;
    void wrap.current?.offsetWidth;
    setPages(ps => ps.map(p => (!p.leaving && p.cls ? { ...p, cls: '' } : p)));
  }, [pages, setPages, wrap]);
  return <>{pages.map(p => <div key={p.id} className={`ob-page ${p.cls}`.trim()} data-p={p.name}>{render(p.name)}</div>)}</>;
}
/** Two hearts that come together: the same mark as the launch screen */
const HEART = 'M0 30 C -26 13 -36 -3 -36 -15 C -36 -27 -27 -35 -17 -35 C -9 -35 -3 -31 0 -24 C 3 -31 9 -35 17 -35 C 27 -35 36 -27 36 -15 C 36 -3 26 13 0 30 Z';
export const Logo = () => (
  <svg className="ob-logo" viewBox="0 0 160 100" aria-hidden="true">
    <g transform="translate(60 52)"><path className="h1" d={HEART} /></g>
    <g transform="translate(100 52)"><path className="h2" d={HEART} /></g>
  </svg>
);
