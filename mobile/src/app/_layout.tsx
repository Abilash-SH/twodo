/* Twodo · the root of the app: theme, gestures, the screen stack, and the launch on top while it plays. */
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Launch } from '@/ui/launch/Launch';
import { launch, useLaunch } from '@/ui/launch/launchStore';
import { ThemeProvider, useTheme } from '@/ui/theme';

// The still splash stays until the animated launch has drawn its first frame (same colour, no picture).
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 150 });

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  const t = useTheme(), l = useLaunch();
  return (
    <>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.n.bg } }} />
      {l.showing ? <Launch a={l.a} b={l.b} onDone={launch.end} /> : null}
    </>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
