/* Twodo · motion for the 3D people: motion-capture clips played on any human skeleton.
   The clips (public/people/motion/<g>_<name>.json) come from Microsoft Rocketbox (MIT), made small by
   scripts/people/motions_blender.py. Each frame says how far each body bone has turned from a T pose, in the world
   (Y up, the person facing +Z), and where the hips are, in hips heights. A skeleton plays a clip by turning each of its
   own bones the same amount from its own T pose, so it works whatever the bones are called or how their axes point:
   a Rocketbox person (Bip01 bones) or an avatar of your own (Hips, Spine, LeftArm…). Bones a skeleton doesn't have are
   skipped; bones a clip doesn't move stay as they are.
   Nothing here touches the page: it turns clips into three.js AnimationClips. Every clip is checked before use. */
import * as THREE from 'three';

const BODY = ['hips', 'spine', 'spine1', 'spine2', 'neck', 'head', 'lShoulder', 'lArm', 'lForeArm', 'lHand', 'rShoulder', 'rArm', 'rForeArm', 'rHand',
  'lUpLeg', 'lLeg', 'lFoot', 'lToe', 'rUpLeg', 'rLeg', 'rFoot', 'rToe'] as const;
const FINGERS = (['l', 'r'] as const).flatMap(s => (['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] as const).flatMap(f => [1, 2, 3].map(j => `${s}${f}${j}`)));
export const HUMANOID: readonly string[] = [...BODY, ...FINGERS];
const KNOWN = new Set(HUMANOID);
/** the humanoid bone a finger joint hangs from (a still joint keeps its turn relative to it) */
const PARENT = (h: string): string => { const m = /^([lr])([A-Za-z]+)(\d)$/.exec(h)!; return m[3] === '1' ? `${m[1]}Hand` : `${m[1]}${m[2]}${+m[3] - 1}`; };

/** What a bone may be called: Rocketbox (three.js turns spaces into underscores), and Mixamo-style names
 *  (Avaturn, Ready Player Me, Mixamo with or without its "mixamorig" prefix). Compared without case. */
const RB_FINGER = { Thumb: 0, Index: 1, Middle: 2, Ring: 3, Pinky: 4 } as const;
function names(h: string): string[] {
  const side = h[0] === 'l' ? 'Left' : 'Right', S = h[0] === 'l' ? 'L' : 'R', rest = h.slice(1);
  const body: Record<string, [string, string]> = {
    hips: ['Bip01_Pelvis', 'Hips'], spine: ['Bip01_Spine', 'Spine'], spine1: ['Bip01_Spine1', 'Spine1'], spine2: ['Bip01_Spine2', 'Spine2'],
    neck: ['Bip01_Neck', 'Neck'], head: ['Bip01_Head', 'Head'],
  };
  if (body[h]) return body[h];
  const limb: Record<string, [string, string]> = {
    Shoulder: [`Bip01_${S}_Clavicle`, `${side}Shoulder`], Arm: [`Bip01_${S}_UpperArm`, `${side}Arm`], ForeArm: [`Bip01_${S}_Forearm`, `${side}ForeArm`],
    Hand: [`Bip01_${S}_Hand`, `${side}Hand`], UpLeg: [`Bip01_${S}_Thigh`, `${side}UpLeg`], Leg: [`Bip01_${S}_Calf`, `${side}Leg`],
    Foot: [`Bip01_${S}_Foot`, `${side}Foot`], Toe: [`Bip01_${S}_Toe0`, `${side}ToeBase`],
  };
  if (limb[rest]) return limb[rest];
  const m = /^([A-Za-z]+)(\d)$/.exec(rest);
  if (!m) return [];
  const i = RB_FINGER[m[1] as keyof typeof RB_FINGER], j = +m[2];
  return [`Bip01_${S}_Finger${i}${j === 1 ? '' : j - 1}`, `${side}Hand${m[1]}${j}`];
}
const key = (n: string) => n.replace(/^mixamorig[_:]?/i, '').toLowerCase();

/* ---------- clips ---------- */
export interface Motion {
  name: string; fps: number; frames: number; loop: boolean;
  /** walking: how far the hips travel a second, in hips heights (the clip itself stays in place) */
  speed: number;
  bones: string[]; q: Float32Array; still: string[]; sq: Float32Array; hips: Float32Array;
}
function int16(b64: string): Int16Array {
  const s = atob(b64), n = s.length >> 1, out = new Int16Array(n);
  for (let i = 0; i < n; i++) { const v = s.charCodeAt(2 * i) | (s.charCodeAt(2 * i + 1) << 8); out[i] = v >= 0x8000 ? v - 0x10000 : v; }
  return out;
}
/** A clip read from a file, checked: anything that doesn't fit is refused (null) */
export function parseMotion(raw: unknown): Motion | null {
  try {
    const o = raw as Record<string, unknown>;
    if (!o || o.v !== 1 || typeof o.name !== 'string' || !/^[a-z][a-z0-9_]{0,23}$/.test(o.name)) return null;
    const fps = Number(o.fps), frames = Number(o.frames), speed = Number(o.speed);
    if (!(fps >= 1 && fps <= 60) || !Number.isInteger(frames) || frames < 2 || frames > 3600 || !(speed >= 0 && speed < 5)) return null;
    const bones = o.bones, still = o.still;
    if (!Array.isArray(bones) || !Array.isArray(still) || bones.length > 64 || still.length > 64) return null;
    if (![...bones, ...still].every(b => typeof b === 'string' && KNOWN.has(b))) return null;
    if (still.some(b => FINGERS.indexOf(b as string) < 0)) return null; // only finger joints are kept still
    if (typeof o.q !== 'string' || typeof o.sq !== 'string' || typeof o.hips !== 'string') return null;
    const q = int16(o.q), sq = int16(o.sq), hips = int16(o.hips);
    if (q.length !== frames * bones.length * 4 || sq.length !== still.length * 4 || hips.length !== frames * 3) return null;
    return {
      name: o.name, fps, frames, loop: !!o.loop, speed, bones: bones as string[], still: still as string[],
      q: Float32Array.from(q, v => v / 32767), sq: Float32Array.from(sq, v => v / 32767), hips: Float32Array.from(hips, v => v / 10000),
    };
  } catch { return null; }
}

/* ---------- skeletons ---------- */
export interface Rig {
  root: THREE.Object3D;
  bone: Map<string, THREE.Object3D>;       // humanoid name → bone
  order: string[];                          // mapped humanoid bones, parents before children
  restLocal: Map<THREE.Object3D, THREE.Quaternion>;
  restW: Map<string, THREE.Quaternion>;     // each mapped bone's turn in a T pose, relative to the root
  face: THREE.Quaternion;                   // from facing +Z to the way this skeleton faces
  hipsH: number; hipsW: THREE.Vector3; hipsParentInv: THREE.Matrix4;
  /** how tall the person stands, from the feet (y = 0 at the lowest bone) to the top of the head bone */
  height: number;
}
const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();

/** Find the human skeleton under `root` (in its bind pose) and measure it. Null if it isn't a person. */
export function makeRig(root: THREE.Object3D): Rig | null {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const byKey = new Map<string, THREE.Object3D>();
  root.traverse(o => { if ((o as THREE.Bone).isBone || o.type === 'Bone') { const k = key(o.name); if (!byKey.has(k)) byKey.set(k, o); } });
  const bone = new Map<string, THREE.Object3D>();
  for (const h of HUMANOID) { for (const n of names(h)) { const b = byKey.get(key(n)); if (b) { bone.set(h, b); break; } } }
  for (const need of ['hips', 'spine', 'head', 'lArm', 'lForeArm', 'rArm', 'rForeArm', 'lUpLeg', 'lLeg', 'rUpLeg', 'rLeg'])
    if (!bone.has(need)) return null;
  const depth = (o: THREE.Object3D) => { let d = 0; for (let p = o.parent; p && p !== root; p = p.parent) d++; return d; };
  const order = [...bone.keys()].sort((a, b) => depth(bone.get(a)!) - depth(bone.get(b)!));
  const restLocal = new Map<THREE.Object3D, THREE.Quaternion>();
  root.traverse(o => { if (o !== root) restLocal.set(o, o.quaternion.clone()); });
  const rs = (o: THREE.Object3D) => new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); // root space
  const pos = (h: string) => V().setFromMatrixPosition(rs(bone.get(h)!));
  const restW = new Map<string, THREE.Quaternion>();
  for (const h of order) { const m = rs(bone.get(h)!), q = Q(), s = V(); m.decompose(V(), q, s); restW.set(h, q); }
  // which way it faces: its left is +X when it faces +Z
  const lr = pos('lArm').sub(pos('rArm')); lr.y = 0;
  const fwd = V().crossVectors(lr, new THREE.Vector3(0, 1, 0)).normalize();
  const face = Q().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(fwd.x, fwd.z));
  // Measured from a true T pose, as the clips are: arms straight out to the sides, legs straight down. A skeleton
  // bound in another pose (arms lower, legs apart) is measured as if it stood that way.
  const P = new Map(order.map(h => [h, pos(h)]));
  const below = (h: string) => { const top = bone.get(h)!; return order.filter(x => { for (let p: THREE.Object3D | null = bone.get(x)!; p; p = p.parent) if (p === top) return true; return false; }); };
  const align = (h: string, next: string, want: THREE.Vector3) => {
    if (!P.has(h) || !P.has(next)) return;
    const fix = Q().setFromUnitVectors(P.get(next)!.clone().sub(P.get(h)!).normalize(), want), pivot = P.get(h)!.clone();
    for (const x of below(h)) { restW.get(x)!.premultiply(fix); P.get(x)!.sub(pivot).applyQuaternion(fix).add(pivot); }
  };
  const left = new THREE.Vector3(1, 0, 0).applyQuaternion(face), right = left.clone().negate(), down = new THREE.Vector3(0, -1, 0);
  for (const [s, out] of [['l', left], ['r', right]] as const) {
    align(`${s}Arm`, `${s}ForeArm`, out); align(`${s}ForeArm`, `${s}Hand`, out);
    align(`${s}UpLeg`, `${s}Leg`, down); align(`${s}Leg`, `${s}Foot`, down);
  }
  const feet = Math.min(...['lFoot', 'rFoot', 'lToe', 'rToe'].filter(h => bone.has(h)).map(h => pos(h).y), pos('lLeg').y);
  const hipsW = pos('hips'), hipsH = hipsW.y - feet;
  const hb = bone.get('hips')!, hipsParentInv = hb.parent && hb.parent !== root ? rs(hb.parent).invert() : new THREE.Matrix4();
  const top = pos('head').y - feet;
  if (!(hipsH > .05 && top > hipsH)) return null;
  return { root, bone, order, restLocal, restW, face, hipsH, hipsW, hipsParentInv, height: top * 1.08 };
}

/** The clip for this skeleton: each frame's turns as its own bones' rotations (plus the hips' position) */
export function bake(m: Motion, rig: Rig): THREE.AnimationClip {
  const { bone, order, restLocal, restW, root } = rig, B = m.bones.length;
  const at = new Map(m.bones.map((b, i) => [b, i])), still = new Map(m.still.map((b, i) => [b, i]));
  const face = rig.face, faceInv = face.clone().invert();
  const stillQ = new Map<string, THREE.Quaternion>(), up = new Map<string, string>();
  for (const [h, i] of still) {
    stillQ.set(h, Q().set(m.sq[i * 4], m.sq[i * 4 + 1], m.sq[i * 4 + 2], m.sq[i * 4 + 3]).normalize().premultiply(face).multiply(faceInv));
    up.set(h, PARENT(h));
  }
  const used = order.filter(h => at.has(h) || still.has(h));
  const values = new Map(used.map(h => [h, new Float32Array(m.frames * 4)]));
  const hipsPos = new Float32Array(m.frames * 3), times = new Float32Array(m.frames);
  // scratch kept between frames (no garbage while baking): each bone's turn and each node's rotation, marked by frame
  const dq = new Map<string, THREE.Quaternion>(), dAt = new Map<string, number>();
  const wq = new Map<THREE.Object3D, THREE.Quaternion>(), wAt = new Map<THREE.Object3D, number>();
  const ONE = Q(), local = Q(), wp = V(), prev = new Map(used.map(h => [h, Q()])), seen = new Set<string>();
  const slot = <K>(map: Map<K, THREE.Quaternion>, k: K) => { let q = map.get(k); if (!q) { q = Q(); map.set(k, q); } return q; };
  const world = (o: THREE.Object3D | null, f: number): THREE.Quaternion => {
    if (!o || o === root) return ONE;
    if (wAt.get(o) === f) return wq.get(o)!;
    const w = slot(wq, o).copy(world(o.parent, f)).multiply(restLocal.get(o) || o.quaternion);
    wAt.set(o, f); return w;
  };
  const delta = (h: string, f: number): THREE.Quaternion | null => {
    if (dAt.get(h) === f) return dq.get(h)!;
    const i = at.get(h);
    let d: THREE.Quaternion;
    if (i !== undefined) { const k = (f * B + i) * 4; d = slot(dq, h).set(m.q[k], m.q[k + 1], m.q[k + 2], m.q[k + 3]).normalize().premultiply(face).multiply(faceInv); }
    else if (still.has(h)) { const p = delta(up.get(h)!, f); if (!p) return null; d = slot(dq, h).copy(p).multiply(stillQ.get(h)!); }
    else return null;
    dAt.set(h, f); return d;
  };
  for (let f = 0; f < m.frames; f++) {
    times[f] = f / m.fps;
    for (const h of used) {
      const b = bone.get(h)!, d = delta(h, f); if (!d) continue;
      const w = slot(wq, b).copy(d).multiply(restW.get(h)!); wAt.set(b, f);
      local.copy(world(b.parent, f)).invert().multiply(w);
      const p = prev.get(h)!;
      if (seen.has(h) && p.dot(local) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
      p.copy(local); seen.add(h); local.toArray(values.get(h)!, f * 4);
    }
    wp.set(m.hips[f * 3], m.hips[f * 3 + 1], m.hips[f * 3 + 2]).multiplyScalar(rig.hipsH).applyQuaternion(face).add(rig.hipsW).applyMatrix4(rig.hipsParentInv);
    wp.toArray(hipsPos, f * 3);
  }
  const tracks: THREE.KeyframeTrack[] = used.map(h => new THREE.QuaternionKeyframeTrack(`${bone.get(h)!.uuid}.quaternion`, times, values.get(h)!));
  tracks.push(new THREE.VectorKeyframeTrack(`${bone.get('hips')!.uuid}.position`, times, hipsPos));
  return new THREE.AnimationClip(m.name, (m.frames - 1) / m.fps, tracks);
}
