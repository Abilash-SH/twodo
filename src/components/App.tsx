'use client';
/* Twodo · the app: start-up, the screen stack and everything that floats above it */
import { useEffect, useState } from 'react';
import { startCloud } from '@/lib/account';
import { ui } from '@/lib/bridge';
import { asset, cloudReady } from '@/lib/config';
import { Auth } from '@/lib/firebase';
import { scheduleRender } from '@/lib/render';
import { L, ensureBasics, load, save } from '@/lib/store';
import { Sync } from '@/lib/sync';
import '@/lib/vault'; // registers with the store before the first save
import { applyTheme } from '@/lib/theme';
import { reducedMotion, todayStr } from '@/lib/util';
import { useApp } from '@/hooks/useApp';
import { useKeyboard } from '@/hooks/useKeyboard';
import { alertOpen } from '@/ui/alert';
import { boot, gateStore, showGate, showOnboarding } from '@/ui/gate';
import { focusOpen, island, showLive } from '@/ui/island';
import { closeMenu, menuOpen } from '@/ui/menu';
import { Nav, armTrap, boardAdd, boardHome, bootNav, depth, navState, onHistoryBack, openBoardAdd, openSearch, popView, pushView, topSpec } from '@/ui/nav';
import { resume, watchUpdates } from '@/ui/update';
import { PhotoView } from '@/ui/photos';
import { checkReminders } from '@/ui/reminders';
import { seedTasks } from '@/ui/seed';
import { Sheet, closeSheet, sheetOpen } from '@/ui/sheet';
import { useStore } from '@/ui/store';
import { ChatCtl, fxPickerStore } from './chat/chatCtl';
import { FxPicker, fxPickerOpen } from './chat/FxPicker';
import { LoveYou } from './chat/LoveYou';
import { Composer } from './composer/Composer';
import { Gate } from './gate/Gate';
import { Onboarding } from './gate/Onboarding';
import { NavStack } from './nav/NavStack';
import { AlertHost } from './overlays/AlertHost';
import { FocusOverlay, closeFocus, focusTick } from './overlays/FocusOverlay';
import { IslandHost } from './overlays/IslandHost';
import { MenuHost } from './overlays/MenuHost';
import { PhotoViewer } from './overlays/PhotoViewer';
import { SheetHost } from './overlays/SheetHost';
import { vaultBlocks } from './vault/VaultUI';
import { importBackup } from './settings/Settings';

/* ---------- launch animation: let the intro finish, then zoom through into the app ---------- */
function hideSplash() {
  const el = document.getElementById('splash'); if (!el || el.classList.contains('out')) return;
  const t0 = (window as Window & { splashT?: number }).splashT || 0;
  const min = reducedMotion.matches ? 300 : 1080, wait = Math.max(0, min - (performance.now() - t0));
  setTimeout(() => {
    el.classList.add('out');
    document.body.classList.add('landing'); document.body.classList.remove('launching'); applyTheme();
    setTimeout(() => { el.style.display = 'none'; el.hidden = true; document.body.classList.remove('landing'); }, 800);
  }, wait);
}

function runBoot() {
  ensureBasics();
  bootNav();
  // straight after an update: back on the screen you were on (your typing returns in ChatBar / Composer)
  const back = resume();
  for (const spec of back.stack) pushView(spec);
  if (back.updated) setTimeout(() => island({ e: '✨', text: 'Twodo is up to date', ms: 2200 }), 1700);
  if (!Sync.live) void startCloud();
  if (L.focus && L.focus.running) showLive();
  checkReminders();
  if (location.hash === '#chat') { history.replaceState({ d: 1 }, '', location.pathname + location.search); setTimeout(() => ChatCtl.open(), 900); }
  scheduleRender();
}

function init() {
  load(); applyTheme();
  if (L.sync && (L.sync.code || L.sync.url)) L.sync = {}; // retire the old invite-link pairing
  ui.island = island; ui.showGate = showGate; ui.closeSheet = () => closeSheet(); ui.seedTasks = seedTasks;
  boot.run = runBoot;
  if (location.hash.startsWith('#join=')) history.replaceState(null, '', location.pathname + location.search);
  if (cloudReady()) {
    // Accounts are on: sign-in comes first, before anything else
    if (!Auth.user() || (L.auth && L.auth.expired)) { if (L.auth && L.auth.expired) { L.auth = null; save(); } showGate(L.lastUid ? 'signin' : 'welcome'); }
    else if (!L.auth!.username) { runBoot(); showGate('username'); }
    else runBoot();
  } else if (!L.onboarded) showOnboarding();
  else runBoot();
}

function useGlobalEvents() {
  useEffect(() => {
    // Back (browser button, Android gesture, iPhone edge swipe): exactly one thing closes per Back
    const onPop = (e: PopStateEvent) => {
      if (Nav.ignoreNextPop) { Nav.ignoreNextPop = false; return; } // removing our own history entry
      if (Sheet.ignorePop) { Sheet.ignorePop = false; return; }
      if (sheetOpen()) { closeSheet({ history: false }); return; } // that Back used the sheet's own entry
      // a photo, menu, timer or effects picker on top: close just that (the Back used the screen's entry: re-arm it)
      const overlay = PhotoView.close || menuOpen() || focusOpen.get() || fxPickerOpen();
      if (overlay) {
        if (PhotoView.close) PhotoView.close(); else if (menuOpen()) closeMenu(); else if (focusOpen.get()) closeFocus(); else fxPickerStore.set(null);
        Nav.trap = false; if (depth() > 1) armTrap();
        return;
      }
      onHistoryBack(e);
    };
    const onKey = (e: KeyboardEvent) => {
      const tag = ((e.target as HTMLElement).tagName || '').toLowerCase(), typing = ['input', 'textarea', 'select'].includes(tag);
      if (e.key === 'Escape') {
        if (alertOpen()) return;
        if (menuOpen()) return closeMenu();
        if (fxPickerOpen()) return;
        if (PhotoView.close) return PhotoView.close();
        if (focusOpen.get()) return closeFocus();
        if (sheetOpen()) return closeSheet();
        if (typing) return (e.target as HTMLElement).blur();
        return popView();
      }
      if (!L.onboarded) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!sheetOpen()) openSearch(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === 'n' || e.key === '/') && !sheetOpen() && topSpec().type !== 'search') {
        if (topSpec().type === 'home' && boardHome()) { e.preventDefault(); openBoardAdd(); return; } // on the board the task box comes up first
        const ta = document.getElementById('cta') as HTMLTextAreaElement | null;
        if (ta && !document.getElementById('composer')!.classList.contains('hide')) { e.preventDefault(); ta.focus(); }
      }
    };
    addEventListener('popstate', onPop);
    document.addEventListener('keydown', onKey);
    // Keep "today" fresh across midnight and long sessions; check in-app reminders; run the focus timer
    let lastKey = todayStr() + new Date().getHours();
    const t1 = setInterval(() => {
      checkReminders();
      const k = todayStr() + new Date().getHours();
      if (k !== lastKey) { lastKey = k; scheduleRender(); }
    }, 20000);
    const t2 = setInterval(focusTick, 500);
    const vis = () => { if (!document.hidden && L.onboarded) { scheduleRender(); checkReminders(); } };
    document.addEventListener('visibilitychange', vis);
    return () => { removeEventListener('popstate', onPop); document.removeEventListener('keydown', onKey); clearInterval(t1); clearInterval(t2); document.removeEventListener('visibilitychange', vis); };
  }, []);
}

function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator) || !/^https?:/.test(location.protocol)) return;
    // A new version waits until you tap "Update" or reopen the app (src/ui/update.ts): the app never reloads by itself
    navigator.serviceWorker.register(asset('sw.js'), { scope: asset(''), updateViaCache: 'none' }).then(watchUpdates).catch(err => console.warn('sw', err));
    const msg = (e: MessageEvent) => {
      const d = e.data as { open?: string } | null;
      if (d && d.open === 'chat' && Auth.user()) ChatCtl.open();
    };
    navigator.serviceWorker.addEventListener('message', msg);
    return () => navigator.serviceWorker.removeEventListener('message', msg);
  }, []);
}

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => { try { init(); } finally { setReady(true); hideSplash(); } }, []);
  useKeyboard();
  useGlobalEvents();
  useServiceWorker();
  useApp();
  const gate = useStore(gateStore), adding = useStore(boardAdd);
  useStore(navState);
  if (!ready) return null;
  const top = topSpec(), noEntries = !navState.get().entries.length;
  // the task box belongs to the to-do screens; on the board it comes up when you tap "Add a to-do"; the chat has its own
  const composerHidden = noEntries || !L.onboarded || top.type === 'search' || top.type === 'tips' || top.type === 'chat' || (top.type === 'home' && boardHome() && !adding)
    || (top.type === 'list' && vaultBlocks(top.id));
  return (<>
    <div id="app"><NavStack /><Composer hidden={composerHidden} /></div>
    <SheetHost />
    <MenuHost />
    <IslandHost />
    <FocusOverlay />
    <input type="file" id="importFile" accept="application/json,.json" hidden onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) void importBackup(f); }} />
    <AlertHost />
    <PhotoViewer />
    <FxPicker />
    <LoveYou />
    {gate ? (gate.kind === 'gate' ? <Gate key={gate.seq} first={gate.first} /> : <Onboarding key={gate.seq} />) : null}
  </>);
}
