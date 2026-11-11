# Twodo 💞 a to-do list made for two

A fast, beautiful, iPhone-style to-do app for you and your partner. It's a static site (plain HTML, CSS and JS; no build step), so it runs on **GitHub Pages** for free. It installs on your phone like a real app, works offline, and can sync between your two phones in real time with **end-to-end encryption**.

---

## 1. Put it on GitHub Pages (≈3 minutes)

1. Create a new repository on GitHub, e.g. `twodo`. It can be **public or private** (GitHub Pages on private repos needs a paid plan).
2. Upload **everything in this folder**, keeping the folder structure (`js/`, `icons/` and so on). On a computer: unzip, then drag the files onto the repo page. Or use git:
   ```bash
   git init && git add . && git commit -m "Twodo"
   git branch -M main
   git remote add origin https://github.com/<you>/twodo.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then branch **main** and folder **/ (root)**, and click **Save**.
4. After about a minute your app is live at `https://<you>.github.io/twodo/`.

### Install it on your phones
- **iPhone:** open the link in **Safari** → **Share** → **Add to Home Screen**. It opens full-screen with no browser bars. Reminders on iPhone only work from the Home Screen app.
- **Android:** open it in Chrome → tap **Install** (or ⋮ → *Install app*).

The first launch asks for both of your names and a colour each. Each phone takes on its owner's colour.

---

## 2. Sync between your two phones (free, ≈5 minutes, optional)

Without sync, each phone keeps its own list. To share lists, Twodo uses a free **Firebase Realtime Database** as a mailbox for encrypted data. No Firebase code or keys go in the repo; the only thing you paste into the app is the database URL.

1. Go to <https://console.firebase.google.com> → **Create a project** (any name; you can turn Google Analytics off). The free **Spark** plan needs no credit card.
2. In the left menu: **Build → Realtime Database → Create Database**. Pick a location, then choose **Start in locked mode**.
3. Open the **Rules** tab, replace everything with the contents of [`firebase.rules.json`](firebase.rules.json), and click **Publish**.
4. Copy the database URL at the top of the **Data** tab. It looks like `https://your-app-default-rtdb.firebaseio.com` (or `…firebasedatabase.app` in some regions).
5. In Twodo: tap your avatars (top right) → **Sync with …** → paste the URL → **Create our shared space**.
6. Tap **Invite …** and send the link to your partner **privately**, for example in your own chat. They open it on their phone, tap **Connect** and pick their name. Done 💞

From then on, changes appear on both phones within a second. You'll see a little island message when your partner finishes something or adds something for you.

### How private is it?
- Everything is **encrypted on your phones** with AES-256-GCM before it's sent. Firebase only ever stores `{ timestamp, ciphertext }`, never task titles, names or notes.
- The key and the database path both come from the 120-bit **pair code** in your invite link. Treat that link like a password: anyone who has it can join.
- The rules block anyone from listing or browsing the database. Data can only be read at a path that is derived from your code.
- **Secret lists** (🎁) never leave the phone they were made on. They're perfect for planning surprises. If you move a shared task into a secret list, it is withdrawn from your partner's phone.
- Sync is "last change wins" per task. If you both edit the *same* task at the *same* moment, the later edit is kept.

---

## 3. What it does

**Feels like an iPhone app**
- Large titles that collapse into a frosted nav bar, inset-grouped lists, spring animations, light/dark mode and accent colours
- Push navigation with **swipe-from-left-edge to go back**
- Bottom sheets that scale the page behind them; **drag down to dismiss**
- **Swipe right** to complete; **swipe left** to pin or delete (a full swipe deletes)
- **Long-press** a task for a blurred context menu: Today, Tomorrow, Weekend, Next Week, priority, person, move, duplicate, focus
- A **Dynamic Island**-style toast with **Undo**, and a "Live Activity" while the focus timer runs
- Haptics (Android, and iPhone on iOS 18+), soft sounds, and confetti when today's list is cleared

**A composer like Claude's chat box.** Type naturally and Twodo works out the details. Coloured chips show what it understood; tap a chip to ignore it.

| You type | You get |
|---|---|
| `Call mom tomorrow 6pm` | due tomorrow at 6:00 PM |
| `Movie night fri 8pm @us !!` | Friday 8 PM, for both of you, medium priority |
| `Book flights @priya !!!` | assigned to your partner, high priority |
| `Milk #groceries` | added to the Groceries list |
| `Gym every mon 7am` | repeats weekly from Monday |
| `Water plants daily` · `Standup weekdays 9:15am` | repeating tasks |
| `Pay rent 1/12` · `dec 24` · `in 3 days` · `next week` · `this weekend` · `tonight` | dates |
| several lines pasted | several tasks at once |

The quick pills above the keyboard insert these for you. `@me`, `@us` and `@<name>` assign tasks, `!`, `!!` and `!!!` set priority, `#List` files a task into an existing list (otherwise it becomes a #tag), and `every …`, `daily` and `weekly` make it repeat.

**Organised**
- Smart lists: **Today** (split into Overdue, Morning, Afternoon and Tonight), **Upcoming** (by day), **Together**, **Pinned**, **All** and **Completed**
- Your own lists with an emoji and a colour, plus a **Secret** list
- Filter any list by person: *All · You · Partner · Us*
- Sort by smart order, due date, priority, date added or title
- Task details: notes, date, time, repeat, priority, person, list, tags, subtasks, pin and who did what
- Search across titles, notes, subtasks and #tags

**Productive**
- Focus timer (25/5 Pomodoro) per task, with 🍅 counts
- Daily streak, a "done together this week" count, and how many tasks your partner has left today
- Reminders while the app is open or recently used, plus **Add to Calendar** (.ics) for alerts that always fire
- Desktop keyboard shortcuts: `N` or `/` to add, `⌘K` or `Ctrl+K` to search, `Esc` to go back or close
- Works offline (PWA); changes made offline sync when you're back online
- Backup export/import (JSON)

---

## 4. Good to know
- **Reminders:** a static site has no server to send push notifications. So reminders fire when Twodo is open or was used recently. For alerts that must fire, open a task and tap **Add to Calendar**.
- **Updating the app:** after you change any file, bump `VERSION` in `sw.js` so phones pick up the new version. It takes one or two app launches to appear.
- **Free-tier limits:** Firebase Spark allows 100 simultaneous connections, 1 GB of storage and 10 GB of downloads a month. Two people's to-dos use a tiny fraction of that.
- **Your data lives** in your browser's storage on each phone, plus the encrypted copy in your Firebase project if you turn on sync. Use **Export backup** now and then.

## Files
```
index.html            app shell
styles.css            iOS-style design system and animations
js/util.js            helpers, icons, haptics, sounds, confetti
js/store.js           data model, persistence, smart lists, recurrence
js/parse.js           natural-language parser
js/sync.js            encrypted Firebase sync
js/ui.js              theme, island, sheets, alerts, menus
js/views.js           navigation stack and screens
js/actions.js         task actions and touch gestures
js/sheets.js          task details, list editor, calendar export
js/settings.js        settings, pairing, backup
js/focus.js           focus timer and reminders
js/composer.js        the chat-style composer
js/main.js            onboarding and boot
sw.js                 offline support
manifest.webmanifest  install metadata
firebase.rules.json   database rules to paste into Firebase
PROMPT.md             the prompt this app was built from
```
