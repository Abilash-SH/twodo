/* The screens and components render, respond, and clean up, in light and dark. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Playground } from '@/features/playground/Playground';
import { Character } from '../characters/Character';
import { CHAR_KINDS, MOMENTS, STATES } from '../characters/moods';
import { LAUNCH_MS, Launch } from '../launch/Launch';
import { ThemeProvider, type SchemeChoice } from '../theme';

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: ReactNode, scheme: SchemeChoice = 'light') => (
  <SafeAreaProvider initialMetrics={METRICS}><ThemeProvider initial={scheme}>{ui}</ThemeProvider></SafeAreaProvider>
);

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

test.each(['light', 'dark'] as const)('the Playground renders in %s and its controls respond', async scheme => {
  await render(wrap(<Playground />, scheme));
  expect(screen.getByText('Playground')).toBeTruthy();
  expect(screen.getByText('The two of you')).toBeTruthy();
  for (const label of ['Wave', 'Cheer', 'Love', 'Hop', 'Happy']) await fireEvent.press(screen.getAllByText(label)[0]);
  await fireEvent.press(screen.getByText('Show a note'));
  expect(screen.getByText('Saved on your phone')).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(2500); });
  expect(screen.queryByText('Saved on your phone')).toBeNull();
  await fireEvent.press(screen.getByText('Dark'));
});

test('every character draws in every state and moment, still or moving, turned or not', async () => {
  for (const kind of CHAR_KINDS) {
    for (const state of STATES) {
      const { unmount } = await render(wrap(<Character kind={kind} color="green" size={64} state={state} flip={kind === 'drop'} />));
      await unmount();
    }
    for (const [i, mood] of MOMENTS.entries()) {
      const { unmount } = await render(wrap(<Character kind={kind} color="pink" size={64} moment={{ mood, key: i + 1 }} />));
      await act(async () => { jest.advanceTimersByTime(1600); });
      await unmount();
    }
    const { unmount } = await render(wrap(<Character kind={kind} color="gray" size={30} still />));
    await unmount();
  }
});

test('the launch ends by itself, and a tap ends it sooner', async () => {
  const done = jest.fn();
  await render(wrap(<Launch onDone={done} />));
  expect(screen.getByLabelText('Two souls, one space.')).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(LAUNCH_MS.hold + LAUNCH_MS.exit + 100); });
  expect(done).toHaveBeenCalledTimes(1);

  const tapped = jest.fn();
  await render(wrap(<Launch onDone={tapped} />));
  await fireEvent.press(screen.getAllByLabelText('Two souls, one space.').pop()!);
  await act(async () => { jest.advanceTimersByTime(LAUNCH_MS.exit + 100); });
  expect(tapped).toHaveBeenCalledTimes(1);
});
