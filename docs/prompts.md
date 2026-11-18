# The prompts behind Twodo

A record of what the owner asked for, in order, kept as history. **These are not instructions to follow now**: the
current plan is `docs/architecture.md` and where to continue is `HANDOFF.md`.

- The first prompt is kept word for word. Prompts from 2026-11-11 to 2026-11-14 were not saved word for word, so they
  are summarised from the project's history. From 2026-11-15 they are word for word.
- Screenshots that came with a prompt are described, not stored.
- A website's name is left out, as the owner asked (marked "[a website]").

## The first prompt (2026-11-11)

It describes the first version, plain HTML, CSS and JavaScript. The app has since moved to Next.js
(`MIGRATION.md`) and is being rebuilt as a React Native app (`docs/architecture.md`).

> Copy-paste this into any capable AI model to regenerate or extend the app.

Copy-paste this into any capable AI model to regenerate or extend the app.

---

Build **"Twodo"**, a production-quality, mobile-first to-do web app for two people (me and my girlfriend). It must deploy as a static site on **GitHub Pages**: no build step, no frameworks, no server I have to run. Use vanilla HTML, CSS and JavaScript split into `index.html`, `styles.css`, `app.js`.

#### 1. Look and feel: it should feel like a native iPhone app
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

#### 2. Input: a Claude-style composer
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

#### 3. Productivity features
- Smart lists: **Today** (including overdue), **Upcoming**, **All**, **Pinned**, **Us** (shared tasks) and **Completed**.
- Custom lists with an emoji and a colour, plus a **Secret list that never syncs**, for planning surprises.
- Task detail sheet: title, notes, date, time, repeat, priority, assignee, list, tags, subtasks, pin, focus timer, add-to-calendar (.ics) and delete. Every change saves instantly.
- Recurring tasks, Undo, search, filtering by person, a progress ring, a daily streak and a "together this week" count.
- Focus mode (Pomodoro, 25/5) linked to a task.
- Reminders through notifications while the app is open, plus an .ics export for alerts that are guaranteed to fire.
- Keyboard shortcuts on desktop (`/` or `N` to add, `⌘K` to search, `Esc` to close).
- An offline-first PWA: manifest, service worker, home-screen icon, opens full-screen like a real app.
- JSON export/import backup.

#### 4. Made for two
- First-run onboarding asks for both names, who is using this device, and a colour for each person.
- Optional **real-time sync** between our phones using a free Firebase Realtime Database through its REST and streaming API (no SDK), paired with a random code shared as a link.
- **End-to-end encrypt** everything on the device (AES-GCM, key derived from the pair code) so the database only ever stores ciphertext. Never commit secrets to the repo.
- A toast whenever my partner completes something or assigns something to me.

#### 5. Deliverables
- `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, icons, a Firebase rules file, and a README with step-by-step GitHub Pages and Firebase setup.
- Test it on a phone-sized viewport with no console errors.

## 2026-11-11 to 2026-11-14 (summarised)

- Accounts, partner requests by unique @username, end-to-end encrypted sync on Firebase, and phone reminders at no
  cost. An iMessage-style encrypted chat; the chat with the partner is the heart of Home, to-dos one feature.
- Move from plain HTML, CSS and JavaScript to Next.js, React and TypeScript, still on GitHub Pages (`MIGRATION.md`).
- A teammate with ChatGPT Plus (Codex) contributes too.
- iPhone polish: motion, keyboard, one swipe = one screen, back gestures, chat reading position, safe updates
  (PRs #1 to #6); a visual system and home concepts (#7); returning to a quoted message (#8); the Pinboard home (#9).
- Standing rules from the owner: never use "Priya" as a test or prototype name (the partner in tests is "Deiva");
  always check for security flaws in every code change.

## Word for word, from 2026-11-15

**1.** (2026-11-15)
> There were updates made using Codex, so just do the following. Pinboard Idea looks good, incorporate it with the App, now and make sure it is also smooth

**2.**
> Right, now design the home screen, like we generally do in the home to make it aesthetic.

Outcome: a cork-board concept (PR #13, closed after the next feedback).

**3.**
> Now create a journal option, and a planner option like weekly ones, create with a fantastic ui ux by exploring all the state of art out there and please make something unique with smooth and responsive design.

Answers to the questions that followed: journal "Both: shared + private"; planner "No preference"; "Build straight
away". Outcome: the week planner and the journal (#11, #12).

**4.**
> I am not copying anything from [a website] or any of those in their GitHub, so please do not include any of the infos related to that in my code sections.

**5.**
> It did not push update to my app live, and there is no design at all. please add adesign and some beautiful functionas

Outcome: one release PR to `main` (#12). Lesson: PRs always target `main`.

**6.**
> I don’t want cork with string lights, also journal i want it like a continuous thread with just posting only this without any filters. Just keep it raw no sun, weather option, prompt place and tell about that and all. And the design looks like iPhone Notes

Answers: "No the previous design looks like iPhone notes." and "No private posts". Outcome: the journal as one
shared thread (#14).

**7.**
> A home where screen where a character has a role play model to select , like [a website]

Then, choosing concept B:
> B

Outcome: the character Home (#15).

**8.** (2026-11-16)
> Don’t keep two doo as a name now, Just leave the app name blank and also change the animation of app intro into something with two heart shaped like connecting each other, And caption as two souls, one space (make the grammar right). That’s with the starter screen now, 1)Inside the home screen, all the todos, weekly planner looks so scattered and the options look redundants. So make sure to keep only the best one to avoid the scatters. 2) Have a partner’s character aswell, i don’t want the latest message to be in the character box. 3) Journal design looks too old and simple. I want it to be more modern than twitter, x, threads.

Outcome: the two-hearts launch with "Two souls, one space." (#17), a tidier Home with both characters (#18), the
journal as a modern feed with hearts (#19).

**9.**
> Journal looks huge. I need something where each post connects with love threads

Outcome: compact posts on love threads (#20).

**10.** (2026-11-17) With a screenshot of a diagram: an AI engineer writes an architecture doc covering framework,
database, auth and integrations.
> Post questions to me along with options to select from the options. List the benefits as well. Also ask one for Ui designs as well. I need to make a fantastic and stable design.

Answers: framework "Rebuild in React Native"; database "Move to Supabase"; sign-in "No preference"; integrations
"Photos in journal and chat" and "Home Screen widget"; UI design "Playful, character-first". Then:
> Continue

Outcome: `docs/architecture.md` (#21).

**11.**
> I am an apple developer now, so go ahead

Outcome: phase 1 of the iPhone app: the design system, characters, launch and Playground (#22).

**12.** (2026-11-18) With a screenshot of a 3D avatar app concept: a home with a greeting, a fanned stack of
character cards and a floating tab bar; a character detail screen; a dressing-room screen.
> I need characters like this instead of the previous ones. For male and female.
>
> And see the first image inside the photo for home screen ideas, create something similar like that.
>
> And For Journal, I dont need it like a threads, create something with ui like the above and only for the same day i need it to enter and for seeing previous days i need to select days for that.
>
> Also, do keep my prompts in GitHub, remove all the prompts which I have given and create a separate file for another agent to understand. Incase if this session limit gets over the next agent should know where to continue and execute it.

Outcome: this file and `HANDOFF.md` (the old `PROMPT.md` moved here), new characters, a new Home and a day-by-day
journal in the iPhone app. See `HANDOFF.md` for the PRs.
