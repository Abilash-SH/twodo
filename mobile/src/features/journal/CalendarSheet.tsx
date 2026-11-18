/* Twodo · the journal's calendar: a month at a time in a sheet, with dots for the days either of you wrote.
   Pick a day to read it; days after today can't be picked. Swipe the sheet down or tap Done to close. */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/ui/components';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icons';
import { Txt } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { HIT, RADIUS, SPACE } from '@/ui/tokens';
import { dayOfMonth, monthGrid, monthStart, monthYear } from '../dates';
import { Arrow, Dots, dayLabel, type DayColors, type Written } from './DayPicker';

const HEAD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const HEAD_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function CalendarSheet({ visible, selected, today, written, colors, onPick, onClose }: {
  visible: boolean; selected: string; today: string; written: Map<string, Written>; colors: DayColors;
  onPick: (d: string) => void; onClose: () => void;
}) {
  const t = useTheme(), insets = useSafeAreaInsets();
  const [first, setFirst] = useState(() => monthStart(selected));
  const thisMonth = monthStart(today);
  const cells = monthGrid(first);
  const pick = (d: string) => { haptic.tick(); onPick(d); onClose(); };
  const count = cells.filter(d => d && written.has(d)).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} onShow={() => setFirst(monthStart(selected))}>
      <ScrollView style={{ flex: 1, backgroundColor: t.n.sheet }} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + SPACE.xl }]}>
        <View style={styles.top}>
          <Txt variant="title" accessibilityRole="header">Pick a day</Txt>
          <Pressable
            onPress={onClose} hitSlop={6} accessibilityRole="button" accessibilityLabel="Done"
            style={({ pressed }) => [styles.close, { backgroundColor: pressed ? t.n.fill2 : t.n.fill }]}
          >
            <Icon name="close" size={18} color={t.n.label} />
          </Pressable>
        </View>

        <View style={styles.monthRow}>
          <View>
            <Txt variant="headline" accessibilityRole="header">{monthYear(first)}</Txt>
            <Txt variant="footnote" tone="soft">{count === 0 ? 'No pages this month' : `${count} day${count === 1 ? '' : 's'} with a page`}</Txt>
          </View>
          <View style={styles.arrows}>
            <Arrow dir="left" label="Previous month" onPress={() => setFirst(monthStart(first, -1))} />
            <Arrow dir="right" label="Next month" disabled={first >= thisMonth} onPress={() => setFirst(monthStart(first, 1))} />
          </View>
        </View>

        <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {HEAD.map((h, i) => <Txt key={HEAD_NAMES[i]} variant="caption" tone="soft" align="center" style={styles.cell}>{h}</Txt>)}
        </View>
        <View style={styles.grid}>
          {cells.map((d, i) => {
            if (!d) return <View key={`blank${i}`} style={styles.cell} />;
            const future = d > today, on = d === selected, w = written.get(d);
            return (
              <View key={d} style={styles.cell}>
                <Pressable
                  disabled={future} onPress={() => pick(d)}
                  accessibilityRole="button" accessibilityLabel={dayLabel(d, today, w, colors)} accessibilityState={{ selected: on, disabled: future }}
                  style={[styles.day, on && { backgroundColor: t.n.label }, d === today && !on && { borderWidth: 2, borderColor: t.color(colors.me) }]}
                >
                  <Txt variant="callout" tabular style={{ color: on ? t.n.bg : future ? t.n.faint : t.n.label, fontWeight: on || d === today ? '700' : '500' }} maxFontSizeMultiplier={1.3}>
                    {dayOfMonth(d)}
                  </Txt>
                  <Dots w={w} c={colors} size={5} on={on} />
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={styles.legend}>
          <Legend color={t.color(colors.me)} text="You wrote" />
          <Legend color={t.color(colors.partner)} text={`${colors.partnerName} wrote`} />
        </View>
        <Button title="Go to today" kind="quiet" color={colors.me} onPress={() => pick(today)} />
      </ScrollView>
    </Modal>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Txt variant="footnote" tone="soft">{text}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SPACE.m, paddingTop: SPACE.l },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: HIT - 8, height: HIT - 8, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACE.l, marginBottom: SPACE.s },
  arrows: { flexDirection: 'row', gap: SPACE.xs },
  row: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 3 },
  day: { width: HIT + 2, height: HIT + 6, borderRadius: RADIUS.s, alignItems: 'center', justifyContent: 'center', gap: 1 },
  legend: { flexDirection: 'row', gap: SPACE.l, justifyContent: 'center', marginTop: SPACE.m, marginBottom: SPACE.m },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xxs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
