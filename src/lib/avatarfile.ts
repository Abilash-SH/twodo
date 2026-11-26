/* Twodo · your own 3D avatar's file (docs/own-avatar.md): checked, made small and given a face picture, all on the
   phone. Loaded only when an avatar is imported or arrives (it brings three.js). Nothing here touches the network. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { asset } from './config';
import { bake, makeRig, parseMotion } from './mocap';
import { lights, makeRenderer, prepare } from './people3d';

export const MAX_IN = 40e6, MAX_KEPT = 6e6, MAX_VERTS = 400000;
/** Why a file was refused, in words for the person */
export class AvatarError extends Error {}

/** The glTF's JSON, if this is a glTF 2 binary that keeps everything inside itself and needs nothing we can't read */
function glbJson(buf: ArrayBuffer): Record<string, unknown> {
  const no = (why: string) => new AvatarError(why);
  if (buf.byteLength < 20 || buf.byteLength > MAX_IN) throw no(buf.byteLength > MAX_IN ? 'That file is too big (over 40 MB).' : 'That isn’t an avatar file.');
  const v = new DataView(buf);
  if (v.getUint32(0, true) !== 0x46546c67 || v.getUint32(4, true) !== 2) throw no('That isn’t a .glb avatar file.');
  const len = v.getUint32(12, true);
  if (v.getUint32(16, true) !== 0x4e4f534a || 20 + len > buf.byteLength) throw no('That .glb file is damaged.');
  let j: Record<string, unknown>;
  try { j = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, len))); } catch { throw no('That .glb file is damaged.'); }
  const list = (k: string) => (Array.isArray(j[k]) ? j[k] as Record<string, unknown>[] : []);
  // nothing outside the file: no links to download, not even embedded data links
  if ([...list('buffers'), ...list('images')].some(x => x && x.uri !== undefined)) throw no('That file points to other files. Export it as a single .glb.');
  const OK = new Set(['KHR_materials_emissive_strength', 'KHR_texture_transform', 'KHR_materials_specular', 'KHR_materials_ior']);
  if (Array.isArray(j.extensionsRequired) && j.extensionsRequired.some(e => !OK.has(String(e)))) throw no('That file needs something Twodo can’t read. Export it again as a plain .glb.');
  const acc = list('accessors');
  const verts = list('meshes').reduce((n, m) => n + (Array.isArray(m.primitives) ? (m.primitives as Record<string, unknown>[]) : []).reduce((k, p) => {
    const i = (p.attributes as Record<string, unknown> | undefined)?.POSITION;
    return k + (typeof i === 'number' && acc[i] ? Number(acc[i].count) || 0 : 0);
  }, 0), 0);
  if (!verts || verts > MAX_VERTS) throw no(verts ? 'That avatar is too detailed for a phone.' : 'There’s no person in that file.');
  return j;
}

const loader = new GLTFLoader();
function parse(buf: ArrayBuffer): Promise<THREE.Object3D> {
  glbJson(buf);
  return new Promise((res, rej) => loader.parse(buf.slice(0), '', g => res(g.scene), () => rej(new AvatarError('That .glb file couldn’t be read.'))));
}
/** A file from the network or this phone: checked again before it is drawn */
export async function checkKept(buf: ArrayBuffer): Promise<void> {
  if (buf.byteLength > MAX_KEPT) throw new AvatarError('too big');
  if (!makeRig(await parse(buf))) throw new AvatarError('no person');
}

/** A picture drawn small enough to keep: the colour only, JPEG unless it has see-through parts (hair, lashes) */
function shrinkMap(t: THREE.Texture | null, cut: boolean): void {
  const img = t?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!t || !img || !img.width) return;
  const side = cut ? 512 : 1024, s = Math.min(1, side / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  t.image = c; t.userData.mimeType = cut ? 'image/png' : 'image/jpeg'; t.needsUpdate = true;
}

/** Your avatar as Twodo keeps and sends it: checked, a person we can move, colour pictures only, written again */
export async function shrink(buf: ArrayBuffer): Promise<Uint8Array<ArrayBuffer>> {
  const root = await parse(buf);
  if (!makeRig(root)) throw new AvatarError('Twodo can’t find a person to move in that file. Export the avatar with its skeleton.');
  root.traverse(o => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    for (const mt of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
      const cut = mt.transparent || mt.alphaTest > 0;
      for (const k of ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'lightMap', 'bumpMap', 'displacementMap'] as const) (mt as unknown as Record<string, unknown>)[k] = null;
      shrinkMap(mt.map, cut);
    }
  });
  const out = await new GLTFExporter().parseAsync(root, { binary: true, animations: [], maxTextureSize: 1024 }) as ArrayBuffer;
  if (out.byteLength > MAX_KEPT) throw new AvatarError('That avatar is still too big after making it smaller.');
  await checkKept(out);
  return new Uint8Array(out);
}

/** A head-and-shoulders picture (192 px JPEG) for small round pictures, standing as in the app (null without WebGL) */
export async function faceShot(buf: ArrayBuffer, g: 'f' | 'm'): Promise<string | null> {
  const root = prepare(await parse(buf)), rig = makeRig(root); if (!rig) return null;
  const canvas = document.createElement('canvas'), r = makeRenderer(canvas); if (!r) return null;
  try {
    root.rotation.y = -new THREE.Euler().setFromQuaternion(rig.face, 'YXZ').y;
    const raw = await fetch(asset(`people/motion/${g}_idle.json`)).then(x => (x.ok ? x.json() : null)).catch(() => null), m = raw && parseMotion(raw);
    if (m) { const mx = new THREE.AnimationMixer(root); mx.clipAction(bake(m, rig)).play(); mx.update(0); }
    const scene = new THREE.Scene(); lights(scene); scene.add(root); root.updateMatrixWorld(true);
    const head = new THREE.Vector3().setFromMatrixPosition(rig.bone.get('head')!.matrixWorld);
    const cam = new THREE.PerspectiveCamera(22, 1, .01, 20); cam.position.set(head.x, head.y + .03, head.z + .95); cam.lookAt(head.x, head.y + .01, head.z);
    r.setPixelRatio(1); r.setSize(192, 192, false); r.setClearColor(0xF4EFEA, 1); r.render(scene, cam);
    return canvas.toDataURL('image/jpeg', .85);
  } finally { r.dispose(); r.forceContextLoss(); }
}
