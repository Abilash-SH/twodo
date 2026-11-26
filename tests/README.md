# Twodo end-to-end tests

Real browser tests (Playwright + Chrome) that use the app the way a person does, with two accounts
(Abilash and Deiva), against a small local stand-in for Firebase Auth + Realtime Database (`mock_firebase.py`,
which also enforces the same access rules as `firebase.rules.json` for the paths the app uses).

```sh
pip install playwright                         # and a Chrome/Chromium; set CHROME=/path/to/chrome if needed
python3 tests/mock_firebase.py &               # fake Firebase on 127.0.0.1:9000
sh scripts/build-test.sh                       # test build → .test-out/
python3 -m http.server 8003 --directory .test-out &
python3 tests/e2e/test_1_pair_and_chat.py      # creates both accounts and pairs them (run this first, on a freshly started mock)
for t in $(ls tests/e2e/test_*.py | sort -t_ -k2 -n | tail -n +2); do python3 "$t" || break; done   # every other test, in order
node tests/velocity.cjs
node tests/performance.cjs
node tests/courtyard.cjs
python3 tests/test_courtyard_rules.py
```
`test_4_offline_onboarding.py` needs a build without Firebase settings (no accounts), served on port 8004:
`NEXT_PUBLIC_FIREBASE_API_KEY= NEXT_PUBLIC_FIREBASE_DATABASE_URL= NEXT_PUBLIC_BASE_PATH= npm run build`.
Each test prints what it checked and ends with `ERRORS: NONE` when the page logged no errors. The first lines of each test file say what it covers.

Tests 6 and 7 require both online (8003) and offline (8004) builds. Test 7 asserts
geometry, focus retention, encrypted long-passcode round trips and changes, overlay
swipes, and text contrast for every palette pair. Test 6 refreshes bubble geometry
after reply dismissal because the reply bar changes the available message area.
Set `CHROME=/usr/bin/chromium` if Chromium is installed instead of Google Chrome.

Test 21 covers the opt-in courtyard after test 1: simultaneous two-finger movement/look, live partner positions,
collision-safe travel to the bench, sitting/standing, expired presence after a sheet opens, rendering pause,
Chat keyboard retention, task completion, camera preview/send, feature doors, landscape, Reduce Motion and
context loss/retry and no-WebGL fallback. It uses `/tmp/mo/sunset.jpg`, as test 18 does. `tests/courtyard.cjs`
checks routes and protocol bounds, actual AES-GCM payload privacy, stale sequences, coalesced serialized writes,
heartbeat expiry, denied channels and cleanup. `test_courtyard_rules.py` tests the hand-translated mock rules;
it is not a substitute for publishing/testing the production Firebase rules. See `docs/courtyard.md`.

Where Turbopack's CSS-worker IPC port is blocked by the execution environment, use Next's webpack test selector:
`IS_WEBPACK_TEST=1 sh scripts/build-test.sh` (or `IS_WEBPACK_TEST=1 npm run build`). The repository's default build
and production hosting configuration remain unchanged. Record which bundler was actually tested.

Every test starts on the board (Home when signed in); `tests/e2e/helpers.py` has `open_chat()` and `back_home()`.

**Safari's engine.** Playwright's WebKit can't be downloaded in every workspace, so `tests/webkit/` drives WebKitGTK
from Ubuntu's own packages (the engine Safari uses) through the system Python:
```sh
sudo apt-get install libwebkit2gtk-4.1-0 gir1.2-webkit2-4.1 python3-gi python3-gi-cairo xvfb xauth
xvfb-run -a /usr/bin/python3.12 tests/webkit/test_home_webkit.py     # after test 1, with the mock and 8003 running
```
It signs in as Abilash like a new iPhone (iPhone user agent, `(hover: none)`, dark mode, no vibration) and taps every
door on Home with a finger: the partner chip, the partner, the bar's chat, Journal, To-dos and Settings. Nothing may
fail. Set `SHOTS=/some/folder` to save screenshots. The touch events are stand-ins (WebKitGTK has no touch screen
here), so it checks the engine and the app's touch paths, not iOS itself.
Test 16 holds task/message writes to verify local-first feedback and keyboard focus, checks atomic and nested
Firebase updates without per-record GETs, and checks lazy history photos with eager header/viewer photos.
Test 13 covers Home: the hello and what today holds in your character's voice, the one Today card (against the
To-dos screen, both characters on it, your partner's turned to you), Moments under it (the heading and the shutter;
test 18 covers sharing), every door (the card, your partner's chip, the bar's
To-dos, Journal and Chat, Settings), reopening the chat while it still slides away, a part of Home or the chat that
fails to draw (a safe note; the bar still works), adding a to-do from the bar, ticking off on Today with Undo, picking
a character's look, skin, hair and role from Settings (it reaches the partner's card), that nothing from a secret list
is shown or said, offline and "Waiting to send", before pairing (the moments card leads to Add partner) and with nothing
to do, and text contrast for every colour in light and dark.

Test 14 covers the weekly planner: goals (synced, three at most), picking a day, a time typed on its own landing
on that day, planning a to-do from its menu, busy days, *Not planned yet*, to-dos left open from before, looking
back, a secret to-do never showing (it creates a passcode in its own browser only), seven columns on wide screens,
and contrast.

Test 15 covers the journal by day: it opens on today (a week strip with days to come shut, both characters, an empty
page, no tabs, prompts or private pages), *Save page* (Saved, a dot on today) and saving again into the same record,
your partner seeing your page live (and Home's journal button saying so) with no way to edit it while theirs arrives
on yours, hearts (a double tap gives one and a second keeps it, the button takes it back, "Deiva loved your page" on
the other phone, a heart is its own record with no text), a draft kept when you leave and come back, an earlier day
read-only (from the strip and the calendar sheet, which shuts days to come; *Go to today*), a page from an earlier day
shown under it, an emptied page deleted after a question on both phones (its words gone from storage), text contrast
for every colour in light and dark (the page and the calendar), and the wide layout.

Test 18 covers Moments: the shutter opens the camera (`capture=environment`) and the other button your photos; the
picture is shown once with a caption and sent; it is made small (re-encoded, at most 140,000 characters) and kept in
IndexedDB `twodo-moments`, never in `twodo:data`; your partner sees it on Home within seconds (the photo, who, the
caption) with a line on the island; a newer one replaces it on Home while the moments sheet keeps both, newest first;
only the one who shared it can remove it, and removing takes it off both phones (the one before shows again); the
sheet's text contrast for every colour, light and dark, and a 44 pt Remove; the worst case (a 14 MB photo of pure
noise with an 80-character caption) stays under the database's 200,000-character limit. It needs `/tmp/mo/sunset.jpg`,
`/tmp/mo/coffee.jpg` and `/tmp/mo/noise.jpg` (any two photos, and 4032 × 3024 random pixels saved as a JPEG at
quality 95; the test's docstring has a one-line way to make them).

Test 19 covers the two of you on Home in 3D: their drawings first, then the 3D people (WebGL), standing above the Today
card and not on it; a flick on you turns you more than half a turn and you turn back to the front; a "Make Deiva wave"
button (keyboard and screen readers) makes her wave; when Deiva shares a moment her person takes a photo on your Home;
with Reduce Motion a slow drag turns you exactly with the finger and you stay, and up and down over the people still
scrolls Home; the character screen's person turns round too; without WebGL (`--disable-3d-apis`) the drawings stay and
nothing fails. It reads where someone faces from `data-me-yaw` / `data-me-state` on `.home-people`. Needs
`/tmp/mo/sunset.jpg` (see test 18).

Test 20 covers your own 3D avatar (docs/own-avatar.md): a photo instead of an avatar is refused with a reason; an
avatar .glb is checked, made small, shown at once, sent in encrypted pieces (only ciphertext in the database) and
reaches your partner's Home and round picture by itself; "Use a Twodo person again" takes it off both phones and out
of the database. Needs an avatar file: `AVATAR=/path/to/avatar.glb` (any Avaturn export; by default Avaturn's sample
at `/tmp/avt/a/public/default_model.glb`, never committed) and `/tmp/mo/sunset.jpg`.

Test 9 asserts one navigation per completed swipe (and none for a short cancelled one), rapid consecutive swipes,
the browser Back button, a system back racing our own swipe (both orders), Back closing only an open menu or sheet,
1:1 finger tracking, app sizing in portrait/landscape with and without `body.ios-fullscreen` (the message bar must be
fully on screen), simulated keyboard sizing, and Reduce Motion.
