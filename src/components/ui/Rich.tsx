/* Twodo · tiny, safe text formatting for the app's own copy: **bold**, _italic_, `key`. Never used for user text. */
import { Fragment, type ReactNode } from 'react';

export function rich(s: string): ReactNode {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|_(.+?)_|`(.+?)`/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(m[1] ? <b key={i++}>{m[1]}</b> : m[2] ? <i key={i++}>{m[2]}</i> : <kbd key={i++}>{m[3]}</kbd>);
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return <Fragment>{out}</Fragment>;
}
