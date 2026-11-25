/* Twodo · the two of you on Home (2026-11-25: "realistic 3D where it turns 360 degree… Don't stand on the card, I want
   them to have some animations, movements like that"). The realistic 3D people (lib/people.ts) stand free on Home's
   background, both in one WebGL canvas, and move by motion capture (lib/mocap.ts: Microsoft Rocketbox, MIT):
   - they breathe and shift their weight, look around, touch their hair, stretch in the morning, yawn late at night,
     think, walk somewhere else and turn back, turn to each other and wave, and now and then dance;
   - a finger turns either of you all the way round (360°; a flick keeps them turning); a tap and they wave at you;
   - they come to rest two minutes after the last touch, and nothing is drawn while Home is covered, hidden or
     scrolled away (battery). With Reduce Motion they stand still and only your finger turns them.
   What they do is chosen from the time of day and what Home already knows (`Vibe`); nothing is stored or sent.
   Loaded only when Home shows them (a dynamic import), like three.js itself. */
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { asset } from './config';
import { bake, makeRig, parseMotion, type Motion, type Rig } from './mocap';
import { lights, makeRenderer, model, prepare } from './people3d';
import { reducedMotion } from './util';

export type Body = 'f' | 'm';
export type Act = 'wave' | 'hello' | 'cheer' | 'clap' | 'dance' | 'stretch' | 'hair' | 'think' | 'yawn' | 'photo' | 'look';
export interface Who { id: string; url: string; g: Body }
/** what Home knows that colours what they do */
export interface Vibe { free: boolean; unread: boolean; ptDone: boolean }

/* ---------- the clips, read once per body ---------- */
const clips = new Map<string, Promise<Motion | null>>();
function clip(g: Body, name: string): Promise<Motion | null> {
  const k = `${g}_${name}`;
  let p = clips.get(k);
  if (!p) {
    const url = asset(`people/motion/${k}.json`);
    // offline, only what this phone already keeps (sw.js): no failed downloads; it's asked for again later
    const kept = () => (typeof navigator !== 'undefined' && !navigator.onLine && typeof caches !== 'undefined' ? caches.match(url).then(r => !!r, () => false) : Promise.resolve(true));
    p = kept().then(ok => (ok ? fetch(url).then(r => (r.ok ? r.json() : null)).then(parseMotion) : null)).catch(() => null);
    clips.set(k, p); void p.then(m => { if (!m) clips.delete(k); });
  }
  return p;
}

const FADE = .45, TAU = Math.PI * 2, REST_MS = 120e3, FRAME_MS = 32;
const WIDE = new Set(['stretch', 'hello', 'dance', 'cheer']);   // arms out: done nearer the middle, so nothing is cut off
const wrap = (a: number) => (((a + Math.PI) % TAU) + TAU) % TAU - Math.PI;   // to -π…π
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

interface Task { kind: 'act' | 'walk' | 'turn' | 'wait'; name?: string; to?: THREE.Vector2; yaw?: number; until?: number; started?: boolean; endAt?: number; then?: Task | null }

class Person {
  holder = new THREE.Group();
  acts = new Map<string, THREE.AnimationAction>();
  cur: THREE.AnimationAction | null = null; curName = '';
  pos: THREE.Vector2; yaw = 0; restYaw = 0; spin = 0; held = false;
  task: Task | null = null; nextAt = 0; idle = 'idle';
  mixer: THREE.AnimationMixer;
  constructor(readonly who: Who, readonly root: THREE.Object3D, readonly rig: Rig, readonly shadow: THREE.Mesh, at: THREE.Vector2) {
    this.mixer = new THREE.AnimationMixer(root);
    this.pos = at.clone();
    this.holder.add(root);
  }
  get speed(): number { const w = this.acts.get('walk'); return w ? ((w.getClip().userData.speed as number) || .9) * this.rig.hipsH : 0; }
}

/** A clip baked for this person's skeleton, ready to play (false: it couldn't be read) */
async function ensure(p: Person, name: string): Promise<boolean> {
  if (p.acts.has(name)) return true;
  const m = await clip(p.who.g, name);
  if (!m) return false;
  const c = bake(m, p.rig); c.userData.speed = m.speed;
  if (!p.acts.has(name)) p.acts.set(name, p.mixer.clipAction(c));
  return true;
}
function play(p: Person, name: string, fade = FADE, scale = 1): number {
  const a = p.acts.get(name); if (!a) return 0;
  const loop = name === 'idle' || name === 'idle2' || name === 'walk';
  if (p.cur === a && loop) { a.setEffectiveTimeScale(scale); return a.getClip().duration; }
  a.reset(); a.enabled = true; a.setEffectiveTimeScale(scale); a.setEffectiveWeight(1);
  a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop;
  a.play();
  if (p.cur && p.cur !== a) p.cur.crossFadeTo(a, fade, false);
  p.cur = a; p.curName = name;
  return a.getClip().duration;
}

function shadowMaterial(): THREE.MeshBasicMaterial {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(27,23,48,.42)'); g.addColorStop(.55, 'rgba(27,23,48,.16)'); g.addColorStop(1, 'rgba(27,23,48,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false });
}

export interface StageHandle {
  /** who stands there: one person (alone) or two (you on the left, your partner on the right) */
  setPeople(list: Who[]): Promise<void>;
  act(id: string, a: Act): void;
  vibe(v: Vibe): void;
  /** the person under a point of the canvas (CSS pixels), or null */
  hit(x: number, y: number): string | null;
  grab(id: string): void; turnBy(id: string, rad: number): void; letGo(id: string, radPerS: number): void; tap(id: string): void;
  resize(w: number, h: number): void;
  /** false while Home is covered: nothing is drawn */
  setActive(on: boolean): void;
  destroy(): void;
}

/** Where someone ends up facing (radians, 0 = towards you) when a finger lets go, a flick stops or they turn back */
export type Report = (id: string, yaw: number, state: 'held' | 'spinning' | 'free' | 'rest' | `act:${string}`) => void;

/** The stage in `canvas` (w × h CSS pixels). Resolves once the people are drawn; throws without WebGL. */
export async function mountStage(canvas: HTMLCanvasElement, w: number, h: number, people: Who[], report: Report = () => {}): Promise<StageHandle> {
  const r = makeRenderer(canvas);
  if (!r) throw new Error('No WebGL');
  const scene = new THREE.Scene(); lights(scene);
  const cam = new THREE.PerspectiveCamera(24, w / h, .05, 50);
  const shadowMat = shadowMaterial(), shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  let list: Person[] = [], active = true, gone = false, raf = 0, last = 0, lastTouch = performance.now(), vibe: Vibe = { free: false, unread: false, ptDone: false };
  let size = { w, h };
  const still = () => reducedMotion.matches;

  const frame = () => {
    const tall = Math.max(1.6, ...list.map(p => p.rig.height)), pair = list.length > 1;
    const span = pair ? 2.55 : 1.25, high = tall * 1.1, fov2 = THREE.MathUtils.degToRad(cam.fov / 2);
    cam.aspect = size.w / size.h;
    const dist = Math.max(high / 2 / Math.tan(fov2), span / 2 / Math.tan(fov2) / cam.aspect);
    cam.position.set(0, tall * .6, dist); cam.lookAt(0, tall * .5, 0); cam.updateProjectionMatrix();
  };
  const resize = (nw: number, nh: number) => {
    size = { w: Math.max(1, Math.round(nw)), h: Math.max(1, Math.round(nh)) };
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(size.w, size.h, false); frame(); draw(0);
  };

  /* ---------- what they do ---------- */
  const restYaw = (p: Person) => { const o = list.find(x => x !== p); return o ? .35 * Math.sign(o.pos.x - p.pos.x || 1) : 0; };
  const toIdle = (p: Person) => { p.idle = Math.random() < .35 ? 'idle2' : 'idle'; play(p, p.acts.has(p.idle) ? p.idle : 'idle'); };
  const later = (p: Person, a = 4, b = 9) => { p.nextAt = performance.now() + rnd(a, b) * 1000; };
  const walkTo = (p: Person): Task | null => {
    const o = list.find(x => x !== p), left = !o || p.pos.x <= o.pos.x;
    for (let i = 0; i < 8; i++) {
      const to = new THREE.Vector2(o ? (left ? rnd(-.92, .1) : rnd(-.1, .92)) : rnd(-.4, .4), rnd(-.45, .3));
      if (to.distanceTo(p.pos) < .35) continue;
      if (o && (to.distanceTo(o.pos) < .62 || (o.task?.to && to.distanceTo(o.task.to) < .62))) continue;
      return { kind: 'walk', to, then: { kind: 'turn', yaw: NaN } };
    }
    return null;
  };
  const together = (p: Person): boolean => {
    const o = list.find(x => x !== p);
    if (!o || o.task || o.held || o.spin) return false;
    const face = (a: Person, b: Person) => Math.atan2(b.pos.x - a.pos.x, b.pos.y - a.pos.y);
    p.task = { kind: 'turn', yaw: face(p, o), then: { kind: 'act', name: 'wave', then: { kind: 'turn', yaw: NaN } } };
    o.task = { kind: 'turn', yaw: face(o, p), then: { kind: 'wait', until: 0, then: { kind: 'act', name: Math.random() < .5 ? 'wave' : 'clap', then: { kind: 'turn', yaw: NaN } } } };
    o.task.then!.until = performance.now() + 900;
    return true;
  };
  /** an act, after a few steps towards the middle if the arms would reach past the edge */
  const doing = (p: Person, name: string, then: Task | null = null): Task => {
    const act: Task = { kind: 'act', name, then };
    if (!WIDE.has(name) || Math.abs(p.pos.x) <= .45) return act;
    return { kind: 'walk', to: new THREE.Vector2(Math.sign(p.pos.x) * .42, p.pos.y * .5), then: { kind: 'turn', yaw: NaN, then: act } };
  };
  const decide = (p: Person) => {
    const h = new Date().getHours(), morning = h >= 5 && h < 11, late = h >= 22 || h < 5, mine = list[0] === p;
    const pool: [number, () => Task | null | boolean][] = [
      [3, () => doing(p, 'look')], [2, () => doing(p, 'hair')],
      [morning ? 3 : .6, () => doing(p, 'stretch')], [late ? 3 : .3, () => doing(p, 'yawn')],
      [1.4, () => doing(p, 'think')], [list.length > 1 ? 3.5 : 0, () => walkTo(p)], [list.length > 1 ? 2.2 : 0, () => together(p)],
      [vibe.free ? 1.6 : .35, () => doing(p, 'dance')], [vibe.free ? 1.2 : .25, () => doing(p, 'cheer')],
      [!mine && vibe.unread ? 2.5 : .4, () => ({ kind: 'turn', yaw: 0, then: doing(p, 'hello', { kind: 'turn', yaw: NaN }) })],
      [!mine && vibe.ptDone ? 1.6 : 0, () => doing(p, 'clap')],
    ];
    let n = Math.random() * pool.reduce((s, [wt]) => s + wt, 0);
    for (const [wt, make] of pool) {
      if ((n -= wt) > 0) continue;
      const t = make();
      if (t && t !== true) p.task = t;
      if (t) return; break;
    }
    later(p, 2, 4); // nothing fitted this time: try again soon
  };
  const step = (p: Person, dt: number, now: number) => {
    if (p.held) return;
    if (p.spin) {                                  // still turning after a flick
      p.yaw += p.spin * dt; p.spin *= Math.exp(-dt * 2.4);
      if (Math.abs(p.spin) < .25) { p.spin = 0; report(p.who.id, p.yaw, 'free'); p.task = { kind: 'wait', until: now + 2200, then: { kind: 'turn', yaw: NaN } }; }
      return;
    }
    const t = p.task;
    if (!t) { if (!still() && now >= p.nextAt && now - lastTouch < REST_MS) decide(p); return; }
    const done = () => { p.task = t.then || null; if (!p.task) later(p); };
    if (t.kind === 'wait') { if (now >= (t.until || 0)) done(); return; }
    if (t.kind === 'act') {
      if (!t.started) {
        t.started = true;
        if (!p.acts.has(t.name!)) { void ensure(p, t.name!); done(); return; }  // next time it's there
        const d = play(p, t.name!); t.endAt = now + Math.max(.5, d - FADE) * 1000; report(p.who.id, p.yaw, `act:${t.name}`); return;
      }
      if (now >= t.endAt!) { toIdle(p); done(); }
      return;
    }
    if (t.kind === 'turn') {
      if (Number.isNaN(t.yaw)) t.yaw = p.yaw + wrap(restYaw(p) - p.yaw);
      const d = wrap(t.yaw! - p.yaw);
      if (!t.started) { t.started = true; if (Math.abs(d) > 1 && p.acts.has('walk')) play(p, 'walk', .3, .72); }  // big turns step round
      if (Math.abs(d) < .02) { p.yaw += d; if (p.curName === 'walk') toIdle(p); done(); if (!p.task) report(p.who.id, p.yaw, 'rest'); return; }
      p.yaw += Math.sign(d) * Math.min(Math.abs(d), (p.curName === 'walk' ? 2.6 : 1.8) * dt);
      return;
    }
    // walk: face where you're going, then go there at the clip's own pace (the feet don't slide)
    if (!t.started) { t.started = true; if (!p.acts.has('walk')) { done(); return; } play(p, 'walk', .35); }
    const to = t.to!, dx = to.x - p.pos.x, dz = to.y - p.pos.y, dist = Math.hypot(dx, dz);
    const d = wrap(Math.atan2(dx, dz) - p.yaw);
    p.yaw += Math.sign(d) * Math.min(Math.abs(d), 4 * dt);
    const v = p.speed * dt * Math.max(0, Math.cos(d));
    if (dist <= v + .015) { p.pos.copy(to); toIdle(p); done(); return; }
    p.pos.x += Math.sin(p.yaw) * v; p.pos.y += Math.cos(p.yaw) * v;
  };

  const draw = (dt: number) => {
    const now = performance.now();
    for (const p of list) {
      if (dt > 0) step(p, dt, now);
      p.holder.position.set(p.pos.x, 0, p.pos.y); p.holder.rotation.y = p.yaw;
      p.shadow.position.set(p.pos.x, .002, p.pos.y);
      p.mixer.update(still() ? 0 : dt);
    }
    r.render(scene, cam);
  };
  const busy = () => list.some(p => p.held || p.spin || p.task);
  const loop = (t: number) => {
    raf = 0;
    if (gone || !active || document.hidden || still()) return;
    if (!last) last = t;
    if (t - last >= FRAME_MS) { draw(Math.min(.1, (t - last) / 1000)); last = t; }
    if (performance.now() - lastTouch < REST_MS || busy()) raf = requestAnimationFrame(loop);
  };
  const wake = (touch = false) => {
    if (touch) lastTouch = performance.now();
    if (still()) { draw(0); return; }
    if (!raf && active && !gone && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); }
  };
  const onVis = () => wake(true);
  document.addEventListener('visibilitychange', onVis);
  let onScreen = true, uncovered = true;
  const update = () => { active = onScreen && uncovered; if (active) wake(true); };
  const seen = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; update(); }) : null;
  seen?.observe(canvas);

  /* ---------- who is there ---------- */
  const load = async (who: Who, at: THREE.Vector2): Promise<Person | null> => {
    try {
      const root = prepare(cloneSkinned(await model(who.url)));
      const rig = makeRig(root); if (!rig) return null;
      const face = new THREE.Euler().setFromQuaternion(rig.face, 'YXZ').y;
      root.rotation.y = -face; root.position.y = -(rig.hipsW.y - rig.hipsH);              // facing you, feet on the floor
      const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.scale.set(.78, 1, .46);
      const p = new Person(who, root, rig, shadow, at);
      if (!(await ensure(p, 'idle'))) return null;
      await Promise.all(['idle2', 'walk'].map(n => ensure(p, n)));                       // the rest follows quietly
      play(p, 'idle', 0); p.mixer.setTime(Math.random() * 4);
      void (async () => {                                                                 // one at a time, in quiet moments
        for (const n of ['wave', 'look', 'hair', 'stretch', 'yawn', 'think', 'hello', 'clap', 'cheer', 'dance', 'photo']) {
          await new Promise(res => setTimeout(res, 400)); if (gone) return; await ensure(p, n);
        }
      })();
      return p;
    } catch { return null; }
  };
  const setPeople = async (next: Who[]) => {
    const spots = next.length > 1 ? [new THREE.Vector2(-.42, 0), new THREE.Vector2(.42, 0)] : [new THREE.Vector2(0, 0)];
    const keep = new Map(list.map(p => [p.who.id + p.who.url, p]));
    const made = await Promise.all(next.map((who, i) => keep.get(who.id + who.url) || load(who, spots[i])));
    if (gone) return;
    for (const p of list) if (!made.includes(p)) { scene.remove(p.holder, p.shadow); p.mixer.stopAllAction(); }
    list = made.filter((p): p is Person => !!p);
    list.forEach((p, i) => {
      if (!p.holder.parent) { scene.add(p.holder, p.shadow); p.pos.copy(spots[i] || spots[0]); }
      p.yaw = p.restYaw = restYaw(p); later(p, 4, 9);
    });
    frame(); draw(0); wake(true);
  };
  const by = (id: string) => list.find(p => p.who.id === id);

  resize(w, h);
  await setPeople(people);
  if (!list.length) { r.dispose(); throw new Error('No people'); }

  const handle: StageHandle = {
    setPeople,
    act(id, a) {
      const p = by(id); if (!p || still()) return;
      void ensure(p, a).then(ok => {
        if (!ok || p.held || gone) return;
        if (p.curName === 'walk') toIdle(p);
        p.spin = 0; p.task = { kind: 'turn', yaw: 0, then: doing(p, a, { kind: 'turn', yaw: NaN }) };
        wake(true);
      });
    },
    vibe(v) { vibe = v; },
    hit(x, y) {
      let best: Person | null = null, bestZ = -Infinity;
      for (const p of list) {
        const a = new THREE.Vector3(p.pos.x, 0, p.pos.y).project(cam), b = new THREE.Vector3(p.pos.x, p.rig.height, p.pos.y).project(cam);
        const sx = (v: THREE.Vector3) => (v.x + 1) / 2 * size.w, sy = (v: THREE.Vector3) => (1 - v.y) / 2 * size.h;
        const half = Math.abs(sy(a) - sy(b)) * .2 + 10;
        if (x < sx(a) - half || x > sx(a) + half || y < sy(b) - 8 || y > sy(a) + 8) continue;
        if (p.pos.y > bestZ) { best = p; bestZ = p.pos.y; }                               // the one in front
      }
      return best ? best.who.id : null;
    },
    grab(id) { const p = by(id); if (!p) return; p.held = true; p.spin = 0; if (p.task?.kind === 'walk' || p.curName === 'walk') toIdle(p); p.task = null; report(id, p.yaw, 'held'); wake(true); },
    turnBy(id, rad) { const p = by(id); if (!p) return; p.yaw += rad; lastTouch = performance.now(); if (still()) draw(0); },
    letGo(id, v) {
      const p = by(id); if (!p) return;
      p.held = false; p.spin = still() ? 0 : Math.max(-14, Math.min(14, v));
      if (!p.spin) p.task = still() ? null : { kind: 'wait', until: performance.now() + 2200, then: { kind: 'turn', yaw: NaN } };
      report(id, p.yaw, p.spin ? 'spinning' : 'free'); wake(true);
    },
    tap(id) { handle.act(id, 'wave'); },
    resize,
    setActive(on) { uncovered = on; update(); },
    destroy() {
      gone = true; cancelAnimationFrame(raf); seen?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      for (const p of list) p.mixer.stopAllAction();
      shadowGeo.dispose(); shadowMat.map?.dispose(); shadowMat.dispose(); r.dispose();
    },
  };
  return handle;
}
