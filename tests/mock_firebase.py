"""Firebase stand-in for testing Twodo: Auth REST (signUp / signInWithPassword / token refresh),
Realtime Database REST + SSE with ?auth= tokens, the same access policy as firebase.rules.json
(hand-translated), admin access via ?access_token=, and a fake Web Push service that records requests."""
import json, threading, queue, time, re, os, secrets, base64
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import copy

TTL = int(os.environ.get('MOCK_TOKEN_TTL', '3600'))
DB = {}; LOCK = threading.RLock(); SUBS = []
USERS = {}  # email -> {uid, password}
PUSHLOG = []

def get(root, ps):
    n = root
    for k in ps:
        if not isinstance(n, dict) or k not in n: return None
        n = n[k]
    return n
def setp(root, ps, val):
    if not ps: return val
    n = root
    for k in ps[:-1]:
        if not isinstance(n.get(k), dict): n[k] = {}
        n = n[k]
    if val is None:
        n.pop(ps[-1], None)
    else: n[ps[-1]] = val
    return root
def prune(n):
    if isinstance(n, dict):
        for k in list(n):
            n[k] = prune(n[k])
            if n[k] is None or n[k] == {}: n.pop(k)
        return n or None
    return n

def members(root, s): return get(root, ['spaces', s, 'members']) or {}
HEX40 = re.compile(r'^[0-9a-f]{40}$'); UNAME = re.compile(r'^[a-z0-9_.]{3,20}$')

def can_read(ps, uid):
    if uid == '__admin__': return True
    if uid is None or len(ps) < 2: return False
    a, b = ps[0], ps[1]
    if a == 'usernames': return True
    if a == 'users': return len(ps) >= 3 and (ps[2] == 'public' or (ps[2] == 'private' and uid == b))
    if a == 'spaces': return uid in members(DB, b)
    if a == 'requests': return uid == b
    if a == 'rem': return uid in members(DB, b)
    if a == 'push': return uid == b
    return False

def can_write(ps, uid, before, after):
    if uid == '__admin__': return True
    if uid is None or len(ps) < 2: return False
    new = get(after, ps); old = get(before, ps); a, b = ps[0], ps[1]
    if a == 'usernames' and len(ps) == 2:
        ok = (old is None and new == uid) or (old == uid and new is None)
        return ok and bool(UNAME.match(b)) and (new is None or isinstance(new, str))
    if a == 'users' and len(ps) >= 3:
        if uid != b: return False
        if ps[2] == 'public':
            pub = get(after, ps[:3]); return pub is None or ('name' in pub and 'pub' in pub)
        return ps[2] == 'private'
    if a == 'spaces' and len(ps) >= 3:
        mem = members(before, b)
        if ps[2] == 'members' and len(ps) == 4:
            m = ps[3]
            ok = uid == m and bool(HEX40.match(b)) and (new is None or not mem or get(before, ['spaces', b, 'invites', m]) is not None)
            return ok and (new is None or new is True)
        if ps[2] == 'invites' and len(ps) == 4:
            return uid in mem or (uid == ps[3] and new is None)
        if ps[2] == 'c' and len(ps) >= 5:
            if uid not in mem: return False
            if ps[3] == 'm' and len(ps) == 5:
                ok = (old is None or old.get('f') == uid) and (new is None or new.get('f') == uid)
                return ok and (new is None or (isinstance(new.get('u'), (int, float)) and isinstance(new.get('d'), str) and 'f' in new))
            if ps[3] == 'e' and ps[4] == 'x' and len(ps) == 6: return ps[5] == uid and (new is None or ('u' in new and isinstance(new.get('d'), str)))
            if ps[3] == 'e' and ps[4] == 'rx' and len(ps) == 7: return ps[6] == uid and (new is None or ('u' in new and isinstance(new.get('d'), str)))
            return False
        if ps[2] == 'r':
            if uid not in mem: return False
            for v in (get(after, ['spaces', b, 'r']) or {}).values():
                if not (isinstance(v, dict) and isinstance(v.get('u'), (int, float)) and isinstance(v.get('d'), str)): return False
            return True
        return False
    if a == 'requests' and len(ps) == 3:
        if not (uid == ps[2] or (uid == b and new is None)): return False
        if new is None: return True
        return all(k in new for k in ('ts', 'username', 'name')) and (new.get('type') == 'accepted' or all(k in new for k in ('pub', 'space', 'wk')))
    if a == 'rem':
        if uid not in members(before, b): return False
        mem_after = members(after, b)
        for v in (get(after, ['rem', b]) or {}).values():
            if not (isinstance(v, dict) and isinstance(v.get('at'), (int, float)) and isinstance(v.get('d'), str) and 'to' in v): return False
            if not all(t in mem_after and val is True for t, val in (v.get('to') or {}).items()): return False  # only people in this space
        return True
    if a == 'push':
        if uid != b: return False
        for v in (get(after, ['push', b]) or {}).values():
            if not (isinstance(v, dict) and 'endpoint' in v and 'keys' in v): return False
        return True
    return False

def notify(ps, event, data):
    for sp, q, uid in list(SUBS):
        if ps[:len(sp)] == sp:
            q.put((event, {'path': '/' + '/'.join(ps[len(sp):]), 'data': data}))
        elif sp[:len(ps)] == ps:  # write above the subscription
            q.put(('put', {'path': '/', 'data': get(DB, sp)}))

def tok(uid): return f'id.{uid}.{int(time.time()) + TTL}'
def uid_of(qs):
    if 'access_token' in qs: return '__admin__', None
    t = (qs.get('auth') or [None])[0]
    if not t: return None, None
    p = t.split('.')
    if len(p) != 3 or p[0] != 'id': return None, 'bad'
    if int(p[2]) < time.time(): return None, 'expired'
    return p[1], None

LAT = int(os.environ.get('MOCK_LAT', '0')) / 1000.0
STATS = {'OPTIONS': 0, 'writes': 0}
class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(self, *a): pass
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,PUT,PATCH,POST,DELETE,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    def do_OPTIONS(self):
        STATS['OPTIONS'] += 1
        if LAT: time.sleep(LAT)
        self.send_response(204); self.cors(); self.send_header('Content-Length', '0'); self.end_headers()
    def raw(self):
        n = int(self.headers.get('Content-Length') or 0); return self.rfile.read(n)
    def reply(self, obj, code=200):
        if LAT and not (urlparse(self.path).path.startswith('/__') or 'pushlog' in self.path): time.sleep(LAT)
        b = json.dumps(obj).encode()
        self.send_response(code); self.cors(); self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def parse(self):
        u = urlparse(self.path); p = u.path
        if p.endswith('.json'): p = p[:-5]
        return [x for x in p.split('/') if x], parse_qs(u.query)

    def do_POST(self):
        u = urlparse(self.path)
        if u.path.startswith('/pushsvc/'):
            body = self.raw(); PUSHLOG.append({'path': u.path, 'headers': dict(self.headers), 'body': base64.b64encode(body).decode()})
            self.send_response(201); self.cors(); self.send_header('Content-Length', '0'); self.end_headers(); return
        if 'identitytoolkit' in u.path:
            body = json.loads(self.raw() or b'{}'); email = body.get('email', '').lower(); pw = body.get('password', '')
            with LOCK:
                if u.path.endswith('accounts:signUp'):
                    if email in USERS: return self.reply({'error': {'message': 'EMAIL_EXISTS'}}, 400)
                    if len(pw) < 6: return self.reply({'error': {'message': 'WEAK_PASSWORD : Password should be at least 6 characters'}}, 400)
                    USERS[email] = {'uid': 'u' + secrets.token_hex(6), 'password': pw}
                elif u.path.endswith('accounts:signInWithPassword'):
                    if email not in USERS or USERS[email]['password'] != pw: return self.reply({'error': {'message': 'INVALID_LOGIN_CREDENTIALS'}}, 400)
                uid = USERS[email]['uid']
            return self.reply({'localId': uid, 'idToken': tok(uid), 'refreshToken': 'rf.' + uid, 'expiresIn': str(TTL), 'email': email})
        ov = (parse_qs(u.query).get('x-http-method-override') or [None])[0]
        if ov in ('PUT', 'PATCH', 'DELETE'): return self.write(ov)
        if 'securetoken' in u.path:
            f = parse_qs(self.raw().decode()); rt = (f.get('refresh_token') or [''])[0]
            if not rt.startswith('rf.'): return self.reply({'error': {'message': 'INVALID_REFRESH_TOKEN'}}, 400)
            uid = rt[3:]; return self.reply({'id_token': tok(uid), 'refresh_token': rt, 'user_id': uid, 'expires_in': str(TTL)})
        self.reply({'error': 'not found'}, 404)

    def do_GET(self):
        ps, qs = self.parse()
        if ps == ['pushlog']: return self.reply(PUSHLOG)
        if ps == ['__dump']: return self.reply(DB)
        if ps == ['__users']: return self.reply(USERS)
        if ps == ['__stats']: return self.reply(STATS)
        uid, err = uid_of(qs)
        if err == 'expired': return self.reply({'error': 'Auth token is expired'}, 401)
        if not can_read(ps, uid): return self.reply({'error': 'Permission denied'}, 401)
        lim = int((qs.get('limitToLast') or ['0'])[0])
        sa = json.loads(qs['startAt'][0]) if 'startAt' in qs else None
        def window(v):
            if isinstance(v, dict) and sa is not None: v = {k: v[k] for k in v if k >= sa}
            if lim and isinstance(v, dict): return {k: v[k] for k in sorted(v)[-lim:]}
            return v
        if 'text/event-stream' in (self.headers.get('Accept') or ''):
            q = queue.Queue(); t = (qs.get('auth') or [''])[0]
            with LOCK: SUBS.append((ps, q, uid)); q.put(('put', {'path': '/', 'data': window(copy.deepcopy(get(DB, ps)))}))
            self.send_response(200); self.cors(); self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache'); self.end_headers()
            try:
                while True:
                    try: ev, data = q.get(timeout=3)
                    except queue.Empty:
                        if t and int(t.split('.')[2]) < time.time():
                            self.wfile.write(b'event: auth_revoked\ndata: "credential is no longer valid"\n\n'); self.wfile.flush(); break
                        ev, data = 'keep-alive', None
                    if LAT and ev != 'keep-alive': time.sleep(LAT / 2)
                    self.wfile.write(f'event: {ev}\ndata: {json.dumps(data)}\n\n'.encode()); self.wfile.flush()
            except Exception: pass
            finally:
                with LOCK: SUBS[:] = [s for s in SUBS if s[1] is not q]
            return
        with LOCK: self.reply(window(get(DB, ps)))

    def write(self, method):
        global DB
        STATS['writes'] += 1
        ps, qs = self.parse(); body = None if method == 'DELETE' else json.loads(self.raw() or b'null')
        if method == 'DELETE': self.raw(); method = 'PUT'
        uid, err = uid_of(qs)
        if err == 'expired': return self.reply({'error': 'Auth token is expired'}, 401)
        with LOCK:
            before = copy.deepcopy(DB); after = copy.deepcopy(DB)
            if method == 'PATCH':
                paths = [ps + [x for x in k.split('/') if x] for k in body]
                for p, v in zip(paths, body.values()): after = setp(after, p, copy.deepcopy(v)) or {}
            else:
                paths = [ps]; after = setp(after, ps, copy.deepcopy(body)) or {}
            after = prune(after) or {}
            for p in paths:
                if not can_write(p, uid, before, after): return self.reply({'error': 'Permission denied'}, 401)
            DB = after
            if method == 'PATCH':
                if ps: notify(ps, 'patch', body)
                else:
                    for k, v in body.items(): notify([x for x in k.split('/') if x], 'put', v)
            else: notify(ps, 'put', body)
        self.reply(body)
    def do_PATCH(self): self.write('PATCH')
    def do_PUT(self): self.write('PUT')

if __name__ == '__main__':
    if os.path.exists('/tmp/push.crt'):
        import ssl
        tls = ThreadingHTTPServer(('127.0.0.1', 9443), H)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain('/tmp/push.crt', '/tmp/push.key')
        tls.socket = ctx.wrap_socket(tls.socket, server_side=True)
        threading.Thread(target=tls.serve_forever, daemon=True).start()
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('PORT', '9000'))), H).serve_forever()
