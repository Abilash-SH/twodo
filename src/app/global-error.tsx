'use client';
/* Twodo · the last resort when something fails outside every boundary (instead of the framework's blank "This page
   couldn't load"): what failed, in a line that is safe to screenshot and send (errorSummary), and Reload. It replaces
   the whole page, so it carries its own plain styles. */
import { errorSummary } from '@/lib/errors';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const box: React.CSSProperties = { maxWidth: 420, margin: '0 auto', padding: 'max(72px, calc(env(safe-area-inset-top) + 40px)) 24px 32px', textAlign: 'center' };
  const btn: React.CSSProperties = { minHeight: 48, padding: '0 22px', margin: '6px', border: 0, borderRadius: 24, font: '700 16px/20px -apple-system, system-ui, sans-serif' };
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#FAF8FB', color: '#1B1730', font: '16px/22px -apple-system, system-ui, sans-serif' }}>
        <main style={box} role="alert">
          <h1 style={{ font: '800 26px/32px ui-rounded, -apple-system, system-ui, sans-serif', margin: '0 0 8px' }}>Twodo stopped for a moment</h1>
          <p style={{ margin: '0 0 18px', color: '#5E5A69' }}>Your to-dos and messages are saved on this phone. Reload to carry on.</p>
          <p style={{ margin: '0 0 22px', fontSize: 13, lineHeight: '18px', color: '#5E5A69' }}>
            If it happens again, a screenshot of this line helps fix it:<br />
            <code style={{ display: 'inline-block', marginTop: 6, padding: '6px 10px', borderRadius: 10, background: '#EFEBF3', color: '#1B1730', wordBreak: 'break-word' }}>
              {errorSummary(error)}{error.digest ? ` · ${error.digest.slice(0, 12)}` : ''}
            </code>
          </p>
          <button type="button" style={{ ...btn, background: '#1B1730', color: '#FFFFFF' }} onClick={() => location.reload()}>Reload</button>
          <button type="button" style={{ ...btn, background: '#EFEBF3', color: '#1B1730' }} onClick={() => reset()}>Try again</button>
        </main>
      </body>
    </html>
  );
}
