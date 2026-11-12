/* Twodo · icons (Lucide), keeping the app's own .i sizing classes so the design system sizes them */
import {
  ArrowUp, Bell, Calendar, CalendarArrowUp, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, CircleEllipsis, CircleX, Clock, Cloud,
  Copy, Delete, Download, FileText, Flag, Hand, Heart, House, Inbox, KeyRound, Lightbulb, List, Lock, LockOpen, Menu, MessageCircle, Moon, Pause, Pencil, Pin,
  Play, Plus, Repeat, Reply, ScanFace, Search, Settings, ShieldCheck, Share, SlidersHorizontal, Smartphone, Sofa, Sparkles, SquareCheck, Sun, Sunrise, Tag, Timer,
  Trash2, Upload, User, X, type LucideIcon,
} from 'lucide-react';

const ICONS = {
  chevL: ChevronLeft, gear: Settings, todo: SquareCheck, chevR: ChevronRight, chevD: ChevronDown, plus: Plus, arrowUp: ArrowUp, search: Search,
  more: CircleEllipsis, cal: Calendar, calnext: CalendarArrowUp, sunrise: Sunrise, moon: Moon, sofa: Sofa, clock: Clock, reply: Reply, repeat: Repeat,
  flag: Flag, person: User, heart: Heart, pin: Pin, trash: Trash2, check: Check, tray: Inbox, tag: Tag, bell: Bell, timer: Timer, share: Share,
  x: X, xcircle: CircleX, lock: Lock, note: FileText, list: List, copy: Copy, edit: Pencil, play: Play, pause: Pause, cloud: Cloud, key: KeyRound,
  sparkles: Sparkles, download: Download, upload: Upload, sun: Sun, phone: Smartphone, chat: MessageCircle, menu: Menu, home: House,
  sliders: SlidersHorizontal, camera: Camera, bulb: Lightbulb, hand: Hand, unlock: LockOpen, faceid: ScanFace, backspace: Delete, shield: ShieldCheck,
} satisfies Record<string, LucideIcon>;
export type IconName = keyof typeof ICONS;

export function Icon({ name, cls = '' }: { name: IconName | string | null | undefined; cls?: string }) {
  const C = name ? ICONS[name as IconName] : undefined;
  if (!C) return null;
  return <C className={`i ${name === 'xcircle' ? 'xc ' : ''}${cls}`.trim()} aria-hidden="true" focusable="false" />;
}
