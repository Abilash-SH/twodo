/* Twodo · client configuration, from build-time environment variables (see .env.example).
   Every value here is PUBLIC by design: it identifies the Firebase project, it doesn't grant access.
   Access is enforced by firebase.rules.json and sign-in. Secrets never belong in NEXT_PUBLIC_* variables. */
import { z } from 'zod';

const url = z.union([z.literal(''), z.url()]);
const Env = z.object({
  apiKey: z.string().max(200).default(''),
  databaseURL: url.default(''),
  authEmulator: url.default(''),
  vapidPublicKey: z.string().regex(/^[A-Za-z0-9_-]*$/).max(200).default(''),
  basePath: z.string().regex(/^(\/[A-Za-z0-9_.-]+)*$/).default(''),
});

// Next inlines NEXT_PUBLIC_* at build time, so each one must be referenced by its full name.
const parsed = Env.safeParse({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? '',
  authEmulator: process.env.NEXT_PUBLIC_AUTH_EMULATOR ?? '',
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
});
if (!parsed.success) console.warn('Twodo: ignoring invalid configuration', parsed.error.issues);
const env = parsed.success ? parsed.data : Env.parse({});

export const CFG = {
  firebase: { apiKey: env.apiKey, databaseURL: env.databaseURL },
  authEmulator: env.authEmulator,
  vapidPublicKey: env.vapidPublicKey,
  basePath: env.basePath,
};
export const cloudReady = (): boolean => !!(CFG.firebase.apiKey && CFG.firebase.databaseURL && typeof crypto !== 'undefined' && crypto.subtle);
/** A path inside the site, e.g. asset('sw.js') → "/twodo/sw.js" on GitHub Pages */
export const asset = (p: string): string => `${CFG.basePath}/${p.replace(/^\/+/, '')}`;
