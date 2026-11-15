# Home with a character

Asked for on 2026-11-15: "a home screen where a character has a role play model to select". Three concepts were drawn
(a canvas: pick your character and role; A, a little room; B, your character tells you). **B was chosen** and is what
is built. The characters are original, drawn for Twodo.

## What it is

- **Six characters:** Bun, Sprout, Pebble, Puff, Bolt, Drop. Each is drawn in your colour (body), with a lighter face
  or tummy and darker feet (`src/components/home/Character.tsx`, styles in `39-characters.css`).
- **Four roles:** Cheerleader, Calm friend, Cheeky, Poet. The role is how your character tells you about your day:
  the same facts, a different voice.
- **Home:** your character at the top, with what it says in a bubble, its role and *Change*. Tap the character for the
  next thing it has to tell you (1/3, 2/3…). Then your partner's latest message with the writer's character on it,
  Today (tick in place, with times), and three doors: This week, Journal, Together. The two buttons stay at the bottom.
- **Your character** (Home → *Change*, or Settings → *Your character*): pick a character and a role. It applies at
  once and reaches your partner's phone. Each of you picks your own.

## What it says, and where that comes from

Everything is written by `src/lib/characters.ts` from data already on the phone, with fixed sentences for each role.
No AI, nothing is sent anywhere, nothing is stored.

| Fact | From |
| --- | --- |
| Greeting (morning, afternoon, evening, late) | The phone's clock |
| How many things today, the next one with a time | To-dos due today (`liveTasks()`: never a secret list) |
| Left from before | Open to-dos due before today |
| Pinned | Your first pinned to-do |
| Messages from your partner | The chat's unread count |
| Your partner ticked something off | Their last ticked-off to-do (36 hours) |
| Your partner posted in the journal | The shared journal thread |
| Things to do together | To-dos for both of you |
| Add your partner | Not paired yet |

**Privacy.** A character never mentions anything from a secret list (test 13 checks every line it says, with a secret
to-do due today, for both of you and pinned, unlocked, ticked off and locked) and never quotes a message.

## Data (roadmap rule: written down before it is built)

- Two optional fields on each person in the existing `people` record: `char` (`bun|sprout|pebble|puff|bolt|drop`)
  and `role` (`cheer|calm|cheeky|poet`). Synced and encrypted like your name and colour.
- `cleanPerson` drops any other value. Without a choice: `a` has Bun, `b` has Puff, both Cheerleaders.
- Older app versions keep the two fields when they save the people record (unknown fields are kept), so a choice
  survives a phone that has not updated yet.
- No new record kind, storage key, sync format, encryption, database rule or CSP change.

## Motion

Still by default (design.md, "Characters"). It waves once when Home appears and hops once when tapped, under 1.2 s,
transform only, and neither with Reduce Motion. No idle loops.

## Not built (yet)

- Waving at each other (it would need a small message kind).
- The little room (concept A).
