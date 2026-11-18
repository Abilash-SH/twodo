/* A small stand-in for Reanimated in unit tests: animations jump to their end value, animated components are plain
   components. Real motion is checked in the web preview and on the iPhone, not here. (Reanimated's own Jest mock
   fails to start under the iOS preset in this version.) */
const React = require('react');
const { View, Text, ScrollView, Image } = require('react-native');

const id = v => v;
const Easing = {
  linear: id, ease: id, quad: id, cubic: id, sin: id, circle: id, exp: id, bounce: id,
  bezier: () => id, in: () => id, out: () => id, inOut: () => id, back: () => id, elastic: () => id, poly: () => id,
};
function layoutAnimation() {
  const a = {};
  for (const k of ['duration', 'delay', 'springify', 'damping', 'stiffness', 'easing', 'withCallback', 'reduceMotion']) a[k] = () => a;
  return a;
}
function createAnimatedComponent(Component) {
  const Animated = React.forwardRef(function Animated(props, ref) {
    const { entering, exiting, layout, animatedProps, ...rest } = props;
    return React.createElement(Component, { ...rest, ...(animatedProps || {}), ref });
  });
  return Animated;
}
const done = (to, cb) => { if (typeof cb === 'function') cb(true); return to; };
/** Gesture Handler asks Reanimated for these when a gesture has worklet callbacks; in tests they do nothing. */
class NativeEventsManager { attachEvents() {} detachEvents() {} updateEvents() {} }

module.exports = {
  __esModule: true,
  default: {
    View: createAnimatedComponent(View), Text: createAnimatedComponent(Text),
    ScrollView: createAnimatedComponent(ScrollView), Image: createAnimatedComponent(Image), createAnimatedComponent,
  },
  createAnimatedComponent,
  useSharedValue: initial => React.useRef({ value: initial, _isSharedValue: true }).current,
  isSharedValue: v => !!v && typeof v === 'object' && v._isSharedValue === true,
  useEvent: handler => handler,
  useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
  useComposedEventHandler: () => () => {},
  setGestureState: () => {},
  NativeEventsManager,
  useAnimatedStyle: updater => updater(),
  useAnimatedProps: updater => updater(),
  useDerivedValue: updater => ({ value: updater() }),
  useReducedMotion: () => false,
  withTiming: (to, _config, cb) => done(to, cb),
  withSpring: (to, _config, cb) => done(to, cb),
  withDelay: (_ms, animation) => animation,
  withSequence: (...steps) => steps[steps.length - 1],
  withRepeat: animation => animation,
  cancelAnimation: () => {},
  Easing,
  FadeInUp: layoutAnimation(), FadeOutUp: layoutAnimation(), FadeIn: layoutAnimation(), FadeOut: layoutAnimation(),
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
};
