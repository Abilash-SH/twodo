/* Twodo · a short, safe description of an error, for the "something went wrong" screens: the error's type and the
   browser's explanation of the code that failed ("undefined is not an object (evaluating 'a.b')"), so a screenshot
   is enough to find the cause. Text in double or curly quotes is dropped and the length is capped, because that is
   where an error repeats data (a JSON parse error quotes what it read). No stack, nothing sent anywhere. */
export function errorSummary(e: unknown, area = ''): string {
  const err = e instanceof Error ? e : null;
  const name = (err && err.name) || (typeof e === 'object' && e && 'name' in e ? String((e as { name: unknown }).name) : 'Error');
  const raw = err ? err.message : typeof e === 'string' ? e : '';
  const msg = String(raw || '')
    .replace(/"[^"]*"|“[^”]*”|„[^“”]*[“”]|«[^»]*»/g, '…')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return `${area ? area + ' · ' : ''}${name.slice(0, 40)}${msg ? ': ' + msg : ''}`;
}
