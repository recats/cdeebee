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
