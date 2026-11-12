/* Twodo service worker: offline app shell + encrypted push reminders. */
// Both lines are filled in at build time by scripts/postbuild.mjs (every file of the build, and a version from their hashes)
const VERSION = 'twodo-dev';
const SHELL = ['./'];

/* Updates. A new version downloads into its OWN cache and then waits: it never takes over a running app by itself,
   because someone may be typing, editing a task or entering a passcode. The app shows "Update ready" and sends
   SKIP_WAITING when the person agrees; if they never do, the new version starts the next time the app is opened from
   closed. Each version's cache is complete and is never changed afterwards, so the app always starts offline with
   files that belong together. */
self.addEventListener('install', e => {
  // always from the server (the browser's own HTTP cache may hold old files); all files or none
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION && k.startsWith('twodo-')).map(k => caches.delete(k)));
    await self.clients.claim(); // the app that asked for the update reloads itself (see src/ui/update.ts)
  })());
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // never touch sync traffic
  e.respondWith(caches.open(VERSION).then(async cache => {
    // this version's own files, as downloaded together; anything else (not part of the app shell) from the network
    const hit = await cache.match(e.request, { ignoreSearch: true });
    return hit || fetch(e.request);
  }));
});

/* ---------- Push reminders: the payload is still encrypted with your space key; decrypt it here ---------- */
function idbGet(key) {
  return new Promise((res, rej) => {
    const r = indexedDB.open('twodo', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('keys');
    r.onerror = () => rej(r.error);
    r.onsuccess = () => {
      const q = r.result.transaction('keys').objectStore('keys').get(key);
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    };
  });
}
async function decryptReminder(msg) {
  const sp = await idbGet('space');
  if (!sp || sp.id !== msg.s) return null;
  const key = await crypto.subtle.importKey('raw', sp.raw, { name: 'AES-GCM' }, false, ['decrypt']);
  const b = Uint8Array.from(atob(msg.d), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, key, b.slice(12))));
}
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let msg = {}; try { msg = e.data ? e.data.json() : {}; } catch (err) { /* ignore */ }
    let r = null; try { r = await decryptReminder(msg); } catch (err) { /* wrong key → generic text */ }
    const chat = (r && r.k === 'chat') || String(msg.id || '').startsWith('chat_');
    await self.registration.showNotification(r ? (chat ? r.t : `⏰ ${r.t}`) : chat ? '💬 New message' : '⏰ Twodo reminder', {
      body: r ? r.b : chat ? 'Open Twodo to read it.' : 'You have a task due.', tag: chat ? 'chat' : 'rem-' + (msg.id || Date.now()),
      icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: chat ? './#chat' : './' },
    });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) { if (url.includes('#chat')) c.postMessage({ open: 'chat' }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
