import { describe, it, expect } from 'vitest';
import { applyChangeSet, type ApplyChangeSetOptions } from '../../../lib/core/commit';
import type { CdeebeeChangeSet, CdeebeeListChange } from '../../../lib/core/types';

/**
 * Randomized commit sequences. The pairwise cases in merge.test.ts pin each rule; this file checks
 * they compose: the outcome must not depend on which response landed first, and in send order the
 * store must agree with a naive model that simply applies every write.
 */

interface Item { itemID: number; a?: number; b?: number; tagList?: number[]; updatedAt?: number }
interface S { itemList: Record<number, Item> }
const primaryKeyList = { itemList: 'itemID' } as const;
const ID_LIST = [1, 2, 3];

// deterministic LCG so a failure reproduces from the printed steps
let seed = 20260906;
const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const chance = (p: number) => random() < p;
const int = (max: number) => Math.floor(random() * max);
const pick = <T>(list: T[]): T => list[int(list.length)];
const shuffle = <T>(list: T[]): T[] => {
  const next = list.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = int(i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

/**
 * This generator restricts versions to send order to test composition under that assumption.
 * Servers may also process requests in reverse order; merge.test.ts and plugins/queryQueue.test.ts
 * cover that valid case explicitly.
 */
const versionAt = (seq: number) => Math.floor(seq / 2);

const entity = (itemID: number, seq: number, versioned: boolean): Item => ({
  itemID,
  a: int(5),
  ...(chance(0.5) ? { b: int(5) } : {}),
  ...(chance(0.5) ? { tagList: chance(0.5) ? [] : [1] } : {}),
  ...(versioned ? { updatedAt: versionAt(seq) } : {}),
});

type Change = CdeebeeListChange<Item>;
interface Step { seq: number; change: Change }
type Kind = 'upsert' | 'patch' | 'set' | 'remove' | 'replace';

interface GenerateOptions { kindList?: Kind[]; versioned?: boolean; composite?: boolean }
const generate = (count: number, { kindList = ['upsert', 'upsert', 'patch', 'set', 'remove', 'replace'], versioned = false, composite = false }: GenerateOptions = {}): Step[] => {
  const stepList: Step[] = [];
  for (let seq = 1; seq <= count; seq += 1) {
    const change: Change = {};
    const partCount = composite ? 1 + int(2) : 1;
    for (let part = 0; part < partCount; part += 1) {
      const kind = pick(kindList);
      if (kind === 'remove') change.removeIDList = [pick(ID_LIST)];
      else if (kind === 'replace') {
        change.replaceList = {};
        for (const itemID of ID_LIST) if (chance(0.5)) change.replaceList[itemID] = entity(itemID, seq, versioned);
      } else change[`${kind}List`] = [entity(pick(ID_LIST), seq, versioned)];
    }
    stepList.push({ seq, change });
  }
  return stepList;
};

const run = (stepList: Step[], versioned = false) => {
  const options: ApplyChangeSetOptions<S> = {
    metaList: new Map(), listSeqMap: new Map(), seq: 0, versionKeyList: versioned ? { itemList: 'updatedAt' } : undefined,
  };
  let storage: S = { itemList: {} };
  for (const step of stepList) {
    storage = applyChangeSet(storage, { itemList: step.change } as CdeebeeChangeSet<S>, primaryKeyList, { ...options, seq: step.seq }).storage;
  }
  const tombstoneCount = [...(options.metaList.get('itemList') ?? new Map()).values()].filter(meta => meta.deleted).length;
  return { storage, tombstoneCount };
};

/** what a store with no freshness rules would hold after applying the steps in send order */
const naivePresence = (stepList: Step[]): string => {
  let idSet = new Set<number>();
  for (const { change } of [...stepList].sort((x, y) => x.seq - y.seq)) {
    if (change.replaceList) idSet = new Set(Object.keys(change.replaceList).map(Number));
    for (const list of [change.upsertList, change.patchList, change.setList]) list?.forEach(item => idSet.add(item.itemID));
    change.removeIDList?.forEach(itemID => idSet.delete(itemID as number));
  }
  return [...idSet].sort().join(',');
};

const presence = (storage: S) => Object.keys(storage.itemList).map(Number).sort().join(',');
const ROUNDS = 1500;
const PERMUTATIONS = 4;

describe('fuzz: freshness rules compose', () => {
  it('in any arrival order the store holds exactly what a naive store would after send order (composite commits included)', () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const stepList = generate(3 + int(6), { composite: true });
      const expected = naivePresence(stepList);
      for (let p = 0; p < PERMUTATIONS; p += 1) {
        const shuffled = shuffle(stepList);
        expect(presence(run(shuffled).storage), JSON.stringify(shuffled)).toBe(expected);
      }
    }
  });

  it('with monotonic server versions, which entities are present is still order-independent', () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const stepList = generate(3 + int(6), { versioned: true });
      const expected = presence(run(stepList, true).storage);
      for (let p = 0; p < PERMUTATIONS; p += 1) {
        const shuffled = shuffle(stepList);
        expect(presence(run(shuffled, true).storage), JSON.stringify(shuffled)).toBe(expected);
      }
    }
  });

  it('without fill (upsert / remove / replace only) the whole storage is order-independent', () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const stepList = generate(3 + int(6), { kindList: ['upsert', 'remove', 'replace'] });
      const expected = run(stepList).storage;
      for (let p = 0; p < PERMUTATIONS; p += 1) {
        const shuffled = shuffle(stepList);
        expect(run(shuffled).storage, JSON.stringify(shuffled)).toEqual(expected);
      }
    }
  });

  it('tombstones never outnumber the removals sent after the last list reset', () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const stepList = generate(3 + int(8), { composite: true });
      const lastReset = Math.max(0, ...stepList.filter(step => step.change.replaceList).map(step => step.seq));
      const removalCount = stepList.filter(step => step.change.removeIDList && step.seq >= lastReset).length;
      expect(run(shuffle(stepList)).tombstoneCount, JSON.stringify(stepList)).toBeLessThanOrEqual(removalCount);
    }
  });
});
