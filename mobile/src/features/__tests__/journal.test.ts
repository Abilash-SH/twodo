/* The journal's rules (HANDOFF.md, "Data decisions"): one page each per day, only today's can be written, earlier
   days are read-only, future days don't exist, a heart only on a page your partner wrote. */
import { addDays, isYmd, monthGrid, monthStart, todayYmd, weekDays, weekStart, ymd } from '../dates';
import { PAGE_MAX, journal, seed } from '../journal/journalStore';

const TODAY = '2026-11-18'; // a Wednesday
beforeEach(() => seed(TODAY));

test('only today can be written', () => {
  expect(journal.write(TODAY, 'A good day.', TODAY)).toBe(true);
  expect(journal.day(TODAY).mine?.text).toBe('A good day.');
  const yesterday = addDays(TODAY, -1), before = journal.day(yesterday).mine?.text;
  expect(journal.write(yesterday, 'Changed later', TODAY)).toBe(false);
  expect(journal.day(yesterday).mine?.text).toBe(before);
  expect(journal.write(addDays(TODAY, 1), 'Tomorrow', TODAY)).toBe(false);
  expect(journal.day(addDays(TODAY, 1)).mine).toBeUndefined();
  for (const bad of ['', '2026-13-01', '2026-02-30', '18-11-2026', 'today']) expect(journal.write(bad, 'x', TODAY)).toBe(false);
});

test('a page keeps its words, loses trailing space, stops at the limit, and an empty save removes it', () => {
  journal.write(TODAY, '  Morning walk.\n\n  ', TODAY);
  expect(journal.day(TODAY).mine?.text).toBe('  Morning walk.');
  journal.write(TODAY, 'x'.repeat(PAGE_MAX + 50), TODAY);
  expect(journal.day(TODAY).mine?.text.length).toBe(PAGE_MAX);
  journal.write(TODAY, '   \n', TODAY);
  expect(journal.day(TODAY).mine).toBeUndefined();
});

test('a heart only goes on a page your partner wrote, and can be taken back', () => {
  expect(journal.heart(TODAY, true)).toBe(false); // nothing from them today
  const three = addDays(TODAY, -3);
  expect(journal.day(three).theirs).toBeDefined();
  expect(journal.heart(three, true)).toBe(true);
  expect(journal.day(three).iLoved).toBe(true);
  expect(journal.heart(three, false)).toBe(true);
  expect(journal.day(three).iLoved).toBe(false);
  expect(journal.heart(addDays(TODAY, -6), true)).toBe(false); // only your own page that day
});

test('written days list who wrote', () => {
  journal.write(TODAY, 'Hi', TODAY);
  const w = journal.written();
  expect(w.get(TODAY)).toEqual({ mine: true, theirs: false });
  expect(w.get(addDays(TODAY, -1))).toEqual({ mine: true, theirs: true });
  expect(w.get(addDays(TODAY, -3))).toEqual({ mine: false, theirs: true });
  expect(w.has(addDays(TODAY, -2))).toBe(false);
});

test('days are local calendar days', () => {
  expect(todayYmd(new Date(2026, 10, 18, 23, 59))).toBe('2026-11-18');
  expect(todayYmd(new Date(2026, 10, 19, 0, 0))).toBe('2026-11-19');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(isYmd('2026-11-18')).toBe(true);
  expect(isYmd('2026-11-31')).toBe(false);
  expect(isYmd(20261118)).toBe(false);
  expect(ymd(new Date(2026, 0, 5))).toBe('2026-01-05');
});

test('weeks start on Monday and months fill whole rows', () => {
  expect(weekStart('2026-11-18')).toBe('2026-11-16');
  expect(weekStart('2026-11-16')).toBe('2026-11-16');
  expect(weekStart('2026-11-22')).toBe('2026-11-16'); // a Sunday ends the week
  expect(weekDays('2026-11-16')).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
  expect(monthStart('2026-11-18')).toBe('2026-11-01');
  expect(monthStart('2026-01-31', -1)).toBe('2025-12-01');
  const nov = monthGrid('2026-11-01'); // 1 November 2026 is a Sunday
  expect(nov.length % 7).toBe(0);
  expect(nov.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01']);
  expect(nov.filter(Boolean)).toHaveLength(30);
  const feb = monthGrid('2027-02-01'); // starts on a Monday, 28 days: exactly four rows
  expect(feb).toHaveLength(28);
  expect(feb[0]).toBe('2027-02-01');
});
