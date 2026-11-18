/* Twodo · the floating tab bar from the reference: a dark pill near the bottom with one round button per tab; the
   chosen tab is a light circle. Each button has a label for VoiceOver; a tap gives a light tick. */
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from './haptics';
import { Icon, type IconName } from './icons';
import { useTheme } from './theme';
import { PILL, SPACE } from './tokens';

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'Home' },
  todos: { icon: 'todos', label: 'To-dos' },
  journal: { icon: 'journal', label: 'Journal' },
  chat: { icon: 'chat', label: 'Chat' },
};
export const PILL_SPACE = 96; // room to leave at the bottom of a tab's content

export function PillBar({ state, navigateToTab }: BottomTabBarProps) {
  const t = useTheme(), insets = useSafeAreaInsets(), c = PILL[t.scheme];
  return (
    <View style={[styles.wrap, { bottom: insets.bottom + SPACE.xs }]} pointerEvents="box-none">
      <View style={[styles.pill, { backgroundColor: c.bg, boxShadow: t.shadow[2] }]} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const tab = TABS[route.name] ?? { icon: 'home' as const, label: route.name };
          const on = state.index === i;
          return (
            <Pressable
              key={route.key} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: on }}
              onPress={() => {
                if (on) return;
                haptic.tick();
                navigateToTab(route.key);
              }}
              style={[styles.tab, on && { backgroundColor: c.activeBg }]}
            >
              <Icon name={tab.icon} size={24} color={on ? c.activeIcon : c.icon} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', gap: SPACE.xs, padding: 6, borderRadius: 999 },
  tab: { width: 56, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
