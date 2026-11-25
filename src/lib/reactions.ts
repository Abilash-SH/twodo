/* Twodo · reactions sent from Home (2026-11-18: "not in the chat, something reactive"). A reaction is never a message:
   it rides, encrypted, on your live presence record (/spaces/{space}/c/e/x/{uid}, field `poke`), plays on your
   partner's screen as a burst of that emoji if their app is open (or opens within a minute), and is gone.
   2026-11-25: Home shares Moments instead (lib/moments.ts), so nothing here sends one any more. Receiving stays,
   so a partner still on an older version can send one, and the burst is still used by the chat. */
import { haptic } from './feedback';
import { reducedMotion } from './util';

export const REACTIONS = [
  { e: '❤️', label: 'Love', verb: 'sent you love' }, { e: '🤗', label: 'Hug', verb: 'sent you a hug' },
  { e: '😘', label: 'Kiss', verb: 'sent you a kiss' }, { e: '🥺', label: 'Miss you', verb: 'misses you' },
  { e: '😂', label: 'Haha', verb: 'is laughing with you' }, { e: '✨', label: 'Proud', verb: 'is proud of you' },
] as const;
export type ReactionEmoji = typeof REACTIONS[number]['e'];
export const isReaction = (e: unknown): e is ReactionEmoji => REACTIONS.some(r => r.e === e);
export const reactionOf = (e: ReactionEmoji) => REACTIONS.find(r => r.e === e)!;
/** how long a reaction stays deliverable: an app opened within this time still plays it */
export const POKE_MS = 60e3;

/** A burst of one emoji over the whole screen: they rise from the bottom (or from `from`), drift and fade.
 *  Transform and opacity only; with Reduce Motion one big emoji fades in and out. Never takes taps. */
export function playEmojiBurst(e: string, { from = null as { x: number; y: number } | null, count = 22 } = {}): void {
  if (typeof document === 'undefined') return;
  const layer = document.createElement('div');
  layer.className = 'fx-layer react-burst'; layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  const W = innerWidth, H = innerHeight, done: Promise<unknown>[] = [];
  if (reducedMotion.matches) {
    const s = document.createElement('span'); s.className = 'rb-e rb-big'; s.textContent = e;
    s.style.left = `${W / 2 - 60}px`; s.style.top = `${H / 2 - 60}px`; layer.appendChild(s);
    done.push(s.animate([{ opacity: 0 }, { opacity: 1, offset: .25 }, { opacity: 1, offset: .75 }, { opacity: 0 }], { duration: 1400 }).finished);
  } else {
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span'); s.className = 'rb-e'; s.textContent = e;
      const size = 28 + Math.random() * 34, x0 = from ? from.x : Math.random() * W, y0 = from ? from.y : H + 20;
      const dx = (from ? (Math.random() - .5) * W * .9 : (Math.random() - .5) * 120), dy = -(from ? 160 + Math.random() * H * .5 : H * (.55 + Math.random() * .45));
      const rot = (Math.random() - .5) * 70, delay = Math.random() * (from ? 120 : 650), dur = 1500 + Math.random() * 900;
      s.style.fontSize = `${size}px`; s.style.left = `${x0 - size / 2}px`; s.style.top = `${y0 - size / 2}px`;
      layer.appendChild(s);
      done.push(s.animate([
        { transform: 'translate(0, 0) scale(.4) rotate(0deg)', opacity: 0 },
        { transform: `translate(${dx * .25}px, ${dy * .25}px) scale(1.1) rotate(${rot * .3}deg)`, opacity: 1, offset: .2 },
        { transform: `translate(${dx * .8}px, ${dy * .8}px) scale(1) rotate(${rot * .8}deg)`, opacity: 1, offset: .75 },
        { transform: `translate(${dx}px, ${dy}px) scale(.9) rotate(${rot}deg)`, opacity: 0 }],
        { duration: dur, delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }).finished);
    }
  }
  Promise.allSettled(done).then(() => layer.remove());
  haptic('success');
}
