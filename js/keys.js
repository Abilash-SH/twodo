/* Twodo · cryptography and on-device key storage
   Password ──PBKDF2(600k)──▶ 512 bits ─┬─ first half  → login secret sent to Firebase (never the real password)
                                        └─ second half → "wrap" key that encrypts your keys for backup
   Each account has an ECDH P-256 key pair. Partners agree on a key-encryption key with ECDH + HKDF,
   which carries the shared space key from one phone to the other. The server never sees any of these. */
'use strict';

const te = new TextEncoder(), td = new TextDecoder();
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const unb64url = s => unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
const hex = u8 => Array.from(u8, b => b.toString(16).padStart(2, '0')).join('');
const randHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));

async function encryptObj(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return b64(out);
}
async function decryptObj(key, s) {
  const b = unb64(s);
  return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, key, b.slice(12))));
}

const PBKDF2_ITER = 600000;
async function derivePasswordKeys(password, email) {
  const base = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = te.encode('twodo/v2/' + String(email).trim().toLowerCase());
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, base, 512));
  const wrap = await crypto.subtle.importKey('raw', bits.slice(32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return { authPass: hex(bits.slice(0, 32)), wrap };
}

async function newKeyPair() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
  return { pub: { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y }, privJwk: await crypto.subtle.exportKey('jwk', kp.privateKey) };
}
const importPriv = jwk => crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
const importPub = jwk => crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
async function pairKek(priv, otherPub, spaceId) {
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: await importPub(otherPub) }, priv, 256);
  const hk = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: te.encode(spaceId), info: te.encode('twodo/pair/v1') },
    hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const spaceKeyFromRaw = raw => crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

// 8 digits both phones compute from the two public keys. If they match, nobody swapped keys in between.
async function safetyCode(pubA, pubB) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode([pubA.x + pubA.y, pubB.x + pubB.y].sort().join('|'))));
  const n = (h[0] * 16777216 + h[1] * 65536 + h[2] * 256 + h[3]) % 1e8;
  const s = String(n).padStart(8, '0');
  return s.slice(0, 4) + ' ' + s.slice(4);
}

/* IndexedDB key store. Shared with the service worker so push reminders can be decrypted on the phone.
   Keys: wrap (CryptoKey), priv (CryptoKey), pub (JWK), space ({ id, raw }) */
const KeyStore = {
  _db: null,
  open() {
    return this._db || (this._db = new Promise((res, rej) => {
      const r = indexedDB.open('twodo', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('keys');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
  },
  async get(k) {
    const db = await this.open();
    return new Promise((res, rej) => { const q = db.transaction('keys').objectStore('keys').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  },
  async set(obj) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('keys', 'readwrite'), st = tx.objectStore('keys');
      for (const [k, v] of Object.entries(obj)) st.put(v, k);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
  },
  async clear() {
    const db = await this.open();
    return new Promise((res, rej) => { const tx = db.transaction('keys', 'readwrite'); tx.objectStore('keys').clear(); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  },
};
