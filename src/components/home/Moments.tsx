'use client';
/* Twodo · Moments on Home (lib/moments.ts, docs/moments.md): your partner's latest photo, big, and a shutter.
   One tap opens the camera; you see the picture once (with an optional caption) and send it. It appears on your
   partner's Home and their phone gets a notification. Tap a photo to look back through the ones this phone has. */
import { useState } from 'react';
import { haptic } from '@/lib/feedback';
import { Moments, momentEvents, photoForMoment } from '@/lib/moments';
import { L, partnerKey, person } from '@/lib/store';
import type { Moment, PersonKey } from '@/lib/types';
import { dayDiff, firstWord, todayStr, ymd } from '@/lib/util';
import { confirmDialog } from '@/ui/alert';
import { island } from '@/ui/island';
import { closeSheet, openSheet } from '@/ui/sheet';
import { openInviteSheet } from '../settings/AccountSheets';
import { colorVar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Portrait } from './Character';
import { homePeople } from './People';
import { avatarOf } from '@/lib/characters';

const paired = () => !!(L.pair && L.pair.status === 'paired');
const nameOf = (k: PersonKey) => (k === L.me ? 'You' : firstWord(person(k).name));
export function whenShared(at: number): string {
  const d = new Date(at), diff = dayDiff(todayStr(), ymd(d)), mins = Math.round((Date.now() - at) / 60e3);
  if (diff === 0 && mins < 1) return 'Just now';
  if (diff === 0 && mins < 60) return `${mins} min ago`;
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return diff === 0 ? `Today ${t}` : diff === 1 ? `Yesterday ${t}` : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Pick a picture: the camera (one tap) or your photos. The input is made inside the tap, as iOS requires. */
function pick(camera: boolean): void {
  if (!paired()) { openInviteSheet(); return; }
  document.querySelectorAll('input.mo-pick').forEach(x => x.remove()); // one left from a picker that was cancelled
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.className = 'mo-pick'; if (camera) inp.setAttribute('capture', 'environment');
  inp.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0';
  document.body.append(inp);
  inp.addEventListener('cancel', () => inp.remove());
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
    try { openSend(await photoForMoment(f)); }
    catch { island({ e: '⚠️', text: 'That photo couldn’t be used', sub: 'Try another one' }); }
  });
  inp.click();
}

function SendMoment({ img }: { img: string }) {
  const [caption, setCaption] = useState(''), [busy, setBusy] = useState(false), pt = firstWord(person(partnerKey()).name);
  const send = async () => {
    if (busy) return; setBusy(true);
    const m = await Moments.send(img, caption);
    if (!m) { setBusy(false); island({ e: '⚠️', text: 'That photo couldn’t be sent', sub: 'Try another one' }); return; }
    haptic('success'); closeSheet(); homePeople.act('me', 'photo'); // on Home, you take a photo
    island(navigator.onLine ? { e: '📸', text: `Sent to ${pt}`, ms: 2200 } : { e: '📸', text: `${pt} gets it when you’re online`, ms: 2600 });
  };
  return (
    <div className="mo-send">
      <img className="mo-send-img" src={img} alt="Your moment" />
      <input className="inp mo-caption" type="text" maxLength={80} placeholder="Add a caption (optional)" aria-label="Caption"
        value={caption} onChange={e => setCaption(e.currentTarget.value)} enterKeyHint="send" onKeyDown={e => { if (e.key === 'Enter') void send(); }} />
      <button type="button" className="btn mo-send-btn" disabled={busy} onClick={() => void send()}><Icon name="arrowUp" />Send to {pt}</button>
    </div>
  );
}
const openSend = (img: string) => openSheet({ title: 'Share a moment', right: '', body: <SendMoment img={img} /> });

function MomentList() {
  const list = Moments.history, mine = Moments.of(L.me);
  if (!list.length) return <p className="mo-none">No moments yet. Tap the shutter on Home to share one.</p>;
  return (
    <div className="mo-list">
      {list.map(m => (
        <figure key={`${m.who}-${m.at}`} className="mo-item" style={colorVar(person(m.who).color)}>
          <img src={m.img} alt={`${nameOf(m.who)}’s moment`} loading="lazy" decoding="async" />
          <figcaption>
            <b>{nameOf(m.who)}</b><span>{whenShared(m.at)}</span>
            {m.caption ? <q>{m.caption}</q> : null}
            {mine && m === mine ? (
              <button type="button" className="mo-remove" onClick={async () => {
                if (!(await confirmDialog({ title: 'Remove this moment?', message: `It goes from ${firstWord(person(partnerKey()).name)}’s phone too.`, ok: 'Remove', destructive: true }))) return;
                await Moments.remove(); closeSheet(); haptic('light');
              }}>Remove</button>
            ) : null}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
export const openMoments = () => openSheet({ title: 'Moments', right: 'Done', tall: true, body: <MomentList /> });

// your partner's moment arrives while the app is open: a line on the island
momentEvents.onArrive = (m: Moment) => {
  haptic('light'); homePeople.act('pt', 'photo');
  island({ e: '📸', text: `${firstWord(person(m.who).name)} shared a moment`, sub: m.caption || '', btn: 'See', onBtn: openMoments, ms: 4200 });
};

/** Home's moments: your partner's latest, big; under it your last one, the shutter and your photos */
export function HomeMoments({ v }: { v: number }) {
  void v;
  const ok = paired(), pk = partnerKey(), pt = firstWord(person(pk).name), theirs = Moments.of(pk), mine = Moments.of(L.me);
  return (
    <section className="home-moments" aria-label="Moments">
      <h2 className="home-h">{ok ? `Moments with ${pt}` : 'Moments'}</h2>
      <button type="button" className={`mo-card${theirs ? '' : ' empty'}`} style={colorVar(person(pk).color)}
        onClick={() => (ok ? openMoments() : openInviteSheet())}
        aria-label={theirs ? `${pt}’s moment, ${whenShared(theirs.at)}${theirs.caption ? `: ${theirs.caption}` : ''}. Opens your moments` : ok ? `${pt} hasn’t shared a moment yet` : 'Add your partner to share moments'}>
        {theirs ? <img src={theirs.img} alt="" decoding="async" /> : <span className="mo-empty"><Icon name="camera" /><span>{ok ? `${pt}’s moments appear here` : 'Add your partner to share moments'}</span></span>}
        {theirs ? (
          <span className="mo-meta">
            <span className="mo-who"><Portrait look={avatarOf(pk)} who={pk} size={26} /><b>{pt}</b><span>{whenShared(theirs.at)}</span></span>
            {theirs.caption ? <span className="mo-cap">{theirs.caption}</span> : null}
          </span>
        ) : null}
      </button>
      <div className="mo-bar">
        {mine ? (
          <button type="button" className="mo-mine" onClick={() => openMoments()} style={colorVar(person(L.me).color)} aria-label={`Your last moment, ${whenShared(mine.at)}`}>
            <img src={mine.img} alt="" decoding="async" />
          </button>
        ) : <span className="mo-mine-none" aria-hidden="true" />}
        <button type="button" className="mo-shutter" onClick={() => { haptic('light'); pick(true); }} aria-label={ok ? `Take a photo for ${pt}` : 'Add your partner to share moments'}>
          <span className="mo-shutter-in" aria-hidden="true" />
        </button>
        <button type="button" className="mo-lib" onClick={() => pick(false)} aria-label="Share one of your photos"><Icon name="images" /></button>
      </div>
    </section>
  );
}
