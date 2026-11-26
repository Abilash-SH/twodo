'use client';
/* Twodo · keeps a failure in one part of a screen (Home's header, Home's cards) from taking the whole app down: that
   part shows a short note with what failed (errorSummary) and "Try again", which draws it afresh; everything around
   it keeps working, so the bar can still open the chat or To-dos. */
import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { errorSummary } from '@/lib/errors';

interface Props { area: string; children: ReactNode; compact?: boolean }
interface State { error: unknown; tries: number }
export class AreaBoundary extends Component<Props, State> {
  state: State = { error: null, tries: 0 };
  static getDerivedStateFromError(error: unknown): Partial<State> { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    void info; // its component stack names code only, but stays out of logs like everything else here
    console.warn('Twodo: part of the screen failed', errorSummary(error, this.props.area));
  }
  render() {
    if (!this.state.error) return <Fragment key={this.state.tries}>{this.props.children}</Fragment>;
    const summary = errorSummary(this.state.error, this.props.area);
    return (
      <div className={`area-fail${this.props.compact ? ' compact' : ''}`} role="alert">
        {this.props.compact ? null : <b>This part of {this.props.area} couldn’t load</b>}
        {this.props.compact ? null : <span>Your to-dos and messages are saved. The buttons below still work.</span>}
        <code>{summary}</code>
        <button type="button" className="btn" onClick={() => this.setState(s => ({ error: null, tries: s.tries + 1 }))}>Try again</button>
      </div>
    );
  }
}
