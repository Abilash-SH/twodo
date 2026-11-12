/* Twodo · in-app reminders (while the app is open or recently used) and system notifications */
import { asset } from '@/lib/config';
import { Push } from '@/lib/push';
import { L, fmtDue, fmtTime, liveTasks, partnerKey, save } from '@/lib/store';
import { island } from './island';

export async function sysNotify(title: string, body: string, tag?: string): Promise<boolean> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    const icon = asset('icons/icon-192.png');
    if (reg) { await reg.showNotification(title, { body, icon, badge: icon, tag: tag || title + body }); return true; }
    new Notification(title, { body, icon }); return true;
  } catch { return false; }
}
export function checkReminders(): void {
  if (!L.settings.notify) return;
  const now = Date.now();
  for (const t of liveTasks()) {
    if (t.done || !t.due || !t.time || t.assignee === partnerKey()) continue;
    const at = new Date(`${t.due}T${t.time}`).getTime(), key = `${t.id}@${t.due}T${t.time}`;
    if (now >= at && now - at < 3 * 3600e3 && !L.notified[key]) {
      L.notified[key] = now;
      if (!Push.on()) void sysNotify(`⏰ ${t.title}`, `Due ${fmtDue(t.due, t.time)}${t.assignee === 'both' ? ' · for both of you' : ''}`, 'rem-' + t.id); // push covers it otherwise
      if (!document.hidden) island({ e: '⏰', text: t.title, sub: `Due ${fmtTime(t.time)}`, ms: 5000 });
    }
  }
  for (const k in L.notified) if (now - L.notified[k] > 7 * 864e5) delete L.notified[k];
  save();
}
