// Wire-level patches and deliberately reordered/failed writes: no real accounts or network.
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { strict: assert } = require('node:assert');
const ts = require('typescript');
function load(file, deps = {}) {
  const box = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, { exports: box.exports, setTimeout, clearTimeout, console,
    require: key => { assert(key in deps, `Unexpected dependency ${key}`); return deps[key]; } });
  return box.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const { RecordStream } = load('src/lib/recordStream.ts');

async function main() {
  const tree = new RecordStream();
  tree.apply('put', { path: '/', data: { one: { f: 'a', u: 1, d: 'old' }, two: { u: 1, d: 'two' } } });
  const patch = tree.apply('patch', { path: '/', data: { 'one/u': 2, 'one/d': 'new', 'two/u': 3, 'two/d': 'next' } });
  assert.deepEqual(JSON.parse(JSON.stringify(patch)), { one: { f: 'a', u: 2, d: 'new' }, two: { u: 3, d: 'next' } });
  tree.apply('patch', { path: '/one', data: { u: 4, d: 'later' } });
  assert.equal(patch.one.d, 'new', 'queued events must keep the envelope for their own revision');
  assert.equal(tree.apply('put', { path: '/one/d', data: 'field' }).one.f, 'a');
  assert.equal(tree.apply('patch', { path: '/one', data: { f: null } }).one.f, undefined);
  assert.equal(tree.apply('put', { path: '/one', data: null }).one, null);
  assert.equal(tree.apply('put', { path: '/one', data: { u: 5, d: 'replacement' } }).one.f, undefined);
  tree.apply('patch', { path: '/', data: JSON.parse('{"__proto__/polluted":true,"constructor/prototype":true}') });
  assert.equal({}.polluted, undefined);
  tree.apply('put', { path: '/', data: null });
  assert.equal(tree.apply('put', { path: '/one/u', data: 6 }).one.d, undefined, 'new snapshots discard old ciphertext');
  assert.equal(new RecordStream().apply('put', { path: '/one/u', data: 7 }).one.d, undefined, 'reconnects share no snapshot');
  console.log('PASS: atomic multi-record/field patches, deletes, immutable queued snapshots, reconnect isolation, hostile keys');

  let gets = 0, decrypts = 0, decryptGate;
  const writes = [], gates = [];
  const sync = { key: {}, space: 'test-space', enabled: () => true };
  const { Chat } = load('src/lib/chat.ts', {
    './config': { CFG: {} },
    './crypto': { encryptObj: async (_key, obj) => JSON.stringify(obj), decryptObj: async (_key, text) => { decrypts++; if (decryptGate) await decryptGate.promise; return JSON.parse(text); } },
    './firebase': { dbGet: () => { gets++; throw Error('No record GET expected'); }, dbPatch: async () => {}, dbPut: async (path, value) => { writes.push({ path, value }); const gate = gates.shift(); if (gate) await gate.promise; } },
    './fx': { FX: { valid: () => false } }, './live': { Live: { close: () => {} } },
    './render': { scheduleRender: () => {} }, './sync': { Sync: sync }, './util': { firstWord: x => x },
    './store': { D: { people: null }, L: { auth: { uid: 'a' }, pair: { status: 'paired', uid: 'b' } }, partnerKey: () => 'b', myName: () => 'Abilash',
      cNum: v => typeof v === 'number' && Number.isFinite(v) ? v : 0, cStr: (v, n) => typeof v === 'string' ? v.slice(0, n) : '', DAY_RE: /^$/, TIME_RE: /^$/ }
  });
  Chat.saveSoon = Chat.updateBadge = Chat.notifyPartner = () => {};
  const stream = new RecordStream(), id = '000000001abcde';
  const envelope = (u, t) => ({ f: 'b', u, d: JSON.stringify({ t, ts: u }) });
  await Chat.onM('put', { path: '/', data: stream.apply('put', { path: '/', data: { [id]: envelope(1, 'initial') } }) });
  for (let u = 2; u <= 101; u++) {
    const v = envelope(u, `revision ${u}`);
    await Chat.onM('patch', { path: '/', data: stream.apply('patch', { path: '/', data: { [`${id}/u`]: v.u, [`${id}/d`]: v.d } }) });
  }
  assert.equal(Chat.msgs[id].t, 'revision 101'); assert.equal(gets, 0);
  console.log('PASS: 100 nested message revisions converge with zero per-record GETs');

  const first = deferred(), second = deferred(); gates.push(first, second);
  const message = Chat.send({ t: 'before the response' });
  const sentRevision = message._u;
  assert.equal(Chat.msgs[message.id].status, 'sending');
  Chat.unsend(message.id);
  assert(message._u > sentRevision, 'Undo Send has a strictly newer revision');
  assert.equal(Chat.msgs[message.id].del, true); assert.equal(Chat.msgs[message.id].t, '');
  const done = Chat.writes.get(message.id);
  await tick(); assert.equal(writes.length, 1, 'Undo Send waits for the older write, while its UI is already updated');
  first.resolve(); await tick();
  assert.equal(writes.length, 2); assert.equal(Chat.msgs[message.id].status, 'sending', 'old acknowledgement cannot complete the newer edit');
  assert.equal(JSON.parse(writes[1].value.d).del, true);
  second.resolve(); await done;
  await Chat.onM('put', { path: `/${message.id}`, data: writes[0].value });
  assert.equal(Chat.msgs[message.id].del, true, 'late echo cannot resurrect removed text');
  assert.equal(Chat.msgs[message.id].status, 'sent');
  const failure = deferred(); gates.push(failure);
  const failed = Chat.send({ t: 'keep this for retry' }); await tick(); failure.reject(Error('offline'));
  await Chat.writes.get(failed.id);
  assert.equal(failed.status, 'failed'); assert.equal(failed.t, 'keep this for retry');
  Chat.retry(failed.id); await Chat.writes.get(failed.id); assert.equal(failed.status, 'sent');
  const interrupted = deferred(); gates.push(interrupted);
  const restarting = Chat.send({ t: 'resume my latest state' }); await tick();
  const count = writes.length;
  Chat.stop(); assert.equal(restarting.status, 'failed');
  Chat.retry(restarting.id); const restarted = Chat.writes.get(restarting.id); await tick();
  assert.equal(writes.length, count, 'restart cannot overtake an already in-flight write');
  interrupted.resolve(); await restarted;
  assert.equal(restarting.status, 'sent'); assert.equal(writes.length, count + 1);
  decryptGate = deferred();
  const pendingEcho = Chat.onM('put', { path: `/${restarting.id}`, data: { f: 'a', u: restarting._u + 1, d: JSON.stringify({ t: 'older edit', ts: restarting.ts }) } });
  Chat.unsend(restarting.id); const removal = Chat.writes.get(restarting.id);
  decryptGate.resolve(); await pendingEcho; await removal; decryptGate = undefined;
  assert.equal(Chat.msgs[restarting.id].del, true, 'a local edit during decryption wins over the older echo');
  const slow = deferred(); gates.push(slow);
  const waiting = Chat.send({ t: 'slow message' }); const waitingWrite = Chat.writes.get(waiting.id); await tick();
  const independent = Chat.send({ t: 'independent message' }); await Chat.writes.get(independent.id);
  assert.equal(independent.status, 'sent'); assert.equal(waiting.status, 'sending', 'different messages remain independent');
  slow.resolve(); await waitingWrite;
  console.log('PASS: optimistic send/Undo Send, serialized writes, stale echoes, failure keeps text, retry');

  const reaction = { u: 1, d: JSON.stringify({ r: '❤️' }) };
  await Chat.onE('put', { path: '/', data: { rx: { [id]: { b: reaction } }, x: {} } });
  const rx = Chat.rx, before = decrypts, cacheSize = Chat.dcache.size;
  for (let i = 0; i < 100; i++) await Chat.onE('put', { path: '/x/b', data: { u: i, d: JSON.stringify({ at: i, on: 1, read: 0 }) } });
  assert.equal(Chat.rx, rx, 'typing/heartbeats reuse the reaction collection');
  assert.equal(decrypts - before, 100, 'only new presence ciphertext is decrypted');
  assert.equal(Chat.dcache.size, cacheSize, 'presence updates never fill or evict the stable-data cache');
  for (let i = 0; i < 700; i++) await Chat.dec({ d: JSON.stringify({ at: i }) });
  assert(Chat.dcache.size <= 512);
  await Chat.dec(reaction); const cached = decrypts; await Chat.dec(reaction); assert.equal(decrypts, cached);
  Chat.stop(); assert.equal(Chat.dcache.size, 0); assert.equal(Object.keys(Chat.eTree).length, 0);
  console.log('PASS: stable reactions during presence updates, bounded decrypt cache, teardown clears decrypted caches');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
