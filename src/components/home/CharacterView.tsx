'use client';
/* Twodo · Your character: how it looks (female or male, a skin tone, a hair colour; the hoodie is your colour) and its
   role (how it tells you about your day). A choice applies at once and syncs with your partner, like your name and
   colour. docs/characters.md */
import { HAIRS, LOOKS, ROLES, SKINS, avatarOf, lines, lookName, roleName, roleOf, setMine } from '@/lib/characters';
import { haptic } from '@/lib/feedback';
import { L, partnerKey, person } from '@/lib/store';
import type { AvatarLook } from '@/lib/types';
import { firstWord } from '@/lib/util';
import { colorVar, cssVars } from '../ui/Avatar';
import { Character } from './Character';
import { boardData } from './BoardView';

export function CharacterView() {
  const me = L.me, pk = partnerKey(), mine = avatarOf(me), role = roleOf(me);
  const paired = !!(L.pair && L.pair.status === 'paired');
  const sample = lines(boardData().facts, role)[0];
  const pick = (patch: Partial<AvatarLook>) => { setMine({ avatar: { ...mine, ...patch } }); haptic('light'); };
  return (
    <div className="chv" style={colorVar(person(me).color)}>
      <h1 className="large-title">Your character</h1>
      <div className="chv-preview">
        <Character key={`${mine.look}${mine.skin}${mine.hair}${role}`} look={mine} size={150} cls="wave" />
        <p className="say" aria-live="polite">{sample}</p>
      </div>
      <h2 className="chv-h">Who you are</h2>
      <div className="chv-grid looks" role="radiogroup" aria-label="Your character">
        {LOOKS.map(([l, name]) => (
          <button key={l} type="button" role="radio" aria-checked={l === mine.look} className={`chv-pick${l === mine.look ? ' on' : ''}`} data-look={l}
            onClick={() => { if (l !== mine.look) pick({ look: l }); }}>
            <Character look={{ ...mine, look: l }} size={112} still /><span>{name}</span>
          </button>
        ))}
      </div>
      <h2 className="chv-h">Skin</h2>
      <div className="chv-dots" role="radiogroup" aria-label="Skin tone">
        {SKINS.map(([k, name, hex]) => (
          <button key={k} type="button" role="radio" aria-checked={k === mine.skin} aria-label={name} className={`chv-dot${k === mine.skin ? ' on' : ''}`}
            style={cssVars({ '--dot': hex })} onClick={() => { if (k !== mine.skin) pick({ skin: k }); }} />
        ))}
      </div>
      <h2 className="chv-h">Hair</h2>
      <div className="chv-dots" role="radiogroup" aria-label="Hair colour">
        {HAIRS.map(([k, name, hex]) => (
          <button key={k} type="button" role="radio" aria-checked={k === mine.hair} aria-label={name} className={`chv-dot${k === mine.hair ? ' on' : ''}`}
            style={cssVars({ '--dot': hex })} onClick={() => { if (k !== mine.hair) pick({ hair: k }); }} />
        ))}
      </div>
      <p className="chv-sub chv-note">The hoodie is your colour: change it in Settings, under your name.</p>
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
          <Character look={avatarOf(pk)} size={60} still flip />
          <p><b>{firstWord(person(pk).name)}</b> picks their own: {lookName(avatarOf(pk).look).toLowerCase()}, as {roleName(roleOf(pk)) === 'Cheeky' ? 'the cheeky one' : `a ${roleName(roleOf(pk)).toLowerCase()}`}.</p>
        </div>
      ) : null}
    </div>
  );
}
