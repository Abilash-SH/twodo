/* Twodo · Home (after the owner's reference): who you are and who you're with at the top, a big hello, then a fanned
   stack of cards for what matters today (to-dos, your partner, the journal, the week), and the two characters.
   A card shows a count or a nudge, never the content of a message or a page. Tapping a card opens its tab.
   Preview build: the to-do numbers are samples until the to-do screens come (phase 3); the journal card reads the
   journal on this phone. */
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AVATAR_RATIO, Avatar } from '@/ui/avatar/Avatar';
import type { Moment } from '@/ui/avatar/moods';
import { Portrait } from '@/ui/avatar/Portrait';
import { useMoments } from '@/ui/avatar/useMoments';
import { haptic } from '@/ui/haptics';
import { PILL_SPACE } from '@/ui/PillBar';
import { Txt } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { PRESENCE, RADIUS, SPACE } from '@/ui/tokens';
import { longDate, useToday } from '../dates';
import { journal, useJournalVersion } from '../journal/journalStore';
import { firstName, usePeople, type Person } from '../people';
import { CardStack, type StackCard } from './CardStack';

export type HomeTarget = 'todos' | 'journal' | 'chat' | 'playground';

/** Sample numbers for the preview build (phase 3 counts the real to-dos). */
export const SAMPLE_TODOS = { left: 3, done: 2, weekDone: 5, weekTotal: 12 };

export function Home({ onOpen }: { onOpen: (to: HomeTarget) => void }) {
  const t = useTheme(), insets = useSafeAreaInsets(), today = useToday();
  const people = usePeople(), { me, partner } = people;
  useJournalVersion();
  const page = journal.day(today);
  const her = firstName(partner.name);

  const cards: StackCard[] = [
    {
      id: 'today', badge: 'Today', colors: ['yellow', 'orange'],
      title: SAMPLE_TODOS.left === 0 ? 'All done' : `${SAMPLE_TODOS.left} to-do${SAMPLE_TODOS.left === 1 ? '' : 's'} left`,
      sub: `${SAMPLE_TODOS.done} done so far`,
      art: a => <Pair me={me} partner={partner} {...a} mood="happy" />,
      label: 'Show today', hint: 'Opens your to-dos', onOpen: () => onOpen('todos'),
    },
    {
      id: 'partner', badge: her, colors: [partner.color, 'purple'],
      title: people.unread > 0 ? `${people.unread} new message${people.unread === 1 ? '' : 's'}` : 'Say hello',
      sub: people.partnerOnline ? 'Online now' : 'Away for now',
      art: a => <One person={partner} {...a} flip mood="wave" />,
      label: `Show ${her}`, hint: 'Opens the chat', onOpen: () => onOpen('chat'),
    },
    {
      id: 'journal', badge: 'Journal', colors: ['purple', 'indigo'],
      title: page.mine ? "Today's page is done" : "Write today's page",
      sub: page.theirs ? `${her} wrote today` : `${her} hasn't written yet`,
      art: a => <One person={me} {...a} state={page.mine ? 'idle' : 'think'} mood="happy" />,
      label: 'Show the journal', hint: "Opens today's page", onOpen: () => onOpen('journal'),
    },
    {
      id: 'week', badge: 'This week', colors: ['mint', 'teal'],
      title: `${SAMPLE_TODOS.weekDone} of ${SAMPLE_TODOS.weekTotal} done`,
      sub: 'Plans for the two of you',
      art: a => <Pair me={me} partner={partner} {...a} mood="cheer" />,
      label: 'Show this week', hint: 'Opens your to-dos', onOpen: () => onOpen('todos'),
    },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.n.bg }}
      contentContainerStyle={{ paddingTop: insets.top + SPACE.xs, paddingBottom: insets.bottom + PILL_SPACE + SPACE.l }}
      contentInsetAdjustmentBehavior="never"
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => { haptic.press(); onOpen('playground'); }} style={styles.meBox}
          accessibilityRole="button" accessibilityLabel={me.name} accessibilityHint="Opens the Playground, where you can change how you both look"
        >
          <Portrait avatar={me.avatar} color={me.color} size={48} />
          <View>
            <Txt variant="headline" numberOfLines={1}>{me.name}</Txt>
            <Txt variant="footnote" tone="soft" numberOfLines={1}>with {her}</Txt>
          </View>
        </Pressable>
        <Pressable
          onPress={() => { haptic.press(); onOpen('chat'); }}
          style={[styles.chip, { backgroundColor: t.n.raised, boxShadow: t.shadow[1] }]}
          accessibilityRole="button"
          accessibilityLabel={`${her}, ${people.partnerOnline ? 'online' : 'away'}${people.unread ? `, ${people.unread} new` : ''}`}
          accessibilityHint="Opens the chat"
        >
          <View>
            <Portrait avatar={partner.avatar} color={partner.color} size={32} />
            {people.partnerOnline ? <View style={[styles.presence, { backgroundColor: PRESENCE, borderColor: t.n.raised }]} /> : null}
          </View>
          <Txt variant="callout" style={styles.chipName} numberOfLines={1}>{her}</Txt>
          {people.unread > 0 ? (
            <View style={[styles.count, { backgroundColor: t.color(partner.color) }]}>
              <Txt variant="caption" tone="on" tabular>{people.unread > 9 ? '9+' : people.unread}</Txt>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.hello}>
        <Txt variant="largeTitle" accessibilityRole="header" numberOfLines={2}>Hello, {firstName(me.name)}!</Txt>
        <Txt variant="callout" tone="soft">{longDate(today)}</Txt>
      </View>

      <CardStack cards={cards} />

      <View style={styles.section}>
        <Txt variant="title" accessibilityRole="header">The two of you</Txt>
        <Txt variant="footnote" tone="soft" style={styles.sectionSub}>Tap one to change how you both look.</Txt>
        <View style={styles.tiles}>
          <Tile person={me} who="You" onPress={() => onOpen('playground')} />
          <Tile person={partner} who={her} flip onPress={() => onOpen('playground')} />
        </View>
      </View>
    </ScrollView>
  );
}

/** A moment once each time the card comes to the top (never on the first draw, while the app is opening). */
function useTopMoment(top: boolean, mood: Moment) {
  const m = useMoments(), was = useRef(top), { react } = m;
  useEffect(() => {
    if (top && !was.current) react(mood);
    was.current = top;
  }, [top, mood, react]);
  return m.moment;
}

interface ArtProps { w: number; h: number; top: boolean; mood: Moment }
const artHeight = (h: number) => h - SPACE.xxl - 104;

function One({ person, w, h, top, mood, flip = false, state = 'idle' }: ArtProps & { person: Person; flip?: boolean; state?: 'idle' | 'think' }) {
  const moment = useTopMoment(top, mood);
  const size = Math.min(artHeight(h) * 0.98, (w - SPACE.xl) / AVATAR_RATIO);
  return <Avatar avatar={person.avatar} color={person.color} size={size} flip={flip} state={state} moment={moment} still={!top} />;
}

function Pair({ me, partner, w, h, top, mood }: ArtProps & { me: Person; partner: Person }) {
  const moment = useTopMoment(top, mood);
  const size = Math.min(artHeight(h) * 0.86, (w - SPACE.xl) / (AVATAR_RATIO * 1.85));
  return (
    <View style={styles.pair}>
      <Avatar avatar={me.avatar} color={me.color} size={size} moment={moment} still={!top} />
      <Avatar avatar={partner.avatar} color={partner.color} size={size * 0.92} flip moment={moment} still={!top} />
    </View>
  );
}

function Tile({ person, who, flip = false, onPress }: { person: Person; who: string; flip?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => { haptic.press(); onPress(); }}
      accessibilityRole="button" accessibilityLabel={who} accessibilityHint="Opens the Playground, where you can change how you both look"
      style={({ pressed }) => [styles.tile, { backgroundColor: pressed ? t.person(person.color).tint : t.n.raised, boxShadow: t.shadow[1] }]}
    >
      <View style={[styles.tileGlow, { backgroundColor: t.person(person.color).tint }]} />
      <Avatar avatar={person.avatar} color={person.color} size={118} flip={flip} still />
      <Txt variant="headline" numberOfLines={1} style={styles.tileName}>{who}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACE.m, gap: SPACE.s },
  meBox: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s, flexShrink: 1, minHeight: 48 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingLeft: 6, paddingRight: SPACE.s, minHeight: 44, borderRadius: RADIUS.pill },
  chipName: { fontWeight: '700', maxWidth: 110 },
  presence: { position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  hello: { paddingHorizontal: SPACE.m, paddingTop: SPACE.xl, paddingBottom: SPACE.s, gap: 2 },
  section: { paddingHorizontal: SPACE.m, marginTop: SPACE.xxl },
  sectionSub: { marginTop: 2 },
  tiles: { flexDirection: 'row', gap: SPACE.s, marginTop: SPACE.s },
  tile: { flex: 1, alignItems: 'center', paddingTop: SPACE.m, paddingBottom: SPACE.s, borderRadius: RADIUS.l, overflow: 'hidden' },
  tileGlow: { position: 'absolute', left: SPACE.l, right: SPACE.l, top: SPACE.l, bottom: SPACE.xxl + SPACE.s, borderRadius: RADIUS.pill, opacity: 0.9 },
  tileName: { marginTop: SPACE.xxs },
  pair: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: SPACE.xxs },
});
