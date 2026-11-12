/* Twodo · a button that shows a spinner while its action runs (and can't be pressed twice) */
import { useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';

export function BusyButton({ onRun, children, ref, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & { onRun: () => Promise<unknown> | unknown; children: ReactNode; ref?: Ref<HTMLButtonElement> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button ref={ref} type="button" {...rest} disabled={busy || rest.disabled} onClick={async () => {
      if (busy) return; setBusy(true);
      try { await onRun(); } finally { setBusy(false); }
    }}>{busy ? <span className="spin" /> : children}</button>
  );
}
