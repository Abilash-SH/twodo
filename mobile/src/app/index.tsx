/* Phase 1: the app opens on the Playground. Phase 3 puts Home here and moves the Playground behind a
   developer-only route. */
import { Playground } from '@/features/playground/Playground';

export default function Index() {
  return <Playground />;
}
