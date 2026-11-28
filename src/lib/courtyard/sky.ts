/** The sky over Explore, following the phone's clock (daylight.ts): a gradient dome with the sun and its glow, a
 *  warm band along the horizon at sunset, stars and the moon at night, and clouds lit by the time of day. Its
 *  colours also become the city's reflections (an environment map made from the dome alone). All painted on the
 *  phone; nothing is downloaded. */
import * as T from 'three';
import { seededNoise } from './city-art';
import type { Daylight } from './daylight';

const DOME_VERTEX = [
  'varying vec3 vDir;',
  'void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
].join('\n');
const DOME_FRAGMENT = [
  'uniform vec3 zenith; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sunColor; uniform vec3 sunDir;',
  'uniform float glowStrength; uniform float band; uniform float sunUp;',
  'varying vec3 vDir;',
  'void main() {',
  '  vec3 d = normalize(vDir);',
  '  float h = d.y;',
  '  vec3 c = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), .5));',
  '  c = mix(c, horizon * .45, smoothstep(0.0, -.2, h));',
  '  float s = max(dot(d, sunDir), 0.0);',
  '  c += glow * (pow(s, 5.0) * .28 + pow(s, 48.0) * .55) * glowStrength;',
  '  vec2 flatDir = normalize(d.xz + 1e-5), flatSun = normalize(sunDir.xz + 1e-5);',
  '  float toward = pow(max(dot(flatDir, flatSun), 0.0), 2.5);',
  '  c += glow * toward * exp(-abs(h - .02) * 9.0) * band;',
  '  float disc = smoothstep(.99985, .99993, dot(d, sunDir));',
  '  c = mix(c, sunColor * 6.0, disc * sunUp);',
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

/** where the moon hangs: low over the lake to the west (18° up), so you see it from the promenade */
export const MOON = new T.Vector3(-.947, .309, .083).normalize();

export function buildSky(scene: T.Scene) {
  const disposables: { dispose(): void }[] = [];
  const keep = <D extends { dispose(): void }>(d: D) => { disposables.push(d); return d; };
  const sky = new T.Group();
  sky.name = 'sky';
  scene.add(sky);

  const uniforms = {
    zenith: { value: new T.Color() }, horizon: { value: new T.Color() }, glow: { value: new T.Color() }, sunColor: { value: new T.Color() },
    sunDir: { value: new T.Vector3(0, 1, 0) }, glowStrength: { value: 1 }, band: { value: 0 }, sunUp: { value: 1 },
  };
  const domeGeometry = keep(new T.SphereGeometry(130, 48, 24));
  const domeMaterial = keep(new T.ShaderMaterial({ uniforms, vertexShader: DOME_VERTEX, fragmentShader: DOME_FRAGMENT, side: T.BackSide, depthWrite: false, fog: false }));
  const dome = new T.Mesh(domeGeometry, domeMaterial);
  dome.renderOrder = -10;
  sky.add(dome);
  // the same dome on its own, for the reflections
  const reflectionScene = new T.Scene();
  reflectionScene.add(new T.Mesh(domeGeometry, domeMaterial));

  const random = seededNoise(4242), points: number[] = [];
  for (let i = 0; i < 900; i++) {
    const y = .05 + Math.pow(random(), .7) * .95, a = random() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    points.push(Math.cos(a) * r * 120, y * 120, Math.sin(a) * r * 120);
  }
  const starGeometry = keep(new T.BufferGeometry());
  starGeometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  const starMaterial = keep(new T.PointsMaterial({ color: new T.Color(1.4, 1.4, 1.5), size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0 }));
  const stars = new T.Points(starGeometry, starMaterial);
  stars.renderOrder = -9;
  sky.add(stars);

  const moonMap = keep(canvasTexture(128, 128, c => {
    const g = c.createRadialGradient(64, 64, 20, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,250,235,.35)'); g.addColorStop(1, 'rgba(255,250,235,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    c.beginPath(); c.arc(64, 64, 22, 0, Math.PI * 2); c.fillStyle = '#f4efe2'; c.fill();
    for (const [x, y, r] of [[58, 58, 5], [71, 66, 4], [62, 74, 3], [70, 54, 2.5]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = 'rgba(170,165,150,.45)'; c.fill(); }
  }));
  const moonMaterial = keep(new T.SpriteMaterial({ map: moonMap, color: new T.Color(1.6, 1.6, 1.55), fog: false, depthWrite: false, transparent: true, opacity: 0 }));
  const moon = new T.Sprite(moonMaterial);
  moon.position.copy(MOON).multiplyScalar(118);
  moon.scale.setScalar(13);
  moon.renderOrder = -8;
  sky.add(moon);

  // Soft clouds, painted once, tinted by the hour and by how close they are to the sun.
  const cloudMap = keep(canvasTexture(256, 128, c => {
    const r = seededNoise(77);
    for (let i = 0; i < 26; i++) {
      const x = 40 + r() * 176, y = 58 + (r() - .5) * 34, s = 16 + r() * 30;
      const g = c.createRadialGradient(x, y, 0, x, y, s);
      g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(x - s, y - s, s * 2, s * 2);
    }
  }));
  const clouds = new T.Group();
  sky.add(clouds);
  const cloudParts: { material: T.SpriteMaterial; dir: T.Vector3 }[] = [];
  const cr = seededNoise(31);
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2 + cr() * .4, dist = 95 + cr() * 22, y = 34 + cr() * 30;
    const material = keep(new T.SpriteMaterial({ map: cloudMap, fog: false, depthWrite: false, transparent: true, opacity: .8 }));
    const sprite = new T.Sprite(material);
    sprite.position.set(Math.cos(a) * dist, y, Math.sin(a) * dist);
    sprite.scale.set(34 + cr() * 30, 13 + cr() * 9, 1);
    sprite.renderOrder = -7;
    clouds.add(sprite);
    cloudParts.push({ material, dir: sprite.position.clone().normalize() });
  }

  const sunDir = new T.Vector3(), at = new T.Vector3(), white = new T.Color(1, 1, 1), dusk = new T.Color(), warm = new T.Color(), lit = new T.Color();
  return {
    reflectionScene,
    /** colour the sky for this moment */
    update(d: Daylight) {
      sunDir.set(d.sun[0], d.sun[1], d.sun[2]);
      uniforms.sunDir.value.copy(sunDir);
      uniforms.zenith.value.set(d.zenith); uniforms.horizon.value.set(d.horizon);
      uniforms.glow.value.set(d.glow); uniforms.sunColor.value.set(d.sunColor);
      uniforms.glowStrength.value = .35 + d.day * .65;
      uniforms.band.value = d.golden * .9;
      uniforms.sunUp.value = d.elevation > -1.2 ? 1 : 0;
      starMaterial.opacity = d.night * .9;
      moonMaterial.opacity = d.night;
      dusk.set(d.zenith).lerp(warm.set(d.horizon), .3).multiplyScalar(1.3);
      warm.set(d.glow);
      // the clock's rotation of the cloud ring changes which clouds face the sun: measure in world space
      clouds.updateMatrixWorld();
      for (const [i, part] of cloudParts.entries()) {
        part.dir.copy(clouds.children[i].getWorldPosition(at)).normalize();
        const near = Math.pow(Math.max(0, part.dir.dot(sunDir)), 2);
        lit.copy(white).lerp(warm, Math.min(1, d.golden * (.55 + near)));
        part.material.color.copy(dusk).lerp(lit, Math.max(d.day, d.golden * .9)).multiplyScalar(.75 + d.day * .45 + near * d.golden * .8);
        part.material.opacity = .55 + d.day * .3 - d.night * .2;
      }
    },
    /** clouds drift slowly while the city is awake */
    drift(seconds: number) { clouds.rotation.y += seconds * .0025; },
    dispose() { disposables.forEach(item => item.dispose()); sky.removeFromParent(); },
  };
}

/** The dome alone, blurred into an environment map: glass and water reflect this hour's sky. */
export function skyReflections(renderer: T.WebGLRenderer, reflectionScene: T.Scene): T.WebGLRenderTarget | null {
  let pmrem: T.PMREMGenerator | null = null;
  try {
    pmrem = new T.PMREMGenerator(renderer);
    return pmrem.fromScene(reflectionScene, .02, .1, 300);
  } catch { return null; }
  finally { pmrem?.dispose(); }
}
