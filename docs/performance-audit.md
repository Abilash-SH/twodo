# Data and rendering performance

Twodo uses Firebase Realtime Database REST/SSE and encrypted records, not SQL. This audit covers
all application `dbGet` call sites, stream handlers, the reminder worker, local search/sort paths,
the service worker and profile photos. No production database or iPhone was profiled.

## 1. Repeated reads

**Cause:** both chat and shared-record handlers issued a GET of the containing record for every
field-level SSE notification. A batch touching N records could produce N extra requests even though
the stream had already sent the ciphertext. Root multi-path PATCH events were also misread as record IDs.

**Change:** opt-in record streams reconstruct encrypted envelopes in memory, per EventSource connection.
They apply every part of an atomic patch before dispatching complete affected records once. Consumers
still decrypt and validate through their existing boundaries. Queued events retain their own snapshots;
deletes and reconnects discard the corresponding cached ciphertext. No additional network reads.

Other reads deliberately retained:

| Path | Reason |
| --- | --- |
| Account public/private records | Two independent reads already run in parallel at sign-in; never fetched per row. |
| Username then public profile | A dependent lookup for one pairing action; no denormalized public key copy or ownership cache. |
| Username ownership on claim/review | Must be checked live for security. |
| Pairing inbox | One read on start/resume; live changes arrive through SSE. |
| Reminder members/subscriptions | Existing per-run caches read each distinct space/recipient once, shared by all reminders. Reading all accounts' subscriptions to save these authorized reads would broaden data access. |

## 2. Query/index coverage

| Search/order | Execution | Index |
| --- | --- | --- |
| Chat history, including reconnect window | `orderBy="$key"`, `startAt`, `limitToLast=300` | Firebase automatically indexes keys; no `.indexOn` entry needed. |
| Username/account lookup | Direct key paths | Built-in key lookup. |
| Task title/tag search; due date, priority, pinned/order sorting | On-device decrypted records (`store.ts`, list views) | No server query; the server cannot index encrypted title/date fields. |
| Journal/week/Home selections | On-device shared records, with existing secret-list filtering | No server query. |
| Reminder scan | Scheduled trusted worker reads the current `/rem` tree | No `orderByChild` query. A secondary index would not accelerate this read. A different due-reminder layout would need a separate schema/security proposal. |

`firebase.rules.json` is unchanged: there are no unindexed secondary-field queries to fix. Adding
unused indexes, plaintext search fields or broad read grants would not improve these paths.

## 3. Cache what stays stable

- Presence/typing events reuse the current reaction collection instead of traversing, awaiting and
  reconstructing every reaction on each heartbeat. Root snapshots and reaction updates rebuild it.
- Unchanged reaction ciphertext reuses the existing decrypt cache. The cache is now bounded to 512
  entries, cleared at chat teardown, and guarded against decryption finishing after teardown. Presence
  ciphertext bypasses it, so frequent heartbeats cannot fill it with obsolete entries.
- The existing versioned service-worker cache already holds static assets offline. It is retained;
  private Firebase/auth responses never enter Cache Storage. Existing local-first record persistence
  and the last-600-message cache are retained as well.
- Username ownership, authentication results and pairing safety decisions are deliberately not TTL-cached.

## 4. Lazy photos

The only raster images in the UI are sanitized inline profile photos, previously eager CSS backgrounds.
Avatars now use native `loading="lazy"` and `decoding="async"` images by default, including repeated
history/task/journal avatars. Header photos and the explicitly opened photo viewer use eager loading.
The existing avatar fixes the size before decoding; circular cropping and rings are preserved. SVG
characters/icons have no external image request to defer. User-selected file decoding remains immediate.

These photos are data URLs inside an already-synced encrypted people record: lazy loading defers
offscreen image work; it does **not** reduce the bytes of that record or promise exact browser thresholds.

## 5. Optimistic interactions

Tasks, planner goals, journal posts, messages and reactions already update local state before sending.
Keep that local-first model and the existing sync retry queue. Do not show successful pairing, login
or vault setup before the security-critical operation succeeds.

**Race fixed:** writes for the same message now capture their payload at invocation and execute in
order. A delayed send cannot land after Undo Send; an older response or SSE echo cannot mark a newer
edit sent or restore removed text. Undo Send gets a strictly newer revision even within one millisecond.
Only the current revision receives the resulting status. Failure preserves the message with Retry.
Chat restart invalidates old callbacks, marks interrupted work retryable and retains in-flight write
ordering until it settles. Different messages remain independent.

## Regression checks

- `node tests/performance.cjs`: atomic/nested patches, nulls, reconnect isolation, queued snapshots,
  hostile keys, 100 message updates with zero record GETs, delayed writes, stale echoes, failure/retry,
  stable reaction identity during presence changes, bounded cache and teardown.
- `tests/e2e/test_16_data_performance.py`: holds real UI task/message requests until the local display
  is asserted; verifies partner convergence after atomic field patches, zero record GETs after nested
  notifications, composer focus, lazy history photos and eager header/viewer photos.
- The full browser suite covers navigation, vault isolation, keyboard geometry, offline startup,
  service-worker updates and current Home/planner/journal behaviour. Test results belong in the PR;
  browser emulation is not physical-iPhone performance evidence.

## Physical iPhone checklist

- Add and complete a task while offline; it appears immediately, remains after reopening, and reaches
  the partner when connected. Secret lists still stay inside their own list.
- With a slow connection, send, retry a failed message, then Undo Send after delivery. Check both
  phones: no restored text, a clear pending/failure state, and the keyboard stays focused after sending.
- Scroll a conversation with profile photos, then open either header photo. Check circular crops,
  rings, no row-height jumps and an immediate header/viewer.
- Type while your partner reacts; the reaction stays visible through typing/online updates. Reopen
  the app and check reaction convergence. Check signing out/in does not reuse the previous session.
- Launch offline from the Home Screen; the cached app opens. Apply an update only through the existing
  Update ready action. Storage, vault, encryption, CSP, sync format and database rules are unchanged.
