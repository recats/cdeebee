import { bench, describe } from 'vitest';
import { createCdeebee } from '../../lib/core/createCdeebee';

interface Item { itemID: string | number; value: number }
interface TestStorage { itemList: Record<string | number, Item> }

// Seed outside the timed callbacks; alternate values so writes never become no-ops.
for (const stringIDs of [false, true]) {
  describe(`isolated commits, 10k ${stringIDs ? 'UUID' : 'numeric'} IDs`, () => {
    const itemList = Array.from({ length: 10_000 }, (_, i): Item => ({
      itemID: stringIDs ? `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` : i,
      value: 0,
    }));
    const make = () => {
      const db = createCdeebee<TestStorage>({ fetch: {}, primaryKeyList: { itemList: 'itemID' } });
      db.commit({ itemList: { upsertList: itemList } }, { source: 'set' });
      return db;
    };
    for (const batch of [false, true]) {
      const db = make();
      const variants = [1, 2].map(value => itemList.slice(0, 100).map(row => ({ ...row, value })));
      let iteration = 0;
      bench(batch ? '100 entities in one commit' : '100 individual setEntity calls', () => {
        const writes = variants[iteration++ % 2];
        if (batch) db.commit({ itemList: { setList: writes } }, { source: 'set' });
        else for (const row of writes) db.setEntity('itemList', row.itemID, { value: row.value });
      }, { time: 300, iterations: 3 });
    }
    const db = make();
    const record = Object.fromEntries(itemList.map(row => [row.itemID, row]));
    db.replaceList('itemList', record);
    bench('stale replaceList, retained entities', () => {
      db.commit({ itemList: { replaceList: record } }, { source: 'request', seq: 1 });
    }, { time: 300 });
    bench('stale upsert, complete retained entities', () => {
      db.commit({ itemList: { upsertList: itemList } }, { source: 'request', seq: 1 });
    }, { time: 300 });
  });
}
