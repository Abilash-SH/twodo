/* Twodo · feedback: haptics, tiny WebAudio sounds (no files), confetti */
import { L } from './store';
import { reducedMotion } from './util';

/* ---------- Haptics ----------
   Android: Vibration API. iOS 18+: toggling a hidden <input switch> produces a system haptic. */
export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warn';
export function haptic(kind: HapticKind = 'light'): void {
  if (!L.settings.haptics) return;
  try {
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua && !ua.hasBeenActive) return; // browsers ignore (and complain about) vibration before the first tap
    if (navigator.vibrate) navigator.vibrate({ light: 8, medium: 14, heavy: 22, success: [8, 50, 12], warn: [14, 40, 14] }[kind] || 8);
    else document.getElementById('haptic')?.click();
  } catch { /* ignore */ }
}

/* ---------- Sounds ---------- */
type AC = typeof AudioContext;
let audioCtx: AudioContext | null = null;
function ctx(): AudioContext {
  audioCtx = audioCtx || new ((window.AudioContext || (window as unknown as { webkitAudioContext: AC }).webkitAudioContext) as AC)();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}
// iPhones only allow sound after a tap: wake the audio once on the first touch
if (typeof window !== 'undefined') addEventListener('pointerdown', () => { try { ctx(); } catch { /* ignore */ } }, { once: true, capture: true });

export type BlipKind = 'done' | 'add' | 'chime' | 'pop';
export function blip(kind: BlipKind = 'done'): void {
  if (!L.settings.sounds) return;
  try {
    const ac = ctx(), t = ac.currentTime;
    const notes = { done: [880, 1318.5], add: [660], chime: [659.3, 880, 1108.7], pop: [520] }[kind] || [660];
    notes.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const s = t + i * 0.075;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(kind === 'add' ? 0.05 : 0.09, s + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, s + (kind === 'chime' ? 0.5 : 0.2));
      o.connect(g).connect(ac.destination);
      o.start(s); o.stop(s + 0.55);
    });
  } catch { /* ignore */ }
}
// Soft, warm two-note chimes: rising when you send, gently falling when a message arrives, an arpeggio for "love you"
export function chatSound(kind: 'send' | 'recv' | 'love'): void {
  if (!L.settings.sounds) return;
  try {
    const ac = ctx(), t0 = ac.currentTime + 0.01;
    const out = ac.createGain(); out.gain.value = kind === 'send' ? 0.05 : 0.06;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
    out.connect(lp).connect(ac.destination);
    const note = (f: number, at: number, dur: number) => {
      for (const [mult, amp, type] of [[1, 1, 'sine'], [2, 0.18, 'sine'], [1, 0.12, 'triangle']] as const) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.value = f * mult;
        g.gain.setValueAtTime(0.0001, t0 + at);
        g.gain.exponentialRampToValueAtTime(amp, t0 + at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        o.connect(g).connect(out); o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
      }
    };
    if (kind === 'love') { out.gain.value = 0.045; ([[1047, 0, .6], [1319, .11, .6], [1568, .22, .7], [2093, .36, 1.1]] as const).forEach(([f, a, d]) => note(f, a, d)); }
    else if (kind === 'send') { note(784, 0, 0.22); note(1175, 0.06, 0.32); }     // G5 → D6
    else { note(1047, 0, 0.5); note(784, 0.11, 0.62); }                          // C6 → G5
  } catch { /* no audio */ }
}

/* ---------- Confetti ---------- */
export function confetti(): void {
  if (!L.settings.confetti || reducedMotion.matches) return;
  const c = document.createElement('canvas'); c.id = 'confetti'; document.body.append(c);
  const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
  const x = c.getContext('2d')!; x.scale(dpr, dpr);
  const cols = ['#F2A3C0', '#F5BE95', '#F3DA8F', '#9AD8B3', '#9DB7F0', '#C9A9EA', '#A6DAF2'];
  const P = Array.from({ length: 160 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 80, y: H * 0.32,
    vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 4,
    r: Math.random() * 6 + 5, c: cols[(Math.random() * cols.length) | 0],
    a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, rect: Math.random() < 0.6,
  }));
  const t0 = performance.now(), dur = 2800;
  (function frame(now: number) {
    const t = now - t0;
    x.clearRect(0, 0, W, H);
    for (const p of P) {
      p.vy += 0.33; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.a += p.va;
      x.save(); x.globalAlpha = Math.max(0, 1 - t / dur); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c;
      if (p.rect) x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); else { x.beginPath(); x.arc(0, 0, p.r / 2.6, 0, 7); x.fill(); }
      x.restore();
    }
    if (t < dur) requestAnimationFrame(frame); else c.remove();
  })(t0);
}
