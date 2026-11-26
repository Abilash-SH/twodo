'use client';
/* Twodo · Your character: who it is (a woman or a man, then one of the realistic 3D people, lib/people.ts) and its
   role (how it tells you about your day). A choice applies at once and syncs with your partner, like your name and
   colour. docs/characters.md */
import { HAIRS, LOOKS, ROLES, SKINS, avatarOf, lines, lookName, roleName, roleOf, setMine } from '@/lib/characters';
import { haptic } from '@/lib/feedback';
import { L, partnerKey, person } from '@/lib/store';
import type { AvatarLook } from '@/lib/types';
import { firstWord } from '@/lib/util';
import { colorVar, cssVars } from '../ui/Avatar';
import { faceUrl, PEOPLE, personFor } from '@/lib/people';
import { Character } from './Character';
import { PersonPreview } from './People';
import { Avatars } from '@/lib/avatar3d';
import { Icon } from '../ui/Icon';
import { boardData } from './BoardView';

/** Your own avatar from a selfie (docs/own-avatar.md): made at Avaturn, imported here, sent to your partner encrypted */
function OwnAvatar({ pt }: { pt: string }) {
  const own = !!Avatars.url[L.me], busy = Avatars.state === 'checking' || Avatars.state === 'sending';
  const pick = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.glb,model/gltf-binary,application/octet-stream';
    inp.addEventListener('change', async () => { const f = inp.files && inp.files[0]; if (f) await Avatars.use(await f.arrayBuffer()); });
    inp.click();
  };
  return (
    <div className="chv-own">
      <p className="chv-sub">Make a realistic avatar of yourself from a selfie at Avaturn (free), download it as a .glb file, then import it here.
        {pt ? ` It reaches ${pt}’s phone by itself, encrypted.` : ' Once your partner is added, it reaches their phone too, encrypted.'} It moves like the others.</p>
      <div className="chv-own-row">
        <a className="btn chv-own-btn tint" href="https://avaturn.me" target="_blank" rel="noopener noreferrer"><Icon name="camera" />Make one at Avaturn</a>
        <button type="button" className="btn chv-own-btn" disabled={busy} onClick={pick}><Icon name="upload" />{own ? 'Import a new one' : 'Import your avatar'}</button>
      </div>
      {own && !busy ? <button type="button" className="chv-own-off" onClick={() => { haptic('light'); void Avatars.remove(); }}>Use a Twodo person again</button> : null}
      <p className={`chv-own-note ${Avatars.state}`} role="status">{Avatars.note}</p>
    </div>
  );
}

export function CharacterView() {
  const me = L.me, pk = partnerKey(), mine = avatarOf(me), role = roleOf(me);
  const paired = !!(L.pair && L.pair.status === 'paired');
  const sample = lines(boardData().facts, role)[0];
  const pick = (patch: Partial<AvatarLook>) => { setMine({ avatar: { ...mine, ...patch } }); haptic('light'); };
  return (
    <div className="chv" style={colorVar(person(me).color)}>
      <h1 className="large-title">Your character</h1>
      <div className="chv-preview">
        <PersonPreview look={mine} name={firstWord(person(me).name) || 'You'} />
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
      <h2 className="chv-h">Pick your person</h2>
      <div className="chv-faces" role="radiogroup" aria-label="Your person">
        {PEOPLE.filter(p => p.look === mine.look).map(p => {
          const on = personFor(mine).id === p.id, name = `${SKINS.find(x => x[0] === p.skin)![1]} skin, ${HAIRS.find(x => x[0] === p.hair)![1].toLowerCase()} hair`;
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} aria-label={name} data-person={p.id} className={`chv-face${on ? ' on' : ''}`}
              onClick={() => { if (!on) pick({ skin: p.skin, hair: p.hair }); }}>
              <img src={faceUrl(p)} alt="" width={72} height={72} decoding="async" draggable={false} />
            </button>
          );
        })}
      </div>
      <h2 className="chv-h">Your own 3D you</h2>
      <OwnAvatar pt={paired ? firstWord(person(pk).name) : ''} />
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
