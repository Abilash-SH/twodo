/* Home: the first tab. */
import { useRouter } from 'expo-router';
import { Home, type HomeTarget } from '@/features/home/Home';

export default function HomeTab() {
  const router = useRouter();
  const open = (to: HomeTarget) => {
    if (to === 'playground') router.push('/playground');
    else router.navigate(`/${to}`);
  };
  return <Home onOpen={open} />;
}
