import { describe, it, expect, vi } from 'vitest';
import { createCdeebee } from '../../lib/core/createCdeebee';

interface Item { itemID: number; groupID: number; value: number }
interface S { itemList: Record<number, Item> }

describe('perf smoke: 10k entities', () => {
  const itemList: Record<number, Item> = {};
  for (let i = 1; i <= 10_000; i += 1) itemList[i] = { itemID: i, groupID: i % 100, value: i };

  it('upsert of one entity notifies exactly its entity listener and the list listener', () => {
    const db = createCdeebee<S>({ fetch: {}, primaryKeyList: { itemList: 'itemID' }, indexList: { itemList: ['groupID'] }, initialStorage: { itemList } });
    const entityListenerList = Array.from({ length: 1000 }, () => vi.fn());
    entityListenerList.forEach((listener, i) => db.subscribe(listener, [{ listName: 'itemList', entityID: i + 1 }]));
    const listListener = vi.fn();
    db.subscribe(listListener, [{ listName: 'itemList' }]);

    const before = db.getState().storage.itemList;
    db.setEntity('itemList', 500, { value: -1 });
    db.flush();

    expect(entityListenerList.filter(l => l.mock.calls.length > 0)).toHaveLength(1);
    expect(entityListenerList[499]).toHaveBeenCalledTimes(1);
    expect(listListener).toHaveBeenCalledTimes(1);
    expect(db.getState().storage.itemList).not.toBe(before);
    expect(db.getState().storage.itemList[1]).toBe(before[1]);
    expect(db.getIndex('itemList', 'groupID', 0).size).toBe(100);
  });

  it('re-upserting identical entities keeps every reference and notifies nobody', () => {
    const db = createCdeebee<S>({ fetch: {}, primaryKeyList: { itemList: 'itemID' }, initialStorage: { itemList } });
    const listener = vi.fn();
    db.subscribe(listener);
    const before = db.getState();
    db.commit({ itemList: { upsertList: Object.values(itemList).map(item => ({ ...item })) } }, { source: 'set' });
    db.flush();
    expect(db.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('perf budget: 10k entities (coarse, catches order-of-magnitude regressions only)', () => {
  interface Row { rowID: number; groupID: number; name: string; updatedAt: string; tagList: string[] }
  interface RS { rowList: Record<number, Row> }
  const at = (n: number) => new Date(1_700_000_000_000 + n * 1000).toISOString();
  const rowList = Array.from({ length: 10_000 }, (_, i) => ({ rowID: i + 1, groupID: i % 100, name: `n${i}`, updatedAt: at(0), tagList: ['a'] }));
  const thinList = rowList.map(row => ({ ...row, name: `t${row.rowID}`, tagList: [] as string[] }));
  const measure = (fn: () => void) => { const t0 = performance.now(); fn(); return performance.now() - t0; };
  const budgetMs = { commit: 250, setEntity: 10 };

  it('upsert, patch and replaceList of 10k rows each stay under budget', () => {
    const db = createCdeebee<RS>({ fetch: {}, primaryKeyList: { rowList: 'rowID' }, versionKeyList: { rowList: 'updatedAt' }, indexList: { rowList: ['groupID'] } });
    for (let i = 1; i <= 1000; i += 1) db.subscribe(() => {}, [{ listName: 'rowList', entityID: i }]);
    const record: Record<number, Row> = {};
    for (const row of rowList) record[row.rowID] = row;

    expect(measure(() => db.commit({ rowList: { upsertList: rowList } }, { source: 'request', seq: 1 }))).toBeLessThan(budgetMs.commit);
    expect(measure(() => db.commit({ rowList: { patchList: thinList } }, { source: 'request', seq: 2 }))).toBeLessThan(budgetMs.commit);
    expect(measure(() => db.commit({ rowList: { replaceList: record } }, { source: 'request', seq: 3 }))).toBeLessThan(budgetMs.commit);
    expect(measure(() => db.commit({ rowList: { upsertList: rowList } }, { source: 'request', seq: 1 }))).toBeLessThan(budgetMs.commit);
  });

  it('a single setEntity with 1000 entity listeners stays under budget', () => {
    const db = createCdeebee<RS>({ fetch: {}, primaryKeyList: { rowList: 'rowID' }, indexList: { rowList: ['groupID'] } });
    db.commit({ rowList: { upsertList: rowList } }, { source: 'request', seq: 1 });
    for (let i = 1; i <= 1000; i += 1) db.subscribe(() => {}, [{ listName: 'rowList', entityID: i }]);
    expect(measure(() => db.setEntity('rowList', 500, { name: 'edited' }))).toBeLessThan(budgetMs.setEntity);
  });
});
