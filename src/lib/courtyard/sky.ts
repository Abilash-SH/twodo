/** The night above the neon city: a violet gradient dome, stars, a ringed planet and a few streaks of light, all
 *  painted on the phone. Also the city's reflections: a small room of coloured light panels turned into an
 *  environment map, so glass, chrome and the wet street pick up neon instead of grey. */
import * as T from 'three';
import { seededNoise } from './city-art';

type Ink = (name: string) => T.Color;

const DOME_VERTEX = [
  'varying vec3 vDir;',
  'void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
].join('\n');
const DOME_FRAGMENT = [
  'uniform vec3 zenith; uniform vec3 horizon; uniform vec3 glow; varying vec3 vDir;',
  'void main() {',
  '  float h = clamp(vDir.y, -.25, 1.0);',
  '  vec3 c = mix(horizon, zenith, smoothstep(-.02, .62, h));',
  '  c += glow * exp(-abs(h - .035) * 11.0) * .55;',
  '  c += glow * .35 * exp(-abs(h - .2) * 4.0) * smoothstep(.2, -.6, vDir.z);',
  '  gl_FragColor = vec4(c, 1.0);',
  '  #include <tonemapping_fragment>',
  '  #include <colorspace_fragment>',
  '}',
].join('\n');

function canvasTexture(w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Sky textures are unavailable');
  paint(context);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  return map;
}

export function buildSky(scene: T.Scene, ink: Ink) {
  const disposables: { dispose(): void }[] = [];
  const keep = <D extends { dispose(): void }>(d: D) => { disposables.push(d); return d; };
  const sky = new T.Group();
  sky.name = 'sky';
  scene.add(sky);

  const dome = new T.Mesh(keep(new T.SphereGeometry(110, 32, 18)), keep(new T.ShaderMaterial({
    uniforms: { zenith: { value: ink('zenith') }, horizon: { value: ink('horizon') }, glow: { value: ink('haze') } },
    vertexShader: DOME_VERTEX, fragmentShader: DOME_FRAGMENT, side: T.BackSide, depthWrite: false, fog: false,
  })));
  dome.renderOrder = -10;
  sky.add(dome);

  // Stars: fixed, brighter than white so the brightest ones bloom a little.
  const random = seededNoise(4242), points: number[] = [];
  for (let i = 0; i < 760; i++) {
    const y = .06 + Math.pow(random(), .7) * .94, a = random() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    points.push(Math.cos(a) * r * 100, y * 100, Math.sin(a) * r * 100);
  }
  const starGeometry = keep(new T.BufferGeometry());
  starGeometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  const stars = new T.Points(starGeometry, keep(new T.PointsMaterial({
    color: new T.Color(1.6, 1.6, 1.75), size: 1.7, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: .85,
  })));
  stars.renderOrder = -9;
  sky.add(stars);

  // A ringed planet low over the skyline, painted once.
  const planetMap = keep(canvasTexture(512, 512, c => {
    const body = c.createRadialGradient(212, 206, 18, 256, 256, 150);
    body.addColorStop(0, '#ffd9f1');
    body.addColorStop(.45, '#e37bc6');
    body.addColorStop(.85, '#6b3aa6');
    body.addColorStop(1, '#2a1458');
    c.save();
    c.beginPath(); c.arc(256, 256, 150, 0, Math.PI * 2); c.clip();
    c.fillStyle = body; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9; i++) {
      c.fillStyle = i % 2 ? 'rgba(255,214,240,.12)' : 'rgba(56,20,96,.18)';
      c.fillRect(0, 150 + i * 26, 512, 9 + (i % 3) * 4);
    }
    const shade = c.createLinearGradient(120, 120, 400, 400);
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(10,4,30,.55)');
    c.fillStyle = shade; c.fillRect(0, 0, 512, 512);
    c.restore();
    c.save();
    c.translate(256, 256); c.rotate(-.32); c.scale(1, .26);
    for (const [r, w, a] of [[222, 10, .75], [200, 6, .5], [242, 4, .4]] as const) {
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2);
      c.strokeStyle = `rgba(124,244,255,${a})`; c.lineWidth = w; c.stroke();
    }
    c.restore();
    // the ring passes in front of the planet's lower half
    c.save();
    c.beginPath(); c.rect(0, 256, 512, 256); c.clip();
    c.translate(256, 256); c.rotate(-.32); c.scale(1, .26);
    c.beginPath(); c.arc(0, 0, 222, 0, Math.PI); c.strokeStyle = 'rgba(190,250,255,.9)'; c.lineWidth = 10; c.stroke();
    c.restore();
  }));
  const planet = new T.Sprite(keep(new T.SpriteMaterial({ map: planetMap, color: new T.Color(1.25, 1.2, 1.3), fog: false, depthWrite: false, transparent: true })));
  planet.position.set(-26, 45, -75);
  planet.scale.setScalar(30);
  planet.renderOrder = -8;
  sky.add(planet);

  // Long diagonal streaks of light, like comets crossing the sky.
  const streakMap = keep(canvasTexture(256, 16, c => {
    const g = c.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.75, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g; c.fillRect(0, 6, 256, 4);
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, 4, 256, 8);
  }));
  const streakGeometry = keep(new T.PlaneGeometry(1, 1));
  for (const [x, y, z, length, tilt, tint] of [
    [24, 42, -70, 46, -.42, 'cyan'], [-8, 52, -82, 34, -.36, 'amber'], [52, 30, -40, 30, -.5, 'pink'],
  ] as const) {
    const streak = new T.Mesh(streakGeometry, keep(new T.MeshBasicMaterial({
      map: streakMap, color: ink(tint).multiplyScalar(1.6), transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
    })));
    streak.position.set(x, y, z);
    streak.scale.set(length, length * .045, 1);
    streak.lookAt(0, y * .4, 0);
    streak.rotateZ(tilt);
    streak.renderOrder = -7;
    sky.add(streak);
  }

  return { dispose() { disposables.forEach(d => d.dispose()); sky.removeFromParent(); } };
}

/** Coloured light panels in a dark room, blurred into the city's environment map. */
export function neonEnvironment(renderer: T.WebGLRenderer, ink: Ink): T.WebGLRenderTarget | null {
  let pmrem: T.PMREMGenerator | null = null;
  const room = new T.Scene(), parts: { dispose(): void }[] = [];
  try {
    const box = new T.BoxGeometry(1, 1, 1);
    parts.push(box);
    const shell = new T.MeshBasicMaterial({ color: ink('zenith'), side: T.BackSide });
    parts.push(shell);
    const walls = new T.Mesh(box, shell);
    walls.scale.set(30, 16, 30);
    walls.position.y = 6;
    room.add(walls);
    const panel = (tint: string, strength: number, x: number, y: number, z: number, w: number, h: number, d: number) => {
      const surface = new T.MeshBasicMaterial({ color: ink(tint).multiplyScalar(strength) });
      parts.push(surface);
      const piece = new T.Mesh(box, surface);
      piece.position.set(x, y, z); piece.scale.set(w, h, d);
      room.add(piece);
    };
    panel('cyan', 2.2, -13, 4, -4, .4, 7, 9);
    panel('pink', 2.2, 13, 4, -2, .4, 6, 8);
    panel('violet', 1.6, 0, 13, -6, 16, .4, 6);
    panel('amber', 1.4, 4, 2, -13, 8, 3, .4);
    panel('blue', 1.6, -5, 5, 13, 9, 6, .4);
    panel('haze', 1, 0, 1, 13, 26, 1.2, .4);
    pmrem = new T.PMREMGenerator(renderer);
    return pmrem.fromScene(room, .035);
  } catch { return null; }
  finally { parts.forEach(p => p.dispose()); pmrem?.dispose(); }
}
