/* Twodo · live streams over the Firebase REST streaming API (Server-Sent Events).
   Phones freeze background apps and quietly drop their connections, and a stream can stay "open" while
   no longer delivering anything. So every stream here reconnects within a second after an error,
   watches for Firebase's 30-second keep-alives, and is re-opened as soon as the app comes back. */
import { streamUrl } from './firebase';
import { L } from './store';

export interface StreamMsg { path: string; data: unknown }
export interface StreamOpts { path: () => string; query?: () => string; on: (type: 'put' | 'patch', m: StreamMsg) => void; onDown?: (e?: unknown) => void; onCancel?: () => void }
export interface Stream extends StreamOpts { es: EventSource | null; last: number; tries: number; timer: ReturnType<typeof setTimeout> | null; gen: number; closed: boolean; opened: boolean }

export const Live = {
  streams: new Set<Stream>(), hiddenAt: 0,

  open(o: StreamOpts): Stream {
    const s: Stream = { es: null, last: 0, tries: 0, timer: null, gen: 0, closed: false, opened: false, ...o };
    this.streams.add(s); this.connect(s);
    return s;
  },
  close(s: Stream | null) { if (!s) return; s.closed = true; this.drop(s); this.streams.delete(s); },
  drop(s: Stream) { if (s.timer) clearTimeout(s.timer); s.timer = null; if (s.es) { s.es.close(); s.es = null; } },

  async connect(s: Stream) {
    this.drop(s);
    if (s.closed) return;
    const gen = ++s.gen;
    let url: string;
    try { url = await streamUrl(s.path()) + (s.query ? s.query() : ''); }
    catch (e) {
      if (gen !== s.gen) return;
      if (s.onDown) s.onDown(e);
      if (!(L.auth && L.auth.expired)) this.retry(s); // signed out for good → the sign-in screen takes over on next launch
      return;
    }
    if (s.closed || gen !== s.gen) return;
    const es = new EventSource(url);
    s.es = es; s.last = Date.now(); s.opened = false;
    const ev = (type: 'put' | 'patch' | 'keep-alive') => (e: MessageEvent) => {
      if (es !== s.es) return;
      s.last = Date.now();
      if (type === 'keep-alive') return;
      let m: StreamMsg; try { m = JSON.parse(e.data); } catch { return; }
      if (!m || typeof m.path !== 'string') return;
      s.tries = 0; s.on(type, m);
    };
    es.onopen = () => { if (es === s.es) { s.opened = true; s.last = Date.now(); } };
    es.addEventListener('put', ev('put'));
    es.addEventListener('patch', ev('patch'));
    es.addEventListener('keep-alive', ev('keep-alive'));
    es.addEventListener('auth_revoked', () => { if (es !== s.es) return; if (L.auth) L.auth.exp = 0; this.connect(s); }); // token expired → fresh one
    es.addEventListener('cancel', () => { if (es !== s.es) return; this.drop(s); if (s.onCancel) s.onCancel(); else this.retry(s, 30000); });
    es.onerror = () => {
      if (es !== s.es) return;
      if (!s.opened && s.tries > 0 && L.auth) L.auth.exp = 0; // refused more than once → maybe the token, get a new one
      this.drop(s);
      if (s.onDown) s.onDown();
      this.retry(s);
    };
  },
  retry(s: Stream, ms?: number) {
    if (s.closed) return;
    if (s.timer) clearTimeout(s.timer);
    if (ms == null) ms = navigator.onLine === false ? 5000 : Math.min(30000, 400 * 2 ** Math.min(s.tries++, 7));
    s.timer = setTimeout(() => this.connect(s), ms);
  },
  kick(s: Stream) { s.tries = 0; this.connect(s); },
  kickAll() { this.streams.forEach(s => this.kick(s)); },
  // Firebase sends a keep-alive about every 30 s; much longer silence means the connection died without telling us
  watch() { const now = Date.now(); this.streams.forEach(s => { if (s.es && now - s.last > 70000) this.kick(s); }); },
};

if (typeof window !== 'undefined') {
  setInterval(() => Live.watch(), 10000);
  addEventListener('online', () => Live.kickAll());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Live.hiddenAt = Date.now(); return; }
    const away = Date.now() - (Live.hiddenAt || Date.now());
    if (away > 8000) Live.kickAll(); else Live.watch();
  });
  addEventListener('pageshow', e => { if (e.persisted) Live.kickAll(); });
}
