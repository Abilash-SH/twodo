/* Home, the Journal and the tab bar render in light and dark, and respond the way the owner asked. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PillBar } from '@/ui/PillBar';
import { ThemeProvider, type SchemeChoice } from '@/ui/theme';
import { addDays } from '../dates';
import { Home } from '../home/Home';
import { Journal } from '../journal/Journal';
import { journal, seed } from '../journal/journalStore';
import { peopleStore } from '../people';

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: ReactNode, scheme: SchemeChoice = 'light') => (
  <GestureHandlerRootView>
    <SafeAreaProvider initialMetrics={METRICS}><ThemeProvider initial={scheme}>{ui}</ThemeProvider></SafeAreaProvider>
  </GestureHandlerRootView>
);
const TODAY = '2026-11-18';

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 10, 18, 12, 0) });
  seed(TODAY);
  peopleStore.reset();
});
afterEach(() => { jest.useRealTimers(); });

test.each(['light', 'dark'] as const)('Home greets you and its cards open their tabs (%s)', async scheme => {
  const open = jest.fn();
  await render(wrap(<Home onOpen={open} />, scheme));
  expect(screen.getByText('Hello, Abilash!')).toBeTruthy();
  expect(screen.getByText('Wednesday, 18 November')).toBeTruthy();

  // Only the top card can be reached; the rest wait in the fan.
  expect(screen.queryByLabelText(/^Deiva: 2 new messages/)).toBeNull();
  await fireEvent(screen.getByLabelText(/^Today: 3 to-dos left/), 'accessibilityTap');
  expect(open).toHaveBeenLastCalledWith('todos');

  // A dot brings a card to the top.
  await fireEvent.press(screen.getByLabelText('Show Deiva'));
  await fireEvent(screen.getByLabelText(/^Deiva: 2 new messages/), 'accessibilityTap');
  expect(open).toHaveBeenLastCalledWith('chat');
  await fireEvent.press(screen.getByLabelText('Show the journal'));
  await fireEvent(screen.getByLabelText(/^Journal: Write today's page/), 'accessibilityTap');
  expect(open).toHaveBeenLastCalledWith('journal');

  await fireEvent.press(screen.getByLabelText('Deiva, online, 2 new'));
  expect(open).toHaveBeenLastCalledWith('chat');
  await fireEvent.press(screen.getByLabelText('Abilash'));
  expect(open).toHaveBeenLastCalledWith('playground');
});

test('the journal card follows the journal', async () => {
  journal.write(TODAY, 'Done for today.', TODAY);
  await render(wrap(<Home onOpen={() => {}} />));
  await fireEvent.press(screen.getByLabelText('Show the journal'));
  expect(screen.getByLabelText(/^Journal: Today's page is done/)).toBeTruthy();
});

test.each(['light', 'dark'] as const)('the Journal writes today and only reads earlier days (%s)', async scheme => {
  await render(wrap(<Journal />, scheme));
  expect(screen.getByText('Journal')).toBeTruthy();
  expect(screen.getByText('18 November')).toBeTruthy();

  await fireEvent.changeText(screen.getByPlaceholderText('How was today?'), 'Picnic in the park.');
  await fireEvent.press(screen.getByText('Save page'));
  expect(journal.day(TODAY).mine?.text).toBe('Picnic in the park.');
  expect(screen.getByText('Saved')).toBeTruthy();
  expect(screen.getByText("Today's page is saved")).toBeTruthy();

  // Yesterday: read only, with both pages and your heart on hers.
  await fireEvent.press(screen.getByLabelText('Tuesday, 17 November 2026. You and Deiva wrote.'));
  expect(screen.queryByPlaceholderText('How was today?')).toBeNull();
  expect(screen.getByText('Read only')).toBeTruthy();
  expect(screen.getByText(/the walk home with you made it/)).toBeTruthy();
  expect(screen.getByText('Deiva loved your page')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Take back your heart'));
  expect(journal.day(addDays(TODAY, -1)).iLoved).toBe(false);
  expect(journal.write(addDays(TODAY, -1), 'late edit')).toBe(false);

  // Tomorrow can't be picked.
  await fireEvent.press(screen.getByLabelText('Thursday, 19 November 2026. Not here yet.'));
  expect(screen.getByText('17 November')).toBeTruthy();

  // Back to today, then an earlier week and the calendar.
  await fireEvent.press(screen.getByLabelText('Wednesday, 18 November 2026, today. You wrote.'));
  expect(screen.getByPlaceholderText('How was today?')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Previous week'));
  expect(screen.getByLabelText('Sunday, 15 November 2026. Deiva wrote.')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Thursday, 12 November 2026. You wrote.'));
  expect(screen.getByText('Planned the weekend. Small things, done slowly.')).toBeTruthy();

  // The calendar reaches any earlier day, never a later one.
  await fireEvent.press(screen.getByLabelText('Calendar'));
  expect(screen.getByText('Pick a day')).toBeTruthy();
  expect(screen.getByText('4 days with a page')).toBeTruthy(); // the 12th, 15th, 17th and today
  await fireEvent.press(screen.getByLabelText('Next month'));
  expect(screen.getByText('4 days with a page')).toBeTruthy(); // still November: no months after this one
  await fireEvent.press(screen.getByLabelText('Monday, 2 November 2026. Nothing written.'));
  expect(screen.queryByText('Pick a day')).toBeNull();
  expect(screen.getByText('2 November')).toBeTruthy();
  expect(screen.getByText("You didn't write this day.")).toBeTruthy();
});

test('words typed just before midnight stay in the box and save to the new day', async () => {
  jest.setSystemTime(new Date(2026, 10, 18, 23, 59, 50));
  await render(wrap(<Journal />));
  await fireEvent.changeText(screen.getByPlaceholderText('How was today?'), 'Almost midnight');
  await act(async () => { jest.advanceTimersByTime(20_000); });
  expect(screen.getByText('19 November')).toBeTruthy();
  expect(screen.getByDisplayValue('Almost midnight')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save page'));
  expect(journal.day('2026-11-19').mine?.text).toBe('Almost midnight');
  expect(journal.day(TODAY).mine).toBeUndefined();
});

test('the pill bar switches tabs and labels each one', async () => {
  const go = jest.fn();
  const props = {
    state: { index: 0, routes: ['index', 'todos', 'journal', 'chat'].map(name => ({ key: `${name}-k`, name })) },
    navigateToTab: go, descriptors: {}, emitter: {}, insets: { top: 0, left: 0, right: 0, bottom: 34 },
  } as unknown as BottomTabBarProps;
  await render(wrap(<PillBar {...props} />, 'dark'));
  await fireEvent.press(screen.getByLabelText('Home'));
  expect(go).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Journal'));
  expect(go).toHaveBeenCalledWith('journal-k');
  expect(screen.getByLabelText('To-dos')).toBeTruthy();
  expect(screen.getByLabelText('Chat')).toBeTruthy();
});
