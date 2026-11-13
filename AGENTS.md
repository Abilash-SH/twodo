# Twodo — rules for coding agents

Twodo is a private to-do list + chat PWA for two people. In tests the partner is "Deiva" (never use the name "Priya"). Next.js App Router with static export, React 19, strict TypeScript. Every push to `main` deploys to GitHub Pages, so always work on a branch and open a PR. Main target: the iPhone home-screen app; then Android and desktop.

## Read first
- `design.md`: the visual specification (colours for the two people, type, spacing, components, characters, motion, accessibility, a "never" list and a checklist). Read it before any visual change; if you must differ, change it in the same PR and say why.
- `ROADMAP.md`: the plan, the state of every item, acceptance criteria and the decisions with their reasons. Take the first item marked next, and update the file in the PR that changes an item's state.

## Where things are
- `src/components`: `App.tsx` (boot, global events), `nav/NavStack.tsx` (screen stack), `chat/` (`ChatView.tsx`, `chatCtl.ts`), `composer/Composer.tsx`, `sheets/`, `settings/`, `vault/VaultUI.tsx`, `overlays/` (sheets, photo viewer, focus timer, alerts, island, menus)
- `src/hooks`: `useKeyboard.ts` (iPhone keyboard), `useStackGestures.ts` + `swipe.ts` (touch gestures), `useTapKeep.ts` (buttons that must not close the keyboard), `useFlip.ts` (rows slide into place)
- `src/lib`: data, sync, crypto, vault (no React). `src/ui`: small stores (`nav.ts` screens and history, `update.ts` app updates).
- `docs/`: `gesture-ownership.md` (who owns each gesture), `home-concepts.md` (home-screen concepts under review), `iphone-validation.md`.
- `src/styles/NN-*.css`: the design system, imported in order by `legacy.css` (later files win). `31-native-surfaces.css` limits every transition to transform/opacity and keeps blur off moving layers. Tokens (colours, motion, layers) live in `01-tokens.css`. Put new CSS in a new, higher-numbered file. Tailwind only with the `tw:` prefix.

## Security (never break)
- No secrets in the repo, `.env.production` or `NEXT_PUBLIC_*` variables. (The Firebase web API key and database URL are public by design; the key is restricted in Google Cloud.)
- No inline scripts, `eval`, `innerHTML` or `dangerouslySetInnerHTML`, and no new third-party origins: `scripts/postbuild.mjs` writes a strict CSP.
- Anything read from storage or the network goes through `cleanRecord`/`cleanMap` (`src/lib/store.ts`).
- Don't change the encryption, the sync format or the storage keys (`twodo:data`, `twodo:local`, `twodo:chat`, `twodo:vault`, IndexedDB `twodo`).
- Secret lists are never synced, exported, searched, counted or shown outside their own list.
- Check every change for security problems and say what you checked in the PR.

## iPhone rules
- iOS gives no keyboard events: keep the approach in `useKeyboard.ts` (measure the VisualViewport once per frame; never predict a saved keyboard height, animate layout, or hide the app to force a reflow). Controls next to a focused field use `useTapKeep` / `useTapKeepWithin`. Only call `.focus()` right after the user tapped something meant for typing (inside that tap), never from a timer and never while a sheet or page is animating.
- Gestures use touch events (`hooks/swipe.ts`), not pointer events.
- Animate only `transform` and `opacity`, with the motion tokens (`--dur-*`, `--ease-*`). Never put `backdrop-filter` over something that keeps animating. With Reduce Motion on, motion becomes simple fades.
- Layers use the `--z-*` scale in `01-tokens.css`; don't invent new z-index numbers.
- Fixed elements respect `env(safe-area-inset-*)`; the status bar is translucent.
- Size full-screen layers with `inset: 0` or the measured `--vvh`/`--vvt`, never `100vh`/`100lvh`/`100dvh`: in Home Screen apps on iOS 26.1+ those units are taller than the visible screen (WebKit bug 301994) and push the message bar off the bottom.
- Back navigation has one owner, `src/ui/nav.ts`: while any screen is open there is exactly one history "trap" entry, and every `popstate` (Back button, Android back, iOS edge swipe) closes exactly one thing. Gestures call `popView()`; they never call `history.back()` themselves. Gestures check `Nav.seq` so one that started before a navigation can't navigate again. Every gesture has one owner: see `docs/gesture-ownership.md` and keep it current.
- The app never reloads, moves focus or closes the keyboard unless the person caused it. A new version waits (`public/sw.js`) and is applied through `src/ui/update.ts` only.
- Don't read layout (`offsetWidth`, `scrollHeight`, `getBoundingClientRect`) while a screen is being pushed; to start a CSS transition, flush styles only (`getComputedStyle(el).opacity`).

## Before every PR
- `npm ci --ignore-scripts`, `npm run typecheck` and `npm run build` must pass.
- If Chrome + Playwright are available, run `tests/e2e/` (they use the fake Firebase in `tests/mock_firebase.py` and `scripts/build-test.sh`; run test 1 first, it creates the two accounts). Also `node tests/velocity.cjs` (see `tests/README.md`). If not, say so.
- For a visual change, go through the checklist at the end of `design.md`.
- One topic per PR. Describe the problem and its cause, the new behaviour, what was tested and what was not, the security and data checks, and a short checklist to try on an iPhone.
