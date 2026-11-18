/* The journal: one page each per day; only today's can be written. */
import { Journal } from '@/features/journal/Journal';

export default function JournalTab() {
  return <Journal />;
}
