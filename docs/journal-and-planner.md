# Journal and weekly planner: what they store

Roadmap rule: a feature that needs a schema, storage or security change is written down before it is built.
This is that note for two features asked for on 2026-11-15: a **weekly planner** and a **journal** (a shared one for
the two of you, and a private one each).

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
