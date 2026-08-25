import { describe, it, expect } from 'vitest';
import { IndexManager } from '../../../lib/core/indexManager';

interface Product { productID: number; reklBundleID: number; title?: string }
interface S { productList: Record<number, Product> }

const storageA: S = { productList: { 1: { productID: 1, reklBundleID: 10 }, 2: { productID: 2, reklBundleID: 10 }, 3: { productID: 3, reklBundleID: 20 } } };

describe('IndexManager', () => {
  it('rebuild creates equality indexes', () => {
    const m = new IndexManager<S>({ productList: ['reklBundleID'] });
    m.rebuild(storageA);
    expect(Array.from(m.get('productList', 'reklBundleID', 10))).toEqual([1, 2]);
    expect(Array.from(m.get('productList', 'reklBundleID', 20))).toEqual([3]);
    expect(m.get('productList', 'reklBundleID', 99).size).toBe(0);
  });

  it('update moves an entity between buckets on field change', () => {
    const m = new IndexManager<S>({ productList: ['reklBundleID'] });
    m.rebuild(storageA);
    const storageB: S = { productList: { ...storageA.productList, 2: { productID: 2, reklBundleID: 20 } } };
    m.update(storageA, storageB, [{ listName: 'productList', entityIDList: [2] }]);
    expect(Array.from(m.get('productList', 'reklBundleID', 10))).toEqual([1]);
    expect(Array.from(m.get('productList', 'reklBundleID', 20)).sort()).toEqual([2, 3]);
  });

  it('update removes deleted entities and adds new ones', () => {
    const m = new IndexManager<S>({ productList: ['reklBundleID'] });
    m.rebuild(storageA);
    const { 1: _removed, ...rest } = storageA.productList;
    const storageB: S = { productList: { ...rest, 4: { productID: 4, reklBundleID: 10 } } };
    m.update(storageA, storageB, [{ listName: 'productList', entityIDList: [1, 4] }]);
    expect(Array.from(m.get('productList', 'reklBundleID', 10)).sort()).toEqual([2, 4]);
  });

  it("'*' rebuilds the list index from nextStorage", () => {
    const m = new IndexManager<S>({ productList: ['reklBundleID'] });
    m.rebuild(storageA);
    const storageB: S = { productList: { 9: { productID: 9, reklBundleID: 30 } } };
    m.update(storageA, storageB, [{ listName: 'productList', entityIDList: '*' }]);
    expect(m.get('productList', 'reklBundleID', 10).size).toBe(0);
    expect(Array.from(m.get('productList', 'reklBundleID', 30))).toEqual([9]);
  });

  it('has() reports configured indexes; get() on unknown index returns empty set', () => {
    const m = new IndexManager<S>({ productList: ['reklBundleID'] });
    expect(m.has('productList', 'reklBundleID')).toBe(true);
    expect(m.has('productList', 'productID')).toBe(false);
    expect(m.get('productList', 'productID', 1).size).toBe(0);
  });

  it('editing a non-indexed field keeps the bucket iteration order', () => {
    const sameBundle: S = { productList: { 1: { productID: 1, reklBundleID: 10 }, 2: { productID: 2, reklBundleID: 10 }, 3: { productID: 3, reklBundleID: 10 } } };
    const m = new IndexManager<S>({ productList: ['reklBundleID'] });
    m.rebuild(sameBundle);
    expect(Array.from(m.get('productList', 'reklBundleID', 10))).toEqual([1, 2, 3]);
    const next: S = { productList: { ...sameBundle.productList, 1: { productID: 1, reklBundleID: 10, title: 'edited' } } };
    m.update(sameBundle, next, [{ listName: 'productList', entityIDList: [1] }]);
    expect(Array.from(m.get('productList', 'reklBundleID', 10))).toEqual([1, 2, 3]);
  });

  it('update normalizes string ids so removal by string id clears the bucket', () => {
    const m = new IndexManager<S>({ productList: ['reklBundleID'] });
    m.rebuild(storageA);
    const { 3: _removed, ...rest } = storageA.productList;
    const storageB: S = { productList: rest };
    m.update(storageA, storageB, [{ listName: 'productList', entityIDList: ['3'] }]);
    expect(m.get('productList', 'reklBundleID', 20).size).toBe(0);
  });
});
