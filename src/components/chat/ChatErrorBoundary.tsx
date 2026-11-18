'use client';
/* Isolate a chat rendering failure so it cannot take down Home or the rest of Twodo.
   The message content and encryption keys must never appear in error logs. */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { popView } from '@/ui/nav';

interface Props { children: ReactNode }
interface State { failed: boolean }
export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    // Do not log error.message, stack or componentStack: those can contain user content.
    console.warn('Twodo: chat render failed', { type: error.name, area: 'chat' });
    void info;
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="view pushed chatview" role="alert" aria-live="assertive">
      <div style={{ padding: 'max(80px, env(safe-area-inset-top)) 24px 24px', textAlign: 'center' }}>
        <h2>Chat couldn't open</h2>
        <p>Your messages are still saved. You can return Home and try again.</p>
        <button type="button" className="btn" onClick={() => { this.setState({ failed: false }); popView(); }}>Back to Home</button>
      </div>
    </section>;
  }
}
