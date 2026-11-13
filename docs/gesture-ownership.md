# Who owns each gesture

One completed gesture causes exactly one action. Every gesture below has a single owner: the one file that decides
whether it starts, follows the finger, and what it does on release. Nothing else may react to the same touch.

All touch gestures share the same rules (`src/hooks/swipe.ts`):

- **Decide early.** After 6 px (`SLOP`) the gesture is claimed or let go; a claimed sideways swipe stops the page scrolling.
- **Follow 1:1.** The layer moves exactly as far as the finger, with no head start and no lag.
- **Finish or return.** Release finishes when the finger travelled 30% of the layer, or at least 24 px at a flick speed
  above 0.35 px/ms (`flung`). Otherwise the layer springs back to where it started. A short drag that is held before
  release has no flick speed, so it returns.
- **Angles are fine.** A swipe counts as sideways while its horizontal travel is at least 85% of its vertical travel.
- **Release continues from the finger.** The closing or returning animation starts at the dragged position.
- **Cancel means cancel.** A second finger or a `touchcancel` (the system took the touch) never commits the action.

| Gesture | Starts on | Owner | Completes | Does | Must never |
| --- | --- | --- | --- | --- | --- |
| Page back | Left 32 px of an opened screen, or a rightward drag anywhere on it that isn't a control. In the chat: the left 32 px, or a drag that starts off the messages (the header, the empty space) | `hooks/useStackGestures.ts` (`edge`/`pan`) | `flung`, finger not moving back left | `popView()`: one screen | Call `history.back()`; act if `Nav.seq` changed since it began; start on a message bubble (that is a reply) |
| System Back (browser button, Android back, iOS edge swipe, Alt+←) | The system | `ui/nav.ts` `onHistoryBack`, reached through the single `popstate` listener in `components/App.tsx` | Always | Closes the top layer: sheet, menu, photo, timer or effects picker if one is open, otherwise one screen | Close two things; be ignored because another navigation just happened |
| Edge swipe that the phone also answers | Left 48 px, touch only | `ui/nav.ts` (`popView({ systemToo })`) | — | The one `popstate` within 0.8 s is the same navigation | Swallow more than one `popstate`; step back past the app's first history entry |
| Sheet dismissal | Sheet header (any direction down), sheet body when scrolled to the top (down), or a rightward drag on the sheet | `components/overlays/SheetHost.tsx` | `flung` | Closes the sheet | Start on inputs, pickers or sliders in the body |
| Settings sub-page back | Rightward drag on a sub-page sheet | `SheetHost.tsx` (clicks the sheet's `[data-back]` button) | `flung` | Returns to Settings, not to the app | Close the whole Settings stack |
| Task complete (swipe) | Rightward drag on a task row when it starts on the checkbox, when the list is Home itself (without accounts), or with a mouse. On an opened screen a rightward touch drag on the row's text is page back | `useStackGestures.ts` (`row`) | Past 100 px, or 40 px at 0.45 px/ms | Toggles done, with Undo | Fire from a page-back swipe or a scroll |
| Task actions | Leftward drag on a task row | `useStackGestures.ts` (`row`) | Past 50 px (or 20 px at 0.4 px/ms) the Pin / Delete buttons stay open; past 62% of the row it deletes | Reveals actions, or deletes with Undo | Fire during a page transition |
| Task menu | Hold a task row 480 ms without moving 8 px | `useStackGestures.ts` → `views/taskMenus` | Timer | Opens the task menu | Fire after the finger moved |
| Checkbox | Tap on the round checkbox | Row click handler | Tap | Toggles done | Start a page-back swipe (the checkbox is excluded) |
| Board to-do | Tap the ring of a to-do on the board's Today note (a 44 px target); tap again within 0.7 s to cancel | `components/home/BoardView.tsx` → `ui/tasks.ts` `toggleDone` | Tap | Ticks it off in place, with Undo | Open the to-do (only its title does) |
| Board notes and buttons | Tap a note, *Message*, *Add a to-do*, Settings or To-dos | `BoardView.tsx` | Tap | Opens one screen or sheet; *Add a to-do* raises the task box with the keyboard in the same tap | Scroll-drags on the board never open a note (taps only) |
| Message reply | Rightward drag on a message bubble that starts at least 32 px from the left edge (`atBackEdge`) | `components/chat/ChatView.tsx` (`useBubbleGestures`) | Past 48 px, or 24 px at 0.3 px/ms | Sets the reply, keeps the keyboard | Buzz more than once per swipe; start in the back strip; navigate |
| Message menu / heart | Hold a bubble; double-tap a bubble | `ChatView.tsx` | Timer / second tap within 320 ms | Menu / ❤️ | Fire after a reply swipe (suppressed for 700 ms) |
| Photo viewer | Rightward or downward drag on the photo | `hooks/swipe.ts` `useSwipeAway`, used by `overlays/PhotoViewer.tsx` | `flung` | Closes the photo | Reach the screen underneath |
| Focus timer | Rightward drag, or downward when scrolled to the top (the ring included) | `useSwipeAway`, used by `overlays/FocusOverlay.tsx` | `flung` | Closes the timer view (the timer keeps running) | Stop the timer |
| Effects picker | Rightward or downward drag | `useSwipeAway`, used by `chat/FxPicker.tsx` | `flung` | Cancels the picker, keeps the draft | Send the message |
| Editing controls | `input`, `textarea`, `select`, `[contenteditable]`, `.seg`, `.pills`, `.tip-pills`, `.picker`, `.colors`, `.no-pan` (`NO_SWIPE`) | The control itself | — | Caret, selection, slider, picker | Be claimed by a back or dismiss swipe |

## History

`src/ui/nav.ts` is the only owner of browser history for screens:

- Home is the base entry. While any screen is open there is exactly one extra "trap" entry above it.
- Home is the board when signed in. The chat is a screen that only ever sits directly above it: opened from the board
  it slides in; asked for from a deeper screen (a tip, a notification) it is put underneath and the screen on top slides
  away, so Back from the chat always leads to the board. To-dos opened from the chat sits on top of it.
- The chat stays mounted while it is closed (`.view.parked`: off to the right, `inert`, not painted). Leaving it blurs
  its message box so the keyboard goes too.
- Every `popstate` closes exactly one thing, then the trap is re-armed if screens remain.
- In-app back (swipe, ‹ button, Escape) never calls `history.back()`, except once to remove the trap on arriving Home.
- Sheets keep one entry of their own (`ui/sheet.ts`); menus, photos, the timer and the effects picker use the trap.

## Tests

`tests/e2e/test_9_navigation_fullscreen.py` covers completed, cancelled and rapid swipes, rapid Back presses, Back
after a swipe or the ‹ button, the system gesture racing ours in both orders, arriving Home by edge swipe with and
without the system gesture, Back with a menu or sheet open, the chat's edge versus a reply swipe on the same message,
To-dos over the chat, and asking for the chat from a deeper screen. `tests/e2e/test_13_board_home.py` covers the
board's notes, buttons and ticking in place. `tests/e2e/test_7_native_regressions.py` covers the
overlay swipes and the reply swipe.
