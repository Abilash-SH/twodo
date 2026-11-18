/* Twodo · drawing the realistic 3D people (lib/people.ts) with three.js. Loaded only when a person is on screen
   (a dynamic import), so the app starts as fast as before.
   Each person has its own small WebGL canvas (a screen shows four at most; phones allow sixteen). The model file is
   downloaded and read once and shared; copying pictures between canvases would stall the GPU on every frame.
   The people breathe, shift their weight and look around a little; a mood (a wave, a hop) moves an arm or the whole
   body for a moment. With Reduce Motion they are drawn once and stand still. Nothing here reads data or the network
   beyond the model files from this site. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { reducedMotion } from './util';

let failed = false;
function makeRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer | null {
  if (failed) return null;
  try {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.setClearColor(0x000000, 0);
    return r;
  } catch { failed = true; return null; }
}

const loader = new GLTFLoader();
const models = new Map<string, Promise<THREE.Object3D>>();
function model(url: string): Promise<THREE.Object3D> {
  let p = models.get(url);
  if (!p) { p = loader.loadAsync(url).then(g => g.scene); models.set(url, p); p.catch(() => models.delete(url)); }
  return p;
}

const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
/** Turn a bone so the bone after it points along `dir` (in the world), keeping its parent where it is */
function aim(root: THREE.Object3D, bone: THREE.Object3D, next: THREE.Object3D, dir: THREE.Vector3): void {
  root.updateMatrixWorld(true);
  const a = bone.getWorldPosition(V()), b = next.getWorldPosition(V());
  const q = Q().setFromUnitVectors(b.sub(a).normalize(), dir.clone().normalize());
  const parentW = bone.parent!.getWorldQuaternion(Q()), boneW = bone.getWorldQuaternion(Q());
  bone.quaternion.copy(parentW.invert().multiply(q.multiply(boneW)));
  root.updateMatrixWorld(true);
}

interface Bones { pelvis?: THREE.Object3D; spine?: THREE.Object3D; neck?: THREE.Object3D; head?: THREE.Object3D; up?: THREE.Object3D; fore?: THREE.Object3D }
interface Inst {
  canvas: HTMLCanvasElement; r: THREE.WebGLRenderer; w: number; h: number; dpr: number;
  scene: THREE.Scene; cam: THREE.PerspectiveCamera; root: THREE.Object3D; bones: Bones; base: Map<THREE.Object3D, THREE.Quaternion>;
  raised?: THREE.Quaternion; seed: number; mood: string; moodAt: number; think: boolean; visible: boolean; drawn: boolean;
}
const insts = new Set<Inst>();

function lights(s: THREE.Scene): void {
  s.add(new THREE.HemisphereLight(0xFFF4EA, 0x8A7A70, 1.6));
  const key = new THREE.DirectionalLight(0xFFFFFF, 2.2); key.position.set(-1.2, 2.2, 2.4); s.add(key);
  const rim = new THREE.DirectionalLight(0xFFE2C8, 1.1); rim.position.set(1.6, 1.6, -1.6); s.add(rim);
}

function draw(i: Inst, t: number): void {
  const still = reducedMotion.matches, { bones: b, base } = i, s = t / 1000 + i.seed;
  for (const [bone, q] of base) bone.quaternion.copy(q);
  i.root.position.y = 0;
  if (!still) {
    if (b.spine) b.spine.rotateX(Math.sin(s * 1.7) * .012);                         // breathing
    if (b.pelvis) b.pelvis.rotateZ(Math.sin(s * .45) * .012);                       // weight shifting
    if (b.head) { b.head.rotateY(Math.sin(s * .5) * .07); b.head.rotateX(Math.sin(s * .37) * .03 + (i.think ? -.12 : 0)); }
    const m = (t - i.moodAt) / 1000;
    if (i.mood && m >= 0 && m < 1.8) {
      const env = Math.sin(Math.min(1, m / 1.8) * Math.PI);                          // up, then back down
      if ((i.mood === 'wave' || i.mood === 'cheer') && b.up && i.raised) {
        b.up.quaternion.slerp(i.raised, Math.min(1, env * 1.6));
        if (b.fore) b.fore.rotateZ(Math.sin(m * 11) * .45 * env);
      } else i.root.position.y = Math.abs(Math.sin(m * Math.PI * 2.2)) * .06 * env;  // a hop
    }
  }
  i.root.updateMatrixWorld(true);
  i.r.render(i.scene, i.cam);
  i.drawn = true;
}

/* They move for a while after something happens (a screen shows them, a mood), then stand still: a page left open
   must not keep the phone's GPU busy (battery) for a breath nobody is watching. */
const AWAKE_MS = 12000;
let raf = 0, last = 0, awakeUntil = 0;
function loop(t: number): void {
  raf = 0;
  if (document.hidden) return;
  if (t - last > 40) { last = t; for (const i of insts) if (i.visible) draw(i, t); }   // about 25 frames a second
  if (!reducedMotion.matches && t < awakeUntil && [...insts].some(i => i.visible)) raf = requestAnimationFrame(loop);
}
const wake = () => { awakeUntil = performance.now() + AWAKE_MS; if (!raf && !document.hidden) raf = requestAnimationFrame(loop); };
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', wake);
const seen = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => {
  for (const e of es) for (const i of insts) if (i.canvas === e.target) { i.visible = e.isIntersecting; if (i.visible && !i.drawn) draw(i, performance.now()); }
  wake();
}) : null;

export interface Handle { mood(m: string): void; think(on: boolean): void; destroy(): void }
/** Draw one person into `canvas` (w × h CSS pixels). Resolves once the first picture is there. */
export async function mount(canvas: HTMLCanvasElement, url: string, { w, h, flip, half = false }: { w: number; h: number; flip: boolean; half?: boolean }): Promise<Handle> {
  const src = await model(url);
  const root = cloneSkinned(src);
  root.traverse(o => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    m.frustumCulled = false;
    for (const mt of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
      mt.metalness = 0; if (mt.transparent) { mt.alphaTest = .5; mt.transparent = false; }  // hair and lashes: cut out, no sorting
    }
  });
  const by = (n: string) => root.getObjectByName(n) || undefined;
  const side = flip ? 'L' : 'R';                                                       // the arm away from your partner waves
  const bones: Bones = { pelvis: by('Bip01_Pelvis'), spine: by('Bip01_Spine1'), neck: by('Bip01_Neck'), head: by('Bip01_Head'), up: by(`Bip01_${side}_UpperArm`), fore: by(`Bip01_${side}_Forearm`) };
  // arms down by the sides (the models come in a T pose), a little bent
  for (const s of ['L', 'R']) {
    const up = by(`Bip01_${s}_UpperArm`), fo = by(`Bip01_${s}_Forearm`); if (!up || !fo) continue;
    root.updateMatrixWorld(true);
    const out = Math.sign(fo.getWorldPosition(V()).x - up.getWorldPosition(V()).x) || 1;
    aim(root, up, fo, new THREE.Vector3(.18 * out, -1, .05));
    fo.rotateOnAxis(new THREE.Vector3(0, 0, 1), -.25);
  }
  root.rotation.y = flip ? -.42 : .42;                                                 // turned to the other person
  root.updateMatrixWorld(true);
  const base = new Map<THREE.Object3D, THREE.Quaternion>();
  for (const bn of [bones.pelvis, bones.spine, bones.neck, bones.head, bones.up, bones.fore]) if (bn) base.set(bn, bn.quaternion.clone());
  let raised: THREE.Quaternion | undefined;
  if (bones.up && bones.fore) {                                                        // the waving arm, raised beside the head
    const keep = bones.up.quaternion.clone();
    const out = Math.sign(bones.fore.getWorldPosition(V()).x - bones.up.getWorldPosition(V()).x) || 1;
    aim(root, bones.up, bones.fore, new THREE.Vector3(.75 * out, .65, .1));
    raised = bones.up.quaternion.clone(); bones.up.quaternion.copy(keep); root.updateMatrixWorld(true);
  }
  const scene = new THREE.Scene(); lights(scene); scene.add(root);
  // framed on the posed body (precise: the skinned shape, not the T pose): all of it, or from the hips up
  const box = new THREE.Box3().setFromObject(root, true);
  if (half) box.min.y = box.max.y - (box.max.y - box.min.y) * .58;
  const sz = box.getSize(V()), c = box.getCenter(V());
  const cam = new THREE.PerspectiveCamera(20, w / h, .01, 100), fov2 = THREE.MathUtils.degToRad(10);
  const dist = Math.max((sz.y * 1.06) / 2 / Math.tan(fov2), (sz.x * 1.12) / 2 / Math.tan(fov2) / (w / h));
  cam.position.set(c.x, c.y, c.z + dist); cam.lookAt(c.x, c.y, c.z);
  const dpr = Math.min(2, devicePixelRatio || 1), r = makeRenderer(canvas);
  if (!r) throw new Error('No WebGL');
  r.setPixelRatio(dpr); r.setSize(w, h, false);
  const i: Inst = { canvas, r, w, h, dpr, scene, cam, root, bones, base, raised, seed: Math.random() * 100, mood: '', moodAt: 0, think: false, visible: !seen, drawn: false };
  insts.add(i); seen?.observe(canvas);
  draw(i, performance.now()); wake();
  return {
    mood(m) { if (!m) return; i.mood = m; i.moodAt = performance.now(); wake(); },
    think(on) { i.think = on; if (reducedMotion.matches) draw(i, performance.now()); },
    destroy() { insts.delete(i); seen?.unobserve(canvas); r.dispose(); },
  };
}
