/* Twodo · the Journal, one page each per day (after the owner's reference: a colourful stage with the two characters
   and a sheet over it). Only today's page can be written; earlier days are read from the week strip or the calendar,
   and can't be changed. You can give a heart to your partner's page. No threads, no feed: one day at a time.
   If the clock passes midnight while you type, your words stay in the box and save to the new day. */
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/ui/avatar/Avatar';
import { Portrait } from '@/ui/avatar/Portrait';
import { useMoments } from '@/ui/avatar/useMoments';
import { PillButton, Toast } from '@/ui/components';
import { Gradient } from '@/ui/Gradient';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icons';
import { PILL_SPACE } from '@/ui/PillBar';
import { Txt } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { BADGE, HIT, MAX_SCALE, RADIUS, SPACE, TYPE } from '@/ui/tokens';
import { dayMonth, weekStart, weekday, useToday } from '../dates';
import { firstName, usePeople } from '../people';
import { CalendarSheet } from './CalendarSheet';
import { WeekStrip, type DayColors } from './DayPicker';
import { PAGE_MAX, journal, useJournalVersion } from './journalStore';

export function Journal() {
  const t = useTheme(), insets = useSafeAreaInsets(), today = useToday();
  const { me, partner } = usePeople(), her = firstName(partner.name);
  useJournalVersion();

  // The day on screen: today unless you picked an earlier one (today follows midnight).
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked !== null && picked < today ? picked : today;
  const isToday = date === today;
  const pick = (d: string) => setPicked(d >= today ? null : d);
  const [monday, setMonday] = useState(() => weekStart(date));
  useEffect(() => setMonday(weekStart(date)), [date]);
  const [calendar, setCalendar] = useState(false);

  const day = journal.day(date), written = journal.written();
  const colors: DayColors = { me: me.color, partner: partner.color, partnerName: her };

  // Today's page: the box keeps what you type; Save writes it. At midnight an untouched box starts the new day empty.
  const savedToday = journal.day(today).mine?.text ?? '';
  const [draft, setDraft] = useState(savedToday);
  const [base, setBase] = useState({ day: today, text: savedToday });
  if (base.day !== today) {
    if (draft === base.text) setDraft(savedToday);
    setBase({ day: today, text: savedToday });
  }
  const dirty = draft.replace(/\s+$/, '') !== savedToday;

  const meM = useMoments(), ptM = useMoments();
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const note = (text: string) => {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  };

  const save = () => {
    if (!journal.write(today, draft, today)) return;
    const now = journal.day(today).mine?.text ?? '';
    setDraft(now);
    setBase({ day: today, text: now });
    Keyboard.dismiss();
    haptic.done();
    if (now) meM.react('happy');
    note(now ? "Today's page is saved" : 'Your page for today is empty');
  };
  const love = () => {
    const on = !day.iLoved;
    if (!journal.heart(date, on)) return;
    haptic.heart();
    if (on) meM.react('love');
  };

  return (
    <View style={[styles.fill, { backgroundColor: t.n.bg }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingTop: insets.top + SPACE.xs, paddingBottom: insets.bottom + PILL_SPACE + SPACE.l, paddingHorizontal: SPACE.m }}
        contentInsetAdjustmentBehavior="never" automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive"
      >
        <View style={styles.titleRow}>
          <Txt variant="largeTitle" accessibilityRole="header">Journal</Txt>
          <Pressable
            onPress={() => { haptic.press(); setCalendar(true); }}
            accessibilityRole="button" accessibilityLabel="Calendar" accessibilityHint="Pick any earlier day to read"
            style={({ pressed }) => [styles.round, { backgroundColor: pressed ? t.n.fill2 : t.n.raised, boxShadow: t.shadow[1] }]}
          >
            <Icon name="calendar" size={22} color={t.n.label} />
          </Pressable>
        </View>

        <WeekStrip monday={monday} selected={date} today={today} written={written} colors={colors} onPick={pick} onWeek={setMonday} />

        <View style={[styles.stage, { boxShadow: t.shadow[1] }]}>
          <Gradient colors={t.gradient(me.color, partner.color)} />
          <View style={[styles.badge, { backgroundColor: BADGE.bg }]}>
            {isToday ? null : <Icon name="lock" size={12} color={BADGE.text} width={2.4} />}
            <Txt variant="label" style={{ color: BADGE.text }}>{isToday ? 'Today' : 'Read only'}</Txt>
          </View>
          <View style={styles.floor}>
            <Pressable onPress={() => { haptic.tick(); meM.react('wave', true); }} accessibilityRole="button" accessibilityLabel="You" accessibilityHint="Waves">
              <Avatar avatar={me.avatar} color={me.color} size={150} state={isToday && !day.mine ? 'think' : 'idle'} moment={meM.moment} />
            </Pressable>
            <Pressable onPress={() => { haptic.tick(); ptM.react('wave', true); }} accessibilityRole="button" accessibilityLabel={her} accessibilityHint="Waves">
              <Avatar avatar={partner.avatar} color={partner.color} size={138} flip moment={ptM.moment} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.sheet, { backgroundColor: t.n.raised, boxShadow: t.shadow[2] }]}>
          <Txt variant="label" tone="soft">{isToday ? 'Today' : weekday(date)}</Txt>
          <Txt variant="display" accessibilityRole="header">{dayMonth(date)}</Txt>

          <View style={styles.block}>
            <View style={styles.who}>
              <Portrait avatar={me.avatar} color={me.color} size={32} />
              <Txt variant="headline" style={styles.grow}>Your page</Txt>
            </View>
            {isToday ? (
              <>
                <TextInput
                  value={draft} onChangeText={setDraft} multiline scrollEnabled={false} maxLength={PAGE_MAX}
                  placeholder="How was today?" placeholderTextColor={t.n.faint} selectionColor={t.color(me.color)}
                  keyboardAppearance={t.scheme} autoCapitalize="sentences" textAlignVertical="top"
                  maxFontSizeMultiplier={MAX_SCALE.body}
                  accessibilityLabel="Your page for today" accessibilityHint="Only today's page can be written"
                  style={[TYPE.body, styles.input, { color: t.n.label, backgroundColor: t.n.sunken }]}
                />
                <View style={styles.saveRow}>
                  <Txt variant="footnote" tone="soft" tabular style={styles.grow}>
                    {draft.length > PAGE_MAX - 500 ? `${PAGE_MAX - draft.length} characters left` : 'Only today can be written.'}
                  </Txt>
                  <PillButton title={dirty || !savedToday ? 'Save page' : 'Saved'} colors={[me.color, partner.color]} disabled={!dirty} onPress={save} />
                </View>
              </>
            ) : (
              <>
                {day.mine ? <Txt variant="body" selectable>{day.mine.text}</Txt> : <Txt variant="callout" tone="soft">You didn't write this day.</Txt>}
                <View style={styles.lockRow}>
                  <Icon name="lock" size={14} color={t.n.soft} />
                  <Txt variant="footnote" tone="soft">Only today's page can be written.</Txt>
                </View>
              </>
            )}
          </View>

          <View style={[styles.block, styles.partnerBlock, { borderTopColor: t.n.line }]}>
            <View style={styles.who}>
              <Portrait avatar={partner.avatar} color={partner.color} size={32} />
              <Txt variant="headline" style={styles.grow} numberOfLines={1}>{her}'s page</Txt>
              {day.theirs ? (
                <Pressable
                  onPress={love} hitSlop={6} accessibilityRole="button" accessibilityLabel={day.iLoved ? 'Take back your heart' : `Give ${her}'s page a heart`}
                  accessibilityState={{ selected: !!day.iLoved }}
                  style={({ pressed }) => [styles.heart, { backgroundColor: pressed ? t.n.fill2 : day.iLoved ? t.love.tint : t.n.fill }]}
                >
                  <Icon name={day.iLoved ? 'heartFill' : 'heart'} size={22} color={day.iLoved ? t.love.color : t.n.soft} />
                </Pressable>
              ) : null}
            </View>
            {day.theirs
              ? <Txt variant="body" selectable>{day.theirs.text}</Txt>
              : <Txt variant="callout" tone="soft">{isToday ? `${her} hasn't written today yet.` : `${her} didn't write this day.`}</Txt>}
            {day.theyLoved && day.mine ? (
              <View style={styles.lockRow}>
                <Icon name="heartFill" size={14} color={t.love.color} />
                <Txt variant="footnote" ink={partner.color}>{her} loved your page</Txt>
              </View>
            ) : null}
          </View>
        </View>

        <Txt variant="caption" tone="soft" align="center" style={styles.foot}>
          Preview build: pages stay on this phone until the app closes.
        </Txt>
      </ScrollView>

      <CalendarSheet
        visible={calendar} selected={date} today={today} written={written} colors={colors}
        onPick={pick} onClose={() => setCalendar(false)}
      />
      {toast ? <Toast text={toast} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: SPACE.s, paddingBottom: SPACE.m },
  round: { width: HIT, height: HIT, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  stage: { height: 232, marginTop: SPACE.l, borderRadius: RADIUS.xl, overflow: 'hidden' },
  badge: { position: 'absolute', top: SPACE.m, left: SPACE.m, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACE.s, paddingVertical: 5, borderRadius: RADIUS.pill },
  floor: { position: 'absolute', left: 0, right: 0, bottom: 34, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: SPACE.m },
  sheet: { marginTop: -SPACE.xxl, borderRadius: RADIUS.xl, padding: SPACE.l, gap: 2 },
  block: { marginTop: SPACE.l, gap: SPACE.s },
  partnerBlock: { paddingTop: SPACE.l, borderTopWidth: StyleSheet.hairlineWidth },
  who: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, minHeight: HIT },
  input: { minHeight: 150, borderRadius: RADIUS.m, paddingHorizontal: SPACE.m, paddingTop: SPACE.s, paddingBottom: SPACE.s },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heart: { width: HIT, height: HIT, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  foot: { marginTop: SPACE.l },
});
