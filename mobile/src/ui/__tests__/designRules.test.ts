/* The design system's rules that code review would otherwise have to catch (docs/architecture.md, section 5). */
import fs from 'fs';
import path from 'path';
import { LAUNCH_BG } from '../tokens';

const SRC = path.join(__dirname, '..', '..');
const UI = path.join(SRC, 'ui') + path.sep;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}
const withoutComments = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('colours are only defined in src/ui (screens use tokens and the theme)', () => {
  const colourValue = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(/;
  // `color` props carry palette names ('blue'), so only style properties that take a colour value are checked.
  const colourLiteral = /\b(backgroundColor|borderColor|shadowColor|tintColor|textShadowColor|fill|stroke|stopColor)\s*[:=]\s*\{?\s*["'`]/;
  const offenders = sourceFiles(SRC)
    .filter(f => !f.startsWith(UI))
    .filter(f => { const code = withoutComments(fs.readFileSync(f, 'utf8')); return colourValue.test(code) || colourLiteral.test(code); })
    .map(f => path.relative(SRC, f));
  expect(offenders).toEqual([]);
});

const appJson = (): { expo: { plugins: unknown[]; ios: { config?: { usesNonExemptEncryption?: boolean } } } } =>
  JSON.parse(fs.readFileSync(path.join(SRC, '..', 'app.json'), 'utf8'));

test('the still splash and the animated launch start on the same colour', () => {
  const splash = appJson().expo.plugins.find(p => Array.isArray(p) && p[0] === 'expo-splash-screen') as [string, { backgroundColor: string; dark: { backgroundColor: string } }];
  expect(splash[1].backgroundColor).toBe(LAUNCH_BG.light);
  expect(splash[1].dark.backgroundColor).toBe(LAUNCH_BG.dark);
});

test('export compliance is answered: no encryption of its own until phase 2 (change this with phase 2)', () => {
  expect(appJson().expo.ios.config?.usesNonExemptEncryption).toBe(false);
  const crypto = sourceFiles(SRC).filter(f => /crypto\.subtle|quick-crypto|encryptObj/.test(fs.readFileSync(f, 'utf8')));
  expect(crypto).toEqual([]);
});

test('no over-the-air updates: every change ships as an Apple-signed build', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(SRC, '..', 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
  expect(Object.keys(pkg.dependencies)).not.toContain('expo-updates');
});

test('no secrets in what ships: only EXPO_PUBLIC_ values are inlined, and none are secret keys', () => {
  const offenders = sourceFiles(SRC).concat(path.join(SRC, '..', 'app.json'), path.join(SRC, '..', 'eas.json'))
    .filter(f => /sb_secret_|service_role|PRIVATE KEY|SUPABASE_SECRET/i.test(fs.readFileSync(f, 'utf8')))
    .map(f => path.relative(SRC, f));
  expect(offenders).toEqual([]);
});
