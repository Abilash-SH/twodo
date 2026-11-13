# Twodo 💞 a to-do list made for two

A fast, iPhone-style to-do app for you and your partner. It's built with **Next.js, React and TypeScript** and exported as a static site, hosted free on **GitHub Pages** (a GitHub Action builds and publishes it on every push to `main`). It installs like a real app, works offline, and, once you add accounts, syncs between your two phones with **end-to-end encryption**, partner requests by **@username**, and **push reminders**. Everything runs on free tiers.

Live at **https://abilash-sh.github.io/twodo/**

---

## 1. Install it on your phones
- **iPhone:** open the link in **Safari** → **Share** → **Add to Home Screen**, then always open Twodo from that icon. iPhone keeps the Home Screen app's data separate from Safari's, and push reminders only work there.
- **Android:** open it in Chrome → **Install**.

The first launch asks for both your names and a colour each. Without the steps below, each phone keeps its own private list.

---

## 2. Turn on accounts & sync (free, ≈10 minutes, once)

1. Go to <https://console.firebase.google.com> → **Create a project** (any name; Analytics can be off). The free **Spark** plan needs no card.
2. **Authentication** (under *Security* or *Build*, depending on the console version) → **Get started** → **Sign-in method** → **Email/Password** → **Enable** → **Save**.
3. **Realtime Database** → **Create database** → choose a location → **Start in locked mode**. Open the **Rules** tab, replace everything with [`firebase.rules.json`](firebase.rules.json), and click **Publish**.
4. Copy two values:
   - the **database URL** at the top of the Realtime Database *Data* tab, e.g. `https://twodo-xxxx-default-rtdb.firebaseio.com`
   - the **Web API key** from ⚙️ **Project settings → General**. If it's missing, click **Add app → Web (</>)** to create one, then copy `apiKey`.
5. In this GitHub repo, open [`.env.production`](.env.production) → ✏️ **Edit**, paste both values (`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_DATABASE_URL`), and **Commit**. These values are public by design: they identify your project but don't grant access. Your login and the rules do that.
6. Wait for the **Deploy to GitHub Pages** action to finish (repo **Actions** tab, about 2 minutes), then reopen Twodo on both phones (fully close and reopen the app; it may take two launches to pick up the update).
7. On each phone: **Settings → Together → Create an account**, then pick a **username** (unique and case-insensitive, e.g. `@abilash`).
8. One of you types the other's `@username` → **Invite**. The other gets a request (a banner on Home, or in Settings) → **Review**.
9. **Compare the 8-digit safety code** on both screens. If it matches, tap **Accept**. You're paired 💞

**Recommended hardening, once you both have accounts:** in Firebase **Authentication → Settings → User actions**, untick **Enable create (sign-up)** (if your console shows it). Then nobody else can create an account in your project. To add an account later, tick it again.

**New phone?** Open Twodo → Settings → Together → **Sign in**. Your encrypted lists, keys and pairing come back.

**Forgot your password?** Twodo can't reset it, because your password *is* your encryption key and nobody else has it. Delete the user in Firebase **Authentication → Users** and create the account again, then pair again. Tasks still on your phone are kept and re-uploaded.

---

## 3. Push reminders (free, ≈10 minutes, optional)

Tasks with a date **and** a time can send a push notification to the phone of whoever the task is for (both of you for shared tasks). A free scheduled **GitHub Action** sends them. It only sees *when* each reminder is due; the title is encrypted and only your phones can read it.

1. **Make the push keys.** In Twodo: Settings → Together → **Set up push reminders**. It generates a key pair on your phone.
2. **Public key:** paste it into [`.env.production`](.env.production) as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (commit), *and* keep it handy for step 4.
3. **Service account:** Firebase ⚙️ **Project settings → Service accounts → Generate new private key**. This downloads a JSON file. It's easier to do steps 3–4 on a computer.
4. In GitHub: repo **Settings → Secrets and variables → Actions → New repository secret**. Add four secrets:
   | Name | Value |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT` | the whole JSON file's contents |
   | `FIREBASE_DB_URL` | your database URL |
   | `VAPID_PUBLIC_KEY` | the public key from step 1 |
   | `VAPID_PRIVATE_KEY` | the private key from step 1 (never put this in `.env.production` or any `NEXT_PUBLIC_` variable: those end up in the app) |
5. Repo **Actions** tab → enable workflows if asked → **Send reminders** → **Run workflow** once to check it goes green.
6. On each iPhone (Home Screen app): Settings → Together → turn on **Push reminders** → **Allow**.

Reminders arrive within roughly **5–15 minutes** of the due time, because GitHub runs scheduled jobs every 5 minutes at best and sometimes later. For alerts that must be on the dot, open the task and tap **Add to Calendar**. Note that GitHub pauses scheduled workflows in public repos after 60 days without a commit; if reminders stop, re-enable the workflow from the Actions tab.

---

## 4. Security model

| Layer | Protection |
|---|---|
| Your password | Never sent anywhere. PBKDF2-SHA256 (600,000 rounds) splits it into a **login secret** (sent to Firebase) and a **wrap key** (stays on the phone). Firebase can't derive one from the other. |
| Your keys | Each account has an ECDH P-256 key pair. The private key is backed up only in encrypted form (wrapped with your wrap key). |
| Your tasks | AES-256-GCM with a shared **space key**. The server only stores ciphertext + timestamps. GCM also detects tampering. |
| Pairing | The space key travels to your partner wrapped with an ECDH + HKDF key. The **safety code** lets you confirm nobody swapped public keys in transit. |
| Database access | Rules allow only the two members of a space to read or write it. Usernames are first-come and can't be stolen. Requests can only be read by their recipient. |
| Secret lists | Never leave the phone they're on. Locked with a 6-digit passcode (and optionally Face ID): a random AES-256-GCM vault key encrypts them on the phone, and that key is itself wrapped by PBKDF2-SHA256 (600,000 rounds, random salt) of the passcode, or by a passkey's PRF secret for Face ID. Locked = not even in memory, so they can't show up in Today, search, counts, reminders, backups or sync. The app locks them whenever you leave it. A 6-digit passcode stops someone holding your phone; it is not strong against someone who copies the app's storage and brute-forces it offline. Forget the passcode and they're gone (that's the point). |
| Push | The sender (GitHub Action) relays still-encrypted titles. Web Push adds another layer of encryption to each phone. It only sends to people in the same space and only to real push services, and it installs exact, checksummed versions of its code (`package-lock.json`, actions pinned to commits). |
| The page itself | A Content Security Policy lets only this site's own scripts run (Next's few inline scripts are allowed by their exact SHA-256 hashes, computed at build time) and only lets the app talk to Firebase. The app never builds HTML from strings: React escapes everything. Everything that arrives from sync (names, colours, emoji, photos, numbers, reactions) is checked before it's shown. |

**What's still visible:** Firebase can see your email, username, display name and colour, and *when* records change or reminders are due. It can't see what your tasks say.

**What's public on purpose:** `.env.production` holds your Firebase *web API key* and database address, and later the push *public* key. These identify your project; they don't unlock anything (the rules and your logins do). There are **no passwords, private keys or service accounts in this repository or its history.** The push *private* key and the Firebase service account live only in GitHub → Settings → Secrets.

**Five minutes in the Firebase / Google Cloud consoles (do these once):**
1. **Republish the rules:** Realtime Database → Rules → paste [`firebase.rules.json`](firebase.rules.json) → Publish (they now also limit who reminders can go to and which push servers can be used).
2. **Close sign-ups once you both have accounts:** Authentication → Settings → User actions → untick **Enable create (sign-up)**. After that nobody else can even make an account on your project.
3. **Lock the API key to your site:** Google Cloud console → APIs & Services → Credentials → the *Browser key* → Application restrictions: **Websites** → add `https://abilash-sh.github.io/*`.
4. Authentication → Settings → keep **Email enumeration protection** on.

**Your biggest levers:** turn on **two-factor authentication** on GitHub and on the Google account that owns Firebase (whoever controls the code or the project could ship a malicious version), keep a **passcode/Face ID** on your phones (the app stores its working copy on the device), and use a long, unique password for Twodo.

---

## 5. Messages 💬
Once you're signed in, **Home is your board**: the latest message, today's to-dos (tick them right there), what's for both of you, one list, a pinned to-do and the last thing ticked off pin themselves to it. **Message** and **Add a to-do** stay at the bottom; **Settings** sits top left and **To-dos & reminders** top right. Nothing from a Secret list ever appears on the board.

Tap **Message** (or the note with their latest message) and the chat slides in; swipe from the left edge or tap ‹ to go back to the board. At the top of the chat: their name, with your two small photos and a heart above it.
- Under their name, quietly: **online**, **typing…** or **last seen 5m ago / 9:41 PM / yesterday** (an encrypted heartbeat every ~45 s while the app is open, so it's accurate to about a minute).
- Your bubbles wear your colour, theirs wear theirs. Under your last message, an outline **♡** means sent and a filled **♥** means seen. Big emoji when you send just one to three.
- Tap either photo to see it big; only your own can be changed (Settings shows only your profile).
- **Hold the send arrow** for *Send with effect*. **Bubble effects:** Slam, Loud, Gentle, Invisible Ink. **Screen effects:** Echo, Spotlight, Balloons, Confetti, Love, Lasers, Fireworks, Celebration.
- Some phrases trigger effects automatically: “happy birthday” → balloons, “congrats” → confetti, “happy new year” → fireworks, “pew pew” → lasers, “love you” → hearts.
- **Double-tap** a message to ❤️ it. **Long-press** to react (❤️ 😂 😮 🥹 🔥 👍), **Reply**, Copy, **Make it a task**, or **Undo Send** (within 15 minutes). **Swipe a message right** to reply.
- **＋** shares one of your tasks as a card your partner can tick off right from the chat. The ❤️ button sends a heart with the Love effect.

Messages are encrypted with the same key as your tasks. The database rules only let the author edit or unsend a message, so neither of you can fake a message from the other. Only the latest 300 messages are downloaded; older ones stay on the phone that has them. If push reminders are set up, an unread message also triggers a push within about 5–15 minutes.

**Already set up before Messages existed?** Republish [`firebase.rules.json`](firebase.rules.json) in Firebase (Realtime Database → Rules) once.

## 6. Using it
- **Type naturally** in the bottom box: `Dinner @us fri 8pm !!` · `Milk #groceries` · `Gym every mon 7am` · `Call mom tomorrow 6pm`. Tap a chip to ignore a guess. Paste several lines to add several tasks.
- **Messages:** swipe a message right to reply (tap the quote to jump to the original) · press and hold to react ❤️ 😂 😮 🥹 🔥 👍, Reply or Copy · when you both say “love you” within 10 minutes, a little celebration plays · the keyboard stays open while you send.
- **Gestures:** swipe a task right to complete · left to pin or delete · long-press for quick actions · **swipe right anywhere else (or from the left edge) to go back one screen** (in the chat: from the left edge, since a swipe on a message is a reply) · drag sheets down to close. On a computer: the ‹ button or Esc.
- **To-dos & reminders** (top-right button): Today (Overdue / Morning / Afternoon / Tonight), Upcoming, **Reminders** (everything with a time, missed ones first), Together, Pinned, All, Completed, search, your streak, plus your own lists and a 🎁 Secret list (locked with a passcode or Face ID).
- **Extras:** focus timer, streaks, search, sorting, person filters, subtasks, repeats, backup export/import, and keyboard shortcuts (`N`, `⌘K`, `Esc`).
- **Home** is your board; **Add a to-do** there adds it to today. Without accounts, Home is To-dos instead.
- **Keyboard:** on iPhone the chat moves up and down with the keyboard and keeps the latest message in view (it learns your keyboard's height the first time you type).
- **Any screen:** phones (portrait or landscape), iPads and computers.
- **💡 Tips & tricks:** every tip, with little animated demos, lives in Settings.

## Developing & deploying
Twodo is a Next.js 16 app (React 19, TypeScript, Tailwind CSS 4, Lucide icons, Zod), exported as static files. See [MIGRATION.md](MIGRATION.md) for how it was moved over from the original plain-JavaScript version.

```sh
npm ci                 # install exact versions (package-lock.json)
npm run dev            # http://localhost:3000 (uses .env.local / .env.development if you add one)
npm run typecheck      # TypeScript, strict
npm run build          # static site in out/ (+ CSP hashes and the offline file list, scripts/postbuild.mjs)
npm run preview        # serve out/ on http://localhost:3000
```
**Deploying:** push to `main`. The **Deploy to GitHub Pages** workflow type-checks, builds and publishes `out/`.
**One-time switch** (when moving from the old plain-files site): repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Phones update themselves: the service worker's cache version is derived from the build's contents, so every deploy is picked up on the next launch.

## Files
```
.env.production        your public Firebase settings (edit this) · .env.example explains each value
firebase.rules.json    database access rules (paste into Firebase)
.github/workflows/pages.yml       builds + deploys the site (actions pinned to commits)
.github/workflows/reminders.yml  + .github/reminders/send.mjs   free push sender (pinned by package-lock.json)
public/                sw.js (offline + push), boot.js (theme before first paint, refuses to run in other sites' frames), manifest, icons
scripts/postbuild.mjs  Content-Security-Policy with script hashes; service-worker file list + version
src/app/               layout (page shell + splash), page, globals.css
src/lib/               the data layer, no React: store + checks on every record, natural-language parser, crypto,
                       Firebase REST + live streams, encrypted sync, chat, pairing, push, effects, Zod schemas
src/ui/                screen state: navigation stack, sheets, menus, toasts, alerts, task actions
src/hooks/             gestures (swipes, long-press, swipe back), keyboard, buttons that keep the keyboard up
src/components/        React components: chat, to-dos, composer, sheets, settings, sign-in gate, overlays
src/styles/            the design system, one file per area (kept rule-for-rule from the original)
PROMPT.md              the original prompt
```
