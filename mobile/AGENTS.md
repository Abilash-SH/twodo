# Twodo app (`mobile/`) — rules for coding agents

The React Native rebuild of Twodo (Expo SDK 58, React Native 0.88, TypeScript). It is being built in phases; so far:
the design system, the two characters (female and male) with their moods, the launch, the Playground, and Home and
the Journal as designs with sample data (four tabs with a floating pill bar). Nothing is stored or sent yet.

## Read first
- `../HANDOFF.md`: where things stand and what to do next. Update it before you end a session.
- `../docs/architecture.md`: the plan (framework, database, sign-in, integrations, design system, security rules,
  phases). Schema, storage or security changes are written down there before they are built.
- `../design.md`: the look, shared with the web app ("The app" section for what is specific to this app).
- `../AGENTS.md`: the web app's rules. They still apply to the web app, and their intent applies here.

## Expo changes between versions
Expo ships breaking changes every SDK. Before using an Expo, EAS or React Native API, check the installed version
(`package.json`) and its own types in `node_modules`, or the docs for that SDK (`https://docs.expo.dev/versions/v58.0.0/`).
`npx expo install` asks Expo's servers for versions; if the network blocks that, take the version from
`node_modules/expo/bundledNativeModules.json` and install it exactly (`.npmrc` saves exact versions).

## Commands
```bash
npm ci                  # exact versions from the lockfile
npm run typecheck
npm test                # Jest: contrast, design rules, moods, rendering
npm run bundle:ios      # bundles the app for iOS: catches a broken import without a Mac
npm run preview:web     # a web preview in .web-preview/, only for screenshots; never shipped
```
CI runs the same checks (`.github/workflows/app.yml`). Merging to `main` builds the app on Expo and sends it to
TestFlight (`.eas/workflows/testflight.yml`).

## Where things are
- `src/app/`: screens (Expo Router). Only screens live here: `(tabs)/` holds Home (`index`), To-dos, Journal and Chat
  with the pill bar; `playground.tsx` opens on top.
- `src/ui/`: the design system. `tokens.ts` is the only place colours, type, space, corners, shadows and motion are
  defined; `theme.tsx` (light, dark, people's colours), `Text.tsx` (`<Txt>`), `components.tsx`, `haptics.ts`,
  `color.ts` (mixing and contrast), `shapes.ts`, `icons.tsx`, `Gradient.tsx`, `PillBar.tsx` (the tab bar), `avatar/`
  (looks, drawings, moods, `<Avatar>`, `<Portrait>`, `<Stage>`), `launch/`.
- `src/features/`: one folder per feature: `home/` (Home and its card stack), `journal/` (the screen, the day strip,
  the calendar, and `journalStore.ts` with the journal's rules), `playground/`; plus `people.ts` (the two of you,
  sample people until phase 2), `dates.ts` (local calendar days) and `ComingSoon.tsx`.
- `jest/`: test stand-ins (Reanimated runs as plain JavaScript in tests; Gesture Handler and Worklets use their own
  Jest mocks, set up in `jest.setup.js`).

## Rules
- Colours and sizes come only from the tokens, through the theme and the components. A test fails if a colour value
  appears outside `src/ui`. Every new use of a colour for text gets a contrast check (4.5:1) in `contrast.test.ts`.
- Text goes through `<Txt>`, so Dynamic Type works with the caps in `MAX_SCALE`.
- Only transform and opacity animate, on the UI thread (Reanimated), with the motion tokens. Respect Reduce Motion.
  Character moments go through `useMoments()`, which keeps them rare; characters are decorative, and the button
  around them carries the label.
- No over-the-air updates (`expo-updates` is not installed): every change ships as an Apple-signed TestFlight build.
- No secrets anywhere: only `EXPO_PUBLIC_*` values and Supabase's publishable key may ship. Never a secret key, an
  App Store Connect key (`.p8`), a certificate or a password in code, `app.json`, `eas.json`, the repo or a chat.
- Never add or edit `ios/` or `android/` by hand: they are generated from `app.json` (and ignored by git).
- A new library needs a reason in its PR (what it does, who maintains it, why the list in `docs/architecture.md` can't
  do it), at an exact version.
- In tests and examples the partner is "Deiva" (never "Priya").
- The journal's rules live in `journalStore.ts` and its tests: only today's page can be written (the store refuses
  any other date), earlier days are read-only, a heart goes only on your partner's page. Keep them there, not in a
  screen.
- A card or a notification shows a count or a nudge, never the text of a message or a page.
- One topic per PR, with what was tested and what wasn't, the security checks, and an iPhone checklist.
