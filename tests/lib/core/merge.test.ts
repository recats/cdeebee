import { describe, it, expect } from 'vitest';
import { applyChangeSet, fill, mergeEntity, readVersion, type ApplyChangeSetOptions } from '../../../lib/core/commit';
import type { CdeebeeChangeSet } from '../../../lib/core/types';

interface Item { itemID: number; name: string; updatedAt?: string; domainList: string[]; note?: string }
interface S { itemList: Record<number, Item> }
const primaryKeyList = { itemList: 'itemID' } as const;

const full = (name: string, updatedAt?: string): Item => ({ itemID: 1, name, updatedAt, domainList: ['a.com', 'b.com'], note: 'n' });
const thin = (name: string, updatedAt?: string): Item => ({ itemID: 1, name, updatedAt, domainList: [] });

const options = (versioned = false): ApplyChangeSetOptions<S> => ({
  metaList: new Map(),
  listSeqMap: new Map(),
  seq: 0,
  versionKeyList: versioned ? { itemList: 'updatedAt' } : undefined,
});

/** applies `stepList` in order, each with its own send sequence, and returns the resulting storage */
const run = (stepList: Array<{ seq: number; change: CdeebeeChangeSet<S> }>, versioned = false) => {
  const opts = options(versioned);
  let storage: S = { itemList: {} };
  for (const step of stepList) {
    storage = applyChangeSet(storage, step.change, primaryKeyList, { ...opts, seq: step.seq }).storage;
  }
  return { storage, meta: opts.metaList.get('itemList')?.get(1) };
};

describe('fill', () => {
  it('fills only keys the base lacks or holds as []', () => {
    const base = { a: 1, b: [], c: undefined, d: 'x' };
    expect(fill(base, { a: 2, b: [1], c: 3, d: 'y', e: 5 })).toEqual({ a: 1, b: [1], c: 3, d: 'x', e: 5 });
  });
  it('ignores donor holes and returns the same reference when nothing is filled', () => {
    const base = { a: 1, b: [] };
    expect(fill(base, { a: undefined, b: [] })).toBe(base);
  });
});

describe('readVersion', () => {
  it('parses ISO timestamps to ms so trimmed fractional seconds order correctly', () => {
    const short = readVersion({ v: '2026-01-01T00:00:00.12Z' }, 'v')!;
    const long = readVersion({ v: '2026-01-01T00:00:00.123Z' }, 'v')!;
    expect(long).toBeGreaterThan(short);
    expect('2026-01-01T00:00:00.12Z' > '2026-01-01T00:00:00.123Z').toBe(true);
  });
  it('passes numbers through and rejects garbage', () => {
    expect(readVersion({ v: 7 }, 'v')).toBe(7);
    expect(readVersion({ v: 'nope' }, 'v')).toBeUndefined();
    expect(readVersion({ v: 7 }, undefined)).toBeUndefined();
  });
});

describe('mergeEntity', () => {
  it('first write of an entity is taken as-is; patch leaves it incomplete, upsert marks it complete', () => {
    expect(mergeEntity(undefined, undefined, thin('a'), 'patch', undefined, 1)?.meta.complete).toBe(false);
    expect(mergeEntity(undefined, undefined, full('a'), 'upsert', undefined, 1)?.meta.complete).toBe(true);
  });
  it('older write against a complete entity is dropped', () => {
    expect(mergeEntity(full('a'), { seq: 5, complete: true }, full('old'), 'upsert', undefined, 4)).toBeUndefined();
  });
});

describe('completeness: thin and full responses commute', () => {
  const fullChange = (name: string): CdeebeeChangeSet<S> => ({ itemList: { upsertList: [full(name)] } });
  const thinChange = (name: string): CdeebeeChangeSet<S> => ({ itemList: { patchList: [thin(name)] } });

  it('full sent first, thin sent later: whichever arrives first, thin scalars win and relations survive', () => {
    const fullThenThin = run([{ seq: 1, change: fullChange('A') }, { seq: 2, change: thinChange('B') }]);
    const thinThenFull = run([{ seq: 2, change: thinChange('B') }, { seq: 1, change: fullChange('A') }]);
    const expected = { itemID: 1, name: 'B', domainList: ['a.com', 'b.com'], note: 'n', updatedAt: undefined };
    expect(fullThenThin.storage.itemList[1]).toEqual(expected);
    expect(thinThenFull.storage.itemList[1]).toEqual(expected);
  });

  it('thin sent first, full sent later: full wins whole in either arrival order', () => {
    const thinThenFull = run([{ seq: 1, change: thinChange('A') }, { seq: 2, change: fullChange('B') }]);
    const fullThenThin = run([{ seq: 2, change: fullChange('B') }, { seq: 1, change: thinChange('A') }]);
    expect(thinThenFull.storage.itemList[1]).toEqual(full('B'));
    expect(fullThenThin.storage.itemList[1]).toEqual(full('B'));
    expect(fullThenThin.meta?.complete).toBe(true);
  });

  it('a full response with [] after a delete is authoritative: a stale earlier full cannot resurrect the rows', () => {
    const afterDelete: CdeebeeChangeSet<S> = { itemList: { upsertList: [{ ...full('A'), domainList: [] }] } };
    const { storage } = run([{ seq: 2, change: afterDelete }, { seq: 1, change: fullChange('A') }]);
    expect(storage.itemList[1].domainList).toEqual([]);
  });

  it('a thin response never wipes a field it does not carry', () => {
    const { storage } = run([{ seq: 1, change: fullChange('A') }, { seq: 2, change: thinChange('A') }]);
    expect(storage.itemList[1].note).toBe('n');
  });
});

describe('freshness: server version beats send order', () => {
  const at = (n: number) => `2026-01-01T00:00:0${n}Z`;

  it('a response carrying an older version is dropped even when sent later', () => {
    const { storage } = run([
      { seq: 1, change: { itemList: { upsertList: [full('new', at(2))] } } },
      { seq: 2, change: { itemList: { upsertList: [full('old', at(1))] } } },
    ], true);
    expect(storage.itemList[1].name).toBe('new');
  });

  it('a newer-version thin response updates scalars and marks the entity incomplete', () => {
    const { storage, meta } = run([
      { seq: 1, change: { itemList: { upsertList: [full('A', at(1))] } } },
      { seq: 2, change: { itemList: { patchList: [thin('B', at(2))] } } },
    ], true);
    expect(storage.itemList[1]).toEqual({ ...full('B', at(2)) });
    expect(meta?.complete).toBe(false);
  });

  it('a same-version thin response keeps the entity complete', () => {
    const { meta } = run([
      { seq: 1, change: { itemList: { upsertList: [full('A', at(1))] } } },
      { seq: 2, change: { itemList: { patchList: [thin('A', at(1))] } } },
    ], true);
    expect(meta?.complete).toBe(true);
  });

  it('after a newer thin response, an older-version full response fills relations but leaves the entity incomplete', () => {
    const { storage, meta } = run([
      { seq: 2, change: { itemList: { patchList: [thin('B', at(2))] } } },
      { seq: 1, change: { itemList: { upsertList: [full('A', at(1))] } } },
    ], true);
    expect(storage.itemList[1].name).toBe('B');
    expect(storage.itemList[1].domainList).toEqual(['a.com', 'b.com']);
    expect(meta?.complete).toBe(false);
  });

  it('same version: send order decides scalars (local edit beats a slower earlier response)', () => {
    const { storage } = run([
      { seq: 2, change: { itemList: { patchList: [{ ...thin('edited', at(1)) }] } } },
      { seq: 1, change: { itemList: { upsertList: [full('server', at(1))] } } },
    ], true);
    expect(storage.itemList[1].name).toBe('edited');
    expect(storage.itemList[1].domainList).toEqual(['a.com', 'b.com']);
  });
});

describe('meta bookkeeping', () => {
  it('replaceList marks every entity complete and forgets the removed ones (the list boundary covers them)', () => {
    const opts = options();
    let storage: S = { itemList: { 1: full('A'), 2: { ...full('B'), itemID: 2 } } };
    storage = applyChangeSet(storage, { itemList: { upsertList: [full('A')] } }, primaryKeyList, { ...opts, seq: 1 }).storage;
    storage = applyChangeSet(storage, { itemList: { replaceList: { 1: thin('A') } } }, primaryKeyList, { ...opts, seq: 2 }).storage;
    const meta = opts.metaList.get('itemList')!;
    expect(storage.itemList).toEqual({ 1: thin('A') });
    expect(meta.get(1)).toEqual({ version: undefined, seq: 2, complete: true });
    expect(meta.get(2)).toBeUndefined();
    expect(opts.listSeqMap.get('itemList')).toBe(2);
  });

  it('a tombstone reads as incomplete and deleted, never as fully loaded', () => {
    const opts = options();
    let storage: S = { itemList: {} };
    storage = applyChangeSet(storage, { itemList: { upsertList: [full('A')] } }, primaryKeyList, { ...opts, seq: 1 }).storage;
    applyChangeSet(storage, { itemList: { removeIDList: [1] } }, primaryKeyList, { ...opts, seq: 2 });
    expect(opts.metaList.get('itemList')!.get(1)).toEqual({ seq: 2, complete: false, deleted: true });
  });

  it('a list reset prunes the tombstones it makes redundant and keeps the newer ones', () => {
    const opts = options();
    let storage: S = { itemList: {} };
    storage = applyChangeSet(storage, { itemList: { removeIDList: [1] } }, primaryKeyList, { ...opts, seq: 1 }).storage;
    storage = applyChangeSet(storage, { itemList: { removeIDList: [2] } }, primaryKeyList, { ...opts, seq: 5 }).storage;
    storage = applyChangeSet(storage, { itemList: { replaceList: {} } }, primaryKeyList, { ...opts, seq: 3 }).storage;
    const meta = opts.metaList.get('itemList')!;
    expect(meta.has(1)).toBe(false);
    expect(meta.get(2)?.deleted).toBe(true);
    // a removal at the reset's own sequence is covered by the boundary too
    applyChangeSet(storage, { itemList: { removeIDList: [3] } }, primaryKeyList, { ...opts, seq: 5 });
    applyChangeSet(storage, { itemList: { replaceList: {} } }, primaryKeyList, { ...opts, seq: 5 });
    expect(meta.has(3)).toBe(false);
    storage = applyChangeSet(storage, { itemList: { upsertList: [full('late')] } }, primaryKeyList, { ...opts, seq: 2 }).storage;
    expect(storage.itemList[1]).toBeUndefined();
    storage = applyChangeSet(storage, { itemList: { upsertList: [{ ...full('late'), itemID: 2 }] } }, primaryKeyList, { ...opts, seq: 4 }).storage;
    expect(storage.itemList[2]).toBeUndefined();
  });

  it('a removal at the same sequence as a tombstone does not re-allocate it', () => {
    const opts = options();
    let storage: S = { itemList: {} };
    storage = applyChangeSet(storage, { itemList: { removeIDList: [1] } }, primaryKeyList, { ...opts, seq: 3 }).storage;
    const first = opts.metaList.get('itemList')!.get(1);
    applyChangeSet(storage, { itemList: { removeIDList: [1] } }, primaryKeyList, { ...opts, seq: 3 });
    expect(opts.metaList.get('itemList')!.get(1)).toBe(first);
  });

  it('one commit may replace a list and re-add an entity the replacement dropped', () => {
    const opts = options();
    let storage: S = { itemList: { 1: full('A'), 2: { ...full('B'), itemID: 2 } } };
    storage = applyChangeSet(storage, { itemList: { upsertList: [full('A'), { ...full('B'), itemID: 2 }] } }, primaryKeyList, { ...opts, seq: 1 }).storage;
    storage = applyChangeSet(storage, {
      itemList: { replaceList: { 1: full('A') }, upsertList: [{ ...full('B2'), itemID: 2 }] },
    }, primaryKeyList, { ...opts, seq: 2 }).storage;
    expect(storage.itemList[2]?.name).toBe('B2');
  });

  it('remove and re-add at the same sequence apply in order, whichever comes first', () => {
    const write: CdeebeeChangeSet<S> = { itemList: { upsertList: [full('A')] } };
    const remove: CdeebeeChangeSet<S> = { itemList: { removeIDList: [1] } };
    expect(run([{ seq: 1, change: write }, { seq: 1, change: remove }]).storage.itemList[1]).toBeUndefined();
    expect(run([{ seq: 1, change: remove }, { seq: 1, change: write }]).storage.itemList[1]?.name).toBe('A');
  });

  it('removeIDList rejects stale resurrection but permits a newer re-add', () => {
    const opts = options();
    let storage: S = { itemList: {} };
    storage = applyChangeSet(storage, { itemList: { upsertList: [full('A')] } }, primaryKeyList, { ...opts, seq: 5 }).storage;
    storage = applyChangeSet(storage, { itemList: { removeIDList: [1] } }, primaryKeyList, { ...opts, seq: 6 }).storage;
    storage = applyChangeSet(storage, { itemList: { upsertList: [full('again')] } }, primaryKeyList, { ...opts, seq: 1 }).storage;
    expect(storage.itemList[1]).toBeUndefined();
    storage = applyChangeSet(storage, { itemList: { upsertList: [full('again')] } }, primaryKeyList, { ...opts, seq: 7 }).storage;
    expect(storage.itemList[1].name).toBe('again');
  });

  it('an unchanged entity keeps its reference but still advances meta', () => {
    const opts = options();
    const item = full('A');
    const empty: S = { itemList: {} };
    const first = applyChangeSet(empty, { itemList: { upsertList: [item] } }, primaryKeyList, { ...opts, seq: 1 });
    const second = applyChangeSet(first.storage, { itemList: { upsertList: [item] } }, primaryKeyList, { ...opts, seq: 2 });
    expect(second.storage).toBe(first.storage);
    expect(opts.metaList.get('itemList')!.get(1)!.seq).toBe(2);
  });
});

describe('setList: local edits replace the entity whole', () => {
  it('can clear an array and unset a field, unlike a patch', () => {
    const { storage } = run([
      { seq: 1, change: { itemList: { upsertList: [full('A')] } } },
      { seq: 2, change: { itemList: { setList: [{ ...full('A'), domainList: [], note: undefined }] } } },
    ]);
    expect(storage.itemList[1].domainList).toEqual([]);
    expect(storage.itemList[1].note).toBeUndefined();
  });

  it('keeps the completeness flag it found: a thin entity stays thin, a full one stays full', () => {
    const thinEdit = run([
      { seq: 1, change: { itemList: { patchList: [thin('A')] } } },
      { seq: 2, change: { itemList: { setList: [thin('B')] } } },
    ]);
    expect(thinEdit.meta?.complete).toBe(false);
    const fullEdit = run([
      { seq: 1, change: { itemList: { upsertList: [full('A')] } } },
      { seq: 2, change: { itemList: { setList: [full('B')] } } },
    ]);
    expect(fullEdit.meta?.complete).toBe(true);
    expect(fullEdit.storage.itemList[1].name).toBe('B');
  });

  it('a stale full response after a local edit fills the holes the edit left but never overrides it', () => {
    const { storage } = run([
      { seq: 2, change: { itemList: { setList: [thin('edited')] } } },
      { seq: 1, change: { itemList: { upsertList: [full('server')] } } },
    ]);
    expect(storage.itemList[1].name).toBe('edited');
    expect(storage.itemList[1].note).toBe('n');
  });
});

describe('replaceList honors freshness per entity', () => {
  it('a stale replaceList neither overrides nor removes entities written later', () => {
    const opts = options();
    let storage: S = { itemList: {} };
    storage = applyChangeSet(storage, { itemList: { upsertList: [full('new'), { ...full('kept'), itemID: 2 }] } }, primaryKeyList, { ...opts, seq: 2 }).storage;
    storage = applyChangeSet(storage, { itemList: { replaceList: { 1: full('old'), 3: { ...full('three'), itemID: 3 } } } }, primaryKeyList, { ...opts, seq: 1 }).storage;
    expect(storage.itemList[1].name).toBe('new');
    expect(storage.itemList[2].name).toBe('kept');
    expect(storage.itemList[3].name).toBe('three');
    expect(opts.metaList.get('itemList')?.get(2)?.seq).toBe(2);
  });

  it('a fresh replaceList still replaces the list exactly', () => {
    const opts = options();
    let storage: S = { itemList: {} };
    storage = applyChangeSet(storage, { itemList: { upsertList: [full('a'), { ...full('b'), itemID: 2 }] } }, primaryKeyList, { ...opts, seq: 1 }).storage;
    storage = applyChangeSet(storage, { itemList: { replaceList: { 1: full('a2') } } }, primaryKeyList, { ...opts, seq: 2 }).storage;
    expect(Object.keys(storage.itemList)).toEqual(['1']);
    expect(storage.itemList[1].name).toBe('a2');
    expect(opts.metaList.get('itemList')?.has(2)).toBe(false);
  });

  it('list reset and a stale upsert commute: the absent id stays absent in either order', () => {
    const reset: CdeebeeChangeSet<S> = { itemList: { replaceList: {} } };
    const stale: CdeebeeChangeSet<S> = { itemList: { upsertList: [full('stale')] } };
    expect(run([{ seq: 5, change: reset }, { seq: 1, change: stale }]).storage.itemList).toEqual({});
    expect(run([{ seq: 1, change: stale }, { seq: 5, change: reset }]).storage.itemList).toEqual({});
  });

  it('a reset sent before a later reset refreshes what it carries but deletes nothing', () => {
    const opts = options(true);
    const at = (n: number) => `2026-01-01T00:00:0${n}Z`;
    let storage: S = { itemList: {} };
    storage = applyChangeSet(storage, { itemList: { upsertList: [full('X', at(9))] } }, primaryKeyList, { ...opts, seq: 1 }).storage;
    // the later reset carries an older version, so X is kept with its seq-1 meta
    storage = applyChangeSet(storage, { itemList: { replaceList: { 1: full('old', at(8)) } } }, primaryKeyList, { ...opts, seq: 5 }).storage;
    expect(storage.itemList[1].name).toBe('X');
    // an earlier-sent empty reset arrives last: it must not delete what the seq-5 reset affirmed
    storage = applyChangeSet(storage, { itemList: { replaceList: {} } }, primaryKeyList, { ...opts, seq: 3 }).storage;
    expect(storage.itemList[1].name).toBe('X');
  });

  it('a replaceList carrying an older server version keeps the newer stored entity', () => {
    const opts = options(true);
    let storage: S = { itemList: {} };
    storage = applyChangeSet(storage, { itemList: { upsertList: [full('new', '2026-01-01T00:00:02Z')] } }, primaryKeyList, { ...opts, seq: 1 }).storage;
    storage = applyChangeSet(storage, { itemList: { replaceList: { 1: full('old', '2026-01-01T00:00:01Z') } } }, primaryKeyList, { ...opts, seq: 2 }).storage;
    expect(storage.itemList[1].name).toBe('new');
  });
});

describe('deletion boundaries survive re-adding an entity', () => {
  it.each(['clear', 'remove'] as const)('%s rejects pre-deletion fields after subsequent writes', kind => {
    const opts = options();
    let storage: S = { itemList: {} };
    const commit = (seq: number, change: CdeebeeChangeSet<S>) => {
      storage = applyChangeSet(storage, change, primaryKeyList, { ...opts, seq }).storage;
    };
    commit(2, { itemList: kind === 'clear' ? { replaceList: {} } : { removeIDList: [1] } });
    commit(3, { itemList: { patchList: [thin('new')] } });
    commit(4, { itemList: { setList: [thin('edited')] } });
    const before = storage;
    commit(1, { itemList: { upsertList: [full('old')] } });
    expect(storage).toBe(before);
    expect(storage.itemList[1]).toEqual(thin('edited'));
    expect(opts.metaList.get('itemList')?.get(1)?.complete).toBe(false);
    // A response sent after deletion may still fill a newer partial entity.
    commit(3, { itemList: { upsertList: [full('valid')] } });
    expect(storage.itemList[1]).toEqual(full('edited'));
  });

  it.each(['clear', 'remove'] as const)('%s also rejects older requests carrying a higher server version', kind => {
    const opts = options(true);
    let storage: S = { itemList: {} };
    const commit = (seq: number, change: CdeebeeChangeSet<S>) => {
      storage = applyChangeSet(storage, change, primaryKeyList, { ...opts, seq }).storage;
    };
    commit(2, { itemList: kind === 'clear' ? { replaceList: {} } : { removeIDList: [1] } });
    commit(3, { itemList: { upsertList: [thin('new', '2026-01-01')] } });
    commit(4, { itemList: { patchList: [thin('edited', '2026-01-02')] } });
    const before = storage;
    commit(1, { itemList: { replaceList: { 1: full('old', '2026-01-09') } } });
    commit(1, { itemList: { patchList: [full('old', '2026-01-09')] } });
    expect(storage).toBe(before);
  });
});

describe('list reset fast path', () => {
  it('skips an entire stale composite change but still updates other lists', () => {
    interface Store { itemList: Record<number, Item>; otherList: Record<number, Item> }
    const opts: ApplyChangeSetOptions<Store> = { metaList: new Map(), listSeqMap: new Map(), seq: 5 };
    const keys = { itemList: 'itemID', otherList: 'itemID' } as const;
    const initial: Store = { itemList: {}, otherList: {} };
    const reset = applyChangeSet(initial, { itemList: { replaceList: { 1: full('kept') } } }, keys, opts);
    const stale = applyChangeSet(reset.storage, {
      itemList: {
        replaceList: {}, upsertList: [full('old')], patchList: [thin('old')],
        setList: [thin('old')], removeIDList: [1],
      },
      otherList: { upsertList: [full('other')] },
    }, keys, { ...opts, seq: 4 });
    expect(stale.storage.itemList).toBe(reset.storage.itemList);
    expect(stale.storage.otherList[1]).toEqual(full('other'));
    expect(stale.changedList).toEqual([{ listName: 'otherList', entityIDList: [1] }]);
    const equal = applyChangeSet(stale.storage, { itemList: { patchList: [thin('equal')] } }, keys, opts);
    expect(equal.storage.itemList[1].name).toBe('equal');
  });
});

describe('server versions after a list reset that retains the entity', () => {
  it.each(['upsertList', 'patchList', 'setList', 'replaceList'] as const)('%s accepts a newer version from an earlier request', mode => {
    const saved = full('saved', '2026-01-01T10:01:00Z');
    const listed = full('listed', '2026-01-01T10:00:00Z');
    const change: CdeebeeChangeSet<S> = { itemList: mode === 'replaceList' ? { replaceList: { 1: saved } } : { [mode]: [saved] } };
    for (const reverse of [false, true]) {
      const steps = [{ seq: 4, change: { itemList: { replaceList: { 1: listed } } } }, { seq: 3, change }];
      const { storage } = run(reverse ? steps.reverse() : steps, true);
      expect(storage.itemList[1]).toEqual(saved);
    }
  });
});
