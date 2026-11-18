# Journal and weekly planner: what they store

Roadmap rule: a feature that needs a schema, storage or security change is written down before it is built.
This is that note for two features asked for on 2026-11-15: a **weekly planner** and a **journal**.

> **Changed the same day (2026-11-15, second request):** the journal is now **one shared thread of posts**, "raw":
> no prompts, no weather, no tabs and **no private journal**. See [The journal as a thread](#the-journal-as-a-thread)
> below; the rest of this note describes the first version and still applies where it says so.

## Summary

| | Weekly planner | Shared journal ("Us") | Private journal ("Just me") |
| --- | --- | --- | --- |
| New record kind | `goal` (key `g:<id>`) | `journal` (key `j:<id>`) | `journal` with `private: true` |
| Where it lives on the phone | `twodo:data`, like tasks | `twodo:data`, like tasks | Only inside `twodo:vault`, encrypted with the passcode key |
| Synced | Yes, end-to-end encrypted like tasks | Yes, end-to-end encrypted like tasks | **Never** |
| In a backup file | Yes | Yes | **Never** |
| On the board, in search, in notifications | The week's goals: no | A one-line "Deiva wrote today" note on the board and an in-app note | **Never** |
| Needs a passcode | No | No | Yes (the same passcode and Face ID as Secret lists) |

Nothing else changes: no new storage keys, no change to the encryption, the sync format, the database rules or the
CSP. Existing to-dos are planned by changing their `due` date, a field that already exists.

## Records

```ts
interface Goal {          // one goal for one week ("Book the trip", up to three a week)
  kind: 'goal'; id: string; week: string /* the Monday, YYYY-MM-DD */; text: string /* ≤ 200 */;
  done: boolean; order: number; createdAt: number; updatedAt: number; deleted: boolean;
}
interface JournalEntry {  // one person's half of one day's page, in one journal
  kind: 'journal'; id: string /* `${'us'|'me'}-${date}-${who}` */; date: string /* YYYY-MM-DD */; who: 'a' | 'b';
  private: boolean; text: string /* ≤ 20000 */; mood: 0..5 /* 0 none, 1 sunny … 5 stormy */; prompt: string /* ≤ 200 */;
  createdAt: number; updatedAt: number; deleted: boolean;
}
```

- Every record read from storage, the network or a backup goes through `cleanRecord` (`src/lib/store.ts`): unknown
  fields are kept as data, every known field is type-checked and clamped, and an id that does not match its fields is
  rejected, so a record cannot pretend to be another day, another person or the other journal.
- **One page per person per day per journal.** Only its author writes a half (the editor is read-only for the other
  person), so the two of you never edit the same record at the same time and last-write-wins never loses words.
- A half with no words, no weather and no prompt is marked deleted (a prompt alone is kept, so the week's prompt
  waits for you). Empty halves are never shown or put on the board.
- Goals are one record each, so ticking one goal never overwrites another one being edited on the other phone.

## Privacy rules

1. A private entry is created only after a passcode exists. Before that, *Just me* asks for one (the Secret-list
   flow). So a private entry is never written in plain text, not even once.
2. While the vault is unlocked, private entries are in memory with the secret lists; `publicData()` leaves them out,
   so `twodo:data` and backups never contain them. The vault's encrypted payload grows from `{ lists, tasks }` to
   `{ lists, tasks, journal }`; its key, salt, iteration count and AES-GCM sealing are unchanged.
3. Locking (the button, leaving the app, a reload) drops private entries from memory, as it does secret lists.
4. Sync never sends a private record (`Sync.isPrivate`), and refuses one that arrives marked private: a partner's
   phone cannot place anything into your private journal.
5. Nothing private reaches the board, search, notifications, the update-resume store (`twodo:resume`), or the
   service-worker reminders.

## Compatibility

- Older versions of the app ignore `g:` and `j:` records (`cleanRecord` returns nothing for an unknown kind), so a
  phone that has not updated yet keeps working and simply does not show them.
- A downgrade is not possible in practice (updates only move forward, see `src/ui/update.ts`). If an older version
  ever re-saved the vault it would keep only `{ lists, tasks }`; this is noted, not guarded.
- The database rules already accept any record key under `spaces/<space>/r/` (size ≤ 200 000 characters): no rules
  change and nothing to redeploy.

## What is deliberately not stored

Streaks, word counts, reading receipts for journal entries, location, photos and analytics. Moods stay inside the
entry they belong to.

## The journal as a thread

Asked for: "a continuous thread with just posting … keep it raw", and no private posts.

| | Before (one page a day) | Now (a thread) |
| --- | --- | --- |
| Record | `journal`, id `us-<date>-<who>` (one half of one day) | `journal`, id `us-p<time><random>` (one post) |
| Fields used | `text`, `mood` (weather), `prompt` | `text` only; `mood` stays 0 and `prompt` empty |
| Who edits | its writer | its writer (⋯ → Edit or Delete) |
| Private | *Just me* pages (`private: true`), only in the vault | none: every post is shared with your partner |

- **Same record kind, same key (`j:<id>`), same sync and encryption.** `cleanRecord` accepts a post id only for a
  shared record (`private` false, `^us-p[0-9a-z]{10,24}$`); a day page must still match `us-|me-<date>-<who>`. So a
  post can never be private, and a record still can't pretend to be another day or person.
- **Older pages** (one per person per day) appear in the thread as posts, at the time they were first written.
  Their weather and prompt are no longer shown.
- **Deleting a post** marks it deleted and empties its text, so the words leave both phones and the server copy.
- **Private pages written before this change** stay encrypted in the vault, untouched (the vault code that keeps them
  is unchanged), but the journal no longer shows or creates them. Nothing private is ever synced, exported or shown.
- **Older app versions** (the one live this morning) ignore post records (`cleanRecord` returns nothing for an id
  they don't know), so they just don't show new posts until they update.
- Not stored: likes, read receipts, counts, streaks.

## Hearts (2026-11-15)

Asked for: a journal "more modern than Twitter, X or Threads". Besides the new look, a post can get a heart from the
person who did not write it (a double tap, or the heart button; the button also takes it back).

- **A heart is its own `journal` record**, id `us-h-<the post's id>-<who gave it>`, `text` always empty, never
  private. Only the phone of the person who gave it writes it, so a heart never collides with an edit of the post.
  Taking it back marks it deleted.
- `cleanRecord` accepts a heart id only when its last letter matches `who`, and forces its text and prompt empty.
- `posts()` never counts a heart as a post; your partner's heart shows a quiet note ("Deiva loved your post") when
  the journal is not open.
- Older versions ignore heart records (they don't know the id). No change to keys, encryption, sync or CSP.

## The journal by day (2026-11-18)

Asked for: "I dont need it like a threads … only for the same day i need it to enter and for seeing previous days i
need to select days". The iPhone app got it first (#25); the web app followed (#29 by Codex, then the design).

- **No new record, id or key.** The web journal reads the thread's posts (`us-p…`) by the day they were written
  (`date`). Your newest post from today is today's page: *Save page* edits it, or writes it if there is none yet.
  Any older posts of yours from today, and every post from an earlier day, are read-only. Pages from before the thread
  (`us-<date>-<who>`) show under their day like posts.
- **Only today.** `editPost` refuses a post from another day, and the screen only offers a writing box for today. If
  midnight passes while you type, your words stay and save to the new day; an untouched box starts the new day empty.
- **Emptied, a page is deleted** (after a question): it is marked deleted and its words are removed, on both phones.
- **Hearts** stay as they were (a record each, `us-h-<post>-<who>`), now given to your partner's words on a day.
- **Why posts and not one record per day** (`us-<date>-<who>`, the app's shape): #29 had already written posts
  today, and keeping them needs no migration. Two phones of the same person can each start today's page offline;
  then the newer is the page and the older stays, read-only, above it. When the data moves to the app (phase 2), each
  person's newest post of a day becomes that day's page.
- Not stored: drafts (in memory only, until the app closes), streaks, counts, read receipts.
