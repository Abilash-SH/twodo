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
import { Nav, bootNav, depth, doPop, navState, openSearch, popView, topSpec } from '@/ui/nav';
import { PhotoView } from '@/ui/photos';
import { checkReminders } from '@/ui/reminders';
import { seedTasks } from '@/ui/seed';
import { Sheet, closeSheet, sheetOpen } from '@/ui/sheet';
import { useStore } from '@/ui/store';
import { ChatCtl } from './chat/chatCtl';
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
    const onPop = (e: PopStateEvent) => {
      if (Nav.ignorePops > 0) { Nav.ignorePops--; const f = Nav.afterPop; Nav.afterPop = null; if (f) f(); return; } // we already animated this one
      PhotoView.close?.();
      if (Sheet.ignorePop) { Sheet.ignorePop = false; return; }
      if (sheetOpen()) { closeSheet({ history: false }); return; }
      closeMenu();
      const d = (e.state && e.state.d) || 1;
      if (d > depth()) { history.replaceState({ d: depth() }, ''); return; } // no "forward"
      // the iPhone's own edge swipe already animated the page away: switch without a second animation
      const instant = !!(e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition || performance.now() - Nav.edgeCancelAt < 2500;
      while (depth() > Math.max(1, d)) doPop({ instant });
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
    let reg: ServiceWorkerRegistration | null = null;
    const vis = () => { if (!document.hidden) reg?.update().catch(() => {}); }; // look for a new version whenever the app comes back to the screen
    navigator.serviceWorker.register(asset('sw.js'), { scope: asset(''), updateViaCache: 'none' }).then(r => { reg = r; document.addEventListener('visibilitychange', vis); })
      .catch(err => console.warn('sw', err));
    const msg = (e: MessageEvent) => {
      const d = e.data as { open?: string; reload?: string } | null;
      if (d && d.open === 'chat' && Auth.user()) ChatCtl.open();
      if (d && typeof d.reload === 'string' && !sessionStorage.getItem('twodo:reloaded:' + d.reload)) {
        sessionStorage.setItem('twodo:reloaded:' + d.reload, '1'); location.reload(); // a new version just took over
      }
    };
    navigator.serviceWorker.addEventListener('message', msg);
    return () => { navigator.serviceWorker.removeEventListener('message', msg); document.removeEventListener('visibilitychange', vis); };
  }, []);
}

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => { try { init(); } finally { setReady(true); hideSplash(); } }, []);
  useKeyboard();
  useGlobalEvents();
  useServiceWorker();
  useApp();
  const gate = useStore(gateStore);
  useStore(navState);
  if (!ready) return null;
  const top = topSpec(), noEntries = !navState.get().entries.length;
  const composerHidden = noEntries || !L.onboarded || top.type === 'search' || top.type === 'tips' || (top.type === 'home' && cloudReady() && !!Auth.user())
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
