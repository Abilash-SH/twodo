/* The Playground: every piece of the design system, and where you change how the two of you look. */
import { useRouter } from 'expo-router';
import { Playground } from '@/features/playground/Playground';

export default function PlaygroundScreen() {
  const router = useRouter();
  return <Playground onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
