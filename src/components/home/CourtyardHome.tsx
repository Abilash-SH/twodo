'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { avatarOf } from '@/lib/characters';
import { Avatars } from '@/lib/avatar3d';
import { PEOPLE, exploreModels, modelUrl, personFor } from '@/lib/people';
import { L, SMART, liveTasks, partnerKey, person, sortTasks } from '@/lib/store';
import { Sync } from '@/lib/sync';
import { Moments } from '@/lib/moments';
import { firstWord } from '@/lib/util';
import { joinWorld, type Connection } from '@/lib/courtyard/presence';
import { GESTURES, type WorldGesture } from '@/lib/courtyard/state';
import type { SceneReport, WorldScene } from '@/lib/courtyard/scene';
import { boardAdd, navState, openJournal } from '@/ui/nav';
import { alertStore } from '@/ui/alert';
import { gateStore } from '@/ui/gate';
import { focusOpen } from '@/ui/island';
import { photoStore } from '@/ui/photos';
import { openSheet, sheetStore } from '@/ui/sheet';
import { useStore } from '@/ui/store';
import { toggleDone } from '@/ui/tasks';
import { useApp } from '@/hooks/useApp';
import { atBackEdge } from '@/hooks/useStackGestures';
import { ChatCtl } from '../chat/chatCtl';
import { openInviteSheet } from '../settings/AccountSheets';
import { Icon } from '../ui/Icon';
import { openMoments, pickMoment } from './Moments';

const INITIAL: SceneReport = { near: null, area: 'garden', portrait: false, sitting: false, canSit: false, ready: false, partnerReady: false };
const PLACES = { garden: 'Neon Plaza', villa: 'Loft', garage: 'Garage' } as const;
const REACTIONS = { wave: 'Wave', clap: 'Clap', cheer: 'Cheer' } as const;
const NEAR_LABELS = { tasks: 'Task patch', workbench: 'Use workbench', moments: 'Open Moments', journal: 'Open journal', partner: 'Open chat' } as const;
/** Who lives in the city: people the two of you didn't pick, in this order (a dancer, a photographer, a fan). */
const RESIDENTS = ['f13', 'm12', 'f11', 'm06', 'f05', 'm08'];
const clock = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function TaskPatch() {
  useApp();
  const tasks = sortTasks(liveTasks().filter(task => SMART.today.match(task) && (
    task.assignee === L.me || task.assignee === 'both' || (!task.assignee && task.createdBy !== partnerKey())
  ))).slice(0, 3);
  if (!tasks.length) return <p className="world-task-empty">Nothing to tick off today.</p>;
  return <ul className="world-task-patch">{tasks.map(task => <li key={task.id}>
    <label><input type="checkbox" checked={task.done} onChange={() => toggleDone(task.id, { instant: true })} /><span>{task.title}</span></label>
  </li>)}</ul>;
}
const openTaskPatch = () => openSheet({ title: 'Task patch', right: 'Done', body: <TaskPatch /> });

export function CourtyardHome({ leave, v }: { leave(): void; v: number }) {
  void v;
  const box = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), stick = useRef<HTMLButtonElement>(null), knob = useRef<HTMLSpanElement>(null);
  const plate = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(clock);
  const world = useRef<WorldScene | null>(null);
  const liveWorld = useRef<ReturnType<typeof joinWorld> | null>(null);
  const [report, setReport] = useState(INITIAL), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<Connection>('connecting'), [here, setHere] = useState(false);
  const [reactions, showReactions] = useState(false);
  const [reaction, setReaction] = useState<WorldGesture | null>(null);
  const entries = useStore(navState).entries, sheets = useStore(sheetStore), adding = useStore(boardAdd);
  const alerts = useStore(alertStore), viewingPhoto = useStore(photoStore), timer = useStore(focusOpen), gate = useStore(gateStore);
  const [visible, setVisible] = useState(true), [inViewport, setInViewport] = useState(true), [keyboard, setKeyboard] = useState(false);
  const covered = entries.length > 1 || sheets.length > 0 || adding || alerts.length > 0 || !!viewingPhoto || timer || !!gate;
  const active = !covered && visible && inViewport && !keyboard && !failed;
  const activity = useRef(active); activity.current = active;
  const me = L.me, pk = partnerKey(), paired = L.pair?.status === 'paired', name = firstWord(person(pk).name) || 'Your partner';
  const mine = avatarOf(me), theirs = avatarOf(pk);
  const myPerson = personFor(mine), theirPerson = personFor(theirs);
  const myUrl = Avatars.url[me], theirUrl = Avatars.url[pk];
  const canvasKey = `${attempt}:${me}:${myPerson.id}:${theirPerson.id}:${myUrl}:${theirUrl}`;
  const key = Sync.key, space = Sync.space, uid = L.auth?.uid, peer = L.pair?.uid;
  const myPhoto = paired ? Moments.of(me)?.img || null : null, theirPhoto = paired ? Moments.of(pk)?.img || null : null;
  const residents = useMemo(() => RESIDENTS.map(id => PEOPLE.find(p => p.id === id)!)
    .filter(p => p && p.id !== myPerson.id && p.id !== theirPerson.id).slice(0, 3)
    .map(p => ({ url: modelUrl(p), gender: p.look === 'male' ? 'm' as const : 'f' as const })), [myPerson.id, theirPerson.id]);
  useEffect(() => { const t = setInterval(() => setTime(clock()), 20000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const b = box.current, cv = canvas.current; if (!b || !cv) return;
    let gone = false, starting = false, failedToLoad = false, resizeFrame = 0, width = 0, height = 0;
    setFailed(false); setReport(INITIAL);
    const fail = () => {
      if (gone || failedToLoad) return;
      failedToLoad = true;
      world.current?.destroy(); world.current = null; setFailed(true); setHere(false);
    };
    const timeout = setTimeout(() => { if (!world.current || cv.dataset.ready !== 'yes') fail(); }, 30000);
    const resized = () => {
      resizeFrame = 0;
      if (gone || failedToLoad || !width || !height) return;
      if (world.current) { world.current.resize(width, height); return; }
      if (starting) return; starting = true;
      import('@/lib/courtyard/scene').then(m => {
        if (gone || failedToLoad) return;
        const handle = m.mountWorld(cv, width, height, {
          slot: me === 'a' ? 0 : 1,
          me: { urls: exploreModels(myPerson, myUrl), gender: myPerson.look === 'male' ? 'm' : 'f' },
          partner: { urls: exploreModels(theirPerson, theirUrl), gender: theirPerson.look === 'male' ? 'm' : 'f' },
          report(r) { if (!gone) { cv.dataset.ready = r.ready ? 'yes' : 'no'; setReport(r); if (r.ready) clearTimeout(timeout); } }, failure: fail,
          labels: [null, plate.current], residents,
        });
        world.current = handle; handle.active(activity.current);
      }).catch(fail);
    };
    const ro = new ResizeObserver(es => {
      const r = es[es.length - 1].contentRect; width = r.width; height = r.height;
      // Never resize a canvas inside ResizeObserver delivery: leave the layout cycle first.
      if (!resizeFrame) resizeFrame = requestAnimationFrame(resized);
    }); ro.observe(b);
    return () => { gone = true; clearTimeout(timeout); cancelAnimationFrame(resizeFrame); ro.disconnect(); world.current?.destroy(); world.current = null; delete cv.dataset.ready; };
  }, [canvasKey, myUrl, theirUrl, myPerson, theirPerson, me, residents]);
  useEffect(() => { world.current?.active(active); }, [active, report.ready]);
  useEffect(() => {
    if (!reaction) return;
    const timeout = setTimeout(() => setReaction(null), 1500);
    return () => clearTimeout(timeout);
  }, [reaction]);
  useEffect(() => { if (!active) showReactions(false); }, [active]);
  useEffect(() => { world.current?.photos([myPhoto, theirPhoto]); }, [myPhoto, theirPhoto, report.ready]);
  useEffect(() => {
    const b = box.current; if (!b) return;
    const io = new IntersectionObserver(es => setInViewport(es[es.length - 1].isIntersecting)); io.observe(b);
    const visibility = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', visibility); visibility();
    const mo = new MutationObserver(() => setKeyboard(document.body.classList.contains('kb'))); mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => { io.disconnect(); mo.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    const w = world.current;
    if (!active || !report.ready || !w || !paired || !key || !space || !uid || !peer) { setHere(false); return; }
    const session = joinWorld({ space, uid, peer, key, pose: () => w.pose(), partner: p => { w.peer(p); setHere(!!p); }, status: setConnection });
    liveWorld.current = session;
    return () => { liveWorld.current = null; session.close(); };
  }, [active, report.ready, paired, key, space, uid, peer]);

  useEffect(() => {
    const b = box.current, s = stick.current, k = knob.current; if (!b || !s || !k) return;
    let lookId: number | null = null, moveId: number | null = null, lastX = 0, lastY = 0, centreX = 0, centreY = 0, mouseLook = false, mouseMove = false, touchAt = -1e9;
    const keys = new Set<string>();
    const centre = () => { const r = s.getBoundingClientRect(); centreX = r.left + r.width / 2; centreY = r.top + r.height / 2; };
    const move = (x: number, y: number) => { const dx = x - centreX, dy = y - centreY, distance = Math.hypot(dx, dy), limit = 35, f = Math.min(1, limit / Math.max(1, distance)); k.style.transform = `translate3d(${dx * f}px,${dy * f}px,0)`; world.current?.input(dx * f / limit, dy * f / limit); };
    const releaseMove = () => { moveId = null; mouseMove = false; k.style.transform = ''; world.current?.input(0, 0); };
    const reset = () => { releaseMove(); lookId = null; mouseLook = false; keys.clear(); };
    const start = (e: TouchEvent) => {
      touchAt = e.timeStamp; if (!activity.current) return;
      for (const touch of Array.from(e.changedTouches)) {
        if ((e.target as Element).closest('.world-stick')) { if (moveId !== null) continue; centre(); moveId = touch.identifier; move(touch.clientX, touch.clientY); if (e.cancelable) e.preventDefault(); }
        else if (!(e.target as Element).closest('button,select') && lookId === null && touch.clientX > 32 && !atBackEdge(touch.clientX)) { lookId = touch.identifier; lastX = touch.clientX; lastY = touch.clientY; }
      }
    };
    const follow = (e: TouchEvent) => { if (!activity.current) { reset(); return; }
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === moveId) { move(touch.clientX, touch.clientY); if (e.cancelable) e.preventDefault(); }
        if (touch.identifier === lookId) { world.current?.look(touch.clientX - lastX, touch.clientY - lastY); lastX = touch.clientX; lastY = touch.clientY; if (e.cancelable) e.preventDefault(); }
      }
    };
    const end = (e: TouchEvent) => { touchAt = e.timeStamp; for (const touch of Array.from(e.changedTouches)) { if (touch.identifier === moveId) releaseMove(); if (touch.identifier === lookId) lookId = null; } };
    const mm = (e: MouseEvent) => { if (!activity.current) return; if (mouseMove) move(e.clientX, e.clientY); if (mouseLook) { world.current?.look(e.clientX - lastX, e.clientY - lastY); lastX = e.clientX; lastY = e.clientY; } };
    const md = (e: MouseEvent) => { if (!activity.current || e.button !== 0 || e.timeStamp - touchAt < 900) return;
      if ((e.target as Element).closest('.world-stick')) { centre(); mouseMove = true; move(e.clientX, e.clientY); }
      else if (!(e.target as Element).closest('button,select') && !atBackEdge(e.clientX)) { mouseLook = true; lastX = e.clientX; lastY = e.clientY; }
      if (mouseMove || mouseLook) e.preventDefault();
    };
    const map: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    const keyInput = () => world.current?.input(Number(keys.has('right')) - Number(keys.has('left')), Number(keys.has('down')) - Number(keys.has('up')));
    const kd = (e: KeyboardEvent) => { if (!activity.current || !map[e.key] || (e.target as Element).matches('input,textarea,select,[contenteditable]') || !(e.target as Element).closest('.world-home')) return; e.preventDefault(); e.stopPropagation(); keys.add(map[e.key]); keyInput(); };
    const ku = (e: KeyboardEvent) => { if (map[e.key]) { keys.delete(map[e.key]); keyInput(); } };
    const visibility = () => { if (document.hidden) reset(); };
    const focusOut = (e: FocusEvent) => { if (!b.contains(e.relatedTarget as Node | null)) { keys.clear(); if (moveId === null && !mouseMove) world.current?.input(0, 0); } };
    b.addEventListener('touchstart', start, { passive: false }); b.addEventListener('touchmove', follow, { passive: false }); b.addEventListener('touchend', end); b.addEventListener('touchcancel', reset); b.addEventListener('mousedown', md);
    addEventListener('mousemove', mm); addEventListener('mouseup', reset); addEventListener('touchend', end); addEventListener('touchcancel', reset); addEventListener('blur', reset); b.addEventListener('keydown', kd); addEventListener('keyup', ku); b.addEventListener('focusout', focusOut); document.addEventListener('visibilitychange', visibility);
    return () => { reset(); b.removeEventListener('touchstart', start); b.removeEventListener('touchmove', follow); b.removeEventListener('touchend', end); b.removeEventListener('touchcancel', reset); b.removeEventListener('mousedown', md); removeEventListener('mousemove', mm); removeEventListener('mouseup', reset); removeEventListener('touchend', end); removeEventListener('touchcancel', reset); removeEventListener('blur', reset); b.removeEventListener('keydown', kd); removeEventListener('keyup', ku); b.removeEventListener('focusout', focusOut); document.removeEventListener('visibilitychange', visibility); };
  }, [report.ready, failed, active]);

  const toChat = () => paired ? ChatCtl.open() : openInviteSheet();
  const openNear = () => {
    if (report.near === 'tasks' || report.near === 'workbench') openTaskPatch();
    else if (report.near === 'moments') paired ? openMoments() : openInviteSheet();
    else if (report.near === 'journal') openJournal();
    else toChat();
  };
  const status = !paired ? 'Add your partner to meet here' : !active ? 'Paused' : connection === 'unavailable' ? 'Live movement unavailable' : connection === 'offline' ? 'Offline · resting together' : connection === 'connecting' ? 'Connecting · resting avatar' : here ? `${name} is here` : `${name} is resting`;
  const plateLine = !paired ? 'Not here yet' : here && active ? 'Here now' : 'Resting on the bench';
  return (
    <main className="world-home" aria-label="Neon city, 3D Explore preview">
      <div className="world-toolbar"><button type="button" onClick={leave}>Leave preview</button><span role="status" data-presence={here && active ? 'live' : 'resting'}>{status}</span></div>
      <div className="world-stage no-pan" ref={box}>
        <canvas key={canvasKey} ref={canvas} className="world-canvas" aria-hidden="true" />
        <div className="world-plate" ref={plate} aria-hidden="true" data-live={here && active ? 'yes' : 'no'}>
          <div className="world-plate-in"><b>{paired ? name : 'Your partner'}</b><span>{plateLine}</span><i /></div>
        </div>
        {!report.ready || failed ? <div className="world-fallback" role="status"><b>{failed ? 'Our place couldn’t load' : 'Preparing our place…'}</b><span>{failed ? 'Your to-dos, journal and chat are still available below.' : 'Your controls are ready while the world loads.'}</span>{failed ? <button type="button" onClick={() => setAttempt(n => n + 1)}>Try 3D again</button> : null}</div> : null}
        {report.ready && !failed ? <>
          <div className="world-hint"><small>Neo Twodo</small><b>{PLACES[report.area]}</b><span><time>{time}</time> · drag to look</span></div>
          <div className="world-travel">
            <button type="button" className="world-find" onClick={() => world.current?.find()} aria-label={`Find ${name}`}>Find {name}</button>
            <button type="button" className="world-bench" onClick={() => world.current?.bench()}>Bench</button>
            <select className="world-destination" aria-label="Walk to" value="" onChange={event => {
              const name = event.currentTarget.value;
              if (name === 'villa' || name === 'garage' || name === 'garden') world.current?.visit(name);
            }}>
              <option value="" disabled>Walk to</option>
              {Object.entries(PLACES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            {reactions ? <div className="world-reactions" role="group" aria-label="Avatar reactions">
              {GESTURES.map(gesture => <button type="button" key={gesture} onClick={() => {
                world.current?.react(gesture); liveWorld.current?.publish(); setReaction(gesture); showReactions(false);
              }}>{REACTIONS[gesture]}</button>)}
            </div> : null}
          </div>
          <button type="button" className="world-stick" ref={stick} aria-label="Walk: drag this control, or focus it and use arrow keys or W A S D"><span className="world-stick-base" aria-hidden="true" /><span className="world-stick-knob" ref={knob} aria-hidden="true"><Icon name="arrowUp" /></span></button>
          <div className="world-interactions">
            <button type="button" onClick={() => world.current?.viewAvatar()} aria-pressed={report.portrait}>{report.portrait ? 'Back to explore' : 'View avatar'}</button>
            <button type="button" onClick={() => showReactions(v => !v)} aria-expanded={reactions}>React</button>
            {report.canSit || report.sitting ? <button type="button" onClick={() => world.current?.sit()}>{report.sitting ? 'Stand up' : 'Sit together'}</button> : null}
            {report.near ? <button type="button" onClick={openNear}>{NEAR_LABELS[report.near]}</button> : null}
          </div>
          <span className="world-reaction-status" role="status" hidden={!reaction}>{reaction ? REACTIONS[reaction] : ''}</span>
        </> : null}
      </div>
      <div className="world-doors" aria-label="Open without walking">
        <button type="button" onClick={openTaskPatch}>Task patch</button>
        <button type="button" onClick={() => paired ? openMoments() : openInviteSheet()}>Moments</button>
        <button type="button" aria-label="Take a photo" onClick={() => pickMoment(true)}><Icon name="camera" /></button>
        <button type="button" aria-label="Choose a photo" onClick={() => pickMoment(false)}><Icon name="images" /></button>
      </div>
    </main>
  );
}
