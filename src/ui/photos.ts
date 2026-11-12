/* Twodo · profile photos: cropped square on this phone, synced end-to-end encrypted like everything else.
   Tap any picture to see it big; only your own can be changed. */
import { cloudReady } from '@/lib/config';
import { haptic } from '@/lib/feedback';
import { scheduleRender } from '@/lib/render';
import { D, L, PHOTO_RE, commit, myName, person, ptName } from '@/lib/store';
import { applyTheme } from '@/lib/theme';
import type { PersonKey } from '@/lib/types';
import { firstWord } from '@/lib/util';
import { island } from './island';
import { createStore } from './store';

export const photoStore = createStore<{ k: PersonKey; from: HTMLElement | null; seq: number } | null>(null);
export const PhotoView = { close: null as null | (() => void) };
let seq = 0;
export function viewPhoto(k: PersonKey, fromEl: HTMLElement | null): void {
  if (PhotoView.close || photoStore.get()) return;
  const mine = k === L.me, paired = !!(L.pair && L.pair.status === 'paired');
  if (!mine && !paired && cloudReady()) return;
  photoStore.set({ k, from: fromEl, seq: ++seq });
  haptic('light');
}
export function pickPhoto(k: PersonKey): void {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0';
  document.body.append(inp);
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
    try { setPhoto(k, await squarePhoto(f, 360)); }
    catch { island({ e: '⚠️', text: 'That photo couldn’t be used', sub: 'Try another one' }); }
  });
  inp.click();
}
function squarePhoto(file: File, size: number): Promise<string> {
  return new Promise((res, rej) => {
    const src = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      try {
        const s = Math.min(img.naturalWidth, img.naturalHeight); if (!s) throw new Error('empty');
        const c = document.createElement('canvas'); c.width = c.height = size;
        const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high';
        x.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        let q = 0.84, url = c.toDataURL('image/jpeg', q);
        while (url.length > 42000 && q > 0.5) { q -= 0.08; url = c.toDataURL('image/jpeg', q); } // keep the synced record small
        if (!PHOTO_RE.test(url)) throw new Error('bad output');
        res(url);
      } catch (e) { rej(e); } finally { URL.revokeObjectURL(src); }
    };
    img.onerror = () => { URL.revokeObjectURL(src); rej(new Error('bad image')); };
    img.src = src;
  });
}
export function setPhoto(k: PersonKey, photo: string | null): void {
  if (k !== L.me) return; // only your own photo can be changed
  const p = { ...person(k) };
  if (photo) p.photo = photo; else delete p.photo;
  D.people![k] = p; commit(D.people!);
  applyTheme(); scheduleRender(); haptic('success');
  island({ e: photo ? '📸' : '🗑️', text: photo ? 'Photo updated' : 'Photo removed', sub: photo && cloudReady() && L.pair && L.pair.status === 'paired' ? `${firstWord(k === L.me ? ptName() : myName())} will see it too` : '', ms: 1800 });
}
