import { bench, describe } from 'vitest';
import { createCdeebee } from '../../lib/core/createCdeebee';

interface Item { itemID: number; groupID: number; name: string; updatedAt: string; tagList: string[]; note?: string }
interface S { itemList: Record<number, Item> }

const N = 10_000;
const at = (n: number) => new Date(1_700_000_000_000 + n * 1000).toISOString();
const full = (i: number, v = 0): Item => ({ itemID: i, groupID: i % 100, name: `n${i}`, updatedAt: at(v), tagList: ['a', 'b'], note: 'x' });
const thin = (i: number, v = 0): Item => ({ itemID: i, groupID: i % 100, name: `t${i}`, updatedAt: at(v), tagList: [] });

const fullList = Array.from({ length: N }, (_, i) => full(i + 1));
const fullCopyList = fullList.map(item => ({ ...item }));
const thinList = Array.from({ length: N }, (_, i) => thin(i + 1));
const thinNewerList = Array.from({ length: N }, (_, i) => thin(i + 1, 1));
const fullRecord: Record<number, Item> = {};
for (const item of fullList) fullRecord[item.itemID] = item;

const make = () => {
  const db = createCdeebee<S>({
    fetch: {},
    primaryKeyList: { itemList: 'itemID' },
    versionKeyList: { itemList: 'updatedAt' },
    indexList: { itemList: ['groupID'] },
  });
  db.subscribe(() => {}, [{ listName: 'itemList' }]);
  for (let i = 1; i <= 1000; i += 1) db.subscribe(() => {}, [{ listName: 'itemList', entityID: i }]);
  return db;
};

const seeded = () => {
  const db = make();
  db.commit({ itemList: { upsertList: fullList } }, { source: 'request', seq: 10 });
  return db;
};

describe('commit, 10k entities', () => {
  bench('upsert cold', () => {
    make().commit({ itemList: { upsertList: fullList } }, { source: 'request' });
  });

  bench('upsert identical (shallowEqual no-op)', () => {
    seeded().commit({ itemList: { upsertList: fullCopyList } }, { source: 'request', seq: 11 });
  });

  bench('patch thin, same version (fill)', () => {
    seeded().commit({ itemList: { patchList: thinList } }, { source: 'request', seq: 11 });
  });

  bench('patch thin, newer version', () => {
    seeded().commit({ itemList: { patchList: thinNewerList } }, { source: 'request', seq: 11 });
  });

  bench('upsert stale (older seq, dropped)', () => {
    seeded().commit({ itemList: { upsertList: fullCopyList } }, { source: 'request', seq: 1 });
  });

  bench('replaceList fresh', () => {
    seeded().commit({ itemList: { replaceList: fullRecord } }, { source: 'request', seq: 11 });
  });

  bench('replaceList stale (older seq, kept)', () => {
    seeded().commit({ itemList: { replaceList: fullRecord } }, { source: 'request', seq: 1 });
  });
});

describe('local mutations, 10k entities', () => {
  const db = seeded();
  let n = 0;

  bench('setEntity x1 (sync flush, 1001 listeners)', () => {
    n += 1;
    db.setEntity('itemList', 500, { name: `e${n}` });
  });

  bench('setEntity x100', () => {
    n += 1;
    for (let i = 1; i <= 100; i += 1) db.setEntity('itemList', i, { name: `e${n}` });
  });

  bench('getIndex', () => {
    db.getIndex('itemList', 'groupID', 7);
  });
});
