/* Twodo · theme: light/dark, and one colour per person (yours is the accent and your bubbles; your partner's tints theirs) */
import { L, partnerKey, person } from './store';

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
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  // the status bar area matches the app's own background (on iOS versions that don't draw the app behind it,
  // the system fills it with this colour)
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (meta) meta.content = document.body.classList.contains('launching') ? '#E98BB1' : bg || (dark ? '#000000' : '#F2F2F7');
}
if (typeof window !== 'undefined') matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
