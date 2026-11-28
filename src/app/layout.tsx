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
  appleWebApp: { capable: true, title: 'Twodo', statusBarStyle: 'black-translucent' },
  other: { 'mobile-web-app-capable': 'yes' },
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
        {/* two hearts, one in each of your colours (boot.js), come together; then the caption */}
        <div id="splash" aria-hidden="true">
          <div className="sp-mark"><svg viewBox="0 0 160 100">
            <g transform="translate(60 52)"><path className="sp-h sp-a" d="M0 30 C -26 13 -36 -3 -36 -15 C -36 -27 -27 -35 -17 -35 C -9 -35 -3 -31 0 -24 C 3 -31 9 -35 17 -35 C 27 -35 36 -27 36 -15 C 36 -3 26 13 0 30 Z" /></g>
            <g transform="translate(100 52)"><path className="sp-h sp-b" d="M0 30 C -26 13 -36 -3 -36 -15 C -36 -27 -27 -35 -17 -35 C -9 -35 -3 -31 0 -24 C 3 -31 9 -35 17 -35 C 27 -35 36 -27 36 -15 C 36 -3 26 13 0 30 Z" /></g>
            <g transform="translate(80 22)"><path className="sp-spark" d="M0 -9 L2 -2 L9 0 L2 2 L0 9 L-2 2 L-9 0 L-2 -2 Z" /></g>
          </svg></div>
          <div className="sp-cap">Two souls, one space.</div>
        </div>
        {children}
      </body>
    </html>
  );
}
