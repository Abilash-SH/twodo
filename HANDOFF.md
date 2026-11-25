# Start here: where Twodo stands and how to continue

For the next agent (Claude, Codex or anyone) picking this up, possibly mid-task. Read this first, then
`AGENTS.md`. **Update this file at the end of every working session** so the next one can continue.

Last updated: 2026-11-25.

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

## State on 2026-11-25

`main` is at `8c4f10a`. **Merged since 2026-11-18:** #31 (containment and the error page), #32 (the web journal by
day), #33 (the crash on reopening the chat), #34 (journal: a plain box and Post), #35 (Home: one Today card), #36
(reactions that burst live, never in the chat) and #37 (realistic 3D people from Microsoft Rocketbox).

**Open:**
- #38 `fix/home-my-tasks` (Claude): Home and Today show only your to-dos and the shared ones. Waiting for the owner.
- `feat/moments` (Claude, 2026-11-25): Moments in place of Home's reactions (see "2026-11-25 Moments" at the end).
  It touches `BoardView.tsx` and test 13 next to #38; whichever merges second needs a small rebase.
- #28 (Codex, work in progress): the Supabase encrypted-data schema and membership RLS. Reviewed (a comment on the PR:
  `public.digest` breaks joining on Supabase, default grants, movable rows, a join token that never expires, …).

**Known broken on `main`:** browser test 6's *short angled reply flick* (in the chat) fails since #37: it passes at
`a705c8f` (before the 3D people) and fails at `8c4f10a`, with the same result with or without Moments. Likely the 3D
people still drawing behind the chat (software WebGL in the test). To fix in the next 3D work: stop drawing them
while Home is covered.

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

1. **The 3D people, the owner's latest ask (2026-11-25):** "realistic 3D where it turns 360 degree… Don't stand on
   the card, I want them to have some animations, movements like that", made **from the two of you, from selfies**
   (each makes a realistic avatar in Avaturn, free, and imports the file in Settings; it stays on your phones, never
   in the public repo). Fix test 6 there too (above).
2. **#38 and Moments:** the owner checks them on his iPhone (their PR checklists). The crash on reopening the chat
   (#33) and the journal by day (#32) are merged; if the *Twodo stopped for a moment* page ever appears again, its
   code line names the error.
3. **#28** (Supabase schema and RLS): Codex, or whoever continues it, works through the review comment, then the
   adversarial RLS tests, and checks it against `docs/architecture.md`, section 2, before it is merged.
4. **The iPhone app:** check the TestFlight build against the PR checklists of #24 and #25 and fix what the owner
   reports (Home's swipe inside the scroll, the keyboard over the journal's writing box, the calendar sheet).
5. **Phase 2, data:** move pure logic to `shared/`; port the encryption with test vectors that match the web app
   byte for byte; the SQLite store, sync and Realtime; sign-up and sign-in; pairing; the join token. Save the
   avatar choices and the journal's day pages (see "Data decisions" below). Before the first build with
   encryption, answer Apple's export-compliance question again (`mobile/app.json` says none today; a test checks).
6. **Phase 3, screens:** To-dos and Today, the week, chat, Settings, the secret-list vault (Home and Journal exist
   as designs with sample data; connect them).
7. **Phases 4 to 6:** integrations (reminders, notifications, photos, widget), the move from Firebase, retiring the
   web app. Open decisions are in `docs/architecture.md`, section 11.

## Data decisions from this session (written down before building, as rule 13 asks)

- **Characters:** each person has an avatar: a look (`male` or `female`), a skin tone and a hair colour; the outfit
  is their own colour. Stored with the person, like name and colour. The web app's six characters (`char`) map to
  a default avatar during the move.
- **Journal:** one page per person per day. You can write only today's page; earlier days are read-only and chosen
  from a day strip or a calendar; future days can't be chosen. The iPhone app stores day pages (`us-<date>-<who>`,
  the format the web app used before the thread). The web app keeps the thread's posts (`us-p…`) by their day: your
  newest post from today is today's page (decided 2026-11-18; why in `docs/journal-and-planner.md`). When the data
  moves, each person's newest post of a day becomes that day's page. Hearts stay.

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
  use a fake Firebase (`tests/README.md`); run test 1 first. Safari's engine: `tests/webkit/` (WebKitGTK from
  Ubuntu's packages, because Playwright's WebKit download is blocked here).
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

## 2026-11-18 web journal follow-up

- User explicitly requested the date-wise journal on the **web app too**. Work started on `feat/web-journal-by-day`: week strip, native date input for older days, two pages, today's own editable page, earlier dates read-only. Existing `us-p…` post records remain encrypted and visible by date; the newest existing post of today acts as the editable page. No migration or storage key change.
- User reported an iPhone black error page, “This page couldn’t load,” on one tap of the **top-right Home button**. The top-right partner chip invokes `toPartner` (chat when paired, invitation otherwise). Reproduction and root-cause identification are pending. Treat as a separate defect/PR; do not assert it is fixed.
- Web journal implementation has **not** passed typecheck, build or browser/iPhone tests yet. Do not merge without these and regression coverage. The original feed-specific journal tests may need updating.

## 2026-11-18 Safari and installed-app Chat crash

- User confirmed tapping the top-right partner picture crashes **both** Safari and the installed Home Screen web app
  (Next's black *This page couldn't load*). Do not assume a service-worker-only issue.
- The chip, the partner's character on Home and the bar's chat button all call the same `toPartner` (the chat when
  paired, the invitation otherwise). Not reproduced in Chrome with an iPhone screen, touch, no vibration, Home
  Screen mode and unread messages; WebKit can't be downloaded in this workspace, so Safari itself wasn't tried.
- #30 (merged) put the chat in an error boundary. Its note always drew as an open screen, so after Back it stayed
  over Home and took every tap.
- #31 (open): the chat's note now slides and parks with the chat and tries again when the
  chat opens; Home's top and Home's content each have their own boundary (`ui/AreaBoundary.tsx`), so the bar keeps
  working; `app/global-error.tsx` replaces the framework's blank page with *Twodo stopped for a moment*, a Reload
  button and one line safe to screenshot (`lib/errors.ts` `errorSummary`: the error's type and a short message with
  anything quoted removed; never a stack or a component stack, and nothing is sent anywhere). Test 13 breaks date formatting on
  purpose to check all of it. **This is containment and diagnosis, not the fix:** the cause is still unknown.
- Also not reproduced in WebKit itself: `tests/webkit/test_home_webkit.py` (WebKitGTK 2.52 from Ubuntu's packages)
  signs in like a new iPhone (touch, dark mode, unread messages tried too) and taps every door on Home: nothing fails
  with the test data. So the cause likely needs the owner's real data or iOS itself; the code line on his screen is
  the next clue.
- **Cause found (2026-11-18), from the owner's screenshot of the new error page:** `undefined is not an object
  (evaluating 't.color')`. Mapped with a source-mapped build to `TaskListView` (`SMART[spec.key].color`). Tapping your
  partner again within half a second of closing the chat (while it still slides away) pushed a second chat entry;
  NavStack only drew the first as the chat, so the new one fell through to the list page with no key. Fix
  (`fix/chat-reopen-crash`): pushing the chat first removes a chat that is still leaving; NavStack never draws a chat
  entry as a page; an unknown list page shows "Nothing here" instead of failing. Test 13 checks it (it fails without
  the fix).

## 2026-11-18 Home reactions (data decision, rule 13)

- Asked for: reactions on Home that are "not sent in the chat, something reactive".
- No new path, key or rule: a reaction rides on your live presence record (`/spaces/{space}/c/e/x/{uid}`, the one
  that already carries typing, read and online), as `poke: { e, at }` inside the same AES-GCM ciphertext. The
  receiving app plays each `at` once, only within a minute (`POKE_MS`), and only for the six known emoji
  (`isReaction`). It is never stored or shown in the chat. Older app versions ignore the extra field.
- Limit: a reaction reaches your partner only if their app is open (or opens within a minute). No push for it.
- Realistic 3D characters (option A): built in `feat/realistic-3d-people` from Microsoft Rocketbox (MIT). See
  `docs/characters.md`, "The 3D people". The iPhone app (`mobile/`) still has the drawn characters.

## 2026-11-25 Moments (data decision, rule 13)

- Asked for, in place of Home's reactions ("the reactions is not great"): "something like Instagram's Instants or
  Locket to share images at one tap". The full decision is `docs/moments.md`; in short:
- **Server:** only the latest moment of each of you, as one more record in the encrypted records: `r/o:a` and
  `r/o:b` (kind `moment`: a JPEG data URL of at most 140,000 characters, a caption of 80, `at`). A new one replaces
  the last. Removing writes a `deleted` marker with the same `at`. The worst case is 144,008 characters encrypted,
  under the 200,000 the rules allow, so **no Firebase rules change**. Older app versions ignore the record.
- **Phone:** a new IndexedDB, `twodo-moments`, keeps the newest 60 moments the phone has seen (read back through
  `cleanRecord`). Not in `twodo:data`. Cleared on unpair, another account, and erase. No existing store changes.
- **Notification:** one more kind of encrypted push entry, `rem/{space}/moment_<uid>`, sent by the reminders job
  ("📸 Abilash · Shared a moment"; nothing about the photo). Tapping it opens the moments sheet.
- **Privacy:** the photo is re-drawn and saved as a new JPEG (long side 960 px or less), so location and camera
  details never leave the phone.
- **Reactions:** nothing sends one any more; receiving stays for a partner still on an older version.
