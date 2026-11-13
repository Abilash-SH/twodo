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
Test 13 covers the board: what its notes say against the To-dos screen, every note as a door, adding and ticking in
place (and the partner's board following), that nothing from a secret list reaches it (unlocked, ticked off, locked),
offline and "Waiting to send", the states before pairing and with nothing to show, and text contrast for every
colour in light and dark.

Test 9 asserts one navigation per completed swipe (and none for a short cancelled one), rapid consecutive swipes,
the browser Back button, a system back racing our own swipe (both orders), Back closing only an open menu or sheet,
1:1 finger tracking, app sizing in portrait/landscape with and without `body.ios-fullscreen` (the message bar must be
fully on screen), simulated keyboard sizing, and Reduce Motion.
