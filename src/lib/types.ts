/* Twodo · data model. The same records are stored on the phone (localStorage) and, encrypted, in Firebase. */
import type { Color, Repeat } from './util';

export type PersonKey = 'a' | 'b';
export type Assignee = PersonKey | 'both' | null;
export type Priority = 0 | 1 | 2 | 3;

/** The six earlier characters: still read (an older version may write one), no longer drawn (docs/characters.md) */
export type CharKind = 'bun' | 'sprout' | 'pebble' | 'puff' | 'bolt' | 'drop';
export type RoleKind = 'cheer' | 'calm' | 'cheeky' | 'poet';
export type Look = 'female' | 'male';
export type Skin = 'porcelain' | 'peach' | 'honey' | 'caramel' | 'cocoa' | 'ebony';
export type Hair = 'black' | 'espresso' | 'chestnut' | 'auburn' | 'golden';
/** How your character looks: female or male, a skin tone and a hair colour; the hoodie is your colour */
export interface AvatarLook { look: Look; skin: Skin; hair: Hair }
/** avatar and role: the character each of you picked and the voice it speaks in (docs/characters.md) */
export interface Person {
  name: string; color: Color; photo?: string; uid?: string | null; username?: string; avatar?: AvatarLook; char?: CharKind; role?: RoleKind;
}
export interface PeopleRec { kind: 'people'; id: 'people'; a: Person; b: Person; updatedAt: number; _s?: 1 }
export interface List {
  kind: 'list'; id: string; name: string; emoji: string; color: Color; private: boolean; deleted: boolean;
  order: number; createdAt: number; updatedAt: number; _s?: 1; ghost?: 1;
}
export interface Subtask { id: string; title: string; done: boolean }
export interface Task {
  kind: 'task'; id: string; title: string; notes: string; listId: string; due: string | null; time: string | null;
  priority: Priority; tags: string[]; assignee: Assignee; subtasks: Subtask[]; repeat: Repeat | null; pinned: boolean;
  done: boolean; doneAt: number | null; doneBy?: PersonKey | null; createdAt: number; createdBy?: PersonKey; updatedAt: number;
  deleted: boolean; pomos: number; _s?: 1; ghost?: 1;
}
/** One goal for one week (the planner). docs/journal-and-planner.md */
export interface Goal {
  kind: 'goal'; id: string; week: string; text: string; done: boolean; order: number;
  createdAt: number; updatedAt: number; deleted: boolean; _s?: 1; ghost?: 1;
}
/** 0 not set · 1 sunny · 2 bright spells · 3 cloudy · 4 rainy · 5 stormy */
export type Mood = 0 | 1 | 2 | 3 | 4 | 5;
/** One person's half of one day's page in one journal. id = `${private ? 'me' : 'us'}-${date}-${who}`.
 *  Private entries live only inside the vault and never sync (docs/journal-and-planner.md). */
export interface JournalEntry {
  kind: 'journal'; id: string; date: string; who: PersonKey; private: boolean; text: string; mood: Mood; prompt: string;
  createdAt: number; updatedAt: number; deleted: boolean; _s?: 1; ghost?: 1;
}
export type Rec = Task | List | PeopleRec | Goal | JournalEntry;
export interface Data { tasks: Record<string, Task>; lists: Record<string, List>; people: PeopleRec | null; goals: Record<string, Goal>; journal: Record<string, JournalEntry> }

export interface Settings { theme: 'auto' | 'light' | 'dark'; accent: string; haptics: boolean; sounds: boolean; confetti: boolean; notify: boolean; dmy: boolean }
export interface AuthState { uid: string; idToken: string; refresh: string; exp: number; email?: string; username?: string; expired?: boolean }
export interface PairState { status: 'sent' | 'paired'; uid: string; username?: string; name: string; code?: string; ts?: number }
export interface FocusState { taskId: string | null; mode: 'focus' | 'break'; total: number; remaining: number; endsAt: number | null; running: boolean }
export interface ViewPrefs { sort?: string; showDone?: boolean; who?: string; cat?: string; week?: string; day?: string; later?: boolean; tab?: string }
export interface Local {
  me: PersonKey; onboarded: boolean; settings: Settings;
  sync: { url?: string; code?: string; space?: string };
  view: Record<string, ViewPrefs>; notified: Record<string, number>; focus: FocusState | null; tips: Record<string, unknown>;
  auth?: AuthState | null; pair?: PairState | null; push?: { id: string } | null; remSig?: Record<string, string>;
  lastUid?: string; lastEmail?: string; streakSeen?: number;
}
