'use client';
/* Isolate a chat rendering failure so it cannot take down Home or the rest of Twodo.
   The message content and encryption keys must never appear in error logs (errorSummary drops quoted text). */
import { Component, type ReactNode } from 'react';
import { errorSummary } from '@/lib/errors';
import { popView } from '@/ui/nav';

/** `cls`, `vid` and `open` are the chat screen's own (see NavStack): the note slides and parks exactly like the chat,
 *  so going back never leaves it covering Home. */
interface Props { children: ReactNode; cls: string; vid?: number; open: boolean }
interface State { failed: boolean; summary: string }
export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, summary: '' };
  // only the error's type and what code failed: never a message
  static getDerivedStateFromError(error: unknown): State { return { failed: true, summary: errorSummary(error, 'Chat') }; }
  componentDidCatch(error: Error) { console.warn('Twodo: chat render failed', errorSummary(error, 'Chat')); }
  componentDidUpdate(prev: Props) {
    // The chat opened or was put away: try it again (what broke may be gone by then). If it breaks again, the note comes back.
    if (this.state.failed && prev.open !== this.props.open) this.setState({ failed: false, summary: '' });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const { cls, vid, open } = this.props;
    return <section className={`${cls} chatview chat-fail`} data-vid={vid} inert={!open} role={open ? 'alert' : undefined}>
      <div className="chat-fail-in">
        <h2>Chat couldn’t open</h2>
        <p>Your messages are still saved. You can go back Home and try again.</p>
        <p><code className="area-code">{this.state.summary}</code></p>
        <button type="button" className="btn" onClick={() => popView()}>Back to Home</button>
      </div>
    </section>;
  }
}
