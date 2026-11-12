/* Twodo · "Add to Home Screen" prompt (Android/desktop Chrome offer an install event; iPhone needs Share → Add) */
import { scheduleRender } from '@/lib/render';

interface InstallEvent extends Event { prompt: () => Promise<void> }
export const Install = { evt: null as InstallEvent | null };
if (typeof window !== 'undefined') addEventListener('beforeinstallprompt', e => { e.preventDefault(); Install.evt = e as InstallEvent; scheduleRender(); });
