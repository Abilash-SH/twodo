'use client';
/* Twodo · confirm dialogs */
import { useEffect, useState } from 'react';
import { alertStore } from '@/ui/alert';
import { useStore } from '@/ui/store';

function Alert({ a }: { a: ReturnType<typeof alertStore.get>[number] }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(r); }, []);
  const done = (ok: boolean) => { setOn(false); setTimeout(() => alertStore.set(l => l.filter(x => x.id !== a.id)), 260); a.resolve(ok); };
  return (
    <div className={`alert-wrap${on ? ' on' : ''}`}>
      <div className="alert" role="alertdialog" aria-label={a.title}><h4>{a.title}</h4><p>{a.message}</p>
        <div className="btns">
          {a.cancel === null ? null : <button type="button" data-r="0" onClick={() => done(false)}>{a.cancel}</button>}
          <button type="button" data-r="1" className={a.destructive ? 'red' : 'b'} onClick={() => done(true)}>{a.ok}</button>
        </div></div>
    </div>
  );
}
export function AlertHost() {
  const list = useStore(alertStore);
  return <>{list.map(a => <Alert key={a.id} a={a} />)}</>;
}
