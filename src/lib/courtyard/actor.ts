import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { asset } from '../config';
import { bake, makeRig, parseMotion, type Motion } from '../mocap';
import { model, prepare } from '../people3d';
import type { PoseMode, WorldGesture } from './state';

export interface Actor {
  holder: T.Group; head: T.Object3D;
  mode(next: PoseMode, reduced: boolean, gesture?: WorldGesture): void;
  update(dt: number, reduced: boolean): void;
  destroy(): void;
}
/** Materials are owned by this scene; shared cached model geometry and textures are never disposed here. */
export async function loadActor(url: string, gender: 'm' | 'f', signal: AbortSignal): Promise<Actor> {
  const root = clone(await model(url)), owned: T.Material[] = [];
  root.traverse(o => { const mesh = o as T.Mesh; if (!mesh.isMesh) return;
    const copy = (m: T.Material) => { const c = m.clone(); owned.push(c); return c; };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(copy) : copy(mesh.material);
    mesh.castShadow = false; mesh.receiveShadow = true;
  });
  try {
    signal.throwIfAborted(); prepare(root);
    const supported = makeRig(root);
    if (!supported) throw new Error('The avatar has no supported human skeleton');
    const rig = supported;
    const loadMotion = async (name: string) => {
      const response = await fetch(asset(`people/motion/${gender}_${name}.json`), { signal });
      if (!response.ok) throw new Error('A movement could not load');
      const motion = parseMotion(await response.json()); if (!motion) throw new Error('A movement was invalid'); return motion;
    };
    const motions = await Promise.all(['idle', 'walk', 'wave'].map(loadMotion));
    const additional = await Promise.all((['clap', 'cheer'] as const).map(async name => {
      try { return { name, motion: await loadMotion(name) }; }
      catch { return null; } // Cached rooms still work offline without these two decorative clips.
    }));
    signal.throwIfAborted();
    root.rotation.y = -new T.Euler().setFromQuaternion(rig.face, 'YXZ').y;
    root.position.y = -(rig.hipsW.y - rig.hipsH);
    const holder = new T.Group(); holder.scale.setScalar(1.7 / rig.height); holder.add(root);
    // Static courtyard shadows are drawn once. A cheap contact shadow follows each moving person.
    const c = document.createElement('canvas'); c.width = c.height = 64; const cx = c.getContext('2d')!;
    const gradient = cx.createRadialGradient(32, 32, 1, 32, 32, 31); gradient.addColorStop(0, 'rgba(0,0,0,.3)'); gradient.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = gradient; cx.fillRect(0, 0, 64, 64);
    const shadowTexture = new T.CanvasTexture(c), shadowGeometry = new T.PlaneGeometry(.8 / holder.scale.x, .6 / holder.scale.x);
    const shadowMaterial = new T.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false });
    const shadow = new T.Mesh(shadowGeometry, shadowMaterial); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .015 / holder.scale.x; holder.add(shadow);
    const mixer = new T.AnimationMixer(root), actions = new Map<PoseMode | WorldGesture, T.AnimationAction>();
    const idle = motions[0], sitQ = new Float32Array(idle.bones.length * 4 * 2), hips = new Float32Array([0, -.43, 0, 0, -.43, 0]);
    for (let f = 0; f < 2; f++) idle.bones.forEach((bone, i) => {
      const out = (f * idle.bones.length + i) * 4;
      if (bone === 'lUpLeg' || bone === 'rUpLeg') new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2).toArray(sitQ, out);
      else if (/^[lr](Leg|Foot|Toe)$/.test(bone)) new T.Quaternion().toArray(sitQ, out);
      else sitQ.set(idle.q.subarray(i * 4, i * 4 + 4), out);
    });
    const seated: Motion = { ...idle, name: 'sit', frames: 2, fps: 1, loop: true, q: sitQ, hips };
    function add(name: PoseMode | WorldGesture, motion: Motion): void {
      const action = mixer.clipAction(bake(motion, rig)); actions.set(name, action);
      if (name === 'wave' || name === 'clap' || name === 'cheer') {
        action.setLoop(T.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.setEffectiveTimeScale(action.getClip().duration / 1.3);
      }
      if (name === 'walk') action.setEffectiveTimeScale(1.45 / Math.max(.1, motion.speed * rig.hipsH * holder.scale.x));
    }
    add('idle', motions[0]); add('walk', motions[1]); add('wave', motions[2]); add('sit', seated);
    for (const item of additional) if (item) add(item.name, item.motion);
    let current: T.AnimationAction | null = null, currentMode: PoseMode | WorldGesture | null = null;
    const actor: Actor = {
      holder, head: rig.bone.get('head')!,
      mode(next, reduced, gesture) {
        const name = reduced && next !== 'sit' ? 'idle' : next === 'wave' && gesture && actions.has(gesture) ? gesture : next;
        if (name === currentMode) return;
        const action = actions.get(name)!;
        action.reset().setEffectiveWeight(1).play();
        if (current) current.crossFadeTo(action, reduced ? 0 : .22, false);
        current = action; currentMode = name;
        if (reduced) mixer.update(.01);
      },
      update(dt, reduced) { if (!reduced) mixer.update(dt); },
      destroy() { mixer.stopAllAction(); mixer.uncacheRoot(root); owned.forEach(m => m.dispose()); shadowTexture.dispose(); shadowGeometry.dispose(); shadowMaterial.dispose(); holder.removeFromParent(); },
    };
    actor.mode('idle', false); mixer.update(.05);
    return actor;
  } catch (error) { owned.forEach(m => m.dispose()); throw error; }
}
