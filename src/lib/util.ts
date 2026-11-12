/* Twodo · small shared helpers (dates, text, platform) */

export const uid = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
export const pad = (n: number): string => String(n).padStart(2, '0');
export const ymd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromYmd = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d: Date, n: number): Date => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const todayStr = (): string => ymd(new Date());
export const dayDiff = (a: string, b: string): number => Math.round((fromYmd(a).getTime() - fromYmd(b).getTime()) / 864e5);
export const nowHM = (): string => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const firstWord = (s: unknown): string => String(s || '').trim().split(/\s+/)[0] || '';
export const initial = (n: unknown): string => (Array.from(String(n || '?').trim())[0] || '?').toUpperCase();
export const shortName = (n: string, max = 7): string => { const f = firstWord(n); return f.length > max ? f.slice(0, max - 1) + '…' : f; };

/* ---------- platform (only ever evaluated in the browser: the app renders client-side) ---------- */
const mq = (q: string) => typeof matchMedia === 'function' && matchMedia(q);
export const reducedMotion = { get matches() { const m = mq('(prefers-reduced-motion: reduce)'); return !!m && m.matches; } };
export const isTouch = (): boolean => { const m = mq('(hover: none)'); return !!m && m.matches; };
export const isIOS = (): boolean => typeof navigator !== 'undefined'
  && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const standalone = (): boolean => { const m = mq('(display-mode: standalone)'); return (!!m && m.matches) || (navigator as Navigator & { standalone?: boolean }).standalone === true; };

export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
export const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export const PALETTE = ['blue', 'indigo', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'mint', 'teal', 'brown', 'gray'] as const;
export type Color = (typeof PALETTE)[number];
export const EMOJIS = ['📥', '🛒', '🏠', '✨', '🎁', '💼', '📚', '💪', '🍳', '✈️', '🎬', '💡', '🧹', '💊', '🐶', '🌱',
  '🎉', '💰', '🎮', '🎵', '📸', '🚗', '❤️', '⭐️', '🧺', '🍿', '🏖️', '🛠️', '📝', '🌙', '☕️', '🎨'];
export const REPEATS = { daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly', yearly: 'Yearly' } as const;
export type Repeat = keyof typeof REPEATS;
export const PRIO_COLOR: readonly ('' | Color)[] = ['', 'blue', 'orange', 'red'];
export const PRIO_NAME = ['None', 'Low', 'Medium', 'High'] as const;

/* ---------- files & clipboard ---------- */
export function downloadFile(name: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove(); return ok;
  }
}
