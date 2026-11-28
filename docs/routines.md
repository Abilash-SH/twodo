# Daily routines and the weekly summary: what they store

Roadmap rule: a feature that needs a schema, storage or security change is written down before it is built.
This is that note for the owner's request of 2026-11-28: daily routines (gym, steps, no sugar, walk, home food)
that each of you marks as done every day, and a summary of the whole week. From the mockups, he picked
**punch cards** for every day and **both** weekly summaries: the quilt first, then the receipt behind it.

## Summary

| | Routines | Punch cards |
| --- | --- | --- |
| What it is | One habit you keep every day ("Gym", "No sugar"), shared by the two of you | One person's card for one week: which routines they kept on which day |
| Record | `routine`, key `r:<id>` | `punch`, key `w:<week>-<who>` |
| Where it lives on the phone | `twodo:data`, like goals | `twodo:data`, like goals |
| Synced | Yes, end-to-end encrypted like every record | Yes, end-to-end encrypted like every record |
| In a backup file | Yes | Yes |
| Who writes it | Either of you (add, rename, remove) | **Only its owner**; the other person's card is read-only |
| On Home, in notifications | No | No |

Nothing else changes: no new storage keys, no change to the encryption, the sync format (`{u, d}` under
`spaces/{space}/r`), the database rules or the CSP. Two new record kinds go through the existing path.

## Records

```ts
interface Routine {     // one daily habit
  kind: 'routine'; id: string; name: string /* ≤ 40 */; emoji: string /* one emoji */; color: Color /* palette */;
  who: 'a' | 'b' | 'both';        // who keeps it; the quilt only shows that person's half
  order: number; createdAt: number; updatedAt: number; deleted: boolean;
}
interface Punch {       // one person's card for one week
  kind: 'punch'; id: string /* `${week}-${who}` */; week: string /* the Monday, YYYY-MM-DD */; who: 'a' | 'b';
  days: Record<string /* routine id */, number /* 7 bits: bit 0 = Monday … bit 6 = Sunday */>;
  updatedAt: number; deleted: boolean;
}
```

- Everything read from storage, the network or a backup goes through `cleanRecord`. A routine's name is cut to 40,
  its emoji to one, its colour must be in the palette, `who` must be one of the three. A card's `id` must equal
  `${week}-${who}` and `week` must be a Monday, so a card cannot pretend to be another week or the other person's;
  `days` keeps at most 60 entries, keys must look like our ids, values must be whole numbers from 0 to 127.
- **One card per person per week, written only by its owner.** The two of you never write the same card, so
  last-write-wins cannot lose the other person's punches. (Your own two phones can: the same as any record today.)
- A routine removed later keeps its punches on old cards; past summaries still show it, by the name it had.
- Punching: today, or an earlier day of this week (you forgot to tick it last night). Never a day still to come,
  never a past week.

## Trust

The database rules let either member write any record of the space (as for every record today); the server cannot
see inside them. So "only its owner writes a card" is kept by the app, as it is for journal posts: the app only ever
writes your own card, and shows the other person's as read-only. Your partner is the only other person who can write
to your space.

## What the summary shows

Computed on the phone from the cards and routines, never stored. The quilt: one patch per routine per day, split
corner to corner, your half in your colour and your partner's in theirs; a patch you both kept gets a stitch. The
receipt: each routine's days for each of you, how many patches you sewed, the days you both kept everything, what you
did together most and the routine that was hardest. **No streaks** (design.md, "Never"): counts of the week only,
and no "winner".
