/* Twodo service worker: offline app shell + encrypted push reminders. Bump VERSION when you deploy changes. */
const VERSION = 'twodo-v3.5.0';
const SHELL = [
  './', 'index.html', 'styles.css', 'chat.css', 'manifest.webmanifest', 'config.js',
  'js/boot.js', 'js/util.js', 'js/store.js', 'js/parse.js', 'js/keys.js', 'js/cloud.js', 'js/live.js', 'js/sync.js', 'js/push.js', 'js/pair.js',
  'js/ui.js', 'js/views.js', 'js/actions.js', 'js/sheets.js', 'js/settings.js', 'js/account.js', 'js/gate.js', 'js/chat.js', 'js/effects.js', 'js/chatui.js', 'js/tips.js', 'js/focus.js', 'js/composer.js', 'js/menu.js', 'js/main.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

// Always fetch the new version's files from the server: the browser's own HTTP cache may still hold the old ones.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
// When this replaces an older version, reload the open app once so the update shows right away.
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const updating = keys.some(k => k !== VERSION && k.startsWith('twodo-'));
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
    if (!updating) return;
    for (const c of await self.clients.matchAll({ type: 'window' })) {
      if ('navigate' in c) c.navigate(c.url).catch(() => c.postMessage({ reload: VERSION }));
      else c.postMessage({ reload: VERSION });
    }
  })());
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // never touch sync traffic
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    // fast + offline: answer from the cache, and refresh it from the server (checking, not trusting the HTTP cache)
    const net = fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
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
