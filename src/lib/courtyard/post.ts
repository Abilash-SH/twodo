/** Explore's finish: multisampled HDR frames, a little bloom on lights brighter than white (more at night), a light
 *  vignette, then tone mapping. Falls back to drawing straight to the screen when the phone can't render half-float
 *  frames. */
import * as T from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/** how much the vignette darkens: kept light, so the top edge stays close to the status bar's colour */
const DARKNESS = .22;
const Vignette = {
  name: 'TwodoVignette',
  uniforms: { tDiffuse: { value: null }, darkness: { value: DARKNESS } },
  vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: [
    'uniform sampler2D tDiffuse; uniform float darkness; varying vec2 vUv;',
    'void main() {',
    '  vec4 c = texture2D(tDiffuse, vUv);',
    '  float d = length((vUv - .5) * vec2(1.05, 1.25));',
    '  c.rgb *= mix(1.0, smoothstep(.95, .3, d), darkness);',
    '  gl_FragColor = c;',
    '}',
  ].join('\n'),
};

export interface Finish {
  render(): void; setSize(w: number, h: number, dpr: number): void; dispose(): void;
  /** how strongly bright lights bloom (0 = none) */
  setBloom(strength: number): void;
  /** 'bloom' while post-processing runs, 'plain' after a fallback */
  readonly kind: 'bloom' | 'plain';
}

export function makeFinish(renderer: T.WebGLRenderer, scene: T.Scene, camera: T.Camera, w: number, h: number, dpr: number): Finish {
  const plain: Finish = {
    kind: 'plain',
    render() { renderer.render(scene, camera); },
    setSize() {},
    setBloom() {},
    dispose() {},
  };
  const ext = renderer.extensions;
  if (!ext.has('EXT_color_buffer_half_float') && !ext.has('EXT_color_buffer_float')) return plain;
  let composer: EffectComposer, bloom: UnrealBloomPass, vignette: ShaderPass, output: OutputPass;
  try {
    const target = new T.WebGLRenderTarget(Math.max(1, w * dpr), Math.max(1, h * dpr), { type: T.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, target);
    composer.setPixelRatio(dpr);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new T.Vector2(w * dpr, h * dpr), .1, .3, 1.05);
    composer.addPass(bloom);
    vignette = new ShaderPass(Vignette);
    composer.addPass(vignette);
    output = new OutputPass();
    composer.addPass(output);
    composer.setSize(w, h);
  } catch { return plain; }
  let broken = false;
  const finish: Finish = {
    get kind() { return broken ? 'plain' : 'bloom'; },
    render() {
      if (broken) { renderer.render(scene, camera); return; }
      try { composer.render(); }
      catch { broken = true; renderer.setRenderTarget(null); renderer.render(scene, camera); }
    },
    setSize(nw, nh, ndpr) { if (broken) return; composer.setPixelRatio(ndpr); composer.setSize(nw, nh); },
    setBloom(strength) { bloom.strength = strength; bloom.enabled = strength > .005; },
    dispose() { bloom.dispose(); vignette.dispose(); output.dispose(); composer.dispose(); },
  };
  return finish;
}

const fit = (v: number) => (v * (v + .0245786) - .000090537) / (v * (.983729 * v + .432951) + .238081);
const unit = (v: number) => Math.max(0, Math.min(1, v));
/** The colour a linear scene colour ends up as at the top centre of the screen: exposure, the vignette there, ACES
 *  filmic tone mapping (the same fit three.js uses) and sRGB. For the status bar, so it continues the sky. */
export function onScreen(linear: T.Color, exposure: number, kind: Finish['kind']): string {
  const k = exposure / .6 * (kind === 'bloom' ? 1 - DARKNESS * .5 : 1);
  const r = linear.r * k, g = linear.g * k, b = linear.b * k;
  const ar = fit(.59719 * r + .35458 * g + .04823 * b), ag = fit(.076 * r + .90834 * g + .01566 * b), ab = fit(.0284 * r + .13383 * g + .83777 * b);
  const out = new T.Color().setRGB(
    unit(1.60475 * ar - .53108 * ag - .07367 * ab), unit(-.10208 * ar + 1.10813 * ag - .00605 * ab), unit(-.00327 * ar - .07276 * ag + 1.07602 * ab),
    T.LinearSRGBColorSpace,
  );
  return '#' + out.getHexString();
}
