/** Explore's sky follows the phone's own clock: where the sun is, what colour the sky is, and how the city is lit.
 *  No location is read. The latitude is a fixed 20° (south of the equator when the phone's time zone is), the sun
 *  follows the local time of day and the date, which is close enough for "a sunset when it's sunset for you".
 *  Pure numbers and hex colours, no three.js, so it can be tested on its own. */

export interface Daylight {
  /** sun height above the horizon and compass bearing (0 = north, clockwise), in degrees */
  elevation: number; azimuth: number;
  /** unit vector towards the sun in world space: +x east, +y up, −z north */
  sun: [number, number, number];
  /** 0…1: full daylight, the warm hour around sunset or sunrise, and full night */
  day: number; golden: number; night: number;
  zenith: string; horizon: string; glow: string; sunColor: string;
}

const SOUTHERN = /^(Australia\/|Pacific\/(Auckland|Chatham|Fiji|Noumea|Port_Moresby)|America\/(Argentina|Santiago|Sao_Paulo|Montevideo|Asuncion|La_Paz|Lima)|Africa\/(Johannesburg|Harare|Maputo|Windhoek|Gaborone)|Antarctica\/|Indian\/(Mauritius|Reunion))/;
let zone: string | null = null;
function latitude(): number {
  if (zone === null) { try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { zone = ''; } }
  return SOUTHERN.test(zone) ? -25 : 20;
}

const rad = Math.PI / 180;
export function sunAt(date: Date, lat = latitude()): { elevation: number; azimuth: number } {
  const start = new Date(date.getFullYear(), 0, 0), dayOfYear = Math.floor((date.getTime() - start.getTime()) / 864e5);
  const declination = 23.44 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365) * rad;
  // Clocks run ahead of the sun in most places (and an hour more in summer time): solar noon is taken as 12:18
  // standard time, which puts sunsets within a few minutes of real ones across most of a time zone.
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset(), jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  const summer = date.getTimezoneOffset() < Math.max(jan, jul) ? 1 : 0;
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600 - summer - .3;
  const hourAngle = (hours - 12) * 15 * rad, phi = lat * rad;
  const sinEl = Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const azimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi)) + Math.PI;
  return { elevation: elevation / rad, azimuth: ((azimuth / rad) % 360 + 360) % 360 };
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** sky colours by sun elevation, from midday to deep night */
const KEYS: [number, string, string, string][] = [
  [90, '#2a63c9', '#9cc3ea', '#fff8e6'],
  [35, '#2f6bd0', '#a8cbeb', '#fff3d6'],
  [15, '#3a72c8', '#bed4e6', '#ffe6b3'],
  [6, '#4a6fb7', '#f1c899', '#ffc078'],
  [1, '#41599d', '#ff9b5c', '#ff8a3d'],
  [-2, '#324985', '#f2785f', '#ff6a3a'],
  [-5, '#26346e', '#b5607a', '#d9567a'],
  [-9, '#1a2654', '#4e4278', '#6a3f7a'],
  [-14, '#111c42', '#2c3260', '#3a3560'],
  // a city's night: never black, a little of its own light along the horizon
  [-20, '#0d1736', '#29305a', '#3b3358'],
  [-90, '#0d1736', '#29305a', '#3b3358'],
];
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export function mixHex(a: string, b: string, t: number): string { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); }

export function daylight(date: Date, lat?: number): Daylight {
  const { elevation, azimuth } = sunAt(date, lat);
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] > elevation) i++;
  const [e0, z0, h0, g0] = KEYS[i], [e1, z1, h1, g1] = KEYS[i + 1];
  const t = e0 === e1 ? 0 : Math.max(0, Math.min(1, (e0 - elevation) / (e0 - e1)));
  const el = elevation * rad, az = azimuth * rad;
  return {
    elevation, azimuth,
    sun: [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)],
    day: smooth(-4, 8, elevation),
    golden: smooth(-7, 0, elevation) * (1 - smooth(5, 15, elevation)),
    night: 1 - smooth(-12, -3, elevation),
    zenith: mixHex(z0, z1, t), horizon: mixHex(h0, h1, t), glow: mixHex(g0, g1, t),
    sunColor: mixHex('#ff9a55', '#fff4df', smooth(1, 22, elevation)),
  };
}
