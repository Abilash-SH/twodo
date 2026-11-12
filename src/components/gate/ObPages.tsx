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
export const Logo = () => (
  <svg className="ob-logo" viewBox="0 0 150 110" aria-hidden="true"><circle className="c1" cx="56" cy="55" r="40" fill="var(--c-blue)" opacity=".92" /><circle className="c2" cx="94" cy="55" r="40" fill="var(--c-pink)" opacity=".85" />
    <path className="ck" d="M58 56l12 12 24-26" stroke="#fff" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
