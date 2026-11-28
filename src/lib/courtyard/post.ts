/** The neon city's finish: multisampled HDR frames, bloom on everything brighter than white, a soft vignette, then
 *  tone mapping. Falls back to drawing straight to the screen when the phone can't render half-float frames. */
import * as T from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const Vignette = {
  name: 'TwodoVignette',
  uniforms: { tDiffuse: { value: null }, darkness: { value: .5 } },
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
  /** 'bloom' while post-processing runs, 'plain' after a fallback */
  readonly kind: 'bloom' | 'plain';
}

export function makeFinish(renderer: T.WebGLRenderer, scene: T.Scene, camera: T.Camera, w: number, h: number, dpr: number): Finish {
  const plain: Finish = {
    kind: 'plain',
    render() { renderer.render(scene, camera); },
    setSize() {},
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
    bloom = new UnrealBloomPass(new T.Vector2(w * dpr, h * dpr), .48, .3, 1.05);
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
    dispose() { bloom.dispose(); vignette.dispose(); output.dispose(); composer.dispose(); },
  };
  return finish;
}
