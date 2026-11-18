'use client';
/* Twodo · the journal: one thread for the two of you, compact. Each post hangs on a love thread that runs from its
   writer's character to the next post's, in both colours, with a small heart where they meet. Write and Post; posts
   come in at the top for both of you. Double-tap (or tap the heart on) your partner's post to give it your heart.
   Your own posts: ⋯ to edit or delete. No prompts, no weather, no counts. Data: docs/journal-and-planner.md */
import { useEffect, useRef, useState } from 'react';
import { avatarOf } from '@/lib/characters';
import { haptic } from '@/lib/feedback';
import { POST_MAX, addPost, deletePost, editPost, heart, hearts, journalOpen, posts } from '@/lib/journal';
import { L, partnerKey, person } from '@/lib/store';
import type { JournalEntry, PersonKey } from '@/lib/types';
import { dayDiff, firstWord, reducedMotion, todayStr, ymd } from '@/lib/util';
import { confirmDialog } from '@/ui/alert';
import { Portrait } from '../home/Character';
import { colorVar, cssVars } from '../ui/Avatar';
import { Icon } from '../ui/Icon';

const FMT: Record<string, Intl.DateTimeFormat> = {};
const fmt = (k: string, o: Intl.DateTimeFormatOptions) => (FMT[k] ||= new Intl.DateTimeFormat([], o));
/** "now", "5m", else the time (the day is in the line above) */
function when(ts: number): string {
  const ago = Date.now() - ts;
  if (ago < 60e3) return 'now';
  if (ago < 3600e3) return `${Math.floor(ago / 60e3)}m`;
  return fmt('t', { hour: 'numeric', minute: '2-digit' }).format(new Date(ts));
}
function dayLabel(day: string): string {
  const diff = dayDiff(todayStr(), day), d = new Date(`${day}T12:00`);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return fmt('wd', { weekday: 'long' }).format(d);
  return d.getFullYear() === new Date().getFullYear() ? fmt('dm', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
    : fmt('dmy', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}
const nameOf = (k: PersonKey) => (k === L.me ? 'You' : firstWord(person(k).name));
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s){1,12}$/u;
/** short posts read a little bigger; a few emoji alone, bigger still */
const size = (t: string) => (EMOJI_ONLY.test(t) && !/[0-9#*]/.test(t) ? ' emoji' : t.length <= 48 && !t.includes('\n') ? ' big' : '');

const HeartSvg = ({ on }: { on: boolean }) => (
  <svg className="jt-hs" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.3A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z" className={on ? 'on' : ''} /></svg>
);

/** what you are writing survives leaving the screen (in memory only, until the app closes) */
let draft = '';

function Compose() {
  const [text, setText] = useState(draft);
  const me = L.me;
  const post = () => {
    if (!addPost(text)) return;
    draft = ''; setText(''); haptic('success');
  };
  return (
    <div className="jt-compose" style={colorVar(person(me).color)}>
      <span className="jt-av" aria-hidden="true"><Portrait look={avatarOf(me)} size={28} /></span>
      <div className="jt-grow" data-v={text}>
        <textarea className="jt-ta" rows={1} value={text} maxLength={POST_MAX} aria-label="Write a post"
          placeholder="What’s on your mind?"
          onChange={ev => { draft = ev.currentTarget.value; setText(draft); }} />
      </div>
      <button className="jt-post-btn" type="button" disabled={!text.trim()} onClick={post}>Post</button>
    </div>
  );
}

/** One post. `next`: whose post comes after it, so the love thread can run from this colour into that one. */
function Post({ e, love, next }: { e: JournalEntry; love: Set<PersonKey> | undefined; next: PersonKey | null }) {
  const mine = e.who === L.me, pk = partnerKey();
  const [menu, setMenu] = useState(false), [edit, setEdit] = useState<string | null>(null), [open, setOpen] = useState(false);
  const burst = useRef<HTMLSpanElement>(null), lastTap = useRef(0);
  const loved = !!love && love.has(L.me), ptLoved = !!love && love.has(pk);
  const long = e.text.length > 420 || e.text.split('\n').length > 8;
  const fresh = Date.now() - e.createdAt < 2500;
  const pop = () => {
    haptic('light');
    if (!reducedMotion.matches && burst.current) burst.current.animate(
      [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1.15)', offset: .35 }, { opacity: 1, transform: 'scale(1)', offset: .6 }, { opacity: 0, transform: 'scale(1.3)' }],
      { duration: 720, easing: 'cubic-bezier(.2,.8,.2,1)' });
  };
  const toggle = () => { if (heart(e.id)) pop(); else haptic('light'); };
  // a double tap on your partner's post gives it your heart (never takes it away)
  const tap = (ev: React.MouseEvent) => {
    if (mine || edit !== null || (ev.target as HTMLElement).closest('button, a, textarea')) return;
    const now = Date.now();
    if (now - lastTap.current < 320) { heart(e.id, true); pop(); lastTap.current = 0; } else lastTap.current = now;
  };
  const save = () => { if (edit !== null) editPost(e.id, edit); setEdit(null); setMenu(false); };
  const del = async () => {
    setMenu(false);
    if (await confirmDialog({ title: 'Delete this post?', message: `It goes for ${firstWord(person(pk).name)} too.`, ok: 'Delete', destructive: true })) { deletePost(e.id); haptic('light'); }
  };
  return (
    <article className={`jt-post${mine ? ' mine' : ''}${fresh ? ' fresh' : ''}`} data-id={e.id} onClick={tap} aria-label={`${nameOf(e.who)}, ${when(e.createdAt)}`}
      style={cssVars({ '--c': `var(--c-${person(e.who).color})`, '--cn': `var(--c-${person(next || e.who).color})` })}>
      <span className="jt-burst" ref={burst} aria-hidden="true"><HeartSvg on /></span>
      <span className="jt-av" aria-hidden="true"><Portrait look={avatarOf(e.who)} size={28} /></span>
      {next ? <i className="jt-thread" aria-hidden="true"><HeartSvg on /></i> : null}
      <div className="jt-pbody">
        <header className="jt-meta">
          <b>{nameOf(e.who)}</b><time dateTime={new Date(e.createdAt).toISOString()}>{when(e.createdAt)}</time>
          {e.updatedAt - e.createdAt > 60e3 ? <span className="jt-edited">edited</span> : null}
          {edit === null ? (
            <span className="jt-side">
              {mine ? <button className="jt-dots" type="button" aria-label="Edit or delete this post" aria-expanded={menu} onClick={() => setMenu(m => !m)}><Icon name="more" cls="sm" /></button>
                : <button className={`jt-heart${loved ? ' on' : ''}`} type="button" aria-pressed={loved} aria-label={loved ? 'Take back your heart' : 'Give it your heart'}
                    style={colorVar(person(L.me).color)} onClick={toggle}><HeartSvg on={loved} /></button>}
            </span>) : null}
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
        ) : <>
          <p className={`jt-text${size(e.text)}${long && !open ? ' clamp' : ''}`}>{e.text}</p>
          {long ? <button className="jt-link more" type="button" onClick={() => setOpen(o => !o)}>{open ? 'Show less' : 'Show more'}</button> : null}
        </>}
        {mine && ptLoved && edit === null ? <span className="jt-loved" style={colorVar(person(pk).color)}><HeartSvg on />{firstWord(person(pk).name)} loved this</span> : null}
        {menu && edit === null ? (
          <div className="jt-menu">
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
  const all = posts(), list = all.slice(0, shown), love = hearts(), pk = partnerKey(), pt = firstWord(person(pk).name);
  let day = '';
  return (
    <div className="jt">
      <h1 className="large-title">Journal</h1>
      <div className="jt-pair">
        <span className="jt-duo" aria-hidden="true">
          <span style={colorVar(person(L.me).color)}><Portrait look={avatarOf(L.me)} size={22} /></span>
          <span style={colorVar(person(pk).color)}><Portrait look={avatarOf(pk)} size={22} /></span>
        </span>
        <span>You and {pt}</span><Icon name="lock" cls="xs" /><span className="jt-only">only you two</span>
      </div>
      <Compose />
      {all.length ? null : <p className="jt-empty">Your first post starts your story. Only you and {pt} will ever see it.</p>}
      <div className="jt-feed">
        {list.map((e, i) => {
          const d = ymd(new Date(e.createdAt)), head = d !== day;
          day = d;
          const next = list[i + 1] ? list[i + 1].who : null;
          return [head ? <h2 key={'d' + d} className={`jt-day${i ? ' on-thread' : ''}`}><span>{dayLabel(d)}</span></h2> : null,
            <Post key={e.id} e={e} love={love.get(e.id)} next={next} />];
        })}
      </div>
      {all.length > shown ? <button className="jt-older" type="button" onClick={() => setShown(n => n + PAGE)}>Show earlier posts</button> : null}
    </div>
  );
}
