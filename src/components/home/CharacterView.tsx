'use client';
/* Twodo · Your character: pick who lives on your Home, and its role (how it tells you about your day).
   A choice applies at once and syncs with your partner, like your name and colour. docs/characters.md */
import { CHARS, ROLES, charName, charOf, lines, roleName, roleOf, setMine } from '@/lib/characters';
import { haptic } from '@/lib/feedback';
import { L, partnerKey, person } from '@/lib/store';
import { firstWord } from '@/lib/util';
import { colorVar } from '../ui/Avatar';
import { Character } from './Character';
import { boardData } from './BoardView';

export function CharacterView() {
  const me = L.me, pk = partnerKey(), kind = charOf(me), role = roleOf(me);
  const paired = !!(L.pair && L.pair.status === 'paired');
  const sample = lines(boardData().facts, role)[0];
  return (
    <div className="chv" style={colorVar(person(me).color)}>
      <h1 className="large-title">Your character</h1>
      <div className="chv-preview">
        <Character key={kind + role} kind={kind} size={96} cls="wave" />
        <p className="say" aria-live="polite">{sample}</p>
      </div>
      <h2 className="chv-h">Who lives on your Home</h2>
      <div className="chv-grid" role="radiogroup" aria-label="Your character">
        {CHARS.map(([k, name]) => (
          <button key={k} type="button" role="radio" aria-checked={k === kind} className={`chv-pick${k === kind ? ' on' : ''}`}
            onClick={() => { if (k !== kind) { setMine({ char: k }); haptic('light'); } }}>
            <Character kind={k} size={68} /><span>{name}</span>
          </button>
        ))}
      </div>
      <h2 className="chv-h">Their role</h2>
      <p className="chv-sub">How they tell you about your day. Same to-dos, a different voice.</p>
      <div className="chv-roles" role="radiogroup" aria-label="Their role">
        {ROLES.map(([k, name, about]) => (
          <button key={k} type="button" role="radio" aria-checked={k === role} className={`chv-role${k === role ? ' on' : ''}`}
            onClick={() => { if (k !== role) { setMine({ role: k }); haptic('light'); } }}>
            <b>{name}</b><span>{about}</span>
          </button>
        ))}
      </div>
      {paired ? (
        <div className="chv-pt" style={colorVar(person(pk).color)}>
          <Character kind={charOf(pk)} size={44} />
          <p><b>{firstWord(person(pk).name)}</b> has {charName(charOf(pk))}, as {roleName(roleOf(pk)) === 'Cheeky' ? 'the cheeky one' : `a ${roleName(roleOf(pk))}`}. Each of you picks your own.</p>
        </div>
      ) : null}
    </div>
  );
}
