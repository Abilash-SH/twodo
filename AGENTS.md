# Twodo — rules for coding agents
Twodo is a private to-do list + chat PWA for two people. In tests the partner is "Deiva" (never use the name "Priya"). Next.js App Router with static export, React 19, strict TypeScript. Every push to main deploys to GitHub Pages, so always work on a branch and open a PR. Main target: the iPhone home-screen app; then Android and desktop.

## Where things are
- src/components: App.tsx (boot, global events), nav/NavStack.tsx (screen stack), chat/ (ChatView.tsx, chatCtl.ts), composer/Composer.tsx, sheets/, settings/, vault/VaultUI.tsx, overlays/ (sheets, photo viewer, focus timer, alerts, island, menus)
- src/hooks: useKeyboard.ts (iPhone keyboard), useStackGestures.ts + swipe.ts (touch gestures), useTapKeep.ts (buttons that must not close the keyboard)
- src/lib: data, sync, crypto, vault (no React). src/ui: small stores.
- src/styles/NN-*.css: the design system, imported in order by legacy.css (later files win). Tokens live in 01-tokens.css. Put new CSS in a new, higher-numbered file. Tailwind only with the tw: prefix.

## Security (never break)
- No secrets in the repo, .env.production or NEXT_PUBLIC_* variables. (The Firebase web API key and database URL are public by design.)
- No inline scripts, eval, innerHTML or dangerouslySetInnerHTML, and no new third-party origins: scripts/postbuild.mjs writes a strict CSP.
- Anything read from storage or the network goes through cleanRecord/cleanMap (src/lib/store.ts).
- Don't change the encryption, the sync format or the storage keys (twodo:data, twodo:local, twodo:chat, twodo:vault, IndexedDB "twodo").
- Secret lists are never synced, exported, searched, counted or shown outside their own list.
- Check every change for security problems and say what you checked in the PR.

## iPhone rules
- iOS gives no keyboard events: keep the approach in useKeyboard.ts. Buttons next to a focused field use useTapKeep. Only call .focus() right after the user tapped something meant for typing.
- Gestures use touch events (hooks/swipe.ts), not pointer events.
- Animate only transform and opacity. Never put backdrop-filter over something that keeps animating. Support prefers-reduced-motion.
- Fixed elements respect env(safe-area-inset-*); the status bar is translucent.

## Before every PR
- npm ci --ignore-scripts, npm run typecheck and npm run build must pass.
- If Chrome + Playwright are available, run tests/e2e/ (they use the fake Firebase in tests/mock_firebase.py and scripts/build-test.sh). If not, say so.
- One topic per PR. Describe what changed, why, and a short checklist to try on an iPhone.
