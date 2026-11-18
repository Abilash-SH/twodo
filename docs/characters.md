# Home with a character

Asked for on 2026-11-15: "a home screen where a character has a role play model to select". Three concepts were drawn
(a canvas: pick your character and role; A, a little room; B, your character tells you). **B was chosen** and is what
is built. The characters are original, drawn for Twodo.

**Changed 2026-11-18:** "I need characters like this instead of the previous ones. For male and female", from a 3D
avatar reference. The six small characters were replaced by two original human characters, the same ones as in the
iPhone app (`mobile/`).

## What it is

- **Two characters, female and male,** drawn as soft 3D chibi figures: big eyes with highlights, rounded shapes, every
  surface lit from the top left with gradients, soft shadows under the fringe, the chin and the feet. Female: long hair
  with a heart clip; male: a side-swept quiff. Each of you picks a look, one of six skin tones (Porcelain, Peach,
  Honey, Caramel, Cocoa, Ebony) and one of five hair colours (Black, Espresso, Chestnut, Auburn, Golden). The hoodie
  is your colour (`src/components/home/Character.tsx`: `<Character>` and `<Portrait>`; styles in `41-avatars.css`).
- **Four roles:** Cheerleader, Calm friend, Cheeky, Poet. The role is how your character tells you about your day:
  the same facts, a different voice.
- **Home:** what your character says in a bubble (its role and *Change* under it), then the two of you side by side:
  your character (tap it for the next thing it has to tell you: 1/3, 2/3…) and your partner's, turned towards you
  (tap it to open your chat; a number says how many messages are new, never what they say). Then Today (tick in
  place, with times) with *This week* one tap away. Journal and To-dos are the round buttons at the top. The two
  buttons stay at the bottom.
- **Your character** (Home → *Change*, or Settings → *Your character*): pick a look, a skin tone, a hair colour and a
  role. It applies at once and reaches your partner's phone. Each of you picks your own.

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

- Optional fields on each person in the existing `people` record, synced and encrypted like your name and colour:
  - `avatar` (since 2026-11-18): `{ look: female|male, skin: porcelain|peach|honey|caramel|cocoa|ebony,
    hair: black|espresso|chestnut|auburn|golden }`. `cleanAvatar` keeps it only when all three parts are one of
    these, and keeps only those three parts; anything else is dropped.
  - `role` (`cheer|calm|cheeky|poet`).
  - `char` (`bun|sprout|…`): the earlier characters. Still read and kept, no longer drawn or written.
- Without a choice: whoever started the space (`a`) is male (Caramel, Black) and the other (`b`) female (Honey,
  Espresso), both Cheerleaders. One tap in *Your character* changes it.
- Older app versions keep `avatar` when they save the people record (unknown fields are kept), so a choice survives a
  phone that has not updated yet; they still draw their six characters until they update.
- No new record kind, storage key, sync format, encryption, database rule or CSP change. The drawings use only
  colours from fixed tables (never text from the data), so nothing from the network reaches the SVG.

## Motion

Still by default (design.md, "Characters"). Moments play once: wave, hop, happy, cheer (arms up, sparkles) and love
(heart eyes, floating hearts), each under 1.5 s. States last while they are true: thinking (eyes up, a thought bubble)
and sleepy (eyes closed, z's). CSS animations of transform and opacity only, and none with Reduce Motion. No idle
loops. Your partner's character is turned towards you.

## Not built (yet)

- Waving at each other (it would need a small message kind).
- The little room (concept A).
