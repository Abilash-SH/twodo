# Twodo end-to-end tests

Real browser tests (Playwright + Chrome) that use the app the way a person does, with two accounts
(Abilash and Deiva), against a small local stand-in for Firebase Auth + Realtime Database (`mock_firebase.py`,
which also enforces the same access rules as `firebase.rules.json` for the paths the app uses).

```sh
pip install playwright                         # and a Chrome/Chromium; set CHROME=/path/to/chrome if needed
python3 tests/mock_firebase.py &               # fake Firebase on 127.0.0.1:9000
sh scripts/build-test.sh                       # test build → .test-out/
python3 -m http.server 8003 --directory .test-out &
python3 tests/e2e/test_1_pair_and_chat.py      # creates both accounts and pairs them (run this first)
python3 tests/e2e/test_2_todos.py
python3 tests/e2e/test_3_desktop_focus_signout.py
python3 tests/e2e/test_5_service_worker_responsive.py
```
`test_4_offline_onboarding.py` needs a build without Firebase settings (no accounts), served on port 8004:
`NEXT_PUBLIC_FIREBASE_API_KEY= NEXT_PUBLIC_FIREBASE_DATABASE_URL= NEXT_PUBLIC_BASE_PATH= npm run build`.
Each test prints what it checked and ends with `ERRORS: NONE` when the page logged no errors.
