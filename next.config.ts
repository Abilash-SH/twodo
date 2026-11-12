import type { NextConfig } from 'next';

// Twodo is a client-only PWA: everything runs in the browser and talks to Firebase directly, so the site is a
// static export that GitHub Pages can host. BASE_PATH is "/twodo" on GitHub Pages and "" for local testing.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const config: NextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
};
export default config;
