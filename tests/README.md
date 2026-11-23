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
```
`test_4_offline_onboarding.py` needs a build without Firebase settings (no accounts), served on port 8004:
`NEXT_PUBLIC_FIREBASE_API_KEY= NEXT_PUBLIC_FIREBASE_DATABASE_URL= NEXT_PUBLIC_BASE_PATH= npm run build`.
Each test prints what it checked and ends with `ERRORS: NONE` when the page logged no errors. The first lines of each test file say what it covers.

Tests 6 and 7 require both online (8003) and offline (8004) builds. Test 7 asserts
geometry, focus retention, encrypted long-passcode round trips and changes, overlay
swipes, and text contrast for every palette pair. Test 6 refreshes bubble geometry
after reply dismissal because the reply bar changes the available message area.
Set `CHROME=/usr/bin/chromium` if Chromium is installed instead of Google Chrome.

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
To-dos screen, both characters on it, your partner's turned to you), six reactions (one tap sends your partner the
emoji as a message and stays on Home; two quick taps send one), every door (the card, your partner's chip, the bar's
To-dos, Journal and Chat, Settings), reopening the chat while it still slides away, a part of Home or the chat that
fails to draw (a safe note; the bar still works), adding a to-do from the bar, ticking off on Today with Undo, picking
a character's look, skin, hair and role from Settings (it reaches the partner's card), that nothing from a secret list
is shown or said, offline and "Waiting to send", before pairing (the reactions lead to Add partner) and with nothing
to do, and text contrast for every colour in light and dark.

Test 17 covers Home's to-dos being only yours and the shared ones: your partner adds four for today (theirs, yours,
both of yours, one for no one); Home counts two, Today opens on those two, *All* shows all four, and the To-dos
screen counts Today the same way.

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

Test 9 asserts one navigation per completed swipe (and none for a short cancelled one), rapid consecutive swipes,
the browser Back button, a system back racing our own swipe (both orders), Back closing only an open menu or sheet,
1:1 finger tracking, app sizing in portrait/landscape with and without `body.ios-fullscreen` (the message bar must be
fully on screen), simulated keyboard sizing, and Reduce Motion.
