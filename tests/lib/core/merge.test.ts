import { describe, it, expect } from 'vitest';
import { applyChangeSet, fill, mergeEntity, readVersion, type ApplyChangeSetOptions } from '../../../lib/core/commit';
import type { CdeebeeChangeSet } from '../../../lib/core/types';

interface Seller { sellerID: number; name: string; updatedAt?: string; domainList: string[]; note?: string }
interface S { sellerList: Record<number, Seller> }
const primaryKeyList = { sellerList: 'sellerID' } as const;

const full = (name: string, updatedAt?: string): Seller => ({ sellerID: 1, name, updatedAt, domainList: ['a.com', 'b.com'], note: 'n' });
const thin = (name: string, updatedAt?: string): Seller => ({ sellerID: 1, name, updatedAt, domainList: [] });

const options = (versioned = false): ApplyChangeSetOptions<S> => ({
  metaList: new Map(),
  seq: 0,
  versionKeyList: versioned ? { sellerList: 'updatedAt' } : undefined,
});

/** applies `stepList` in order, each with its own send sequence, and returns the resulting storage */
const run = (stepList: Array<{ seq: number; change: CdeebeeChangeSet<S> }>, versioned = false) => {
  const opts = options(versioned);
  let storage: S = { sellerList: {} };
  for (const step of stepList) {
    storage = applyChangeSet(storage, step.change, primaryKeyList, { ...opts, seq: step.seq }).storage;
  }
  return { storage, meta: opts.metaList.get('sellerList')?.get(1) };
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
  const fullChange = (name: string): CdeebeeChangeSet<S> => ({ sellerList: { upsertList: [full(name)] } });
  const thinChange = (name: string): CdeebeeChangeSet<S> => ({ sellerList: { patchList: [thin(name)] } });

  it('full sent first, thin sent later: whichever arrives first, thin scalars win and relations survive', () => {
    const fullThenThin = run([{ seq: 1, change: fullChange('A') }, { seq: 2, change: thinChange('B') }]);
    const thinThenFull = run([{ seq: 2, change: thinChange('B') }, { seq: 1, change: fullChange('A') }]);
    const expected = { sellerID: 1, name: 'B', domainList: ['a.com', 'b.com'], note: 'n', updatedAt: undefined };
    expect(fullThenThin.storage.sellerList[1]).toEqual(expected);
    expect(thinThenFull.storage.sellerList[1]).toEqual(expected);
  });

  it('thin sent first, full sent later: full wins whole in either arrival order', () => {
    const thinThenFull = run([{ seq: 1, change: thinChange('A') }, { seq: 2, change: fullChange('B') }]);
    const fullThenThin = run([{ seq: 2, change: fullChange('B') }, { seq: 1, change: thinChange('A') }]);
    expect(thinThenFull.storage.sellerList[1]).toEqual(full('B'));
    expect(fullThenThin.storage.sellerList[1]).toEqual(full('B'));
    expect(fullThenThin.meta?.complete).toBe(true);
  });

  it('a full response with [] after a delete is authoritative: a stale earlier full cannot resurrect the rows', () => {
    const afterDelete: CdeebeeChangeSet<S> = { sellerList: { upsertList: [{ ...full('A'), domainList: [] }] } };
    const { storage } = run([{ seq: 2, change: afterDelete }, { seq: 1, change: fullChange('A') }]);
    expect(storage.sellerList[1].domainList).toEqual([]);
  });

  it('a thin response never wipes a field it does not carry', () => {
    const { storage } = run([{ seq: 1, change: fullChange('A') }, { seq: 2, change: thinChange('A') }]);
    expect(storage.sellerList[1].note).toBe('n');
  });
});

describe('freshness: server version beats send order', () => {
  const at = (n: number) => `2026-01-01T00:00:0${n}Z`;

  it('a response carrying an older version is dropped even when sent later', () => {
    const { storage } = run([
      { seq: 1, change: { sellerList: { upsertList: [full('new', at(2))] } } },
      { seq: 2, change: { sellerList: { upsertList: [full('old', at(1))] } } },
    ], true);
    expect(storage.sellerList[1].name).toBe('new');
  });

  it('a newer-version thin response updates scalars and marks the entity incomplete', () => {
    const { storage, meta } = run([
      { seq: 1, change: { sellerList: { upsertList: [full('A', at(1))] } } },
      { seq: 2, change: { sellerList: { patchList: [thin('B', at(2))] } } },
    ], true);
    expect(storage.sellerList[1]).toEqual({ ...full('B', at(2)) });
    expect(meta?.complete).toBe(false);
  });

  it('a same-version thin response keeps the entity complete', () => {
    const { meta } = run([
      { seq: 1, change: { sellerList: { upsertList: [full('A', at(1))] } } },
      { seq: 2, change: { sellerList: { patchList: [thin('A', at(1))] } } },
    ], true);
    expect(meta?.complete).toBe(true);
  });

  it('after a newer thin response, an older-version full response fills relations but leaves the entity incomplete', () => {
    const { storage, meta } = run([
      { seq: 2, change: { sellerList: { patchList: [thin('B', at(2))] } } },
      { seq: 1, change: { sellerList: { upsertList: [full('A', at(1))] } } },
    ], true);
    expect(storage.sellerList[1].name).toBe('B');
    expect(storage.sellerList[1].domainList).toEqual(['a.com', 'b.com']);
    expect(meta?.complete).toBe(false);
  });

  it('same version: send order decides scalars (local edit beats a slower earlier response)', () => {
    const { storage } = run([
      { seq: 2, change: { sellerList: { patchList: [{ ...thin('edited', at(1)) }] } } },
      { seq: 1, change: { sellerList: { upsertList: [full('server', at(1))] } } },
    ], true);
    expect(storage.sellerList[1].name).toBe('edited');
    expect(storage.sellerList[1].domainList).toEqual(['a.com', 'b.com']);
  });
});

describe('meta bookkeeping', () => {
  it('replaceList marks every entity complete and forgets removed ones', () => {
    const opts = options();
    let storage: S = { sellerList: { 1: full('A'), 2: { ...full('B'), sellerID: 2 } } };
    storage = applyChangeSet(storage, { sellerList: { upsertList: [full('A')] } }, primaryKeyList, { ...opts, seq: 1 }).storage;
    storage = applyChangeSet(storage, { sellerList: { replaceList: { 1: thin('A') } } }, primaryKeyList, { ...opts, seq: 2 }).storage;
    const meta = opts.metaList.get('sellerList')!;
    expect(storage.sellerList).toEqual({ 1: thin('A') });
    expect(meta.get(1)).toEqual({ version: undefined, seq: 2, complete: true });
    expect(meta.get(2)).toBeUndefined();
  });

  it('removeIDList forgets meta so a re-added entity starts fresh', () => {
    const opts = options();
    let storage: S = { sellerList: {} };
    storage = applyChangeSet(storage, { sellerList: { upsertList: [full('A')] } }, primaryKeyList, { ...opts, seq: 5 }).storage;
    storage = applyChangeSet(storage, { sellerList: { removeIDList: [1] } }, primaryKeyList, { ...opts, seq: 6 }).storage;
    storage = applyChangeSet(storage, { sellerList: { upsertList: [full('again')] } }, primaryKeyList, { ...opts, seq: 1 }).storage;
    expect(storage.sellerList[1].name).toBe('again');
  });

  it('an unchanged entity keeps its reference but still advances meta', () => {
    const opts = options();
    const seller = full('A');
    const empty: S = { sellerList: {} };
    const first = applyChangeSet(empty, { sellerList: { upsertList: [seller] } }, primaryKeyList, { ...opts, seq: 1 });
    const second = applyChangeSet(first.storage, { sellerList: { upsertList: [seller] } }, primaryKeyList, { ...opts, seq: 2 });
    expect(second.storage).toBe(first.storage);
    expect(opts.metaList.get('sellerList')!.get(1)!.seq).toBe(2);
  });
});

describe('setList: local edits replace the entity whole', () => {
  it('can clear an array and unset a field, unlike a patch', () => {
    const { storage } = run([
      { seq: 1, change: { sellerList: { upsertList: [full('A')] } } },
      { seq: 2, change: { sellerList: { setList: [{ ...full('A'), domainList: [], note: undefined }] } } },
    ]);
    expect(storage.sellerList[1].domainList).toEqual([]);
    expect(storage.sellerList[1].note).toBeUndefined();
  });

  it('keeps the completeness flag it found: a thin entity stays thin, a full one stays full', () => {
    const thinEdit = run([
      { seq: 1, change: { sellerList: { patchList: [thin('A')] } } },
      { seq: 2, change: { sellerList: { setList: [thin('B')] } } },
    ]);
    expect(thinEdit.meta?.complete).toBe(false);
    const fullEdit = run([
      { seq: 1, change: { sellerList: { upsertList: [full('A')] } } },
      { seq: 2, change: { sellerList: { setList: [full('B')] } } },
    ]);
    expect(fullEdit.meta?.complete).toBe(true);
    expect(fullEdit.storage.sellerList[1].name).toBe('B');
  });

  it('a stale full response after a local edit fills the holes the edit left but never overrides it', () => {
    const { storage } = run([
      { seq: 2, change: { sellerList: { setList: [thin('edited')] } } },
      { seq: 1, change: { sellerList: { upsertList: [full('server')] } } },
    ]);
    expect(storage.sellerList[1].name).toBe('edited');
    expect(storage.sellerList[1].note).toBe('n');
  });
});

describe('replaceList honors freshness per entity', () => {
  it('a stale replaceList neither overrides nor removes entities written later', () => {
    const opts = options();
    let storage: S = { sellerList: {} };
    storage = applyChangeSet(storage, { sellerList: { upsertList: [full('new'), { ...full('kept'), sellerID: 2 }] } }, primaryKeyList, { ...opts, seq: 2 }).storage;
    storage = applyChangeSet(storage, { sellerList: { replaceList: { 1: full('old'), 3: { ...full('three'), sellerID: 3 } } } }, primaryKeyList, { ...opts, seq: 1 }).storage;
    expect(storage.sellerList[1].name).toBe('new');
    expect(storage.sellerList[2].name).toBe('kept');
    expect(storage.sellerList[3].name).toBe('three');
    expect(opts.metaList.get('sellerList')?.get(2)?.seq).toBe(2);
  });

  it('a fresh replaceList still replaces the list exactly', () => {
    const opts = options();
    let storage: S = { sellerList: {} };
    storage = applyChangeSet(storage, { sellerList: { upsertList: [full('a'), { ...full('b'), sellerID: 2 }] } }, primaryKeyList, { ...opts, seq: 1 }).storage;
    storage = applyChangeSet(storage, { sellerList: { replaceList: { 1: full('a2') } } }, primaryKeyList, { ...opts, seq: 2 }).storage;
    expect(Object.keys(storage.sellerList)).toEqual(['1']);
    expect(storage.sellerList[1].name).toBe('a2');
    expect(opts.metaList.get('sellerList')?.has(2)).toBe(false);
  });

  it('a replaceList carrying an older server version keeps the newer stored entity', () => {
    const opts = options(true);
    let storage: S = { sellerList: {} };
    storage = applyChangeSet(storage, { sellerList: { upsertList: [full('new', '2026-01-01T00:00:02Z')] } }, primaryKeyList, { ...opts, seq: 1 }).storage;
    storage = applyChangeSet(storage, { sellerList: { replaceList: { 1: full('old', '2026-01-01T00:00:01Z') } } }, primaryKeyList, { ...opts, seq: 2 }).storage;
    expect(storage.sellerList[1].name).toBe('new');
  });
});
