/* Twodo · characters: each of you has one of two original characters, female or male, drawn in a soft 3D style, with a
   skin tone and a hair colour you pick; the hoodie is your colour. Your character lives on Home and tells you about
   your day in its role's voice. Everything it says is written here from data already on the phone (to-dos without
   secret lists, the chat, the shared journal): no AI, nothing sent anywhere. docs/characters.md */
import { D, L, commit, partnerKey, person } from './store';
import type { AvatarLook, Hair, Look, Person, PersonKey, RoleKind, Skin } from './types';
import { firstWord } from './util';

export const LOOKS: [Look, string][] = [['female', 'Female'], ['male', 'Male']];
/** Skin tones and hair colours: [key, name, colour]. The drawings shade each one (light from the top left). */
export const SKINS: [Skin, string, string][] = [
  ['porcelain', 'Porcelain', '#F8DCCB'], ['peach', 'Peach', '#F1C2A2'], ['honey', 'Honey', '#DDA57F'],
  ['caramel', 'Caramel', '#C68558'], ['cocoa', 'Cocoa', '#9A6243'], ['ebony', 'Ebony', '#6A4130'],
];
export const HAIRS: [Hair, string, string][] = [
  ['black', 'Black', '#231A1C'], ['espresso', 'Espresso', '#3D2A22'], ['chestnut', 'Chestnut', '#6E4431'],
  ['auburn', 'Auburn', '#94402E'], ['golden', 'Golden', '#C99A55'],
];
export const DEFAULT_AVATAR: Record<Look, AvatarLook> = {
  female: { look: 'female', skin: 'honey', hair: 'espresso' },
  male: { look: 'male', skin: 'caramel', hair: 'black' },
};
export const ROLES: [RoleKind, string, string][] = [
  ['cheer', 'Cheerleader', 'Upbeat, always on your side'],
  ['calm', 'Calm friend', 'Gentle, no pressure'],
  ['cheeky', 'Cheeky', 'Teases you a little'],
  ['poet', 'Poet', 'Says it beautifully'],
];
export const isRole = (v: unknown): v is RoleKind => typeof v === 'string' && ROLES.some(r => r[0] === v);
/** Your character's look. Until you pick one, whoever started the space is male and the other female. */
export const avatarOf = (k: PersonKey): AvatarLook => person(k).avatar || (k === 'a' ? DEFAULT_AVATAR.male : DEFAULT_AVATAR.female);
export const roleOf = (k: PersonKey): RoleKind => { const r = person(k).role; return isRole(r) ? r : 'cheer'; };
export const lookName = (l: Look): string => (LOOKS.find(x => x[0] === l) || LOOKS[0])[1];
export const skinColor = (s: Skin): string => (SKINS.find(x => x[0] === s) || SKINS[2])[2];
export const hairColor = (h: Hair): string => (HAIRS.find(x => x[0] === h) || HAIRS[0])[2];
export const roleName = (r: RoleKind): string => (ROLES.find(x => x[0] === r) || ROLES[0])[1];

/** Change your own character or role (synced with the people record, like your name and colour) */
export function setMine(patch: { avatar?: AvatarLook; role?: RoleKind }): void {
  const me: Person = { ...person(L.me), ...patch };
  if (!D.people) D.people = { kind: 'people', id: 'people', a: person('a'), b: person('b'), updatedAt: 0 };
  D.people[L.me] = me;
  commit(D.people);
}

/* ---------- what the character says ---------- */
export interface Facts {
  hour: number; me: string; pt: string; paired: boolean;
  unread: number; today: number; next: { title: string; time: string } | null; overdue: number;
  pinned: { title: string; when: string } | null; doneByPt: string | null; together: number; ptPosted: boolean;
}
const cut = (s: string, n = 40) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

function greeting(r: RoleKind, h: number, me: string): string {
  const part = h >= 5 && h < 12 ? 0 : h < 17 && h >= 12 ? 1 : h >= 17 && h < 22 ? 2 : 3;
  return ({
    cheer: [`Morning, ${me}!`, `Afternoon, ${me}!`, `Evening, ${me}!`, `Still up, ${me}?`],
    calm: ['Good morning.', 'Good afternoon.', 'Good evening.', 'It’s late.'],
    cheeky: ['Up already?', 'Oh, hi.', `Evening, ${me}.`, 'Can’t sleep?'],
    poet: ['The morning opens.', 'The afternoon hums along.', 'Evening settles in.', 'The night is quiet.'],
  } as Record<RoleKind, string[]>)[r][part];
}
function plan(r: RoleKind, f: Facts): string {
  const n = f.today, t = f.next && cut(f.next.title, 32);
  if (!n && f.overdue) return ({
    cheer: `Nothing new today, and ${f.overdue} left from before. You can do it!`, calm: `Nothing new today. ${f.overdue} left from before, no rush.`,
    cheeky: `Nothing new today. Just ${f.overdue} you’ve been avoiding.`, poet: `A quiet day, with ${f.overdue} from other days still waiting.`,
  })[r];
  if (!n) return ({ cheer: 'Nothing planned today. Enjoy it!', calm: 'Nothing planned today. Rest counts too.', cheeky: 'Nothing planned today. Suspicious.', poet: 'Today is an empty page.' })[r];
  if (t) return ({
    cheer: `${plural(n, 'thing')} today. ${t} at ${f.next!.time} is the big one, you’ve got this!`,
    calm: `A gentle day: ${plural(n, 'small thing')}, and ${t} at ${f.next!.time}.`,
    cheeky: `${plural(n, 'thing')} today. Don’t forget ${t} at ${f.next!.time}… again.`,
    poet: `${plural(n, 'small task')} today, and ${t} at ${f.next!.time}, like a lantern.`,
  })[r];
  return ({
    cheer: `${plural(n, 'thing')} today. Let’s go!`,
    calm: `${plural(n, 'small thing')} today. One at a time.`,
    cheeky: `${plural(n, 'thing')} today. They won’t do themselves.`,
    poet: `${plural(n, 'small task')} wait like stones on a path.`,
  })[r];
}
/** What today holds, in the role's voice, without the greeting (Home says hello itself) */
export const dayLine = (f: Facts, r: RoleKind): string => plan(r, f);
/** The first line is the greeting and the day; tapping the character goes through the rest */
export function lines(f: Facts, r: RoleKind): string[] {
  const out = [`${greeting(r, f.hour, f.me)} ${plan(r, f)}`];
  if (f.unread) out.push(({
    cheer: `${f.pt} sent you ${plural(f.unread, 'message')}!`, calm: `${f.pt} sent you ${plural(f.unread, 'message')}, whenever you’re ready.`,
    cheeky: `${f.pt} sent you ${plural(f.unread, 'message')}. Don’t leave them waiting.`, poet: `${plural(f.unread, 'message')} from ${f.pt}, like letters on the mat.`,
  })[r]);
  if (f.overdue && f.today) out.push(({
    cheer: `${f.overdue} left from before. You can still do it!`, calm: `${f.overdue} left from before. No rush, just a look.`,
    cheeky: `${f.overdue} left from before. I’m not judging. Much.`, poet: `${f.overdue} from other days still linger.`,
  })[r]);
  if (f.pinned) out.push(({
    cheer: `Pinned: ${cut(f.pinned.title)}${f.pinned.when ? `, ${f.pinned.when}` : ''}. Big one!`, calm: `Pinned, for when you have a moment: ${cut(f.pinned.title)}${f.pinned.when ? `, ${f.pinned.when}` : ''}.`,
    cheeky: `You pinned ${cut(f.pinned.title)}${f.pinned.when ? ` for ${f.pinned.when}` : ''}. Just saying.`, poet: `Pinned close to the heart: ${cut(f.pinned.title)}.`,
  })[r]);
  if (f.doneByPt) out.push(({
    cheer: `${f.pt} ticked off ${cut(f.doneByPt)}. Teamwork!`, calm: `${f.pt} ticked off ${cut(f.doneByPt)}.`,
    cheeky: `${f.pt} ticked off ${cut(f.doneByPt)}. Your move.`, poet: `${f.pt} quietly ticked off ${cut(f.doneByPt)}.`,
  })[r]);
  if (f.ptPosted) out.push(({
    cheer: `${f.pt} posted in the journal today!`, calm: `${f.pt} posted in the journal today.`,
    cheeky: `${f.pt} wrote in the journal. Aren’t you curious?`, poet: `${f.pt} left words in the journal today.`,
  })[r]);
  if (f.together) out.push(({
    cheer: `${plural(f.together, 'thing')} to do together. Fun!`, calm: `${plural(f.together, 'thing')} for the two of you, when it suits.`,
    cheeky: `${plural(f.together, 'thing')} to do together. Who goes first?`, poet: `${plural(f.together, 'thing')} that need you both.`,
  })[r]);
  if (!f.paired) out.push(({
    cheer: 'Add your partner and I’ll keep you both posted!', calm: 'When you’re ready, add your partner in Settings.',
    cheeky: 'Still on your own? Add your partner.', poet: 'Every story needs two. Add your partner.',
  })[r]);
  return out;
}
export const partnerFirst = (): string => firstWord(person(partnerKey()).name);
