'use client';
/* Twodo · the screen stack: Home underneath, every opened screen sliding in on top (with swipe back) */
import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { Chat } from '@/lib/chat';
import { useApp } from '@/hooks/useApp';
import { Gesture, closeOpenRow, useStackGestures } from '@/hooks/useStackGestures';
import { Nav, homeIsChat, navState, popView, viewTitle, type Entry } from '@/ui/nav';
import { useStore } from '@/ui/store';
import { toggleDone, togglePin, deleteTask } from '@/ui/tasks';
import { ChatView } from '../chat/ChatView';
import { openTaskSheet } from '../sheets/TaskSheet';
import { openSettings } from '../settings/Settings';
import { Icon } from '../ui/Icon';
import { HubView } from '../views/HubView';
import { SearchView } from '../views/SearchView';
import { TaskListView } from '../views/TaskListView';
import { TipsView } from '../views/TipsView';
import { openViewMenu } from '../views/taskMenus';
import { vaultBlocks } from '../vault/VaultUI';

export const NavFx = { lastAction: 'boot' as 'boot' | 'push' | 'pop' };

function ChatBadge() {
  const n = Chat.ready() ? Chat.unread() : 0;
  return <span className="chat-badge" hidden={!n}>{n > 9 ? '9+' : String(n || '')}</span>;
}

function PageView({ entry, prev, cls }: { entry: Entry; prev: Entry | null; cls: string }) {
  const spec = entry.spec, ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false), [q, setQ] = useState('');
  const isSearch = spec.type === 'search';
  let left: React.ReactNode = null, right: React.ReactNode = null, body: React.ReactNode;
  if (prev) {
    const backTo = prev.spec.type !== 'home' ? viewTitle(prev.spec) : homeIsChat() ? <>Chat<ChatBadge /></> : 'To-dos';
    left = <button className="nav-btn back" type="button" onClick={() => popView()}><Icon name="chevL" /><span>{backTo}</span></button>;
  }
  if (spec.type === 'home' || spec.type === 'todos') {
    if (spec.type === 'home') left = <button className="nav-btn" type="button" aria-label="Settings" onClick={() => openSettings()}><Icon name="gear" /></button>;
    body = <HubView />;
  } else if (spec.type === 'tips') body = <TipsView viewRef={ref} />;
  else if (isSearch) body = <SearchView q={q} setQ={setQ} />;
  else {
    right = spec.type === 'list' && vaultBlocks(spec.id) ? null // nothing to edit while it's locked
      : <button className="nav-btn" type="button" aria-label="More options" onClick={e => openViewMenu(e.currentTarget, spec)}><Icon name="more" /></button>;
    body = <TaskListView spec={spec} />;
  }
  return (
    <section ref={ref} className={cls} data-vid={entry.id} onScroll={() => { const s = (ref.current?.scrollTop || 0) > 34; if (s !== scrolled) setScrolled(s); }}>
      <header className={`nav${scrolled || isSearch ? ' scrolled' : ''}`}>
        {isSearch ? (<>
          <div className="nav-side l" style={{ flex: 1 }}><div className="searchbar" style={{ margin: '0 4px 0 8px', width: '100%' }}><Icon name="search" />
            <input className="inp" id="q" type="search" placeholder="Tasks, notes, #tags" enterKeyHint="search" autoComplete="off" value={q} onChange={e => setQ(e.target.value)} maxLength={200} /></div></div>
          <div className="nav-title" style={{ display: 'none' }}>Search</div>
          <div className="nav-side r"><button className="nav-btn" type="button" onClick={() => popView()}>Cancel</button></div>
        </>) : (<>
          <div className="nav-side l">{left}</div><div className="nav-title">{viewTitle(spec)}</div><div className="nav-side r">{right}</div>
        </>)}
      </header>
      <div className="vbody">{body}</div>
    </section>
  );
}

export function NavStack() {
  useApp();
  const { entries } = useStore(navState);
  const ref = useRef<HTMLDivElement>(null), shadeRef = useRef<HTMLDivElement>(null);
  useStackGestures(ref);
  const live = entries.filter(e => e.phase !== 'out');
  const top = entries[entries.length - 1];

  // Screens slide in: render off to the right, let the browser see that, then move into place (CSS transition).
  useLayoutEffect(() => {
    const st = ref.current; if (!st) return;
    const ins = entries.filter(e => e.phase === 'in');
    // One entrance budget per screen, including nested cells: never animate a group and its children.
    st.querySelectorAll<HTMLElement>('.view.enter:not([data-motion-budget])').forEach(view => {
      view.dataset.motionBudget = 'true';
      Array.from(view.querySelectorAll<HTMLElement>('.hub-card, .task, .cell, .hub-done')).slice(0, 6).forEach((item, i) => {
        item.classList.add('entrance-item'); item.style.setProperty('--entrance-delay', `${i * 35}ms`);
      });
    });
    if (ins.length) {
      void st.offsetWidth;
      NavFx.lastAction = 'push';
      navState.set(s => ({ entries: s.entries.map(e => (e.phase === 'in' ? { ...e, phase: 'idle' } : e)) }));
    }
    if (Nav.noAnim.size) { // an instant switch (the phone already animated it): no transition this time
      Nav.noAnim.forEach(id => { const el = st.querySelector<HTMLElement>(`:scope > [data-vid="${id}"]`); if (el) { el.style.transition = 'none'; void el.offsetWidth; el.style.transition = ''; } });
      Nav.noAnim.clear();
    }
    const sh = shadeRef.current;
    if (sh) {
      const want = top && top.phase === 'out' ? 0 : 0.12;
      if (sh.dataset.for !== String(top && top.id)) { // the shade just moved under a new top screen
        sh.dataset.for = String(top && top.id);
        if (NavFx.lastAction === 'push' && top && top.phase !== 'idle') { sh.style.transition = 'none'; sh.style.opacity = '0'; void sh.offsetWidth; sh.style.transition = ''; }
        else { sh.style.transition = 'none'; sh.style.opacity = String(want); void sh.offsetWidth; sh.style.transition = ''; }
      }
      sh.style.opacity = String(want);
    }
    if (Gesture.openRow && !Gesture.openRow.isConnected) Gesture.openRow = null;
  });
  if (top && top.phase === 'out') NavFx.lastAction = 'pop';

  return (
    <div id="stack" ref={ref}
      onClickCapture={e => { if (performance.now() < Gesture.suppressClickUntil) { e.preventDefault(); e.stopPropagation(); } }}
      onClick={e => {
        const t = e.target as HTMLElement;
        const act = t.closest<HTMLElement>('.act-r button');
        if (act) {
          const id = act.closest<HTMLElement>('.task')!.dataset.id!;
          if (act.dataset.act === 'pin') { closeOpenRow(); togglePin(id); } else { Gesture.openRow = null; deleteTask(id); }
          return;
        }
        const row = t.closest<HTMLElement>('.task'); if (!row || !row.closest('#stack')) return;
        if (Gesture.openRow) { closeOpenRow(); return; }
        if (t.closest('.chk')) return toggleDone(row.dataset.id!);
        openTaskSheet(row.dataset.id!);
      }}>
      {entries.map((e, i) => {
        const liveIdx = live.indexOf(e), isTopLive = liveIdx === live.length - 1;
        const cls = ['view', i > 0 ? 'pushed' : '', e.phase !== 'idle' ? 'offright' : '', liveIdx >= 0 && !isTopLive ? 'under' : '', Nav.entering.has(e.id) ? 'enter' : ''].filter(Boolean).join(' ');
        const prev = liveIdx > 0 ? live[liveIdx - 1] : e.phase === 'out' && live.length ? live[live.length - 1] : null;
        const showShade = entries.length > 1 && e === top;
        const view = e.spec.type === 'home' && homeIsChat() ? <ChatView entry={e} cls={cls} /> : <PageView entry={e} prev={prev} cls={cls} />;
        return (
          <Fragment key={e.id}>
            {showShade ? <div ref={shadeRef} className="shade" /> : null}
            {view}
          </Fragment>
        );
      })}
    </div>
  );
}
