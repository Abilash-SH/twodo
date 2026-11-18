# Twodo design specification

Read this before any visual change. It is a specification, not inspiration: if an implementation conflicts with it,
change the implementation or change this file in the same PR and say why.

Twodo is a small shared place that belongs to two people. It should feel personal, expressive and playful, and it
must stay predictable: the important actions (open the chat, add a to-do, tick something off) are always obvious.

Tokens live in `src/styles/01-tokens.css` (and the "Twodo look" overrides in `21-refinements.css`). JavaScript
animations read the same values from `src/lib/motion.ts`. Never hard-code a colour, duration, easing or layer number
that has a token.

## 1. Principles

1. **Two people, two colours.** Everything that belongs to one of you carries that person's colour. Everything
   shared carries both.
2. **Soft and rounded.** Flat pages, rows that sit on the page, soft tinted circles for icons, rounded titles.
3. **One clear action per moment.** Playfulness lives in reactions and details, never in the way of an action.
4. **Touch first.** Everything responds on touch-down, follows the finger, and finishes from where the finger left it.
5. **Calm by default.** Nothing moves unless someone caused it or something arrived.

## 2. Colour

### Roles

| Role | Token | Use |
| --- | --- | --- |
| Page | `--bg` | Every screen's background (light `#FAF8FB`, dark `#0D0C10`) |
| Raised surface | `--bg2` | Cards, pills, the message box, sheets (`--sheet`) |
| Sunken surface | `--bg3`, `--fill`, `--fill2` | Inputs, segmented controls, pressed states |
| Text | `--label` | Body text and titles |
| Secondary text | `--label2` | Sub-titles, timestamps, notes (never below 12 px; must pass 4.5:1, see Known gaps) |
| Disabled / hints | `--label3` | Placeholders and disabled icons only, never information |
| Lines | `--sep` | Hairlines; prefer space over lines |
| Yours | `--me-c` (and `--me-ink` for text on it) | Your bubbles, your avatar ring, your assignee mark, primary buttons |
| Your partner's | `--pt-c` | Their bubbles (as a tint), their avatar ring, their assignee mark, the "New messages" line |
| Shared | `--me-c` and `--pt-c` together | The heart between you, "seen" hearts, tasks for both, celebrations |
| Danger | `--c-red` | Delete, failed sends, errors. Nothing else is red |

### People

Each person picks one colour from the palette of twelve (`--c-blue` … `--c-gray`; dusty pastels with a lighter set
for dark mode). `--me-c` and `--pt-c` are set from those choices, so every rule above works for any pair.

- A person's colour never carries meaning alone: an assignee mark also shows the initial, a bubble also sits on its side.
- When both people chose the same colour the app still works; side, initials and names tell them apart.
- Shared things use a gradient or two overlapping shapes in both colours, never a third "couple" colour.

### Contrast

- Text: at least 4.5:1 against what is behind it, for every palette pair, in light and dark.
- Large text (24 px, or 19 px bold) and essential icons: at least 3:1.
- A tint is made with `color-mix()` from the person's colour and a surface or `--label`, then checked across the
  whole palette in a test (see tests 7 and 10), not by eye.

## 3. Type

| Style | Face | Size / line | Weight | Use |
| --- | --- | --- | --- | --- |
| Large title | `--round` | 28–34 (scales with width) / 1.2 | 700 | The title of a root screen |
| Title | `--round` | 20 / 25 | 700 | Section headers and sheet titles (navigation titles: 17, weight 600) |
| Body | system | 17 / 22 | 400 | Messages, task titles, cells |
| Callout | system | 15 / 20 | 400–600 | Buttons in rows, pill labels |
| Footnote | system | 13 / 18 | 400 | Notes under groups, sub-titles |
| Caption | system | 12 / 16 | 500–600 | Timestamps, the "New messages" line, badges |

- The system face is the device's own (`-apple-system`, `system-ui`). The rounded face is `ui-rounded`, with the
  system face as fallback. No web fonts.
- Nothing readable is smaller than 12 px. Anything a person must read to act is at least 15 px.
- Text fields are at least 16 px so iOS does not zoom the page.
- Numbers that change (timers, counts) use `font-variant-numeric: tabular-nums`.

## 4. Space, shape, surface

- **Spacing** steps: 4, 8, 12, 16, 20, 24, 32. Page side margin 16; text inside a row starts at 20.
- **Touch targets**: at least 44 × 44, with 8 between neighbours. Primary actions sit in the lower half of the screen.
- **Corners**: rows 14 · groups 12 · buttons 16 · cards 20 · bubbles 21 · sheets 28 (top corners) · pills and avatars
  fully round. Nested corners get smaller towards the inside.
- **Surfaces**: three levels, no more.
  - 0, the page: `--bg`, no shadow.
  - 1, resting on the page: cards and pills, `--bg2` with `--shadow`.
  - 2, floating: sheets, menus, the island, dialogs. A dimmed backdrop, not a heavier shadow, separates them.
- **Blur**: only the navigation bar of ordinary screens. Never on anything that moves, never over anything that
  keeps animating (`31-native-surfaces.css` enforces the allowlist).
- **Layers**: the `--z-*` scale, bottom to top: header, bar, sheet, menu, overlay, gate, fx, alert, island, splash.

## 5. Components

- **Buttons.** One primary button per screen, filled with your colour, label in `--me-ink`, which must pass 4.5:1 on
  every palette colour (a dark ink does; white does not, see Known gaps). Secondary buttons are
  tinted or plain text in the accent. Destructive buttons are red text until the confirming step. A button's label
  says what happens ("Add partner", not "OK"). Icon-only buttons have an `aria-label`.
- **Task rows.** Checkbox on the left (44 × 44 hit area), title, then quiet metadata: due date, list, assignee mark.
  Done rows fade and strike through; they never jump. Swipe actions are a shortcut, never the only way: every action
  is also in the row's menu or the task sheet.
- **Message bubbles.** Yours on the right in your colour with a blush of your partner's at the tail edge; theirs on
  the left as a tint of their colour. Crisp heart tail on the last bubble of a group. One heart = delivered, two
  overlapping hearts in both colours = seen. Text on bubbles keeps 4.5:1 for every pair.
- **Separators in the chat.** Day and time pills are centred and quiet. The "New messages" line is a caption between
  two hairlines in your partner's colour.
- **Sheets.** Rise from the bottom, rounded top, a grabber, a title bar with at most one action on each side. Drag
  down from the header (or right anywhere) to close. A sheet never opens another full sheet on top of itself;
  sub-pages replace the content and have a back button.
- **Menus.** Open from the thing that was pressed, above the sheet layer. At most seven items; destructive last.
- **The island.** One short line, an optional second line, at most one button. It never takes focus, never covers a
  focused field, and leaves by itself.
- **Home.** After the owner's reference (2026-11-18), the same as the iPhone app: your picture (Settings, with a dot
  for an update or a sync problem) and name with "with Deiva", your partner's chip on the right (their portrait, a
  count of what's new, never a message's text; it opens your chat). A big rounded "Hello, name!" and, under it, what
  today holds in your character's voice (tap your character for the next thing). Then a fanned stack of four cards:
  Today (how many to-dos, the next one with a time), your partner (new messages, never their text), the journal
  (write today's page) and this week (how many done). Each card is a wash of two colours with a dark badge in small
  capitals, the characters in the middle and big rounded capitals in `--on-color`; cards waiting in the fan show only
  their edges. Swipe the top card away or tap a dot to bring another up; tap it to open. Below, the two of you on a
  soft glow of both colours, your role and *Change*. A floating dark bar at the bottom: Home, To-dos, Journal (a dot
  when your partner wrote today) and Chat (a count), with *Add a to-do* beside it in your colour; it steps aside while
  the task box is up. Ticking to-dos happens on Today. Nothing from a secret list, ever. `docs/characters.md`.
- **The week (planner).** A ribbon of seven day tiles stays under the title while you scroll; each tile's bar shows
  how full the day is in both of your colours, and a dot marks a busy day (six open to-dos or more). Goals are a short
  list of three at most, ticked in the colour of whoever ticked them. The look back (from Friday) shows what you did,
  never a score or a streak. Wide screens: seven columns.
- **The journal.** One thread for the two of you, newest first, compact. At the top two small characters, "You and
  Deiva" and a lock ("only you two"), then a one-line writing box (your character, "What's on your mind?", *Post* in
  your colour) that grows as you write. Each post is a row: the writer's small character, name, time, the text (short
  posts a little bigger, a few emoji alone bigger still, long ones fold after six lines). A love thread runs down from
  each character to the next post's, shading from one writer's colour into the other's, with a small heart where they
  meet. Your partner's posts have a heart (double-tap the post, or tap the heart; a heart blooms over it); yours say
  who loved them and have ⋯ for Edit and Delete. No cards, prompts, weather or counts.
- **Text on a person's colour.** `--on-color` (`#1B1730`, at least 5.08:1 on all twelve colours in both themes) for
  labels on filled buttons and badges in a person's colour. New components use it instead of white `--me-ink`.
- **Launch and the first screen.** No app name is shown. Two hearts, one in each of your colours (yours on the
  left; blue and pink before there are two of you), drift in from either side, meet with a small spark and one
  heartbeat, then the caption: *Two souls, one space.* The sign-in and welcome pages use the same two hearts with the
  caption as their title. Transform and opacity only; with Reduce Motion the hearts are simply there.
- **Empty states.** One emoji or character, one sentence, one button. Friendly, never guilt.
- **Offline.** Say it once, quietly, where it matters ("Will send when you're back"). The app keeps working.
- **When something fails to draw.** Only that part is replaced, by a calm card: what couldn't load, that the
  to-dos and messages are saved, one line safe to screenshot (the error's type and what code failed, with anything quoted
  removed) and *Try again*. Home's bar, the top of Home and Back keep working. If everything fails, a plain
  page says the same with *Reload*. Never red, never the framework's blank error page.

## 6. Characters

Two original characters, female and male, in a soft 3D style; each of you picks a look, a skin tone and a hair colour,
and a role (Cheerleader, Calm friend, Cheeky, Poet) for how it talks to you. The hoodie is your colour. The same
characters as in the iPhone app (section 12). `docs/characters.md`.

- **Original.** Drawn for Twodo. No resemblance to an existing character, mascot, game or brand.
- **Readable small.** A clear face at 44 px; below that (rows, Settings) use the portrait: head and shoulders in a
  circle tinted with the person's colour.
- **Placement.** Home: the two of you side by side, your partner's turned towards you. The character screen and
  Settings; the journal. Never over a name, a status line or a button.
- **Words.** Short, kind, specific: what is on today, the next thing with a time, what your partner did. Fixed
  sentences per role, written from your data; never a quote from a message; never anything from a secret list.
- **Behaviour.** Still by default. Moments (wave, hop, happy, cheer, love) play once, under 1.5 s; states (thinking,
  sleepy) last while true. Transform and opacity only. No idle loops, no blinking on a timer. With Reduce Motion, none.
- **Fallback.** Plain SVG drawn with the page: nothing to load, nothing that can fail.
- **Privacy.** A character never reacts to anything in a secret list.

## 7. Motion

| Token | Value | Use |
| --- | --- | --- |
| `--dur-quick` | 160 ms | Presses, toggles, small fades |
| `--dur-standard` | 280 ms | Most state changes, rows sliding into place |
| `--dur-page` | 420 ms | Screens, menus, a cancelled swipe returning |
| `--dur-sheet` | 520 ms | Sheets rising |
| `--ease-out` | settle | Something finishing where the finger sent it |
| `--ease-ios` | screens and sheets | Push, pop, open |
| `--ease-spring` | small overshoot | Returning after a cancelled drag |
| `--ease-bounce` | pop | Small things only: a heart, a badge, a checkmark |

- Animate `transform` and `opacity` only.
- A press shows within one frame of touch-down. A dragged layer follows the finger 1:1, and the release animation
  continues from the dragged position.
- One entrance budget per screen: at most six items animate in, and never a group together with its children.
- Related things move together with one duration and easing. Unrelated state changes never replay a list.
- Gesture movement never goes through React renders.
- Playful means brief: a micro-interaction is under 600 ms, a celebration under 1.5 s, and neither blocks the next tap.
- **Reduce Motion**: movement becomes a fade of `--dur-standard`; no overshoot, no parallax, no confetti, no
  character reactions. Everything still works and still gives feedback.

## 8. Layout across sizes

- **Phone** (under 700 px wide): one column. Primary actions within thumb reach. Nothing important in the top 90 px
  besides the header. The board keeps its two columns down to 320 px; the message button takes the wider share so a
  name fits.
- **The board on wider screens:** at most 560 px wide and centred; its two buttons are at most 260 px each.
- **Tablet** (from 700 px): content column up to 820 px; where useful, a second column (the chat beside to-dos).
- **Desktop** (from 900 px, and framed on a desk background from 1241 px): sheets become centred dialogs, panels have
  comfortable widths (chat 420–560, lists 360–480), every action is reachable by keyboard, focus and hover are visible.
- 700, 900 and 1241 px are the breakpoints in the code today. New components adapt to their own container
  (container queries) and to their content, not to device names.
- Full-screen layers are sized with `inset: 0` or the measured `--vvh` / `--vvt`, never viewport units. Fixed
  elements respect `env(safe-area-inset-*)` on all four sides.

## 9. Accessibility

- Touch targets at least 44 × 44. Nothing depends on a hidden gesture alone.
- Contrast as in section 2. Meaning is never carried by colour alone.
- Every control has a name; toasts use `role="status"`; separators use `role="separator"`.
- Keyboard: every action reachable, focus visible (`:focus-visible`), Escape closes the top layer.
- Reading order follows visual order. Decorative drawings are hidden from assistive technology.
- Reduce Motion and the phone's text size are respected; layouts survive 200% text without clipping an action.
- Sounds and haptics always accompany something visible and can be turned off in Settings.

## 10. Never

- A colour, duration, easing or layer number written by hand where a token exists.
- Text under 12 px, or grey text below 4.5:1.
- Red for anything that is not destructive or an error.
- A third colour standing for "the couple".
- An action that exists only as a swipe or long-press.
- Blur on a moving layer, or animated scenery behind a blurred surface.
- Animating `width`, `height`, `top`, `left`, margins or anything that reflows.
- An animation that delays what the person asked for.
- A reload, a focus change or a keyboard closing that the person did not cause.
- Streaks, rankings, scores or anything that pressures.
- Anything from a secret list (content, titles, counts) outside that list: not on Home, not in a character's
  reaction, not in a notification, summary or export.
- A character, illustration or visual identity copied from another product.
- A statistics dashboard on Home.

## 11. Consistency checklist

Before shipping a visual change:

1. Does every colour, duration, easing and layer come from a token?
2. Whose is it? Does it carry the right person's colour, or both if shared?
3. Is the main action obvious without knowing a gesture, and within thumb reach?
4. Does text pass 4.5:1 for every palette pair in light and dark (checked in a test)?
5. Are all touch targets at least 44 × 44?
6. Does it only animate `transform` and `opacity`, and does it respect Reduce Motion?
7. Does it hold its layout with the keyboard open, in landscape, and at large text?
8. Are the empty, busy and offline states designed?
9. Is anything from a secret list visible that should not be?
10. Would a person understand it the first time, with no explanation?

## 12. The app (React Native, `mobile/`)

The same Twodo, drawn natively. Everything above applies; this is what is specific to the app
(`docs/architecture.md`, section 5).

- **Tokens.** `mobile/src/ui/tokens.ts` holds the twelve colours (light and dark), the neutrals, the type styles, space,
  corners, three shadow levels and the motion (durations, curves, springs). Screens never write a colour; a test
  rejects one outside `src/ui`.
- **Type.** The system font for reading; the iPhone's rounded face (`ui-rounded`) for titles. Dynamic Type is on, with
  a cap per style so layouts hold.
- **People's colours.** Each colour gives a base, a soft tint, an ink (the colour as readable text) and the dark ink
  for text on it; the character's hoodie is shaded from it. All of them are checked for 4.5:1 in light and dark.
- **Characters.** Two original characters, female and male, in a soft 3D style: big eyes with highlights, rounded
  shapes, gradients lit from the top left. Each person picks a look, skin tone and hair colour; the hoodie is their
  colour. They replace the web app's six blob characters in the app.
- **Characters lead.** Every screen has a host character. A state lasts while it is true (thinking while your partner
  types, sleepy while they're away); a moment is a short reaction to something that happened (happy, wave, hop,
  cheer, love), at most one per character every few seconds, none with Reduce Motion. Only Views move, on the UI
  thread; the drawing never re-renders during a motion. Lists use still characters.
- **Home.** After the owner's reference: your picture and name with your partner's chip (online dot, a count of new
  messages) at the top, a big "Hello", then a fanned stack of cards: Today, your partner, the journal, the week. Each
  card is a wash of two colours with a dark badge in small capitals, the characters in the middle and big rounded
  capitals in ink. Swipe the top card away or tap a dot to bring another up; cards waiting in the fan show only their
  edges. A card shows a count or a nudge, never what a message or a page says.
- **Tab bar.** A floating dark pill with four round buttons (Home, To-dos, Journal, Chat); the chosen one is a light
  circle with a dark icon. Screens leave room for it at the bottom.
- **Journal.** One page each per day. A week strip (the chosen day inverted, today ringed in your colour, a dot in each
  person's colour for who wrote, days to come empty and not choosable) and a calendar sheet for older days. Below, a
  stage washed from your colour into your partner's with both characters, and a sheet over it with the day in big
  capitals and the two pages. Only today's page has a writing box and a Save button; earlier days carry a "Read only"
  badge. A given heart is always the love pink (`LOVE`, 3:1 or more as an icon).
- **Washes.** Cards and big buttons go from a light mix of one colour into another (`cardGradient`); dark ink is checked
  at 4.5:1 on both ends for every pair of colours.
- **Launch.** The still splash is the launch colour; the two hearts fly in once the app runs, exactly as on the web.
- **Playground.** A screen with every component, character and mood, in light and dark: the place to judge the look
  on a real iPhone before a screen is built.

## 13. Known gaps

Places where the app does not yet meet this file. Fix them when touching the area; do not add new ones.

- **Secondary text is too light in the light theme.** `--label2` on `--bg` measures 3.4:1 (6.3:1 in dark). Target:
  a value at or above 4.5:1, such as `#66636D` (5.6:1 on the page, 5.2:1 on tinted surfaces), used in the home-screen
  mockups. Roadmap Phase 6; it changes the look of every screen slightly, so it needs a yes first.
- **Labels on filled buttons are too light.** White `--me-ink` on the twelve person colours measures 2.1–3.4:1.
  A dark ink (`#1B1730`, at least 5.1:1 on every colour) passes, and the board already uses it as `--on-color`
  (test 13 measures every piece of text on the board). The rest of the app: same phase, same yes needed.
- Eight styles use 11–11.5 px text (badges, the "me" tag, reaction counts, the status line under the name in the chat
  header). Target: 12 px. Roadmap Phase 6.
- Priority marks (`!`, `!!`, `!!!`) in task rows use the plain palette blue, orange and red: about 3:1 on a white row.
  Measured while building the planner (test 14 leaves task rows out of its own contrast check for this reason).
- Complete, pin and delete on a task are easiest to find by swiping or holding. Roadmap item 8.
- Phone layouts are stretched on tablets in several screens. Roadmap item 10.
