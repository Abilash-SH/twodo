'use client';
/* Twodo · the task composer: type naturally, see what it understood (chips), tap pills to add details, send */
import { useEffect, useRef, useState } from 'react';
import { takeDraft } from '@/ui/update';
import { blip, haptic } from '@/lib/feedback';
import { KIND_LABEL, parseTask, type ChipKind } from '@/lib/parse';
import { renderNow, scheduleRender } from '@/lib/render';
import { D, L, commit, firstName, fmtDue, listOf, lists, makeTask, partnerKey, ptName } from '@/lib/store';
import type { Task } from '@/lib/types';
import { addDays, firstWord, reducedMotion, todayStr, ymd } from '@/lib/util';
import { useApp } from '@/hooks/useApp';
import { useTapKeep, useTapKeepWithin } from '@/hooks/useTapKeep';
import { closeOpenRow } from '@/hooks/useStackGestures';
import { island } from '@/ui/island';
import { showMenu } from '@/ui/menu';
import { composerState, specKey, topSpec, viewPrefs } from '@/ui/nav';
import { Fresh } from '@/ui/tasks';
import { useStore } from '@/ui/store';
import { Avatar, colorVar, cssVars } from '../ui/Avatar';
import { Icon } from '../ui/Icon';

interface Ctx { listId: string; due: string | null; assignee: Task['assignee']; pinned: boolean; label: string; color: string }
function composerCtx(): Ctx {
  const spec = topSpec(), pickId = composerState.get().listPick;
  const inbox = D.lists.inbox || { emoji: '📥', name: 'Inbox', color: 'blue' };
  const ctx: Ctx = { listId: 'inbox', due: null, assignee: null, pinned: false, label: `${inbox.emoji} ${inbox.name}`, color: inbox.color };
  const pick = pickId && D.lists[pickId] && !D.lists[pickId].deleted ? D.lists[pickId] : null;
  if (pick) Object.assign(ctx, { listId: pick.id, label: `${pick.emoji} ${pick.name}${pick.private ? ' · secret' : ''}`, color: pick.color });
  else if (spec.type === 'list') {
    const l = D.lists[spec.id!]; if (l) Object.assign(ctx, { listId: l.id, label: `${l.emoji} ${l.name}${l.private ? ' · secret' : ''}`, color: l.color });
  }
  if (spec.type === 'smart') {
    const extra = ({ today: ['due', todayStr(), 'Today'], upcoming: ['due', ymd(addDays(new Date(), 1)), 'Tomorrow'], pinned: ['pinned', true, 'Pinned'], us: ['assignee', 'both', 'For both of you'] } as Record<string, [keyof Ctx, string | boolean, string]>)[spec.key!];
    if (extra) { (ctx as unknown as Record<string, unknown>)[extra[0]] = extra[1]; ctx.label += ' · ' + extra[2]; }
  }
  if (spec.type !== 'home' && spec.type !== 'search' && !ctx.assignee) {
    const who = viewPrefs(specKey(spec)).who;
    if (who === 'me') ctx.assignee = L.me;
    else if (who === 'partner') { ctx.assignee = partnerKey(); ctx.label += ` · for ${firstWord(ptName())}`; }
    else if (who === 'both') { ctx.assignee = 'both'; ctx.label += ' · for both'; }
  }
  return ctx;
}

function Pills({ onPick }: { onPick: (kind: ChipKind, tok: string) => void }) {
  const pill = (kind: ChipKind, tok: string, label: string, icon: string, color: string) =>
    <button key={kind + tok} className="pill" type="button" style={colorVar(color)} onClick={() => onPick(kind, tok)}><Icon name={icon} />{label}</button>;
  const who = (tok: string, k: 'both' | 'a' | 'b', label: string) =>
    <button key={'w' + tok} className="pill" type="button" onClick={() => onPick('assignee', tok)}>{k === 'both' ? <span className="av-pair"><Avatar k="a" /><Avatar k="b" /></span> : <Avatar k={k} />}{label}</button>;
  const pt = firstName(partnerKey());
  return (<>
    {pill('due', 'today', 'Today', 'cal', 'blue')}{pill('due', 'tomorrow', 'Tomorrow', 'sunrise', 'orange')}
    {pill('due', 'tonight', 'Tonight', 'moon', 'indigo')}{pill('due', 'this weekend', 'Weekend', 'sofa', 'teal')}
    {pill('due', 'next week', 'Next week', 'calnext', 'purple')}
    {who('@us', 'both', 'Us')}{who('@' + pt.toLowerCase(), partnerKey(), pt)}{who('@me', L.me, 'Me')}
    {pill('priority', '!!!', 'High', 'flag', 'red')}{pill('priority', '!!', 'Medium', 'flag', 'orange')}
    {lists().filter(l => l.id !== 'inbox').slice(0, 6).map(l => <button key={'l' + l.id} className="pill" type="button" onClick={() => onPick('list', '#' + l.name.replace(/\s+/g, ''))}>{l.emoji} {l.name}</button>)}
    {pill('repeat', 'daily', 'Daily', 'repeat', 'gray')}{pill('repeat', 'every week', 'Weekly', 'repeat', 'gray')}
  </>);
}

const PLACEHOLDERS = (pt: string) => ['Add a task…', 'Try “Call mom tomorrow 6pm”', 'Try “Movie night fri 8pm @us !!”', 'Try “Milk #Groceries”',
  'Try “Gym every mon 7am”', `Try “Book flights @${pt.toLowerCase()} !!!”`, 'Paste a list: one task per line'];

/* Bring a new row into view by scrolling only its own list (scrollIntoView can also scroll the whole page on iPhone
   while the keyboard is up, which pushes the header out of view) */
function revealRow(row: Element) {
  const view = row.closest<HTMLElement>('.view'); if (!view) return;
  const r = row.getBoundingClientRect(), v = view.getBoundingClientRect();
  const bottom = v.bottom - (parseFloat(getComputedStyle(document.getElementById('app')!).getPropertyValue('--composer-h')) || 0) - 12;
  const top = v.top + 100; // below the header
  const by = r.bottom > bottom ? r.bottom - bottom : r.top < top ? r.top - top : 0;
  if (by) view.scrollBy({ top: by, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

export function Composer({ hidden }: { hidden: boolean }) {
  useApp();
  useStore(composerState);
  const el = useRef<HTMLDivElement>(null), ta = useRef<HTMLTextAreaElement>(null), send = useRef<HTMLButtonElement>(null), ctxRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(''), [focus, setFocus] = useState(false), [ignored, setIgnored] = useState<Set<string>>(new Set()), [ph, setPh] = useState(0);
  useEffect(() => { // what you were typing before an update is back in the box
    const draft = takeDraft('task');
    if (draft && ta.current && !ta.current.value) { ta.current.value = draft; setText(draft); }
  }, []);
  const blurT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  const parsed = lines.length === 1 ? parseTask(lines[0], ignored) : null;

  useEffect(() => { const t = ta.current!; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 168) + 'px'; }, [text]);
  useEffect(() => { // rotating placeholder that teaches the syntax
    const t = setInterval(() => { if (document.activeElement === ta.current || ta.current?.value) return; setPh(p => (p + 1) % 7); }, 4500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const ro = new ResizeObserver(() => document.getElementById('app')?.style.setProperty('--composer-h', (el.current?.offsetHeight || 0) + 'px'));
    if (el.current) ro.observe(el.current);
    return () => ro.disconnect();
  }, []);

  const insertToken = (kind: ChipKind, tok: string) => {
    const ls = ta.current!.value.split('\n');
    let last = ls.pop() || '';
    const p = parseTask(last, new Set());
    const rawOld = p.raw[kind];
    if (rawOld) { const i = last.toLowerCase().indexOf(rawOld.toLowerCase()); if (i >= 0) last = (last.slice(0, i) + last.slice(i + rawOld.length)).replace(/\s{2,}/g, ' '); }
    last = (last.trimEnd() + ' ' + tok + ' ').replace(/^\s+/, '');
    ls.push(last);
    const v = ls.join('\n');
    ta.current!.value = v; setText(v);
    setIgnored(s => { const n = new Set(s); n.delete(kind); return n; });
    ta.current!.focus(); ta.current!.setSelectionRange(v.length, v.length);
    haptic('light');
  };
  const submit = () => {
    const ls = ta.current!.value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!ls.length) return;
    const ctx = composerCtx(), created: Task[] = [];
    for (const line of ls) {
      const p = parseTask(line, ls.length === 1 ? ignored : new Set());
      const t = makeTask({
        title: p.title.slice(0, 2000), due: p.due || ctx.due, time: p.time, priority: p.priority || 0, tags: p.tags,
        listId: p.listId || ctx.listId, assignee: p.assignee || ctx.assignee, repeat: p.repeat, pinned: ctx.pinned,
      });
      Fresh.add(t.id); created.push(t);
    }
    ta.current!.value = ''; setText(''); setIgnored(new Set());
    haptic('light'); blip('add');
    renderNow();
    setTimeout(() => Fresh.clear(), 600);
    const last = created[created.length - 1];
    const row = document.querySelector(`#stack .view:not(.under):not(.offright) .task[data-id="${CSS.escape(last.id)}"]`);
    const undo = () => { created.forEach(t => { t.deleted = true; commit(t, { silent: true }); }); scheduleRender(); };
    if (row) {
      revealRow(row);
      if (created.length > 1) island({ e: '✨', text: `Added ${created.length} tasks`, btn: 'Undo', onBtn: undo });
    } else {
      const l = listOf(last);
      island({ e: '✨', text: created.length > 1 ? `Added ${created.length} tasks` : `Added to ${l.emoji} ${l.name}`,
        sub: created.length === 1 && (last.due || last.assignee) ? [last.due && fmtDue(last.due, last.time), last.assignee && (last.assignee === 'both' ? 'for both of you' : last.assignee === L.me ? 'for you' : 'for ' + ptName())].filter(Boolean).join(' · ') : '',
        btn: 'Undo', onBtn: undo });
    }
  };
  useTapKeep(send, () => submit(), ta);
  useTapKeepWithin(el, ta); // pills, chips, + and the list picker never close the keyboard
  const c = composerCtx();
  return (
    <div id="composer" ref={el} className={`${focus ? 'focus' : ''}${hidden ? ' hide' : ''}`.trim() || undefined}>
      <div className="pills" id="pills" aria-label="Quick tokens" onMouseDown={e => e.preventDefault()}>{focus ? <Pills onPick={insertToken} /> : null}</div>
      <div className="cbox">
        <div className="chips" id="chips" onMouseDown={e => e.preventDefault()}>
          {parsed ? (<>
            {parsed.chips.map((ch, i) => <button key={ch.kind + i} className="chip" type="button" data-k={ch.kind} style={colorVar(ch.color || 'gray')} title="Tap to ignore"
              onClick={() => { setIgnored(s => new Set(s).add(ch.kind)); haptic('light'); }}>{ch.icon ? <Icon name={ch.icon} /> : null}{ch.label}</button>)}
            {[...ignored].map(k => <button key={'off' + k} className="chip off" type="button" title="Tap to use again" onClick={() => { setIgnored(s => { const n = new Set(s); n.delete(k); return n; }); haptic('light'); }}>{KIND_LABEL[k as ChipKind]}</button>)}
          </>) : lines.length > 1 ? <span className="chip" style={cssVars({ '--c': 'var(--accent)' })}><Icon name="list" />{lines.length} tasks, one per line</span> : null}
        </div>
        <label htmlFor="cta" className="sr">Add a task</label>
        <textarea ref={ta} id="cta" rows={1} placeholder={PLACEHOLDERS(firstName(partnerKey()) || 'partner')[ph]} enterKeyHint="send" autoComplete="off" autoCapitalize="sentences" spellCheck maxLength={20000}
          onInput={e => { const v = e.currentTarget.value; setText(v); if (!v.trim()) setIgnored(new Set()); }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
          onFocus={() => { clearTimeout(blurT.current); setFocus(true); closeOpenRow(); }}
          onBlur={() => { blurT.current = setTimeout(() => { if (document.activeElement !== ta.current) setFocus(false); }, 150); }} />
        <div className="crow">
          <button className="cplus" id="cplus" type="button" aria-label="Show quick options" onMouseDown={e => e.preventDefault()}
            onClick={() => { if (focus) ta.current!.blur(); else ta.current!.focus(); }}><Icon name="plus" /></button>
          <div ref={ctxRef} className="cctx tw:cursor-pointer" id="cctx" role="button" tabIndex={0} onMouseDown={e => e.preventDefault()}
            onClick={() => {
              const cur = composerCtx().listId;
              showMenu({ rect: ctxRef.current!.getBoundingClientRect(), content: (<>
                <div className="mrow"><span className="lbl" style={{ width: 'auto' }}>Add new tasks to</span></div>
                {lists().map(l => <button key={l.id} className="mi" data-m="pick" data-v={l.id} type="button"><span>{l.emoji} {l.name}</span>{l.id === cur ? <Icon name="check" cls="ck" /> : null}</button>)}
              </>), onPick: (m, v) => { composerState.set({ listPick: v || null }); haptic('light'); } });
            }}>{c.label} <Icon name="chevD" cls="xs" /></div>
          <span className="chint">↵ add · ⇧↵ new line</span>
          <button ref={send} className={`csend${lines.length ? ' on' : ''}`} id="csend" type="button" aria-label="Add task"><Icon name="arrowUp" />{lines.length > 1 ? <span className="badge">{lines.length}</span> : null}</button>
        </div>
      </div>
    </div>
  );
}
