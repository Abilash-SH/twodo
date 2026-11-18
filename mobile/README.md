# Twodo for iPhone

The React Native rebuild of Twodo (`docs/architecture.md`). **So far:** the design system, the two characters
(female and male) and their moods, the two-hearts launch, Home (a fanned stack of cards), the journal by day (only
today's page can be written; earlier days from a week strip or a calendar), four tabs with a floating tab bar, and a
Playground to try every piece and change how you both look. To-dos and Chat are placeholders until phase 3.

Nothing in this app is stored or sent yet: Home uses sample numbers, and journal pages stay in memory until the app
closes. The web app keeps working as before until the move (phase 5).

- **App ID (bundle identifier):** `io.github.abilashsh.twodo`
- **Name under the icon:** Twodo
- **Builds:** every merge to `main` that changes `mobile/` is built on Expo's Macs and sent to TestFlight.
  No over-the-air updates: each change is a full, Apple-signed build.

## First build: one-time setup

Needs your Apple Developer membership, a free Expo account, and a computer (Mac, Windows or Linux) with Node.js 22
or newer, once, for about 15 minutes.

1. **Expo.** Create a free account at expo.dev and turn on two-factor sign-in.
2. **On the computer:**
   ```bash
   git clone https://github.com/Abilash-SH/twodo.git
   cd twodo/mobile
   npm ci
   npx testflight
   ```
   It asks you to sign in to Expo, then to your Apple developer account (with its two-factor code). Then it:
   - creates the app's signing certificate and profile, and keeps them on Expo;
   - creates the app in App Store Connect. If Apple says the name "Twodo" is taken, pick another App Store name
     (for example "Twodo for two"); the name under the icon stays Twodo;
   - builds the app and sends it to TestFlight.
3. **The project ID.** The command adds your Expo project ID (and account name) to `mobile/app.json`. Send that change
   (or just the ID) so it can be committed. It identifies the project and is not a secret.
4. **Testers.** In App Store Connect:
   - add your partner under **Users and Access**, with a role that TestFlight accepts for internal testers and access
     to this app only;
   - under the app's **TestFlight → Internal Testing**, add the two of you and turn on automatic distribution.
5. **On each iPhone:** install the TestFlight app, accept the invitation, and install Twodo.
6. **Builds on every merge.** On expo.dev, open the project's **GitHub** settings, connect `Abilash-SH/twodo` and set the
   base directory to `mobile`. From then on, each merge that changes the app arrives in TestFlight by itself.

Keep Apple and Expo keys out of the repo and out of chats: they live only in your Expo account.

## Checks

```bash
npm ci && npm run typecheck && npm test && npm run bundle:ios
```

`npm run preview:web` makes a web preview in `.web-preview/` for screenshots in the cloud; it is never published.
Rules for working on the app: `AGENTS.md`.
