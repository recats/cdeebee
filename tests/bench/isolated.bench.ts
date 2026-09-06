import { bench, describe } from 'vitest';
import { createCdeebee } from '../../lib/core/createCdeebee';

interface Item { id: string | number; value: number }
interface S { items: Record<string | number, Item> }

// Seed outside the timed callbacks; alternate values so writes never become no-ops.
for (const stringIDs of [false, true]) {
  describe(`isolated commits, 10k ${stringIDs ? 'UUID' : 'numeric'} IDs`, () => {
    const rows = Array.from({ length: 10_000 }, (_, i): Item => ({
      id: stringIDs ? `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` : i,
      value: 0,
    }));
    const make = () => {
      const db = createCdeebee<S>({ fetch: {}, primaryKeyList: { items: 'id' } });
      db.commit({ items: { upsertList: rows } }, { source: 'set' });
      return db;
    };
    for (const batch of [false, true]) {
      const db = make();
      const variants = [1, 2].map(value => rows.slice(0, 100).map(row => ({ ...row, value })));
      let iteration = 0;
      bench(batch ? '100 entities in one commit' : '100 individual setEntity calls', () => {
        const writes = variants[iteration++ % 2];
        if (batch) db.commit({ items: { setList: writes } }, { source: 'set' });
        else for (const row of writes) db.setEntity('items', row.id, { value: row.value });
      }, { time: 300, iterations: 3 });
    }
    const db = make();
    const record = Object.fromEntries(rows.map(row => [row.id, row]));
    db.replaceList('items', record);
    bench('replaceList before reset boundary', () => {
      db.commit({ items: { replaceList: record } }, { source: 'request', seq: 1 });
    }, { time: 300 });
    bench('upsert before reset boundary', () => {
      db.commit({ items: { upsertList: rows } }, { source: 'request', seq: 1 });
    }, { time: 300 });
  });
}
