/* Twodo · choosing a day in the journal: a week strip (arrows move a week), and the dots that say who wrote that day.
   Days after today can't be chosen: their pages don't exist yet. */
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icons';
import { Txt } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { HIT, RADIUS, SPACE, type ColorName } from '@/ui/tokens';
import { addDays, dayOfMonth, fullDate, monthYear, weekDays, weekStart, weekdayShort } from '../dates';

export interface Written { mine: boolean; theirs: boolean }
export interface DayColors { me: ColorName; partner: ColorName; partnerName: string }

/** What VoiceOver says for a day: "Monday, 16 November 2026, today. You and Deiva wrote." */
export function dayLabel(d: string, today: string, w: Written | undefined, c: DayColors): string {
  const who = w?.mine && w.theirs ? `You and ${c.partnerName} wrote.` : w?.mine ? 'You wrote.' : w?.theirs ? `${c.partnerName} wrote.` : 'Nothing written.';
  return `${fullDate(d)}${d === today ? ', today' : ''}. ${d > today ? 'Not here yet.' : who}`;
}

export function Dots({ w, c, size = 6, on = false }: { w: Written | undefined; c: DayColors; size?: number; on?: boolean }) {
  const t = useTheme();
  const ring = on ? { borderWidth: 1, borderColor: t.n.bg } : null;
  return (
    <View style={[styles.dots, { height: size + 2 }]}>
      {w?.mine ? <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.color(c.me) }, ring]} /> : null}
      {w?.theirs ? <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.color(c.partner) }, ring]} /> : null}
    </View>
  );
}

export function WeekStrip({ monday, selected, today, written, colors, onPick, onWeek }: {
  monday: string; selected: string; today: string; written: Map<string, Written>; colors: DayColors;
  onPick: (d: string) => void; onWeek: (monday: string) => void;
}) {
  const t = useTheme(), { width } = useWindowDimensions();
  const cell = Math.floor((Math.min(width, 520) - SPACE.m * 2 - SPACE.xxs * 6) / 7);
  const lastWeek = weekStart(today);
  const label = monthYear(addDays(monday, 3));
  return (
    <View>
      <View style={styles.monthRow}>
        <Txt variant="headline" accessibilityRole="header">{label}</Txt>
        <View style={styles.arrows}>
          <Arrow dir="left" label="Previous week" onPress={() => onWeek(addDays(monday, -7))} />
          <Arrow dir="right" label="Next week" disabled={monday >= lastWeek} onPress={() => onWeek(addDays(monday, 7))} />
        </View>
      </View>
      <View style={styles.week}>
        {weekDays(monday).map(d => {
          const future = d > today, on = d === selected, isToday = d === today, w = written.get(d);
          const fg = on ? t.n.bg : future ? t.n.faint : t.n.label;
          return (
            <Pressable
              key={d} disabled={future} onPress={() => { if (!on) { haptic.tick(); onPick(d); } }}
              accessibilityRole="button" accessibilityLabel={dayLabel(d, today, w, colors)}
              accessibilityState={{ selected: on, disabled: future }}
              style={[styles.day, { width: cell, backgroundColor: on ? t.n.label : future ? 'transparent' : t.n.raised },
                isToday && !on && { borderColor: t.color(colors.me), borderWidth: 2 }]}
            >
              <Txt variant="label" style={{ color: on ? t.n.bg : t.n.soft, letterSpacing: 0.5 }} maxFontSizeMultiplier={1.2}>{weekdayShort(d)}</Txt>
              <Txt variant="headline" tabular style={{ color: fg }} maxFontSizeMultiplier={1.3}>{dayOfMonth(d)}</Txt>
              <Dots w={w} c={colors} on={on} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Arrow({ dir, label, disabled = false, onPress }: { dir: 'left' | 'right'; label: string; disabled?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => { haptic.tick(); onPress(); }} disabled={disabled} hitSlop={4}
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.arrow, { backgroundColor: pressed ? t.n.fill2 : t.n.fill, opacity: disabled ? 0.4 : 1 }]}
    >
      <Icon name={dir} size={20} color={t.n.label} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.xs },
  arrows: { flexDirection: 'row', gap: SPACE.xs },
  arrow: { width: HIT - 6, height: HIT - 6, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: SPACE.xs, borderRadius: RADIUS.m, minHeight: 72 },
  dots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
});
