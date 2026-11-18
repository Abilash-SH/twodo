/* Twodo · the four tabs, with the floating pill bar from the owner's reference instead of the standard tab bar. */
import { Tabs } from 'expo-router/js-tabs';
import { PillBar } from '@/ui/PillBar';
import { useTheme } from '@/ui/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      tabBar={props => <PillBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: t.n.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="todos" options={{ title: 'To-dos' }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
    </Tabs>
  );
}
