/* Chat: the screen comes in phase 3 (docs/architecture.md, "Phases"). */
import { ComingSoon } from '@/features/ComingSoon';

export default function ChatTab() {
  return <ComingSoon title="Chat" line="Messages move here once sign-in and syncing are in (phase 2). Until then, chat in the web app." who="partner" />;
}
