/* Encrypted records arrive as snapshots or atomic Firebase field patches. Keep the
   ciphertext already received, rather than fetching each affected record again.
   One instance belongs to one EventSource connection; nothing is persisted. */
type RecordValue = Record<string, unknown>;
const object = (v: unknown): v is RecordValue => !!v && typeof v === 'object' && !Array.isArray(v);
const safe = (key: string) => !!key && !['__proto__', 'prototype', 'constructor'].includes(key);
const copy = (v: RecordValue): RecordValue => Object.fromEntries(Object.entries(v).filter(([k]) => safe(k)));

export class RecordStream {
  private records = new Map<string, RecordValue>();

  apply(type: 'put' | 'patch', { path, data }: { path: string; data: unknown }): Record<string, unknown> {
    const changed = new Map<string, RecordValue | null>();
    const set = (parts: string[], value: unknown) => {
      // The encrypted wire format has exactly two levels: record and envelope field.
      if (!parts.length || parts.length > 2 || !parts.every(safe)) return;
      const [id, field] = parts;
      if (field) {
        const record = { ...this.records.get(id) };
        if (value === null) delete record[field]; else record[field] = value;
        this.records.set(id, record); changed.set(id, record);
      } else if (value === null) {
        this.records.delete(id); changed.set(id, null);
      } else if (object(value)) {
        const record = copy(value);
        this.records.set(id, record); changed.set(id, record);
      }
    };
    const parts = path.split('/').filter(Boolean);
    if (type === 'put' && !parts.length) {
      this.records.clear();
      if (object(data)) for (const [id, value] of Object.entries(data)) set([id], value);
    } else if (type === 'put') set(parts, data);
    else if (object(data)) for (const [key, value] of Object.entries(data)) set([...parts, ...key.split('/').filter(Boolean)], value);
    // Apply every part before notifying, so {u,d} is never observed half-updated.
    // Copy-on-write above also keeps callbacks queued for decryption immutable.
    return Object.fromEntries(changed);
  }
}
