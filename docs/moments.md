# Moments

Asked for on 2026-11-25, in place of Home's reactions: "something like Instagram's Instants or Locket, to share images
at one tap". This is the data decision (roadmap rule 13), written before the code.

## What you see

- **Home:** under the hello and the Today card, *Moments with Deiva*: her latest photo, big, with her picture, when
  and the caption. Under it a row: your own last one (once you have shared one), the shutter in the middle and your
  photo library on the right. Before pairing the card and the shutter lead to *Add partner*.
- **The shutter** opens the camera in one tap (`<input type=file accept=image/* capture=environment>`, made inside the
  tap as iOS requires). The library button is the same without `capture`.
- **Share a moment** (a sheet): the picture once, an optional caption (80 characters) and *Send to Deiva*.
- **Your partner** sees it on Home within seconds if their app is open (a line on the island: *📸 Abilash shared a
  moment*, with *See*), or gets a notification within a few minutes if it isn't. Tapping it opens the moments sheet.
- **The moments sheet** (tap the big photo or your own): everything this phone has seen, newest first. Only your
  latest has *Remove*; it goes from both phones and the one before it shows again.

## Data

### On the server: only the latest of each of you

- One record per person in the same encrypted records as everything else: `spaces/{space}/r/o:a` and `r/o:b`, the
  usual `{ u, d }` envelope, `d` AES-GCM with the space key. A new moment overwrites your last, so the database never
  fills up and nothing old stays on the server.
- The record (`types.ts` `Moment`, checked by `cleanRecord` in `store.ts`):

  | Field | |
  |---|---|
  | `kind` | `'moment'` |
  | `id`, `who` | `'a'` or `'b'`, the same; the key is `o:<who>`, so a record can't claim to be the other person's |
  | `img` | a JPEG data URL, nothing else (`^data:image/jpeg;base64,[A-Za-z0-9+/]+=*$`), at most 140,000 characters |
  | `caption` | text, at most 80 characters, only ever shown as text |
  | `at` | when it was shared |
  | `updatedAt`, `deleted` | as every record. Removing writes `deleted: true` with no picture and the same `at`, so each phone removes exactly that one |

- **Size:** a picture is at most 140,000 characters, so the encrypted record stays under the 200,000 the database
  rules allow for any record (worst case measured by test 18: a 14 MB photo of pure noise with an 80-character caption
  is 144,008 characters encrypted). No rules change.
- **Cost:** both latest moments come with every sync connection, about 2 × 100–190 KB.
- **Older app versions** ignore the record (`cleanRecord` drops kinds it doesn't know).

### On each phone: what it has seen

- IndexedDB `twodo-moments`, store `m`, key `<who>-<at, 15 digits>`: the newest 60 moments this phone has seen, yours
  and your partner's. They never leave the phone again. Read back through `cleanRecord`.
- Not in `twodo:data`: photos would fill localStorage. The existing stores (`twodo:*`, IndexedDB `twodo`) don't change.
- Cleared when you unpair, when another account signs in on the phone, and by *Erase this phone*.
- A new phone sees only the latest of each of you.

### The notification

- The same encrypted push entries as reminders and chat: `rem/{space}/moment_<your uid>` =
  `{ at: now, to: { <partner's uid>: true }, d, sent: 0 }`, `d` = `{ k: 'moment', t: '📸 Abilash', b: 'Shared a moment' }`
  encrypted with the space key. The reminders job sends it (every 5 minutes); `sw.js` shows it with the tag `moment`
  (a newer one replaces it) and tapping it opens the moments sheet (`#moments`).
- Nothing about the photo is in it. Only written when the app has a VAPID key and you're online; a moment shared
  offline syncs when you're back, without a notification.

## Privacy and safety

- The photo is drawn onto a canvas and saved again as a JPEG (long side 960 px, smaller and lower quality until it
  fits). Nothing else from the file is kept: no location, no camera details.
- On the server it's encrypted like everything else; Firebase sees only that `o:a` changed, when and its size.
- A picture is only ever shown as `<img src="data:image/jpeg…">`; anything else in `img` is dropped before it can
  reach the screen. The CSP already allows `img-src data:`.
- Home shows your partner's latest photo to anyone who looks at your Home, as Locket does on a home screen.

## Reactions

Home's reactions (2026-11-18) are gone. Nothing sends one any more; receiving stays (`Chat` `poke`, `lib/reactions.ts`),
so a partner still on an older version can send one until they update.

## Where the code is

- `lib/moments.ts`: the records, IndexedDB, the notification and `photoForMoment` (making the picture small).
- `components/home/Moments.tsx`: Home's card and row, the send sheet, the moments sheet, the island line.
- `lib/sync.ts` (`o:` records), `lib/store.ts` (`cleanRecord`), `public/sw.js` (the notification), `styles/44-moments.css`.
- Test 18.
