/* Real collision/path regressions and encrypted presence protocol, independent of WebGL. */
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const { strict: assert } = require('node:assert');
const { webcrypto } = require('node:crypto');
function load(path, dependencies = {}, extras = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { assert(name in dependencies, 'Unmocked dependency ' + name); return dependencies[name]; }, TextEncoder, TextDecoder, crypto: webcrypto, btoa, atob, Uint8Array, ...extras });
  return exports;
}
const state = load('src/lib/courtyard/state.ts');
const store = load('src/lib/store.ts', { './courtyard/state': state, './render': { scheduleRender() {} }, './util': { PALETTE: ['blue', 'pink'], REPEATS: {} } });
const points = [...Object.values(state.DESTINATIONS), ...Object.values(state.PLACES)];
for (const from of points) for (const to of points) {
  const route = state.route(from, to); assert(route.length, 'reachable world landmark');
  for (const p of route) assert(state.walkable(p.x, p.z));
  for (let i = 1; i < route.length; i++) for (let t = 0; t <= 10; t++) {
    const a = route[i - 1], b = route[i]; assert(state.walkable(a.x + (b.x - a.x) * t / 10, a.z + (b.z - a.z) * t / 10), 'no diagonal corner clipping');
  }
  let position = from;
  for (let elapsed = 0; route.length && elapsed < 20; elapsed += .25) {
    position = state.followRoute(position, route, 1.45 * .25);
  }
  assert.equal(route.length, 0, 'route reaches its destination at four render frames per second');
  assert(Math.hypot(position.x - to.x, position.z - to.z) < .31);
}
for (const [name, room] of Object.entries(state.ROOMS)) {
  const through = state.moveWithin({ x: (room.doorLeft + room.doorRight) / 2, z: room.front + .8 }, 0, -2);
  assert.equal(state.areaAt(through.x, through.z), name, 'can walk through the open doorway');
  const blocked = state.moveWithin({ x: room.minX + .4, z: room.front + .8 }, 0, -12);
  assert(blocked.z > room.front, 'cannot tunnel through the front wall');
  const back = state.moveWithin(through, 0, 2);
  assert.equal(state.areaAt(back.x, back.z), 'garden', 'can leave through the same opening');
}
assert.equal(state.route(state.SPAWN, { x: NaN, z: 0 }).length, 0);
// The bigger map: the promenade, the south and east walks are walkable; the lake and the streets are not.
for (const [x, z] of [[-15, 2], [-18.9, -7], [-12, 12.9], [5, 11], [11.8, -6], [11.8, 12.5]]) assert(state.walkable(x, z), `walkable at ${x},${z}`);
for (const [x, z] of [[-19.8, 2], [-25, 0], [0, 14.2], [13, 0], [0, -8.6], [-9.5, -8.2]]) assert(!state.walkable(x, z), `not walkable at ${x},${z}`);
assert.deepEqual(['lake', 'south', 'east', 'plaza'].map(n => n), [state.outdoorAt(-15, 2), state.outdoorAt(0, 11), state.outdoorAt(11, 0), state.outdoorAt(0, 0)]);
// The sun follows the clock: midday is day, a November evening in India has its sunset near a quarter to six, nine is night.
{
  const daylight = load('src/lib/courtyard/daylight.ts');
  const at = (h, m) => daylight.daylight(new Date(2026, 10, 28, h, m), 20);
  const noon = at(12, 30), sunset = at(17, 40), night = at(21, 0);
  assert(noon.day === 1 && noon.night === 0 && noon.elevation > 40);
  assert(sunset.golden > .5 && Math.abs(sunset.elevation) < 4, sunset.elevation);
  assert(night.night === 1 && night.day === 0 && night.elevation < -20);
  for (const d of [noon, sunset, night]) for (const c of [d.zenith, d.horizon, d.glow, d.sunColor]) assert(/^#[0-9a-f]{6}$/.test(c), c);
  assert(Math.abs(Math.hypot(...sunset.sun) - 1) < 1e-9, 'the sun is a direction');
  assert(daylight.daylight(new Date(2026, 5, 21, 12, 18), -25).elevation < daylight.daylight(new Date(2026, 5, 21, 12, 18), 20).elevation, 'June is winter in the south');
}
const pose = { v: 1, session: '0123456789abcdef', seq: 1, t: 100000, x: 0, z: 5, yaw: 0, mode: 'idle' };
assert(state.cleanPose(pose));
assert(store.cleanRecord(pose, 'courtyard'));
assert.equal(store.cleanRecord({ ...pose, kind: 'courtyard', id: 'presence' }), null, 'poses never become saved/synced records');
for (const bad of [{ x: Infinity }, { x: -7.65, z: -4.5 }, { x: .2, z: -.6 }, { yaw: 20 }, { seq: 0 }, { session: '../a' }, { mode: 'dance' }, { mode: 'sit' }, { t: '100' }]) assert.equal(state.cleanPose({ ...pose, ...bad }), null);
assert.equal(state.cleanPose({ ...pose, ...state.DESTINATIONS.villa, mode: 'wave', gesture: 'clap' }).gesture, 'clap');
assert(state.cleanPose({ ...pose, ...state.DESTINATIONS.lake }), 'a pose on the promenade');
assert.equal(state.cleanPose({ ...pose, x: -25, z: 2 }), null, 'never in the lake');
assert.equal(state.cleanPose({ ...pose, mode: 'wave', gesture: 'unrecognized' }).gesture, undefined);
assert.equal(state.cleanPose({ ...pose, gesture: 'cheer' }).gesture, undefined);
assert(state.cleanPose({ ...pose, ...state.SEATS[0], mode: 'sit' }));
assert(!('secret' in state.cleanPose({ ...pose, secret: 'never retained' })));
assert.equal(state.cleanEnvelope({ u: 1, d: 'A'.repeat(1025) }), null);
assert.equal(store.cleanRecord({ u: 1, d: 'A'.repeat(1025) }, 'courtyard-envelope'), null);

async function main() {
  const crypt = load('src/lib/crypto.ts');
  const key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  let now = 100000, stream, timer, block = null, writes = [], peer = [], statuses = [];
  const timers = new Set();
  const fakeDate = class extends Date { static now() { return now; } };
  let current = { x: 0, z: 5, yaw: 0, mode: 'idle' };
  const network = { async dbReq(path, options) { writes.push({ path, options }); if (block) await block; return options.body; } };
  const live = { open(options) { stream = options; return options; }, close(s) { if (s) s.closed = true; } };
  const pendingCrypto = new Set();
  const track = fn => (...args) => {
    const task = fn(...args).finally(() => pendingCrypto.delete(task));
    pendingCrypto.add(task);
    return task;
  };
  const presence = load('src/lib/courtyard/presence.ts', {
    '../crypto': { ...crypt, encryptObj: track(crypt.encryptObj), decryptObj: track(crypt.decryptObj) }, '../firebase': network, '../live': { Live: live }, '../store': store, './state': state,
  }, { Date: fakeDate, document: { hidden: false }, navigator: { onLine: true }, AbortController,
    setInterval(fn) { timer = fn; return fn; }, clearInterval() { timer = null; }, setTimeout(fn) { timers.add(fn); return fn; }, clearTimeout(fn) { timers.delete(fn); } });
  const session = presence.joinWorld({ space: 'a'.repeat(40), uid: 'alice', peer: 'deiva', key, pose: () => current, partner: p => peer.push(p), status: s => statuses.push(s) });
  const settle = async () => {
    while (pendingCrypto.size) await Promise.allSettled([...pendingCrypto]);
    await new Promise(resolve => setImmediate(resolve));
  };
  await settle(); assert.equal(writes.length, 1);
  assert(!JSON.stringify(writes[0].options.body).includes('"x"'), 'only ciphertext goes to Firebase');
  assert.equal(writes[0].options.body.u['.sv'], 'timestamp');
  const decrypted = await crypt.decryptObj(key, writes[0].options.body.d); assert.equal(decrypted.x, 0); assert.equal(decrypted.z, 5);
  stream.on('put', { path: '/', data: null }); await settle(); assert.equal(statuses.at(-1), 'live');
  const receive = async (p, stamp = now) => { stream.on('put', { path: '/', data: { u: stamp, d: await crypt.encryptObj(key, p) } }); await settle(); };
  await receive(pose); assert.equal(peer.at(-1).seq, 1);
  await receive({ ...pose, seq: 2, x: 1 }, now + 1); assert.equal(peer.at(-1).x, 1);
  await receive({ ...pose, seq: 1, x: 2 }, now + 2); assert.equal(peer.at(-1).x, 1, 'stale sequence never replays');
  await receive({ ...pose, seq: 3, x: Infinity }, now + 3); assert.equal(peer.at(-1).x, 1, 'invalid coordinates ignored');
  await receive({ ...pose, seq: 4, x: 1.2 }, now + 400);
  await receive({ ...pose, seq: 5, x: 1.4 }, now + 300);
  assert.equal(peer.at(-1).seq, 5, 'a newer pose sequence wins even when an older aborted request committed later on the server');
  for (let i = 0; i < 10; i++) { now += 200; timer(); await settle(); } assert.equal(writes.length, 1, 'resting heartbeats are not per frame');
  now += 1000; timer(); await settle(); assert.equal(writes.length, 2);
  let release; block = new Promise(resolve => { release = resolve; });
  current = { ...current, x: 1 }; now += 200; timer(); await settle(); const before = writes.length;
  for (let i = 0; i < 5; i++) { current = { ...current, x: 1 + i * .1 }; now += 200; timer(); }
  await settle(); assert.equal(writes.length, before, 'one in-flight write, no queue of old motion');
  release(); block = null; await settle(); now += 200; timer(); await settle(); assert.equal((await crypt.decryptObj(key, writes.at(-1).options.body.d)).x, 1.4, 'next write coalesces to the newest position');
  current = { ...current, mode: 'wave', gesture: 'cheer' };
  session.publish(); await settle();
  assert.equal((await crypt.decryptObj(key, writes.at(-1).options.body.d)).gesture, 'cheer', 'tap publishes without a render or a heartbeat');
  now += state.LEASE_MS + 1; timer(); await settle(); assert.equal(peer.at(-1), null, 'sleeping partner expires');
  stream.onDown(); assert.equal(statuses.at(-1), 'connecting'); assert.equal(peer.at(-1), null);
  session.close(); assert.equal(timer, null); assert.equal(stream.closed, true); assert.equal(timers.size, 0);
  const count = writes.length;
  const rejected = presence.joinWorld({ space: '../outside', uid: 'alice', peer: 'deiva', key, pose: () => current, partner() {}, status: s => statuses.push(s) });
  assert.equal(statuses.at(-1), 'unavailable'); await settle(); assert.equal(writes.length, count); rejected.close();
  let unavailable = true;
  network.dbReq = async () => { if (unavailable) throw new Error('Temporary write failure'); };
  const stopRecovering = presence.joinWorld({ space: 'a'.repeat(40), uid: 'alice', peer: 'deiva', key, pose: () => current, partner() {}, status: s => statuses.push(s) });
  stream.on('put', { path: '/', data: null });
  await settle(); assert.equal(statuses.at(-1), 'connecting');
  unavailable = false; now += 600; timer(); await settle();
  assert.equal(statuses.at(-1), 'live', 'write recovery works while the receive stream is quiet');
  stopRecovering.close();
  network.dbReq = async () => { const e = new Error('denied'); e.status = 403; throw e; };
  const stopDenied = presence.joinWorld({ space: 'a'.repeat(40), uid: 'alice', peer: 'deiva', key, pose: () => current, partner() {}, status: s => statuses.push(s) });
  await settle(); assert.equal(statuses.at(-1), 'unavailable'); assert.equal(stream.closed, true); stopDenied.close();
  console.log('PASS: indoor routes and thresholds, walls, gesture bounds, ciphertext, sequencing, heartbeat, coalescing, cleanup.');
}
async function faces() {
  const three = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const skeleton = await import('three/examples/jsm/utils/SkeletonUtils.js');
  // GLTFLoader can decode the skin and morph geometry in Node. Pixels are checked in the browser.
  globalThis.self = globalThis;
  globalThis.createImageBitmap = async () => ({ width: 1, height: 1 });
  const loadModel = async path => {
    const bytes = fs.readFileSync(`public/${path}`);
    return (await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene;
  };
  const mocap = load('src/lib/mocap.ts', { three });
  const canvas = { getContext: () => ({
    createRadialGradient: () => ({ addColorStop() {} }), fillRect() {},
  }) };
  const { loadActor } = load('src/lib/courtyard/actor.ts', {
    three, 'three/examples/jsm/utils/SkeletonUtils.js': skeleton,
    '../config': { asset: path => path },
    '../mocap': mocap, '../people3d': { model: loadModel, prepare: root => root },
  }, {
    document: { createElement: () => canvas },
    fetch: async path => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(`public/${path}`, 'utf8')) }),
  });
  const signal = new AbortController().signal;
  for (const id of ['f07', 'm17']) {
    const original = `people/${id}.glb`, refined = `people/explore/${id}.glb`;
    const gender = id[0];
    const actor = await loadActor(['bad-import.glb', refined, original], gender, signal);
    const face = actor.holder.getObjectByName('TwodoFace');
    assert(face?.isSkinnedMesh, 'the new face uses the humanoid skin');
    assert(face.skeleton.bones.includes(actor.head), 'both the face and camera use the same head bone');
    for (const attr of Object.values(face.geometry.attributes)) {
      assert.equal(attr.count, face.geometry.attributes.position.count, 'vertex attributes match the subdivided mesh');
    }
    const weights = face.geometry.getAttribute('skinWeight');
    for (let i = 0; i < weights.count; i++) {
      assert(Math.abs(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i) - 1) < .001);
    }
    const peaks = [];
    for (const gesture of state.GESTURES) {
      actor.mode('wave', false, gesture);
      actor.update(.34, false);
      peaks.push([...face.morphTargetInfluences]);
      actor.mode('idle', false);
      actor.update(.3, false);
      assert(face.morphTargetInfluences.every(weight => Math.abs(weight) < .001), 'reaction settles to neutral');
    }
    assert(peaks[0][0] > .3 && peaks[1][0] > peaks[0][0] && peaks[2][1] > .5, 'wave, clap and cheer use distinct faces');
    actor.mode('walk', false);
    actor.update(.4, false);
    actor.mode('wave', false, 'cheer');
    actor.update(.34, false);
    actor.mode('wave', true, 'cheer');
    actor.update(.34, true);
    assert(face.morphTargetInfluences.every(weight => Math.abs(weight) < .001), 'Reduce Motion keeps the neutral face');
    actor.destroy();
    const imported = await loadActor([original, refined], gender, signal);
    assert(!imported.holder.getObjectByName('TwodoFace'), 'a working imported rig has priority');
    imported.destroy();
    const fallback = await loadActor(['missing-prototype.glb', original], gender, signal);
    assert(!fallback.holder.getObjectByName('TwodoFace'), 'an unavailable prototype falls back to the selected rig');
    fallback.destroy();
  }
  console.log('PASS: facial skin weights, both rigs, three expressions, neutral/reduced motion, import priority and fallback.');
}
main().then(faces).catch(error => { console.error(error); process.exitCode = 1; });
