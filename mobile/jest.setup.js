/* Jest setup: Reanimated is replaced by a small stand-in (jest/reanimated.js), so components render and
   animations settle at once without the native runtime. Worklets and Gesture Handler use their own Jest mocks. */
require('react-native-gesture-handler/jestSetup');
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('./jest/reanimated'));
