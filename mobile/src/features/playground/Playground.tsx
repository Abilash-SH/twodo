/* Twodo · the Playground (phase 1): every piece of the design system on one screen, in light and dark, with the
   characters' moods to try on a real iPhone. Everything here is pretend: nothing is stored or sent. */
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Avatar } from '@/ui/avatar/Avatar';
import { DEFAULT_LOOKS, HAIRS, HAIR_NAMES, LOOKS, LOOK_NAMES, SKINS, SKIN_NAMES, type AvatarLook, type Hair, type Skin } from '@/ui/avatar/looks';
import { MOMENTS, MOOD_NAMES, STATES, type CharState } from '@/ui/avatar/moods';
import { Portrait } from '@/ui/avatar/Portrait';
import { Stage } from '@/ui/avatar/Stage';
import { useMoments } from '@/ui/avatar/useMoments';
import { contrast } from '@/ui/color';
import { Badge, Button, Card, Chip, EmptyState, LargeTitle, Row, Screen, Section, Toast } from '@/ui/components';
import { haptic } from '@/ui/haptics';
import { launch } from '@/ui/launch/launchStore';
import { Txt } from '@/ui/Text';
import { useTheme, type SchemeChoice } from '@/ui/theme';
import { COLOR_NAMES, INK, PALETTE, RADIUS, SPACE, TYPE, type ColorName, type TypeVariant } from '@/ui/tokens';

interface Pick { avatar: AvatarLook; color: ColorName }

const SAMPLE: Record<TypeVariant, string> = {
  largeTitle: 'Today', title: 'This week', headline: 'Buy flowers', body: 'Pick up the cake on the way home.',
  callout: 'Add a to-do', footnote: 'Tomorrow · 6 pm', caption: 'Seen',
};
const SCHEMES: [SchemeChoice, string][] = [['system', 'Like my phone'], ['light', 'Light'], ['dark', 'Dark']];

export function Playground() {
  const t = useTheme(), reduce = useReducedMotion();
  const [me, setMe] = useState<Pick>({ avatar: DEFAULT_LOOKS.male, color: 'blue' });
  const [pt, setPt] = useState<Pick>({ avatar: DEFAULT_LOOKS.female, color: 'pink' });
  const [meState, setMeState] = useState<CharState>('idle');
  const [ptState, setPtState] = useState<CharState>('think');
  const meM = useMoments(), ptM = useMoments();
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const note = (text: string): void => {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  return (
    <View style={styles.fill}>
      <Screen>
        <LargeTitle title="Playground" sub="Twodo's look, piece by piece: the two characters, their moods, colours, type and controls. Everything here is pretend: nothing is saved or sent." />
        <View style={styles.wrap}>
          {SCHEMES.map(([c, label]) => (
            <Chip key={c} label={label} selected={t.choice === c} onPress={() => t.setChoice(c)} color={me.color} />
          ))}
        </View>

        <Section title="The two of you" sub="Tap a character.">
          <Stage
            height={168}
            me={{ ...me, name: 'You', state: meState, moment: meM.moment, hint: 'Your character waves', onPress: () => { haptic.tick(); meM.react('wave', true); } }}
            partner={{ ...pt, name: 'Your partner', state: ptState, moment: ptM.moment, hint: 'Their character waves', onPress: () => { haptic.tick(); ptM.react('wave', true); } }}
          />
        </Section>

        <Section title="Moods" sub={reduce ? 'Reduce Motion is on, so the characters stay still.' : 'A moment plays once. A state lasts while it is true.'}>
          <Txt variant="footnote" tone="soft">Moments, on your character</Txt>
          <View style={styles.wrap}>
            {MOMENTS.map(m => <Chip key={m} label={MOOD_NAMES[m]} onPress={() => meM.react(m, true)} color={me.color} />)}
          </View>
          <Txt variant="footnote" tone="soft" style={styles.gap}>Your state</Txt>
          <View style={styles.wrap}>
            {STATES.map(s => <Chip key={s} label={MOOD_NAMES[s]} selected={meState === s} onPress={() => setMeState(s)} color={me.color} />)}
          </View>
          <Txt variant="footnote" tone="soft" style={styles.gap}>Your partner's state</Txt>
          <View style={styles.wrap}>
            {STATES.map(s => <Chip key={s} label={MOOD_NAMES[s]} selected={ptState === s} onPress={() => setPtState(s)} color={pt.color} />)}
          </View>
        </Section>

        <Section title="Your character">
          <Picker value={me} onChange={setMe} />
        </Section>
        <Section title="Your partner's character">
          <Picker value={pt} onChange={setPt} />
        </Section>

        <Section title="Both looks" sub="Tap one to make it wave.">
          <View style={styles.grid}>
            {LOOKS.map(l => <Tile key={l} avatar={{ ...me.avatar, look: l }} color={me.color} label={LOOK_NAMES[l]} />)}
          </View>
        </Section>

        <Section title="Colours" sub="Dark ink on every colour, and every colour as text, stay readable in light and dark (tested).">
          <View style={styles.grid}>
            {PALETTE.map(c => <Swatch key={c} name={c} />)}
          </View>
        </Section>

        <Section title="Type" sub="The system font for reading; the iPhone's rounded face for titles.">
          <Card>
            {(Object.keys(TYPE) as TypeVariant[]).map(v => (
              <View key={v} style={styles.typeRow}>
                <Txt variant={v}>{SAMPLE[v]}</Txt>
                <Txt variant="caption" tone="soft">{v}</Txt>
              </View>
            ))}
          </Card>
        </Section>

        <Section title="Buttons">
          <View style={styles.stack}>
            <Button title="Add a to-do" color={me.color} onPress={() => { meM.react('happy', true); note('Added (pretend)'); }} />
            <Button title="Not now" kind="quiet" color={me.color} onPress={() => note('Okay, not now')} />
            <Button title="Delete" kind="danger" onPress={() => note('Nothing was deleted')} />
          </View>
        </Section>

        <Section title="Rows on a card">
          <Card>
            <Row title="Buy flowers" sub="Today · 6 pm" left={<Portrait avatar={me.avatar} color={me.color} size={36} />} onPress={() => note('Buy flowers')} />
            <Row title="Plan the weekend" sub="This week" right={<Badge count={2} color={pt.color} />} left={<Portrait avatar={pt.avatar} color={pt.color} size={36} />} onPress={() => note('Plan the weekend')} />
            <Row title="Water the plants" sub="Tomorrow" last onPress={() => note('Water the plants')} />
          </Card>
        </Section>

        <Section title="Empty state">
          <Card>
            <EmptyState avatar={me.avatar} color={me.color} title="Nothing on today" line="Enjoy it, or add something small." action={{ title: 'Add a to-do', onPress: () => note('Added (pretend)') }} />
          </Card>
        </Section>

        <Section title="Moments">
          <View style={styles.stack}>
            <Button title="Show a note" kind="quiet" color={me.color} onPress={() => note('Saved on your phone')} />
            <Button title="Play the launch again" kind="quiet" color={me.color} onPress={() => launch.replay(me.color, pt.color)} />
          </View>
        </Section>

        <Txt variant="caption" tone="soft" align="center" style={styles.foot}>Twodo · phase 1 · the design system</Txt>
      </Screen>
      {toast ? <Toast text={toast} /> : null}
    </View>
  );
}

/** Choose a look, a skin tone, a hair colour and your colour (the hoodie). */
function Picker({ value, onChange }: { value: Pick; onChange: (p: Pick) => void }) {
  const t = useTheme();
  const set = (a: Partial<AvatarLook>) => { haptic.tick(); onChange({ ...value, avatar: { ...value.avatar, ...a } }); };
  return (
    <View>
      <View style={styles.grid}>
        {LOOKS.map(l => {
          const on = value.avatar.look === l;
          return (
            <Pressable
              key={l} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={LOOK_NAMES[l]}
              onPress={() => set({ look: l })}
              style={[styles.lookTile, { backgroundColor: on ? t.person(value.color).tint : t.n.raised, borderColor: on ? t.color(value.color) : t.n.raised }]}
            >
              <Avatar avatar={{ ...value.avatar, look: l }} color={value.color} size={96} still />
              <Txt variant="footnote" style={styles.tileName}>{LOOK_NAMES[l]}</Txt>
            </Pressable>
          );
        })}
      </View>
      <Txt variant="footnote" tone="soft" style={styles.gap}>Skin</Txt>
      <View style={styles.wrap}>
        {(Object.keys(SKINS) as Skin[]).map(k => (
          <Dot key={k} fill={SKINS[k]} on={value.avatar.skin === k} label={SKIN_NAMES[k]} onPress={() => set({ skin: k })} />
        ))}
      </View>
      <Txt variant="footnote" tone="soft" style={styles.gap}>Hair</Txt>
      <View style={styles.wrap}>
        {(Object.keys(HAIRS) as Hair[]).map(k => (
          <Dot key={k} fill={HAIRS[k]} on={value.avatar.hair === k} label={HAIR_NAMES[k]} onPress={() => set({ hair: k })} />
        ))}
      </View>
      <Txt variant="footnote" tone="soft" style={styles.gap}>Your colour (the hoodie)</Txt>
      <View style={styles.wrap}>
        {PALETTE.map(c => (
          <Dot key={c} fill={t.color(c)} on={value.color === c} label={COLOR_NAMES[c]} onPress={() => { haptic.tick(); onChange({ ...value, color: c }); }} />
        ))}
      </View>
    </View>
  );
}

function Dot({ fill, on, label, onPress }: { fill: string; on: boolean; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label} hitSlop={4} onPress={onPress}
      style={[styles.dot, { backgroundColor: fill, borderColor: on ? t.n.label : t.n.bg }]}
    />
  );
}

function Tile({ avatar, color, label }: { avatar: AvatarLook; color: ColorName; label: string }) {
  const t = useTheme(), m = useMoments();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Waves"
      onPress={() => { haptic.tick(); m.react('wave', true); }}
      style={[styles.lookTile, { backgroundColor: t.n.raised, borderColor: t.n.raised }]}
    >
      <Avatar avatar={avatar} color={color} size={150} moment={m.moment} />
      <Txt variant="footnote" style={styles.tileName}>{label}</Txt>
    </Pressable>
  );
}

function Swatch({ name }: { name: ColorName }) {
  const t = useTheme(), p = t.person(name);
  return (
    <View style={[styles.swatch, { backgroundColor: t.n.raised }]} accessible accessibilityLabel={`${COLOR_NAMES[name]}: dark text ${contrast(INK, p.base).toFixed(1)} to 1`}>
      <View style={[styles.swatchColour, { backgroundColor: p.base }]}>
        <Txt variant="headline" tone="on">Aa</Txt>
      </View>
      <Txt variant="footnote" ink={name} style={styles.tileName}>{COLOR_NAMES[name]}</Txt>
      <Txt variant="caption" tone="soft" tabular>{contrast(INK, p.base).toFixed(1)}:1</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, marginTop: SPACE.xs },
  gap: { marginTop: SPACE.m },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs },
  stack: { gap: SPACE.s },
  lookTile: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', borderRadius: RADIUS.l, borderWidth: 2, paddingTop: SPACE.m, paddingBottom: SPACE.xs },
  tileName: { marginTop: SPACE.xxs, fontWeight: '600' },
  dot: { width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
  swatch: { width: '31.5%', alignItems: 'center', borderRadius: RADIUS.l, padding: SPACE.xs, paddingBottom: SPACE.s },
  swatchColour: { alignSelf: 'stretch', height: 56, borderRadius: RADIUS.s, alignItems: 'center', justifyContent: 'center' },
  typeRow: { paddingHorizontal: SPACE.m, paddingVertical: SPACE.xs },
  foot: { marginTop: SPACE.xxl },
});
