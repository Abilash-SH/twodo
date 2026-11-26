/** Latest encrypted world pose, entirely separate from saved records and chat. docs/courtyard.md. */
import { decryptObj, encryptObj, randHex } from '../crypto';
import { dbReq, type AppError } from '../firebase';
import { Live, type Stream } from '../live';
import { cleanRecord } from '../store';
import { LEASE_MS, type WorldPose } from './state';

export type Connection = 'connecting' | 'live' | 'offline' | 'unavailable';
export type LocalPose = Pick<WorldPose, 'x' | 'z' | 'yaw' | 'mode'>;
interface Options {
  space: string; uid: string; peer: string; key: CryptoKey;
  pose: () => LocalPose; partner: (p: WorldPose | null) => void; status: (s: Connection) => void;
}
export function joinWorld(o: Options): () => void {
  if (!/^[0-9a-f]{40}$/.test(o.space) || !/^[A-Za-z0-9_-]{1,128}$/.test(o.uid) || !/^[A-Za-z0-9_-]{1,128}$/.test(o.peer) || o.uid === o.peer) {
    o.status('unavailable'); o.partner(null); return () => {};
  }
  let closed = false, busy = false, readUp = false, wrote = false, denied = false;
  let seq = 0, generation = 0, peerStamp = 0, peerSeq = 0, peerSession = '', expires = 0;
  let lastSent = 0, signature = '', status: Connection | null = null, retryAt = 0, failures = 0;
  let request: AbortController | null = null, latest: WorldPose | null = null;
  const session = randHex(8), path = `spaces/${o.space}/world/`;
  const set = (next: Connection) => { if (!closed && next !== status) { status = next; o.status(next); } };
  const down = (next: Connection) => { generation++; readUp = false; wrote = false; latest = null; expires = 0; o.partner(null); set(next); };
  async function receive(raw: unknown): Promise<void> {
    const gen = generation;
    readUp = true;
    if (wrote) set('live');
    const envelope = cleanRecord(raw, 'courtyard-envelope');
    if (!envelope) { if (raw === null) { generation++; latest = null; expires = 0; o.partner(null); } return; }
    if (Date.now() - envelope.u > LEASE_MS || envelope.u > Date.now() + 5000) return;
    try {
      const p = cleanRecord(await decryptObj(o.key, envelope.d), 'courtyard');
      if (closed || gen !== generation || !p || Date.now() - envelope.u > LEASE_MS) return;
      // A session's delayed packet cannot replay an earlier pose. The server timestamp orders sessions/devices.
      if (p.session === peerSession && p.seq <= peerSeq) return;
      if (p.session !== peerSession && envelope.u <= peerStamp) return;
      peerSession = p.session; peerSeq = p.seq; peerStamp = Math.max(peerStamp, envelope.u);
      expires = Math.max(expires, envelope.u + LEASE_MS); latest = p;
      if (wrote && readUp) o.partner(p);
    } catch { /* invalid ciphertext is never surfaced or logged */ }
  }
  let stream: Stream | null = Live.open({
    path: () => path + o.peer,
    on: (_type, message) => { if (!closed && message.path === '/') void receive(message.data); },
    onDown: () => { if (!closed) down(navigator.onLine ? 'connecting' : 'offline'); },
    onCancel: () => { if (!closed) { denied = true; down('unavailable'); Live.close(stream); } },
  });
  async function send(): Promise<void> {
    if (closed || busy || denied || document.hidden || Date.now() < retryAt) return;
    if (!navigator.onLine) { down('offline'); return; }
    const now = Date.now(), pose = o.pose();
    const next = [pose.x.toFixed(2), pose.z.toFixed(2), pose.yaw.toFixed(2), pose.mode].join(':');
    if (next === signature && now - lastSent < 3000) return;
    busy = true;
    const controller = new AbortController(); request = controller;
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const packet = cleanRecord({ v: 1, session, seq: ++seq, t: now, ...pose }, 'courtyard');
      if (!packet) return;
      const d = await encryptObj(o.key, packet);
      if (closed || document.hidden) return;
      await dbReq(path + o.uid, { method: 'PUT', body: { u: { '.sv': 'timestamp' }, d }, signal: controller.signal });
      if (closed) return;
      signature = next; lastSent = now; wrote = true; retryAt = 0; failures = 0;
      if (readUp) { set('live'); if (latest && expires > Date.now()) o.partner(latest); }
    } catch (e) {
      if (closed) return;
      if ((e as AppError).status === 401 || (e as AppError).status === 403) { denied = true; Live.close(stream); down('unavailable'); }
      else {
        retryAt = Date.now() + Math.min(15000, 500 * 2 ** Math.min(failures++, 5));
        if (!navigator.onLine) down('offline');
        else {
          // The receive stream can stay healthy through a failed write. Keep its state so a successful
          // retry restores the connection even when the partner has no fresh movement to send.
          wrote = false;
          o.partner(null);
          set('connecting');
        }
      }
    } finally { clearTimeout(timeout); if (request === controller) request = null; busy = false; }
  }
  set(navigator.onLine ? 'connecting' : 'offline');
  const timer = setInterval(() => { if (expires && Date.now() >= expires) { expires = 0; o.partner(null); } void send(); }, 200);
  void send();
  return () => { closed = true; generation++; request?.abort(); clearInterval(timer); Live.close(stream); stream = null; o.partner(null); };
}
