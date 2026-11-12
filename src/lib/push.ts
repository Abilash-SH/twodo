/* Twodo · push reminders
   For each task with a date + time, the phone writes /rem/{space}/{taskId} = { at, to, d } where d is the
   title encrypted with the space key. A scheduled GitHub Action (.github/workflows/reminders.yml) sends
   due ones as Web Push without being able to read them; the service worker decrypts them on the phone. */
import { CFG, cloudReady } from './config';
import { encryptObj, hex, te, unb64url } from './crypto';
import { Auth, dbPut } from './firebase';
import { D, L, fmtTime, listOf, save } from './store';
import { Sync } from './sync';
import type { Task } from './types';
import { isIOS, standalone } from './util';

export const Push = {
  supported(): boolean { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; },
  configured(): boolean { return !!CFG.vapidPublicKey; },
  on(): boolean { return !!(L.push && L.push.id); },
  why(): string {
    if (!cloudReady() || !this.configured()) return 'Push isn’t set up yet (README, “Push reminders”).';
    if (!Auth.user()) return 'Sign in to use push reminders.';
    if (isIOS() && !standalone()) return 'On iPhone, open Twodo from your Home Screen first.';
    if (!this.supported()) return 'This browser can’t receive push notifications.';
    return '';
  },
  async enable() {
    const why = this.why(); if (why) throw new Error(why);
    if (await Notification.requestPermission() !== 'granted') throw new Error('Notifications are blocked. Allow them in Settings for Twodo.');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64url(CFG.vapidPublicKey) });
    const j = sub.toJSON();
    const id = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(j.endpoint)))).slice(0, 24);
    await dbPut(`push/${L.auth!.uid}/${id}`, { endpoint: j.endpoint, keys: j.keys, ua: navigator.userAgent.slice(0, 120), ts: Date.now() });
    L.push = { id }; save();
    Sync.pushNewer({}); // (re)write reminder entries for upcoming tasks
  },
  async disable() {
    const id = L.push && L.push.id;
    L.push = null; save();
    try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch { /* ignore */ }
    if (id && Auth.user()) await dbPut(`push/${L.auth!.uid}/${id}`, null);
  },
};

interface RemEntry { at: number; to: string[]; title: string; body: string }
export const Remind = {
  entry(t: Task | undefined): RemEntry | null {
    if (!t || t.deleted || t.done || !t.due || !t.time || Sync.isPrivate(t)) return null;
    const at = new Date(`${t.due}T${t.time}`).getTime();
    if (!(at > Date.now() - 5 * 60e3)) return null;
    const uids = (['a', 'b'] as const).map(k => D.people && D.people[k] && D.people[k].uid).filter((u): u is string => !!u);
    const to = (t.assignee === 'a' || t.assignee === 'b') ? [D.people && D.people[t.assignee] && D.people[t.assignee].uid].filter((u): u is string => !!u) : uids;
    if (!to.length) return null;
    const l = listOf(t);
    const body = [fmtTime(t.time), t.assignee === 'both' ? 'for both of you' : '', `${l.emoji} ${l.name}`].filter(Boolean).join(' · ');
    return { at, to: to.sort(), title: t.title, body };
  },
  // Reminder index changes for the records being flushed. Only writes what actually changed.
  async collect(keys: string[]): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {}; L.remSig = L.remSig || {};
    if (!CFG.vapidPublicKey) return out; // push not configured → nothing to schedule
    for (const k of keys) {
      if (!k.startsWith('t:')) continue;
      const id = k.slice(2), t = D.tasks[id], e = this.entry(t);
      const sig = e ? JSON.stringify([e.at, e.to, e.title, e.body]) : '';
      if (e && L.remSig[id] === sig) continue;
      if (!e && !(t && (t.time || t.done || t.deleted))) continue;
      out[id] = e ? { at: e.at, to: Object.fromEntries(e.to.map(u => [u, true])), d: await encryptObj(Sync.key!, { t: e.title, b: e.body }), sent: 0 } : null;
      if (e) L.remSig[id] = sig; else delete L.remSig[id];
    }
    return out;
  },
};
