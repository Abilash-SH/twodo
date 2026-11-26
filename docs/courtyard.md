# The shared courtyard — web preview

Approved direction, 2026-11-26: a human-scale third-person 3D Home, realistic people and materials, walking,
turning, sitting, and a camera controlled by touch. Both people move together while the courtyard is foregrounded;
when someone leaves or loses their connection, their avatar rests. The generated art reference establishes the
direction, not a claim about the fidelity or frame rate of the running iPhone app.

## First build

An explicit **Explore our place · preview** button on the existing Home opens the courtyard in place. Leave preview
returns to today's Home. Its header, Settings, Chat, Journal, To-dos and Add use the existing navigation and
keyboard behaviour. The courtyard renderer and its assets initialize on entry. The existing Home uses the same
avatar model cache.

One original courtyard: plaster cottage, stone path, planted borders, pond, bench, journal desk and photo display.
Reuse this repository's MIT Rocketbox human models, checked own avatars and retargeted mocap. Environment geometry
is authored for Twodo. Four surface maps use Poly Haven's verified CC0 license, served locally (828,333 JPEG bytes
total); their checked source hashes, transformations and derivative hashes are in `public/world/sources.json`,
with the CC0 legal text alongside. They load only on entering, use the existing worker's lazy-asset cache, and have
procedural fallbacks. Movement uses a thumbstick or arrow/WASD keys; dragging the world
turns the camera. A visible Find partner button walks a collision-safe route. Sit/stand and wave have named buttons.
The feature shortcuts work without walking, WebGL or a connection. The task patch shows up to three of your or
shared to-dos with the regular completion and Undo action. The photo display uses the latest shared photo from
each person already on the device. The camera and library reuse Moments' preview and explicit Send. Moments and
Journal open their existing screens. The presence data contains only world movement and poses.

## Presence data decision (written before implementation)

This is a new, separate channel at `spaces/{space}/world/{uid}`. It does **not** add a saved record kind, alter
existing record/message formats, encryption, protected storage keys or the sync queue. No presence is saved on
the phone. Reuse `encryptObj` / `decryptObj` with the current space key, unchanged AES-GCM construction.

Each UID has at most one latest envelope `{ u: server timestamp, d: ciphertext }`, bounded to 1,024 characters.
The encrypted body is version 1: `{ v, session, seq, t, x, z, yaw, mode }`. Coordinates are virtual courtyard
coordinates, never GPS. Only whitelisted finite bounds, allowed poses, bounded sequence numbers and a random
16-hex-character session are accepted through `cleanRecord`'s courtyard validation scope. No text, names, tasks,
photos or vault information is sent. The database reveals membership, packet timing and ciphertext length, as
existing sync does. It never sees coordinates or actions. A person can write only their UID; only space members
can read. Firebase rules deny unknown children, oversized packets and invalid timestamps.

Latest-only writes are serialized and coalesced, at most five per second while moving, one heartbeat every three
seconds while resting. No movement history, outbox or replay of offline motion. Multiple devices for one account
use the latest foreground writer. Receive generations and server timestamps reject late packets; a valid heartbeat
expires after twelve seconds. Lost local connectivity means **connection unavailable**, not proof that the partner
is offline. A sleeping phone is never described as online indefinitely. On leave/hide/coverage, stop reads/writes;
an already submitted request may finish, and its last heartbeat still expires. The latest ciphertext remains on
the server until replaced or the space is removed; this is an expiring *display lease*, not server-side TTL deletion.

The new rules must be pasted into Firebase by the owner before live presence works in production. Until then the
world remains usable and says live movement is unavailable. Do not change production configuration from this task.

## Rendering and interaction budgets

- One demand-driven WebGL renderer, capped pixel density, bounded textures and geometry; no scenery animation loop.
- Draw during walking, looking, interaction and brief partner interpolation; stop at rest, when covered/hidden and
  after context loss. Release renderer-owned materials, textures, geometries, mixers and listeners on leaving.
- Touch input updates an imperative controller, not React state each frame. The left back edge belongs to the
  existing navigation owner. Other world drags belong to the camera; stick touches never become camera gestures.
- Reduce Motion removes camera smoothing, gait/reaction animation and fades; explicit walking and direct camera
  control remain available. With unavailable WebGL show an explanation and ordinary feature shortcuts, never a blank Home.
- Keep all UI at token sizes/colours, 44-point targets, opaque fills, safe-area padding and visible-viewport sizing.
- Target consistent movement on iPhone; record actual device, asset sizes, draw calls and frame timings before
  replacing Home. Browser/software-WebGL evidence is not physical iPhone validation.

## Acceptance

Walk and look independently with two fingers; a cancelled touch, blur, screen opening or app hide stops input.
Camera and walking cannot pass through the cottage or pond. Find partner reaches a walkable interaction point.
Both paired browser sessions see movement; stopping or disconnecting expires the partner into resting status.
An outsider/non-member cannot read, members cannot move the other's avatar, hostile packets are ignored and no
plaintext coordinate appears in Firebase. Chat and Journal still open once; keyboard drafts and the vault survive.
Exercise WebGL failure/context loss, Reduce Motion, portrait/landscape, small phone, tablet and desktop.
