# Start here: where Twodo stands and how to continue

For the next agent (Claude, Codex or anyone) picking this up, possibly mid-task. Read this first, then
`AGENTS.md`. **Update this file at the end of every working session** so the next one can continue.

Last updated: 2026-11-18.

## The project in short

- Twodo is a private to-do list, chat and journal for two people: the owner (Abilash) and his partner. In tests and
  examples the partner is "Deiva"; never use the name "Priya".
- The owner works from his phone. He reads PRs on GitHub, merges them himself and tries them on his iPhone. He wants
  visible results, short replies, and questions as options with their benefits.
- There are two apps:
  - **The web app (live).** Next.js 16 static export on GitHub Pages, with end-to-end encrypted sync on Firebase.
    Code in `src/`, rules in `AGENTS.md`, tests in `tests/`.
  - **The iPhone app (being built).** React Native with Expo in `mobile/`, moving the data to Supabase. The plan is
    `docs/architecture.md`; the rules are `mobile/AGENTS.md`. It replaces the web app at the end (phase 6).
- Every prompt the owner has given is in `docs/prompts.md`, kept as history.

## State on 2026-11-18

**Merged:** the web app through #20 (two-hearts launch, Home with both characters, the journal on love threads); the
architecture doc (#21); phase 1 of the iPhone app: design system, characters, launch, Playground, CI and TestFlight
workflow (#22).

**This session, as PRs to `main`, merged in this order** (each later branch includes the earlier ones):

1. #23 `docs/handoff`: this file and `docs/prompts.md` (the old `PROMPT.md` moved there).
2. #24 `feat/app-avatars`: two original human characters, male and female, in a soft 3D style, replacing the six
   blob characters in the iPhone app.
3. #25 `feat/app-home-journal`: a new Home like the owner's reference (greeting, a fanned stack of cards, a floating
   tab bar) and the journal as one page per person per day, written only on the day, with earlier days chosen
   from a week strip or a calendar. Four tabs: Home, To-dos and Chat (placeholders), Journal.

All three are open and waiting for the owner to merge. If one was closed instead, ask before rebuilding it.

**Sample data to replace in phases 2 and 3** (nothing in the app is stored or sent yet):
- `mobile/src/features/people.ts`: the two of you (`SAMPLE_PEOPLE`, names "Abilash" and "Deiva"), kept in memory so
  the Playground's look changes show on Home and in the Journal.
- `mobile/src/features/home/Home.tsx`: `SAMPLE_TODOS`, the to-do counts on Home's cards.
- `mobile/src/features/journal/journalStore.ts`: pages in memory, seeded with a few sample days. Its rules (only
  today, read-only past, hearts on your partner's page) are tested in `src/features/__tests__/journal.test.ts`; keep
  them when the store moves to SQLite and sync.

**Waiting on the owner:**
- The one-time setup for the first TestFlight build (`mobile/README.md`, "First build"). When he sends the Expo
  project ID (not a secret), add it to `mobile/app.json` as `extra.eas.projectId` (and `owner`).
- **The app's CI audit step is red** on #24 and #25 since 2026-11-18. `npm audit --omit=dev --audit-level=high` now
  fails on a new picomatch advisory (GHSA-fc5q-39xc-vjpf, every version up to 4.0.7, and no fixed version is
  published yet). picomatch comes with Expo's, Metro's and Jest's build tools. The bundle's source maps show it is
  not in the code that ships to phones. Types, unit tests and the iOS bundle pass. Changing the security check is
  the owner's call: either wait for a fixed picomatch (then pin it with `overrides`), or audit only the packages
  inside the bundle. Don't change `.github/workflows/app.yml` without his yes.

## What to do next, in order

1. **After the three PRs merge:** check the TestFlight build on the owner's phone against each PR's iPhone checklist
   and fix what he reports (Home's swipe inside the scroll, the keyboard over the journal's writing box, the calendar
   sheet).
2. **Phase 1, the rest:** the Supabase schema with Row Level Security and its tests (`docs/architecture.md`,
   section 2): tables, policies, `create_space` and `join_space`, Realtime Broadcast policies, the photos bucket.
   Tests run against a local Supabase in GitHub Actions (`supabase start` needs Docker; this workspace has none).
3. **Phase 2, data:** move pure logic to `shared/`; port the encryption with test vectors that match the web app
   byte for byte; the SQLite store, sync and Realtime; sign-up and sign-in; pairing; the join token. Save the
   avatar choices and the journal's day pages (see "Data decisions" below). Before the first build with
   encryption, answer Apple's export-compliance question again (`mobile/app.json` says none today; a test checks).
4. **Phase 3, screens:** To-dos and Today, the week, chat, Settings, the secret-list vault (Home and Journal exist
   from this session as designs with sample data; connect them).
5. **Phases 4 to 6:** integrations (reminders, notifications, photos, widget), the move from Firebase, retiring the
   web app. Open decisions are in `docs/architecture.md`, section 11.

## Data decisions from this session (written down before building, as rule 13 asks)

- **Characters:** each person has an avatar: a look (`male` or `female`), a skin tone and a hair colour; the outfit
  is their own colour. Stored with the person, like name and colour. The web app's six characters (`char`) map to
  a default avatar during the move.
- **Journal:** one page per person per day. You can write only today's page; earlier days are read-only and chosen
  from a day strip or a calendar; future days can't be chosen. Stored as `journal` records with ids
  `us-<date>-<who>` (the format the web app used before the thread). Posts from the web app's thread (`us-p…`) show
  under the day they were written, read-only. Hearts stay: one per person per page.

## How to work here

- **Branches and PRs:** branch from `main`; never push to `main`. Open PRs with
  `gh api repos/Abilash-SH/twodo/pulls --method POST --input body.json` (`gh pr create` fails here). Always target
  `main`. When PRs depend on each other, base each branch on the previous one and say the merge order. A PR's text
  covers: why, what it does, what was tested and what wasn't, security and data checks, and an iPhone checklist.
- **Commits:** as `Abilash-SH <Abilash-SH@users.noreply.github.com>`, with the attribution lines your environment
  asks for.
- **Never:** secrets in the repo, in `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` values, in config or in a chat (the web
  push private key, Apple `.p8` keys, Supabase secret keys); the owner's email anywhere; force-pushes; anything
  from a secret list outside its own list.
- **One website:** the owner once mentioned a website for an idea. Its name and anything from it stay out of the
  code and the docs.
- **Security:** check every change for security problems and say what you checked in the PR (a standing request).

## Checks and tools

- **Web app:** `npm ci --ignore-scripts && npm run typecheck && npm run build`. The browser tests in `tests/e2e/`
  use a fake Firebase (`tests/README.md`); run test 1 first.
- **iPhone app:** `cd mobile && npm ci && npm run typecheck && npm test && npm run bundle:ios`.
  - To see screens without a Mac: `npm run preview:web`, serve `.web-preview/` with a fallback to `index.html`, and
    screenshot it with Playwright and Chrome at 390 x 844 in light and dark.
  - CI (`.github/workflows/app.yml`) runs the same checks on every PR that touches `mobile/`.
- **Known snags:**
  - `npx expo install` can't reach Expo's servers here. Install the exact version listed in
    `mobile/node_modules/expo/bundledNativeModules.json`.
  - `csstype` is pinned to 3.2.3 (`overrides`) because 3.2.4 was too new to download.
  - Reanimated's own Jest mock fails under the iOS preset, so `mobile/jest/reanimated.js` stands in. Gesture
    Handler v3 asks it for `isSharedValue`, `useEvent`, `useHandler`, `useComposedEventHandler` and
    `NativeEventsManager`, so those are stubbed there too; Worklets uses its own mock (`jest.setup.js`).
  - In a card you can both swipe and tap, use a tap gesture that races the pan (`useCompetingGestures`), not a
    `Pressable`: on the web a `Pressable` still fires after a swipe. VoiceOver opens the card through
    `onAccessibilityTap`.
  - Screens use `useToday()` (`features/dates.ts`) for the date: it changes at midnight. Tests set the clock with
    `jest.useFakeTimers({ now })`.
  - The splash plugin needs an image to use its colours (`assets/splash-blank.png`).
  - `expo prebuild` is only for checks: never commit `ios/` or `android/`.
