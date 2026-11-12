/* Twodo · the HTML page. Everything inside renders in the browser (see page.tsx); the splash is plain HTML so it
   shows instantly. The Content-Security-Policy is added at build time (scripts/postbuild.mjs) with hashes of
   Next's own inline scripts, so only this site's code can run. */
import type { Metadata, Viewport } from 'next';
import './globals.css';

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: 'Twodo',
  description: 'A beautiful to-do list made for two.',
  formatDetection: { telephone: false },
  // full screen on iPhone: the app draws under the status bar (every header already pads for the safe area)
  appleWebApp: { title: 'Twodo', statusBarStyle: 'black-translucent' },
  other: { 'apple-mobile-web-app-capable': 'yes', 'mobile-web-app-capable': 'yes' },
};
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, viewportFit: 'cover', interactiveWidget: 'resizes-content',
  themeColor: '#FAF8FB', colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="manifest" href={`${base}/manifest.webmanifest`} />
        <link rel="icon" href={`${base}/icons/icon.svg`} type="image/svg+xml" />
        <link rel="apple-touch-icon" href={`${base}/icons/apple-touch-icon.png`} />
        {/* runs before the first paint: theme without a flash, and never inside someone else's page */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src={`${base}/boot.js`} />
      </head>
      <body className="launching" suppressHydrationWarning>
        <div id="splash" aria-hidden="true">
          <div className="sp-mark"><svg viewBox="10 22 80 56"><circle className="s1" cx="38" cy="50" r="24" /><circle className="s2" cx="62" cy="50" r="24" /><path className="sck" d="M35.5 51l10.5 10.5 20.5-23" /></svg></div>
          <div className="sp-word">Twodo</div><div className="sp-tag">made for two</div>
        </div>
        {children}
      </body>
    </html>
  );
}
