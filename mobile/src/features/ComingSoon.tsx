/* Twodo · a tab whose screen isn't built yet: its title, a character, and where to go meanwhile. */
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, LargeTitle } from '@/ui/components';
import { PILL_SPACE } from '@/ui/PillBar';
import { useTheme } from '@/ui/theme';
import { SPACE } from '@/ui/tokens';
import { usePeople, type Who } from './people';

export function ComingSoon({ title, line, who }: { title: string; line: string; who: Who }) {
  const t = useTheme(), insets = useSafeAreaInsets(), p = usePeople()[who];
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.n.bg }}
      contentContainerStyle={{ paddingTop: insets.top + SPACE.xs, paddingBottom: insets.bottom + PILL_SPACE, paddingHorizontal: SPACE.m }}
      contentInsetAdjustmentBehavior="never"
    >
      <LargeTitle title={title} />
      <View style={{ marginTop: SPACE.xxl }}>
        <EmptyState avatar={p.avatar} color={p.color} title="Coming next" line={line} />
      </View>
    </ScrollView>
  );
}
