/* Twodo · data model. The same records are stored on the phone (localStorage) and, encrypted, in Firebase. */
import type { Color, Repeat } from './util';

export type PersonKey = 'a' | 'b';
export type Assignee = PersonKey | 'both' | null;
export type Priority = 0 | 1 | 2 | 3;

export interface Person { name: string; color: Color; photo?: string; uid?: string | null; username?: string }
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
export type Rec = Task | List | PeopleRec;
export interface Data { tasks: Record<string, Task>; lists: Record<string, List>; people: PeopleRec | null }

export interface Settings { theme: 'auto' | 'light' | 'dark'; accent: string; haptics: boolean; sounds: boolean; confetti: boolean; notify: boolean; dmy: boolean }
export interface AuthState { uid: string; idToken: string; refresh: string; exp: number; email?: string; username?: string; expired?: boolean }
export interface PairState { status: 'sent' | 'paired'; uid: string; username?: string; name: string; code?: string; ts?: number }
export interface FocusState { taskId: string | null; mode: 'focus' | 'break'; total: number; remaining: number; endsAt: number | null; running: boolean }
export interface ViewPrefs { sort?: string; showDone?: boolean; who?: string; cat?: string }
export interface Local {
  me: PersonKey; onboarded: boolean; settings: Settings;
  sync: { url?: string; code?: string; space?: string };
  view: Record<string, ViewPrefs>; notified: Record<string, number>; focus: FocusState | null; tips: Record<string, unknown>;
  auth?: AuthState | null; pair?: PairState | null; push?: { id: string } | null; remSig?: Record<string, string>;
  lastUid?: string; lastEmail?: string; streakSeen?: number;
}
