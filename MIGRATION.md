# Twodo: migration from plain JavaScript to Next.js + React + TypeScript

This is a migration, not a redesign. The app looks and behaves like v3.6. With the same data loaded, every main screen differs from the original only by the icon glyph pixels (tested at phone and desktop sizes). The original plain-JavaScript app stays on `main` until this branch is merged, and is also kept on the branch `backup/v3-vanilla`.

## 1. Original architecture (v3.6)
- **Front end:** one `index.html` plus 25 classic `<script>` files that share one global scope (about 4,700 lines of JS). Plus `styles.css` and `chat.css` (about 1,400 lines). No build step.
- **Rendering:** screens were built as HTML strings, escaped with `esc()`, written into the page with `innerHTML`, and wired up with delegated events.
- **Navigation:** an in-app stack of screens with iOS-style push, pop and swipe-back, kept in step with `history`.
- **Backend:** Firebase Auth (REST) and Firebase Realtime Database (REST plus Server-Sent Events). There's no Firebase SDK and no server of its own.
- **Data:** end-to-end encrypted with AES-256-GCM (space key, ECDH pairing, PBKDF2 login). Each record is checked before use.
- **PWA:** a hand-versioned service worker for the offline shell and encrypted push.
- **Push:** a GitHub Action (`.github/reminders/send.mjs`) sends due reminders.
- **Hosting:** GitHub Pages, serving the repo's files as they are.

## 2. New architecture
- **Next.js 16** (App Router) with `output: 'export'`, so the result is a fully static site that is still hosted on GitHub Pages. The app is client-only: `ClientApp` loads `App` with `ssr: false`, because it needs localStorage, IndexedDB and Web Crypto from the first instant. The splash screen is plain HTML in `layout.tsx`, so it still paints instantly.
- **Data layer (`src/lib`, no React):** each original module became a strict TypeScript module with types (`types.ts`). Their logic is unchanged.
- **React glue:** data changes call `scheduleRender()` (`lib/render.ts`), and components subscribe with `useApp()` (`useSyncExternalStore`). That is the same one-render-per-frame model as before, and renders still wait while a finger is dragging.
- **Screen state (`src/ui`):** small observable stores for the navigation stack, sheets, menus, the island, alerts, the gate and photos. The original call sites (`openSheet`, `showMenu`, `island`, `pushView`, …) keep their names.
- **Components (`src/components`):** each screen and each overlay is its own component (see section 4).
- **Hooks (`src/hooks`):**
  - `useStackGestures`: row swipes, long-press, edge and pan swipe-back.
  - `useKeyboard`: follows the iOS keyboard.
  - `useTapKeep`: buttons that don't close the keyboard.
  - `useApp`: re-render when the data changes.
- **Styling:** the design system is kept rule-for-rule in `src/styles/01-…29-*.css`, split by area and imported in the original order. Tailwind CSS 4 is set up with the `tw:` prefix and without its preflight reset, and is used for layout utilities in the components. The prefix matters: unprefixed utilities (`.grow`, `.hidden`, …) collided with the design system's own class names during testing.
- **Configuration:** `NEXT_PUBLIC_*` environment variables (`.env.production`, `.env.example`), validated with Zod in `lib/config.ts`. They replace `config.js`. Only public identifiers go there; secrets stay in GitHub Secrets.
- **Forms:** validated with Zod schemas (`lib/schemas.ts`), using the app's own error messages.
- **Build:** `scripts/postbuild.mjs` adds the Content-Security-Policy (with SHA-256 hashes of Next's inline scripts) and generates the service worker's file list and content-based version.

## 3. Folder structure
```
.github/workflows/pages.yml        build + deploy to GitHub Pages (new)
.github/workflows/reminders.yml    push sender (unchanged)   .github/reminders/ (unchanged)
public/  sw.js boot.js manifest.webmanifest icons/
scripts/postbuild.mjs  scripts/build-test.sh
src/app/        layout.tsx page.tsx globals.css
src/lib/        account chat config crypto feedback firebase fx live pair parse push render schemas store sync theme types util bridge
src/ui/         store nav sheet menu island alert tasks reminders photos gate seed install
src/hooks/      useApp useStackGestures useKeyboard useTapKeep
src/components/ App ClientApp
  chat/        ChatView (header, list, message, task card, menus, message box, swipe-to-reply) chatCtl FxPicker LoveYou
  composer/    Composer (chips, pills, list picker)
  gate/        Gate (sign-in / create / username / ready) Onboarding ObPages
  nav/         NavStack (screens, back button, shade, push/pop animations)
  overlays/    SheetHost MenuHost IslandHost AlertHost FocusOverlay PhotoViewer
  settings/    Settings (profile, Together, appearance, feel, backup) AccountSheets (auth, username, pair, request, push keys, add partner)
  sheets/      TaskSheet (details, .ics, share) ListSheet
  views/       HubView TaskListView SearchView TipsView TaskRow taskMenus
  ui/          Icon (Lucide) Avatar Segmented Rich BusyButton
src/styles/     01-tokens … 29-motion.css, legacy.css
firebase.rules.json  README.md  MIGRATION.md
```

## 4. Migrated screens and components

| Original | Now |
|---|---|
| `index.html` | `app/layout.tsx` (head, splash), `app/page.tsx`, `components/App.tsx` |
| `main.js` (boot, popstate, shortcuts, splash, keyboard, onboarding) | `App.tsx`, `hooks/useKeyboard.ts`, `gate/Onboarding.tsx` |
| `views.js` | `ui/nav.ts`, `nav/NavStack.tsx`, `views/HubView`, `TaskListView`, `SearchView`, `TaskRow` |
| `actions.js` | `ui/tasks.ts`, `hooks/useStackGestures.ts`, `views/taskMenus.tsx` |
| `ui.js` | `lib/theme.ts`, `ui/island|sheet|menu|alert.ts`, `overlays/*Host.tsx`, `ui/Segmented.tsx` |
| `sheets.js` | `sheets/TaskSheet.tsx`, `sheets/ListSheet.tsx` |
| `settings.js`, `account.js` | `settings/Settings.tsx`, `settings/AccountSheets.tsx`, `ui/photos.ts`, `overlays/PhotoViewer.tsx` |
| `gate.js` | `gate/Gate.tsx` |
| `chatui.js`, `effects.js` | `chat/ChatView.tsx`, `chat/chatCtl.ts`, `chat/FxPicker.tsx`, `chat/LoveYou.tsx`, `lib/fx.ts` |
| `composer.js` | `composer/Composer.tsx` |
| `focus.js` | `overlays/FocusOverlay.tsx`, `ui/reminders.ts` |
| `tips.js` | `views/TipsView.tsx` (tips text uses a tiny safe formatter, `ui/Rich.tsx`) |
| `store, parse, keys, cloud, live, sync, push, pair, chat, util` | `lib/*.ts`, ported 1:1 with types |
| `menu.js` (☰ side menu) | **not migrated.** It was already switched off in v3.5, and its CSS was dropped |

## 5. Preserved integrations and behaviour
- **Firebase:**
  - Auth REST: sign up, sign in, token refresh, expiry.
  - Realtime Database: REST writes with the method override, live streams that reconnect.
  - Database rules unchanged; database paths and record formats unchanged.
- **Same storage formats:** localStorage keys (`twodo:data`, `twodo:local`, `twodo:chat`) and the IndexedDB key store are identical. Existing phones keep their data and keys when they update, and the new service worker replaces the old one at the same URL.
- **End-to-end encryption, pairing and safety codes:** unchanged.
- **Push reminders:** unchanged. The GitHub Action and the service worker push handler are kept as they were.
- **All features from v3.6:**
  - Chat: presence, typing, ♡/♥ receipts, effects, invisible ink, reactions, swipe-to-reply, Love You, task cards, Undo Send.
  - To-dos: smart lists, natural-language parsing, swipes, long-press menus, details sheet, subtasks, repeats, .ics export, list editor, Secret lists, search, person filter, sorting, streaks.
  - Also: focus timer with live island, Tips, backup export and import, photos, themes, haptics, sounds, keyboard shortcuts, install banner, onboarding without accounts, offline use.

## 6. New dependencies (exact versions, `package-lock.json`)

| Package | Version |
|---|---|
| `next` | 16.4.6 |
| `react`, `react-dom` | 19.3.1 |
| `lucide-react` | 1.72.0 |
| `zod` | 4.6.7 |

Dev dependencies: `typescript` 5.9.3 (the latest 7.x line wasn't used because Next's TypeScript integration targets the 5.x API), `tailwindcss` and `@tailwindcss/postcss` 4.3.5, `@types/*`.

- `npm audit`: 0 vulnerabilities.
- shadcn/ui components were deliberately **not** added. Every control already exists in Twodo's own iOS-style design system, and swapping them in would change the look, which this migration must not do.

## 7. Issues found and fixed during the migration
1. **Desktop sheets stopped centring.** Next's CSS minifier (Lightning CSS) drops `translate` when it shares a rule with `transform`. Fixed by moving it into its own rule.
2. **Tailwind utilities collided with the app's own class names.** For example, Tailwind's `.grow` moved the "Completed" chevron. Fixed with the `tw:` prefix and no preflight.
3. **A lost space in chat timestamps ("Today3:35").** A separate whitespace text node is dropped inside `display: table`. Fixed by rendering the timestamp as a single text node.
4. **Sheets didn't show changes made inside them** (a new subtask, for example). Fixed: sheet and menu content now subscribes to data changes.
5. **Menus could be positioned before they were drawn.** Fixed by placing them after the first render.
6. **Strict CSP vs Next's inline scripts.** Next adds a few inline scripts, which the strict policy would block. Fixed with per-page SHA-256 hashes, so there is still no `'unsafe-inline'` and no `'unsafe-eval'` for scripts.
7. **Vibration before the first tap** made browser console errors. Fixed: vibration is skipped until the user has interacted with the page.
8. **Security hardening added along the way:**
   - Live streams ignore malformed events.
   - Partner requests and pairing targets are type-checked.
   - Names are length-capped and colours limited to the palette before use.
   - Chat ignores message keys that aren't real message ids.
   - Input lengths are capped.
   - Backup imports are size-limited and every record is sanitised.
   - Only your own photo can be changed.
   - No HTML is ever built from strings any more: zero `innerHTML` and zero `dangerouslySetInnerHTML`.
9. **One tip still listed the old reactions.** Its text is updated.

## 8. Remaining items and manual steps
- **Required before the new version goes live:**
  - Merge this branch into `main`.
  - Then set **Settings → Pages → Source: GitHub Actions** once. Until then, Pages keeps serving the old plain files from `main`.
- **Push reminders:** if you use them, put the public VAPID key in `.env.production` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`). It used to go in `config.js`.
- **Firebase console steps:** unchanged from v3.6. Republish the rules, close sign-ups, restrict the API key to `https://abilash-sh.github.io/*`, keep email enumeration protection on.
- **Not tested on a real iPhone:** the iOS keyboard choreography and home-screen behaviour. The code is ported line for line from v3.6.
- **Bigger download:** the first visit loads about 240 KB of JavaScript (gzipped), against about 100 KB before. React and the Next runtime are the cost of the framework. After the first visit, the service worker serves everything from the phone.
- **Icon outlines differ slightly:** Lucide replaced the hand-drawn SF-style icons.

## 9. Build and test results
- **Type-check and build:**
  - `tsc --noEmit` (strict): 0 errors.
  - `next build`: succeeds. `postbuild`: CSP on 4 pages, service worker caches 23 files.
  - A clean CI-style install (`npm ci --ignore-scripts`) then type-check and build: passes.
- **End-to-end tests:** Playwright in Chrome against the local Firebase mock, driven through the UI the way a person would use it, with two accounts (Abilash and Deiva). No JavaScript errors and no CSP violations in any run. Covered:
  - sign-up, username, pairing by @username with the safety code
  - online/typing, sending (the keyboard stays open), seen hearts, swipe-to-reply, reactions synced, Love You
  - composer chips and pills, swipe to complete with Undo, cancel-by-tap, long-press menu and Move to List
  - details sheet (priority, subtasks), new list, search, edge swipe-back, settings (theme), photo viewer
  - desktop shortcuts (Esc, ⌘K, N), right-click menu, focus timer with the live island, sign out, wrong password, sign back in
  - the no-accounts onboarding
  - service worker install and offline reload with offline task creation
  - landscape phone, iPad and iPad landscape
- **Visual parity:** the original and migrated apps were given the same data at 390×844 and 1280×800. Chat, To-dos, Today and the task sheet each differ in 210–609 pixels, all of them icon glyphs.

## 10. Running and deploying
```sh
npm ci && npm run dev                      # develop (http://localhost:3000)
npm run typecheck && npm run build         # static site in out/
npm run preview                            # serve out/ locally
sh scripts/build-test.sh                   # test build against the local Firebase mock (127.0.0.1:9000)
```
To deploy, push to `main`. `.github/workflows/pages.yml` type-checks, builds and publishes. It needs the one-time switch of the Pages source to "GitHub Actions" described in section 8.
