// Twodo reminder sender, run by .github/workflows/reminders.yml every ~5 minutes.
// Reads /rem (due times + encrypted titles), sends Web Push to the subscribed phones, marks them sent.
// It never has the key, so it can't read your tasks: the phone decrypts the title when the push arrives.
import webpush from 'web-push';
import { createSign } from 'node:crypto';

const env = process.env;
if (!env.FIREBASE_SERVICE_ACCOUNT || !env.FIREBASE_DB_URL || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
  console.log('Push reminders are not set up yet (README → "Push reminders"). Nothing to do.');
  process.exit(0);
}
const DB = env.FIREBASE_DB_URL.trim().replace(/\/+$/, '');

// Service-account login (OAuth 2 JWT bearer), no Firebase SDK needed.
async function accessToken() {
  if (env.TEST_ACCESS_TOKEN) return env.TEST_ACCESS_TOKEN;
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const aud = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({
    iss: sa.client_email, aud, iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
  });
  const assertion = unsigned + '.' + createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const res = await fetch(aud, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  const j = await res.json();
  if (!res.ok) throw new Error('Service account login failed: ' + JSON.stringify(j));
  return j.access_token;
}
const token = await accessToken();
async function db(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${DB}/${path}.json?access_token=${encodeURIComponent(token)}`, {
    method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${method} /${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

webpush.setVapidDetails(env.VAPID_SUBJECT || 'mailto:twodo@users.noreply.github.com', env.VAPID_PUBLIC_KEY.trim(), env.VAPID_PRIVATE_KEY.trim());

const now = Date.now();
const EARLY = 90e3;            // runs are every ~5 min, so send up to 90 s early
const STALE = 6 * 3600e3;      // skip anything more than 6 h overdue
const KEEP = 3 * 864e5;        // delete entries 3 days after they were due
const rem = (await db('rem')) || {};
const subsCache = {};
const subsOf = async uid => (subsCache[uid] ??= ((await db(`push/${uid}`)) || {}));
const updates = {};
let sent = 0, cleaned = 0, due = 0;

for (const [space, items] of Object.entries(rem)) {
  for (const [id, r] of Object.entries(items || {})) {
    if (!r || typeof r.at !== 'number') continue;
    if (r.at < now - KEEP) { updates[`rem/${space}/${id}`] = null; cleaned++; continue; }
    if (r.sent || r.at > now + EARLY || r.at < now - STALE) continue;
    due++;
    const payload = JSON.stringify({ s: space, id, d: r.d });
    for (const uid of Object.keys(r.to || {})) {
      for (const [sid, sub] of Object.entries(await subsOf(uid))) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload,
            { TTL: 3600, urgency: 'high', topic: id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) });
          sent++;
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) updates[`push/${uid}/${sid}`] = null; // phone unsubscribed
          else console.warn('Push failed', e.statusCode || '', e.body || e.message);
        }
      }
    }
    updates[`rem/${space}/${id}/sent`] = now;
  }
}
if (Object.keys(updates).length) await db('', { method: 'PATCH', body: updates });
console.log(`${due} reminder(s) due · ${sent} notification(s) sent · ${cleaned} old entr${cleaned === 1 ? 'y' : 'ies'} cleaned up`);
