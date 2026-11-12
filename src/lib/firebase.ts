/* Twodo · Firebase Auth and Realtime Database over REST (no SDK) */
import { CFG } from './config';
import { L, save } from './store';

const dbBase = () => String(CFG.firebase.databaseURL).replace(/\/+$/, '');
const authBase = () => (CFG.authEmulator ? CFG.authEmulator.replace(/\/+$/, '') + '/' : 'https://');
export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
export const normUsername = (s: unknown): string => String(s || '').trim().toLowerCase().replace(/^@/, '');

const AUTH_ERRORS: Record<string, string> = {
  EMAIL_EXISTS: 'That email already has an account. Try signing in.',
  EMAIL_NOT_FOUND: 'Wrong email or password.', INVALID_PASSWORD: 'Wrong email or password.',
  INVALID_LOGIN_CREDENTIALS: 'Wrong email or password.', USER_DISABLED: 'This account has been disabled.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Wait a few minutes and try again.',
  INVALID_EMAIL: 'That email doesn’t look right.', MISSING_EMAIL: 'Enter your email.',
  OPERATION_NOT_ALLOWED: 'Email/password sign-in isn’t switched on in Firebase yet (README, step 2).',
  CONFIGURATION_NOT_FOUND: 'Authentication isn’t set up in Firebase yet (README, step 2).',
  TOKEN_EXPIRED: 'Please sign in again.', USER_NOT_FOUND: 'Please sign in again.', INVALID_REFRESH_TOKEN: 'Please sign in again.',
};
export class AppError extends Error { code?: string; status?: number; offline?: boolean }

interface TokenReply { localId?: string; user_id?: string; idToken?: string; id_token?: string; refreshToken?: string; refresh_token?: string; expiresIn?: string; expires_in?: string }

export const Auth = {
  refreshing: null as Promise<string> | null,
  user() { return L.auth && L.auth.uid ? L.auth : null; },
  async call(kind: 'signUp' | 'signInWithPassword' | 'refresh', body: Record<string, unknown>): Promise<TokenReply> {
    const key = encodeURIComponent(CFG.firebase.apiKey);
    const url = kind === 'refresh' ? `${authBase()}securetoken.googleapis.com/v1/token?key=${key}`
      : `${authBase()}identitytoolkit.googleapis.com/v1/accounts:${kind}?key=${key}`;
    let res: Response, j: TokenReply & { error?: { message?: string } };
    try {
      res = await fetch(url, kind === 'refresh'
        ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body as Record<string, string>) }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      j = await res.json();
    } catch { throw new AppError('Can’t reach Firebase. Check your connection.'); }
    if (!res.ok) {
      const msg = (j.error && j.error.message) || '', code = String(msg).split(' ')[0];
      if (/API key not valid/i.test(msg)) throw new AppError('The Firebase API key in the app’s configuration isn’t right.');
      const err = new AppError(AUTH_ERRORS[code] || code || 'Sign-in failed'); err.code = code; throw err;
    }
    return j;
  },
  setSession(j: TokenReply) {
    L.auth = {
      ...(L.auth || {}), uid: (j.localId || j.user_id)!, idToken: (j.idToken || j.id_token)!,
      refresh: (j.refreshToken || j.refresh_token)!, exp: Date.now() + (Number(j.expiresIn || j.expires_in || 3600) - 90) * 1000,
    };
    save();
  },
  async token(): Promise<string> {
    const a = L.auth; if (!a || !a.refresh) throw new AppError('Not signed in');
    if (a.idToken && Date.now() < a.exp) return a.idToken;
    if (!this.refreshing) {
      this.refreshing = this.call('refresh', { grant_type: 'refresh_token', refresh_token: a.refresh })
        .then(j => { this.setSession(j); return L.auth!.idToken; })
        .catch((e: AppError) => { if (e.code && L.auth) { L.auth.expired = true; save(); } throw e; })
        .finally(() => { this.refreshing = null; });
    }
    return this.refreshing;
  },
};

// Writes go out as "simple" requests (POST + x-http-method-override, plain-text body): the browser then skips the
// extra CORS preflight round trip it would otherwise make before every single write. Firebase documents the override.
const Net = { override: (() => { try { return localStorage.getItem('twodo:noOverride') !== '1'; } catch { return true; } })() };
type Method = 'GET' | 'PUT' | 'PATCH' | 'DELETE';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dbReq<T = any>(path: string, { method = 'GET', body, retry = true, keepalive = false }: { method?: Method; body?: unknown; retry?: boolean; keepalive?: boolean } = {}): Promise<T> {
  const tok = await Auth.token();
  const fast = method !== 'GET' && Net.override;
  let res: Response;
  try {
    res = await fetch(`${dbBase()}/${path}.json?auth=${encodeURIComponent(tok)}${fast ? '&x-http-method-override=' + method : ''}`, fast
      ? { method: 'POST', cache: 'no-store', keepalive, body: JSON.stringify(body === undefined ? null : body) }
      : { method, cache: 'no-store', keepalive, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  } catch { const err = new AppError('You’re offline'); err.offline = true; throw err; }
  if (res.status === 401 && retry && L.auth) { L.auth.exp = 0; return dbReq(path, { method, body, keepalive, retry: false }); }
  if (!res.ok) { const err = new AppError(res.status === 401 || res.status === 403 ? 'denied' : 'Database error ' + res.status); err.status = res.status; throw err; }
  const j = await res.json();
  if (fast && j && typeof j === 'object' && !Array.isArray(j) && Object.keys(j).length === 1 && typeof j.name === 'string' && j.name[0] === '-'
      && !(body && typeof body === 'object' && 'name' in body)) {
    // This server ignored the override and pushed a new child instead: undo that and use normal requests from now on
    Net.override = false; try { localStorage.setItem('twodo:noOverride', '1'); } catch { /* ignore */ }
    await dbReq(`${path ? path + '/' : ''}${j.name}`, { method: 'DELETE' }).catch(() => {});
    return dbReq(path, { method, body, retry });
  }
  return j;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const dbGet = <T = any>(p: string): Promise<T> => dbReq<T>(p);
export const dbPatch = (p: string, b: Record<string, unknown>): Promise<unknown> => dbReq(p, { method: 'PATCH', body: b });
export const dbPut = (p: string, b: unknown, o?: { keepalive?: boolean }): Promise<unknown> => dbReq(p, { method: 'PUT', body: b, ...(o || {}) });
export const streamUrl = async (p: string): Promise<string> => `${dbBase()}/${p}.json?auth=${encodeURIComponent(await Auth.token())}`;
