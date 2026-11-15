'use client';
/* Twodo · the journal: one thread for the two of you. Write something, post it; it goes to the top, for both of you.
   Your own posts have ⋯ to edit or delete them. That's all: no prompts, no weather, no tabs, no counts.
   Data: docs/journal-and-planner.md */
import { useEffect, useState } from 'react';
import { haptic } from '@/lib/feedback';
import { POST_MAX, addPost, deletePost, editPost, journalOpen, posts } from '@/lib/journal';
import { L, partnerKey, person } from '@/lib/store';
import type { JournalEntry } from '@/lib/types';
import { dayDiff, firstWord, todayStr, ymd } from '@/lib/util';
import { confirmDialog } from '@/ui/alert';
import { Avatar, colorVar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';

const FMT: Record<string, Intl.DateTimeFormat> = {};
const fmt = (k: string, o: Intl.DateTimeFormatOptions) => (FMT[k] ||= new Intl.DateTimeFormat([], o));
const time = (ts: number) => fmt('t', { hour: 'numeric', minute: '2-digit' }).format(new Date(ts));
/** the line between days: Today, Yesterday, the weekday for this week, else the date */
function dayLabel(day: string): string {
  const diff = dayDiff(todayStr(), day), d = new Date(`${day}T12:00`);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return fmt('wd', { weekday: 'long' }).format(d);
  return d.getFullYear() === new Date().getFullYear() ? fmt('dm', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
    : fmt('dmy', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}
const nameOf = (e: JournalEntry) => (e.who === L.me ? 'You' : firstWord(person(e.who).name));

/** what you are writing survives leaving the screen (in memory only, until the app closes) */
let draft = '';

/** The box at the top: write, then Post. It grows with the text in CSS (nothing measures layout). */
function Compose() {
  const [text, setText] = useState(draft);
  const post = () => {
    if (!addPost(text)) return;
    draft = ''; setText(''); haptic('success');
  };
  return (
    <div className="jt-compose" style={colorVar(person(L.me).color)}>
      <Avatar k={L.me} />
      <div className="jt-cbody">
        <div className="jt-grow" data-v={text}>
          <textarea className="jt-ta" rows={2} value={text} maxLength={POST_MAX} aria-label="Write a post"
            placeholder={`Write something for you and ${firstWord(person(partnerKey()).name)}…`}
            onChange={ev => { draft = ev.currentTarget.value; setText(draft); }} />
        </div>
        <div className="jt-cacts">
          <button className="jt-post-btn" type="button" disabled={!text.trim()} onClick={post}>Post</button>
        </div>
      </div>
    </div>
  );
}

/** One post. Yours: ⋯ → Edit or Delete. Your partner's: read only. */
function Post({ e }: { e: JournalEntry }) {
  const mine = e.who === L.me;
  const [menu, setMenu] = useState(false), [edit, setEdit] = useState<string | null>(null);
  const save = () => { if (edit !== null) editPost(e.id, edit); setEdit(null); setMenu(false); };
  const del = async () => {
    setMenu(false);
    if (await confirmDialog({ title: 'Delete this post?', message: `It goes for ${firstWord(person(partnerKey()).name)} too.`, ok: 'Delete', destructive: true })) { deletePost(e.id); haptic('light'); }
  };
  return (
    <article className={`jt-post${mine ? ' mine' : ''}`} data-id={e.id} style={colorVar(person(e.who).color)} aria-label={`${nameOf(e)}, ${time(e.createdAt)}`}>
      <Avatar k={e.who} />
      <div className="jt-pbody">
        <header className="jt-meta">
          <b>{nameOf(e)}</b><time dateTime={new Date(e.createdAt).toISOString()}>{time(e.createdAt)}</time>
          {e.updatedAt - e.createdAt > 60e3 ? <span className="jt-edited">edited</span> : null}
          {mine && edit === null ? <button className="jt-more" type="button" aria-label="Edit or delete this post" aria-expanded={menu}
            onClick={() => setMenu(m => !m)}><Icon name="more" cls="sm" /></button> : null}
        </header>
        {edit !== null ? (
          <div className="jt-edit">
            <div className="jt-grow" data-v={edit}>
              <textarea className="jt-ta" value={edit} maxLength={POST_MAX} aria-label="Edit your post" onChange={ev => setEdit(ev.currentTarget.value)} />
            </div>
            <div className="jt-cacts">
              <button className="jt-link" type="button" onClick={() => { setEdit(null); setMenu(false); }}>Cancel</button>
              <button className="jt-post-btn" type="button" disabled={!edit.trim()} onClick={save}>Save</button>
            </div>
          </div>
        ) : <p className="jt-text">{e.text}</p>}
        {menu && edit === null ? (
          <div className="jt-acts">
            <button type="button" onClick={() => setEdit(e.text)}><Icon name="edit" cls="xs" />Edit</button>
            <button type="button" className="red" onClick={() => void del()}><Icon name="trash" cls="xs" />Delete</button>
          </div>) : null}
      </div>
    </article>
  );
}

const PAGE = 30;
export function JournalView() {
  const [shown, setShown] = useState(PAGE);
  useEffect(() => { journalOpen.now = true; return () => { journalOpen.now = false; }; }, []);
  const all = posts(), list = all.slice(0, shown);
  let day = '';
  return (
    <div className="jt">
      <h1 className="large-title">Journal</h1>
      <p className="subtitle">Shared with {firstWord(person(partnerKey()).name)}</p>
      <Compose />
      {all.length ? null : <p className="jt-empty">Nothing here yet. Your posts and {firstWord(person(partnerKey()).name)}’s will be here, newest first.</p>}
      <div className="jt-thread">
        {list.map(e => {
          const d = ymd(new Date(e.createdAt)), head = d !== day;
          day = d;
          return [head ? <h2 key={'d' + d} className="jt-day">{dayLabel(d)}</h2> : null, <Post key={e.id} e={e} />];
        })}
      </div>
      {all.length > shown ? <button className="jt-older" type="button" onClick={() => setShown(n => n + PAGE)}>Show earlier posts</button> : null}
    </div>
  );
}
