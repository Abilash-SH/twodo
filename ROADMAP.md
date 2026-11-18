# Twodo roadmap

Twodo should feel like a small shared place for two people: personal, expressive and playful, and dependable every
day. This file is the plan and its state. Update it in the PR that changes the state of an item.

**Status:** ✅ done · 🔎 waiting for review · 🚧 in progress · ⏭ next · ⏸ blocked · 📋 planned

Rules for every item: follow `AGENTS.md` and `design.md`, one topic per PR, a regression test for every fixed defect,
and a PR text that gives the problem and its cause, the new behaviour, what was tested and what was not, the security
and data checks, and a short iPhone checklist.

## Phases

| Phase | What | Status |
| --- | --- | --- |
| 1 | Reproduce remaining defects, add regression coverage | ✅ PRs #4, #5, #6 |
| 2 | Home-screen concepts and the visual specification | ✅ #7 (`design.md`, `docs/home-concepts.md`); Pinboard chosen |
| 3 | Build the chosen home and navigation | 🔎 this PR: the board is Home, the chat is a screen above it |
| 4 | Chat and task interaction improvements | ⏭ |
| 5 | Prototype and validate the 3D companions | 📋 |
| 6 | Motion, celebrations, adaptive layouts | 📋 |
| 7 | Update safety and the release workflow | 🚧 update safety ✅ #6; workflow proposal 📋 |

## Items

### 1. Foundation, and native packaging later — 📋 Phase 7
- **Keep** Next.js, React and TypeScript for the PWA. New dependencies only for a demonstrated need.
- **Deliver:** `docs/capacitor-assessment.md`: benefits, limits, and what packaging would mean for sign-in, local
  storage, notifications and the vault. An assessment only; nothing is packaged or migrated.
- **Done when:** the document exists and names what must be true of the PWA first.
- **Decided 2026-11-17:** the app is rebuilt in React Native with Expo instead of packaging the PWA, so no
  Capacitor assessment is needed. See item 17 and `docs/architecture.md`.

### 2. A new personal home screen — ✅ Phase 2 (#7) · ✅ Phase 3 (#9, Pinboard) · 🔎 character Home (this PR)
- **Deliver:** three distinct concepts with phone mockups in empty, busy and offline states, the navigation model,
  advantages and tradeoffs of each, and a recommendation: `docs/home-concepts.md` and `docs/home-concepts/`.
- **Done when (Phase 2):** a concept is chosen, or a fourth direction is asked for.
- **Done when (Phase 3):** the chosen home is built; opening the chat and adding a to-do are each one obvious tap;
  nothing from a secret list appears on it; back, swipes and Back presses pass test 9; empty, busy and offline states
  match the mockups.
- **Files:** `src/ui/nav.ts` (the `chat` screen, `boardHome`, `boardAdd`, `navTo`), `src/components/nav/NavStack.tsx`
  (the board at the bottom, the chat mounted right above it), `src/components/home/BoardView.tsx`,
  `src/styles/36-board.css`, `src/components/chat/` (back button, edge strip), `tests/e2e/` (every test now starts on
  the board; `test_13_board_home.py` is new).
- **State:** built. Measured in headless Chrome at 4× CPU slowdown, not on an iPhone: see the PR. Still to confirm on
  a phone: the keyboard with *Add a to-do*, the edge swipe out of the chat next to iOS's own, and the feel of the tilt.

- **Character Home (2026-11-15):** the Pinboard looked too plain, a decorated cork board was not wanted; asked for
  instead: "a home screen where a character has a role play model to select". Concepts drawn (pick screen, A little
  room, B your character tells you); **B chosen and built**: `docs/characters.md`. Test 13 rewritten.

### 3. The visual system — 🔎 Phase 2
- **Deliver:** `design.md`: colour roles (both people), type, spacing, shapes, surfaces, components, characters,
  motion, accessibility, a "never" list, a consistency checklist and the known gaps.
- **Done when:** merged, and referenced from `AGENTS.md`.

### 4. Original 3D companions in the chat header — 📋 Phase 5 (2D characters now live on Home: item 2)
- **Deliver:** a character brief (silhouettes, personalities, colours, a small set of reactions, how they sit beside
  the names), then a prototype with three.js and react-three-fiber in versions that work with this repository, loaded
  separately from the chat controls.
- **Done when:** names, status and navigation render at once without waiting for 3D; rendering is on demand and
  pauses while scrolling, swiping, the keyboard moves or the app is hidden; there is a static fallback for Reduce
  Motion, missing WebGL and failures; GPU resources are released; the scene takes no taps; and a report compares
  loading, memory and rendering cost with the static header. A slow or failed renderer never blanks the header.
- **Decision still open:** whether the measured cost is worth it. If not, the companions ship as static drawings.

### 5. Navigation and gesture ownership — ✅ Phase 1 (#3, #4)
- One completed gesture causes exactly one action; every Back press counts; `docs/gesture-ownership.md` names the
  owner of every gesture.
- **Tests:** 7 and 9.
- **Not verified:** the timing of iOS's own back gesture in the installed app.

### 6. Animation: playful and consistently smooth — 📋 Phase 6
- **Deliver:** a profile before any timing change, then one motion language for related actions.
- **Done when:** touch-down responds within a frame; no layout jumps in transitions; releases continue from the
  finger; unrelated state changes never replay a list; entrance budgets hold; gesture movement causes no React
  renders; Reduce Motion is complete; and frame measurements say which device they came from.
- **Already done:** transform/opacity only, blur allowlist, 1:1 swipes, entrance budget of six (#1–#3).
- **Also in this phase (needs a yes, it changes the look slightly):** the contrast gaps measured in `design.md`
  section 13: secondary text in the light theme (3.4:1) and white labels on filled buttons (2.1–3.4:1).

### 7. Chat — A ✅ #5 · B–F ⏭ Phase 4
- **A. Unread position** ✅: read means "was on screen"; a "New messages" line; opening the chat starts at the first
  unread message; the pill counts and goes there. Test 10.
- **B. History stability** ⏭: keep your place while older messages load, new ones arrive, the keyboard opens and the
  reply bar shows.
- **C. Grouping** ⏭: day separators, timestamps, grouping and spacing.
- **D. Delivery feedback** ⏭: sending, delivered, seen, disconnected and retry are understandable without clutter.
- **E. Bubble identity** ⏭: the blush, heart tails, delivered and seen hearts and the send heart, at 4.5:1 for every
  colour pair and theme.
- **F. Reply navigation** ✅ #8: quoted messages are easy to find, with a clear way back after jumping to the original.
- **Always:** sending a message, a heart or a reply, and cancelling a reply, keep the keyboard focus.
- **Out of scope (backlog):** attachments, calls, a new backend.

### 8. Discoverable task actions — ⏭ Phase 4
- **Done when:** completing, editing, pinning and deleting are each reachable by a visible control; destructive
  actions say what they did and offer Undo; tap, swipe, long-press and assistive access are tested; nothing is
  completed or deleted by a navigation swipe.

### 9. Optional completion celebrations — 📋 Phase 6
- **Done when:** small, occasional, under 1.5 s, never over content or the next tap, off with Reduce Motion, easy to
  turn off. No streaks, rankings or pressure.

### 10. Phone, tablet and desktop — 📋 Phase 6
- **Done when:** each size has an intentional layout (see `design.md` section 8), tested on small and large phones,
  portrait and landscape, tablets and desktop, with safe areas respected and overlays inside the visible viewport
  while the keyboard is open.

### 11. Safe app updates — ✅ Phase 1 (#6)
- A new version waits; "Update ready" appears in a quiet moment; Update saves first and brings back what was being
  typed and the open screen; secret lists stay encrypted and locked. Test 11.
- **Not verified:** how a suspended iPhone Home Screen app picks up the waiting version.

### 12. Development and release workflow — 📋 Phase 7
- **Deliver:** an audit of what is fragile in testing, deployment and production updates, and the smallest practical
  staging or preview proposal: configuration, separate test accounts and backend isolation, sign-in and domain
  implications, how to open a preview on an iPhone, and how production stays untouched.
- **Not part of it:** changing the hosting provider or the production backend configuration.

### 13. Security and data — always
- Encryption, storage keys, sync formats, the CSP and secret-list privacy do not change without a separate, written
  proposal first. Six-digit and longer passcodes, Face ID and auto-lock keep working.
- Secret information stays out of the home screen, character reactions, notifications, analytics, shared views and
  exports.

### 14. Weekly planner — 🔎 #10
- **Asked for 2026-11-15:** a weekly planner, designed after looking at the best of what exists (paper-style weekly
  planners, timeline planners, weekly planning and review rituals) and made for two.
- **Built:** To-dos → *This week*. Up to three shared goals for the week; a sticky ribbon of seven days whose bars show
  how full each day is and for whom; the days with their to-dos; *Not planned yet*; to-dos left open from before;
  from Friday, a look back (no streaks, no scores). Hold a to-do to plan it for a day. Wide screens: seven columns.
- **Data:** goals are a new record kind; planning only changes a to-do's date. `docs/journal-and-planner.md`.
- **Done when:** test 14 passes; checked on an iPhone (the ribbon while scrolling, *Add to …* with the keyboard).

### 15. Journal — ✅ #11 (pages) · ✅ thread (#19, #20) · 🔎 the app: one page each per day (#25)
- **Asked for 2026-11-15**, with the planner: a journal for the two of you (first with a private one each).
- **Changed the same day:** "a continuous thread with just posting … keep it raw", no private posts.
- **Built:** To-dos → *Journal* (or the note on the board): a box to write in, *Post*, then the posts, newest first,
  grouped by day. Your own posts: ⋯ → Edit or Delete. No prompts, weather, tabs, counts or private posts.
- **Data:** posts are `journal` records with their own ids; older day pages show as posts.
  `docs/journal-and-planner.md`, "The journal as a thread".
- **Done when:** test 15 passes; checked on an iPhone (writing a long post with the keyboard up, posting, the
  partner's phone).
- **Changed 2026-11-18, in the app:** "I dont need it like a threads … only for the same day i need it to enter and
  for seeing previous days i need to select days". The app's journal is one page each per day: only today's can be
  written; a week strip and a calendar open earlier days, read-only. The web app keeps its thread until the move.

### 16. Data and rendering performance — 🔎 this PR
- **Request:** audit repeated queries, index coverage, stable-data caches, below-fold photos and optimistic UI.
- **Built:** per-connection encrypted record snapshots remove per-field GETs and handle atomic multi-path
  patches; typing reuses reaction state; decrypt caching is bounded and scoped to the chat session; lazy
  avatar photos with eager headers/viewer; optimistic message writes serialize by message and reject stale echoes.
- **Index decision:** the only ordered server query uses Firebase's automatically indexed `$key`.
  Search/sort of encrypted fields is local. No unused indexes, plaintext metadata or schema changes added.
- **Acceptance:** zero extra record GETs for nested notifications, partner convergence for atomic patches,
  task/message UI before acknowledgement, no late send resurrecting removed text, stable photo geometry,
  no private API responses cached. Required checks and the complete browser suite before the PR.
- **Files/evidence/iPhone checks:** `docs/performance-audit.md`, `src/lib/recordStream.ts`, `live.ts`, `sync.ts`,
  `chat.ts`, `Avatar.tsx`, `40-lazy-photos.css`, `tests/performance.cjs`, `tests/e2e/test_16_data_performance.py`.

### 17. The React Native app (Expo + Supabase) — ✅ architecture doc (#21) · ✅ phase 1 foundation (#22) · 🔎 characters (#24), Home and journal (#25)
- **Request (2026-11-17):** framework React Native, database Supabase, sign-in with no preference, photos in the
  journal and chat, a Home Screen widget, and a playful, character-first design that stays stable.
- **Deliver:** `docs/architecture.md`: the decisions, the schema with Row Level Security, the join token, sign-in, the
  integrations, the design system, the security rules, the move from Firebase, tests, costs, phases and open decisions.
- **Done when:** the doc is merged (that approves it) and the open decisions in its section 11 are answered or accepted
  as recommended. Then phase 1 (foundations) becomes ⏭.
- **Phase 1 (#22):** `mobile/`, the design system (tokens, theme, text, components), the characters with eight
  moods, the launch, the Playground, checks on every PR (`.github/workflows/app.yml`) and builds to TestFlight
  (`mobile/.eas/workflows/testflight.yml`). Next in phase 1: the Supabase schema with Row Level Security and its tests (initial migration drafted on `feat/supabase-rls-foundation`; not tested or complete).
- **2026-11-18:** two original characters, female and male (#24); Home and the journal by day as designs with sample
  data (this PR), with four tabs and a floating tab bar.
- **Needed before builds reach the phones:** the Apple Developer Program, an Expo account and a Supabase project (both
  free), each with 2FA, and the partner added as a TestFlight tester.

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-11-12 | Browser history has one owner (`src/ui/nav.ts`) and one "trap" entry | Two owners made one swipe go back twice |
| 2026-11-12 | Full-screen layers are never sized with viewport units | On iOS 26.1+ Home Screen apps those units are taller than the screen (WebKit 301994) and cut the message bar |
| 2026-11-12 | The echo guard belongs only to our own edge swipe and swallows one `popstate` | A time window after every navigation swallowed real Back presses |
| 2026-11-12 | A message is read when it has been on screen; the read mark stays one timestamp | Reading older history marked new messages as seen; no sync-format change was needed |
| 2026-11-12 | A new version waits; it is applied on "Update" or the next start from closed | The old worker reloaded the app under someone typing |
| 2026-11-12 | Each version's cache is complete and never modified afterwards | Refreshing files in place could mix two versions and break offline start |
| 2026-11-12 | Unsent text survives an update in `sessionStorage` (`twodo:resume`), never text from a secret list | Secret-list content may only ever be stored encrypted |
| 2026-11-12 | PRs are independent and one topic each; they are merged together locally and the whole suite run before opening | Merging happens from a phone, where conflicts are hard to resolve |
| 2026-11-13 | The home screen is not decided: three concepts are prototyped first | Changing Home changes the navigation model, which is expensive to redo |
| 2026-11-13 | No native packaging in this roadmap; Capacitor is assessed after the PWA work | Packaging would not fix web rendering or gesture problems |
| 2026-11-13 | Home is the Pinboard; without accounts Home stays To-dos | Chosen after review of the three concepts. The board needs a partner and shared data to say anything |
| 2026-11-13 | The board stores nothing: every note is computed from tasks, lists and messages already on the phone | No schema, storage or sync change; nothing new to keep private |
| 2026-11-13 | The chat is a screen that only sits directly above the board, and stays mounted while closed | Back from the chat always leads to the board; drawing a long conversation inside the tap cost 217 ms at 4× CPU |
| 2026-11-13 | A to-do added from the board is due today | It then appears on the board's Today note straight away, where it was added |
| 2026-11-13 | In the chat the left 32 px belong to Back; a swipe on a message is only ever a reply | The chat is no longer Home, so it needs a way back that never fights the reply swipe |
| 2026-11-15 | The planner plans existing to-dos by date; only the week's goals are new records | No time-blocking: to-dos have no durations, and a calendar of hours is not what was asked for |
| 2026-11-15 | A busy day is six open to-dos or more; the look back shows what was done, never a score | Overcommitment is worth a gentle mark; comparison and streaks add pressure (roadmap item 9) |
| 2026-11-15 | A journal page has one record per person: only its writer edits it | Two people never edit the same record at once, so last-write-wins never loses words |
| 2026-11-15 | No app name on screen; the launch is two hearts in your colours with "Two souls, one space." | Asked for; the name under the Home Screen icon still comes from the page title and can be renamed when adding it |
| 2026-11-16 | The journal is compact: rows instead of cards, each post on a love thread to the next | "Journal looks huge"; asked for posts that connect with love threads |
| 2026-11-15 | The journal looks like a modern feed: cards with the writer's character, big short posts, a heart | Asked for "more modern than Twitter, X, Threads"; a heart is its own record so it never collides with an edit |
| 2026-11-15 | Home shows the two of you as characters and only Today below; no message card, no extra tiles | The cards and tiles felt scattered and repeated To-dos; a message's text belongs in the chat |
| 2026-11-15 | Home is led by a character you pick, with a role that sets its voice (concept B) | Chosen over a decorated board and a scene; it keeps every door and the two buttons |
| 2026-11-15 | What the character says is fixed sentences per role, written from data on the phone | No AI and nothing sent; it can never say anything from a secret list or quote a message |
| 2026-11-15 | Character and role are two optional fields on each person in the people record | Synced like name and colour; older versions keep unknown fields; no new record or key |
| 2026-11-15 | The journal is one shared thread of posts, newest first; no prompts, weather or private posts | Asked for "raw": just posting. Newest first keeps the box at the top, clear of the keyboard |
| 2026-11-15 | Posts keep the `journal` record kind with their own ids | No new kind, key or sync change; older versions ignore posts until they update |
| 2026-11-15 | The writing field grows in CSS (a hidden copy of the text sizes it), never by measuring | Measuring its height inside the tap cost 44 ms at 4× CPU |
| 2026-11-15 | A screen that opens draws its top inside the tap and the rest just after | Opening the week cost a 200 ms frame at 4× CPU; the slide runs on the compositor while the rest is drawn |
| 2026-11-17 | Rebuild as a React Native app (Expo) on Supabase, still end-to-end encrypted, with a playful, character-first design | Chosen for a real iPhone app with photos and a Home Screen widget; `docs/architecture.md` keeps today's encryption and secret-list rules |
| 2026-11-17 | Open decisions accepted as recommended to start phase 1: "Twodo" under the icon, no over-the-air updates, iPhone only | "Go ahead"; each can still change, and none is hard to undo before the move |
| 2026-11-17 | The app's colours and type come only from `mobile/src/ui/tokens.ts`; the rounded face is the iPhone's own (`ui-rounded`) | One source keeps every screen consistent (a test enforces it); the system face needs nothing bundled |
| 2026-11-18 | Two original human characters, female and male, in a soft 3D style replace the six blob characters in the app | Asked for, from a 3D avatar reference; drawn in parts so moods still move, and the same API could take rendered images later |
| 2026-11-18 | The app's Home is a fanned stack of cards (Today, your partner, the journal, the week) under a big hello, with a floating pill tab bar | Asked for from the reference's home screen; one card at a time keeps it uncluttered, and a card shows counts, never a message's text |
| 2026-11-18 | The journal is one page each per day: only today's can be written, earlier days are read from a week strip or a calendar | Asked for instead of threads; one record per person per day keeps "only its writer edits it" (`docs/architecture.md`, section 7) |
| 2026-11-18 | The web app gets the iPhone app's two characters too, stored as `avatar` (look, skin, hair) on each person; `char` is still read, no longer drawn | Asked to have the new Home and journal in the web app as well; both are built around these characters. One optional field, kept by older versions |
| 2026-11-18 | The web app's Home becomes the iPhone app's: a hello, a fanned stack of cards, the two of you, and a floating bar with Add a to-do beside it; ticking moves to Today | Asked for the reference's Home in the web app too; one card at a time keeps it calm, and Today is one tap away |

## How to pick up work

1. Read `AGENTS.md`, `design.md` and this file.
2. Take the first ⏭ item. If it needs a schema, storage or security change, write that proposal first.
3. Reproduce, add a failing test, fix, run the checks in `AGENTS.md`, open one PR, and update this file in it.
