# The prompt behind Twodo

Copy-paste this into any capable AI model to regenerate or extend the app.

---

Build **"Twodo"**, a production-quality, mobile-first to-do web app for two people (me and my girlfriend). It must deploy as a static site on **GitHub Pages**: no build step, no frameworks, no server I have to run. Use vanilla HTML, CSS and JavaScript split into `index.html`, `styles.css`, `app.js`.

## 1. Look and feel: it should feel like a native iPhone app
- System font (`-apple-system` / SF Pro), iOS system colours, inset-grouped lists, frosted-glass bars, large titles that collapse into a compact nav bar on scroll.
- Automatic light/dark mode with a manual override; a choice of accent colours; safe-area aware (notch, home indicator).
- iOS-style motion everywhere, smooth at 60fps:
  - push/pop navigation between screens, with **swipe from the left edge to go back**
  - bottom sheets that spring up, can be **dragged down to dismiss**, and scale the page behind them like iOS card modals
  - **swipe actions** on rows (swipe right to complete; swipe left to pin or delete; a full swipe commits)
  - **long-press context menu** with a blurred background and the row lifted
  - a **Dynamic Island-style toast** for feedback and Undo
  - a satisfying checkbox animation, and confetti when today's list is cleared
- Haptic feedback where the device supports it. Respect `prefers-reduced-motion`.

## 2. Input: a Claude-style composer
- Pinned to the bottom: a large rounded text box that grows as you type, a "+" button and a round send button that lights up when there's text.
- Enter sends, Shift+Enter adds a new line; pasting several lines adds several tasks at once.
- **Natural-language parsing** with live preview chips:
  - dates: "today", "tomorrow", "fri", "next week", "this weekend", "in 3 days", "dec 24", "24/12"
  - times: "6pm", "18:30", "noon", "tonight"
  - priority: `!`, `!!`, `!!!`
  - `#List` (or a tag if the list doesn't exist)
  - `@me`, `@<partner>`, `@us` to assign
  - repeats: "daily", "every monday", "weekly", "monthly", "weekdays"
- Tappable suggestion pills that insert these tokens, so nobody has to memorise the syntax.

## 3. Productivity features
- Smart lists: **Today** (including overdue), **Upcoming**, **All**, **Pinned**, **Us** (shared tasks) and **Completed**.
- Custom lists with an emoji and a colour, plus a **Secret list that never syncs**, for planning surprises.
- Task detail sheet: title, notes, date, time, repeat, priority, assignee, list, tags, subtasks, pin, focus timer, add-to-calendar (.ics) and delete. Every change saves instantly.
- Recurring tasks, Undo, search, filtering by person, a progress ring, a daily streak and a "together this week" count.
- Focus mode (Pomodoro, 25/5) linked to a task.
- Reminders through notifications while the app is open, plus an .ics export for alerts that are guaranteed to fire.
- Keyboard shortcuts on desktop (`/` or `N` to add, `⌘K` to search, `Esc` to close).
- An offline-first PWA: manifest, service worker, home-screen icon, opens full-screen like a real app.
- JSON export/import backup.

## 4. Made for two
- First-run onboarding asks for both names, who is using this device, and a colour for each person.
- Optional **real-time sync** between our phones using a free Firebase Realtime Database through its REST and streaming API (no SDK), paired with a random code shared as a link.
- **End-to-end encrypt** everything on the device (AES-GCM, key derived from the pair code) so the database only ever stores ciphertext. Never commit secrets to the repo.
- A toast whenever my partner completes something or assigns something to me.

## 5. Deliverables
- `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, icons, a Firebase rules file, and a README with step-by-step GitHub Pages and Firebase setup.
- Test it on a phone-sized viewport with no console errors.
