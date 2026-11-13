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

### 2. A new personal home screen — ✅ Phase 2 (#7, Pinboard chosen) · 🔎 Phase 3 (this PR)
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

### 3. The visual system — 🔎 Phase 2
- **Deliver:** `design.md`: colour roles (both people), type, spacing, shapes, surfaces, components, characters,
  motion, accessibility, a "never" list, a consistency checklist and the known gaps.
- **Done when:** merged, and referenced from `AGENTS.md`.

### 4. Original 3D companions in the chat header — 📋 Phase 5
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
  section 12: secondary text in the light theme (3.4:1) and white labels on filled buttons (2.1–3.4:1).

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

## How to pick up work

1. Read `AGENTS.md`, `design.md` and this file.
2. Take the first ⏭ item. If it needs a schema, storage or security change, write that proposal first.
3. Reproduce, add a failing test, fix, run the checks in `AGENTS.md`, open one PR, and update this file in it.
