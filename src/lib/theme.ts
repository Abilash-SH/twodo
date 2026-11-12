/* Twodo · theme: light/dark, and one colour per person (yours is the accent and your bubbles; your partner's tints theirs) */
import { D, L, partnerKey, person } from './store';
import type { PersonKey } from './types';

export function applyTheme(): void {
  const s = L.settings;
  const dark = s.theme === 'dark' || (s.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  const mc = person(L.me).color || 'blue', pc = person(partnerKey()).color || 'pink';
  root.style.setProperty('--accent', `var(--c-${mc})`);
  root.style.setProperty('--me-c', `var(--c-${mc})`);
  root.style.setProperty('--pt-c', `var(--c-${pc})`);
  root.style.setProperty('--me-ink', ['yellow', 'mint', 'green', 'orange'].includes(mc) ? '#16151A' : '#fff');
  for (const k of ['a', 'b'] as PersonKey[]) { // profile photos, kept once as CSS variables (already checked to be data:image URLs)
    const ph = D.people && D.people[k] && D.people[k].photo;
    if (ph) root.style.setProperty('--ph-' + k, `url("${ph}")`); else root.style.removeProperty('--ph-' + k);
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = document.body.classList.contains('launching') ? '#E98BB1' : dark ? '#0D0C10' : '#FAF8FB';
}
if (typeof window !== 'undefined') matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
