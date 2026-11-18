/* Twodo · the theme: light or dark (following the phone unless chosen), with the neutrals and the people's colours.
   Components read it with useTheme(); nothing else decides a colour. */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { COLORS, LOVE, NEUTRALS, SHADOW, cardGradient, loveTint, personColors, type ColorName, type Neutrals, type PersonColors, type Scheme } from './tokens';

export type SchemeChoice = 'system' | Scheme;

export interface Theme {
  scheme: Scheme;
  n: Neutrals;
  shadow: { 1: string; 2: string };
  /** A palette colour as it looks in this scheme. */
  color: (name: ColorName) => string;
  /** Everything derived from one person's colour. */
  person: (name: ColorName) => PersonColors;
  /** A card's background: a light wash of one colour into another. */
  gradient: (a: ColorName, b?: ColorName) => [string, string];
  /** A given heart, and the circle behind it. */
  love: { color: string; tint: string };
  choice: SchemeChoice;
  setChoice: (c: SchemeChoice) => void;
}

export function makeTheme(scheme: Scheme, choice: SchemeChoice = 'system', setChoice: (c: SchemeChoice) => void = () => {}): Theme {
  const cache = new Map<ColorName, PersonColors>();
  return {
    scheme,
    n: NEUTRALS[scheme],
    shadow: SHADOW[scheme],
    color: name => COLORS[name][scheme],
    person: name => {
      let p = cache.get(name);
      if (!p) cache.set(name, (p = personColors(name, scheme)));
      return p;
    },
    gradient: (a, b) => cardGradient(a, b, scheme),
    love: { color: LOVE[scheme], tint: loveTint(scheme) },
    choice,
    setChoice,
  };
}

const ThemeCtx = createContext<Theme | null>(null);

export function ThemeProvider({ children, initial = 'system' }: { children: ReactNode; initial?: SchemeChoice }) {
  const system = useColorScheme();
  const [choice, setChoice] = useState<SchemeChoice>(initial);
  const scheme: Scheme = choice === 'system' ? (system === 'dark' ? 'dark' : 'light') : choice;
  const theme = useMemo(() => makeTheme(scheme, choice, setChoice), [scheme, choice]);
  return <ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeCtx);
  if (!t) throw new Error('useTheme() needs a ThemeProvider above it');
  return t;
}
