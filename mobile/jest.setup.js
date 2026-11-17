/* Jest setup: Reanimated is replaced by a small stand-in (jest/reanimated.js), so components render and
   animations settle at once without the native runtime. */
jest.mock('react-native-reanimated', () => require('./jest/reanimated'));
