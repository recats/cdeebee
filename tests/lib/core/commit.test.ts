import { describe, it, expect, vi, afterEach } from 'vitest';
import { applyChangeSet } from '../../../lib/core/commit';

interface User { id: number; name: string }
interface S { userList: Record<number, User>; postList: Record<number, { id: number; title: string }> }
const primaryKeyList = { userList: 'id', postList: 'id' } as const;

const base = (): S => ({
  userList: { 1: { id: 1, name: 'a' }, 2: { id: 2, name: 'b' } },
  postList: { 10: { id: 10, title: 'p' } },
});

describe('applyChangeSet', () => {
  afterEach(() => vi.restoreAllMocks());

  it('upsert adds and replaces entities and reports changed ids', () => {
    const storage = base();
    const { storage: next, changedList } = applyChangeSet(storage, {
      userList: { upsertList: [{ id: 2, name: 'B' }, { id: 3, name: 'c' }] },
    }, primaryKeyList);
    expect(next.userList[2]).toEqual({ id: 2, name: 'B' });
    expect(next.userList[3]).toEqual({ id: 3, name: 'c' });
    expect(next.userList[1]).toBe(storage.userList[1]);
    expect(changedList).toEqual([{ listName: 'userList', entityIDList: [2, 3] }]);
  });

  it('upsert replaces the entity whole (omitted fields disappear)', () => {
    const storage = base();
    const { storage: next } = applyChangeSet(storage, {
      userList: { upsertList: [{ id: 1 } as User] },
    }, primaryKeyList);
    expect(next.userList[1]).toEqual({ id: 1 });
  });

  it('keeps untouched list references', () => {
    const storage = base();
    const { storage: next } = applyChangeSet(storage, { userList: { upsertList: [{ id: 9, name: 'z' }] } }, primaryKeyList);
    expect(next.postList).toBe(storage.postList);
    expect(next.userList).not.toBe(storage.userList);
  });

  it('shallow-equal entity keeps its reference and is not reported', () => {
    const storage = base();
    const { storage: next, changedList } = applyChangeSet(storage, {
      userList: { upsertList: [{ id: 1, name: 'a' }] },
    }, primaryKeyList);
    expect(next.userList[1]).toBe(storage.userList[1]);
    expect(next.userList).toBe(storage.userList);
    expect(next).toBe(storage);
    expect(changedList).toEqual([]);
  });

  it('removeIDList removes existing ids only and reports them', () => {
    const storage = base();
    const { storage: next, changedList } = applyChangeSet(storage, {
      userList: { removeIDList: [1, 42] },
    }, primaryKeyList);
    expect(next.userList).toEqual({ 2: { id: 2, name: 'b' } });
    expect(changedList).toEqual([{ listName: 'userList', entityIDList: [1] }]);
  });

  it('replaceList swaps the list, keeps equal entity references, reports changed + removed ids', () => {
    const storage = base();
    const { storage: next, changedList } = applyChangeSet(storage, {
      userList: { replaceList: { 1: { id: 1, name: 'a' }, 5: { id: 5, name: 'e' } } },
    }, primaryKeyList);
    expect(Object.keys(next.userList)).toEqual(['1', '5']);
    expect(next.userList[1]).toBe(storage.userList[1]);
    expect(changedList).toEqual([{ listName: 'userList', entityIDList: [5, 2] }]);
  });

  it('replaceList with identical content keeps the list reference', () => {
    const storage = base();
    const { storage: next, changedList } = applyChangeSet(storage, {
      userList: { replaceList: { 1: { id: 1, name: 'a' }, 2: { id: 2, name: 'b' } } },
    }, primaryKeyList);
    expect(next.userList).toBe(storage.userList);
    expect(changedList).toEqual([]);
  });

  it('skips entities without primaryKey and logs in dev', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const storage = base();
    const { storage: next, changedList } = applyChangeSet(storage, {
      userList: { upsertList: [{ name: 'no-id' } as unknown as User, { id: 4, name: 'd' }] },
    }, primaryKeyList);
    expect(next.userList[4]).toEqual({ id: 4, name: 'd' });
    expect(changedList).toEqual([{ listName: 'userList', entityIDList: [4] }]);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('creates a missing list on the fly', () => {
    const storage = { userList: {} } as unknown as S;
    const { storage: next } = applyChangeSet(storage, { postList: { upsertList: [{ id: 1, title: 't' }] } }, primaryKeyList);
    expect(next.postList[1]).toEqual({ id: 1, title: 't' });
  });

  it('applies removeIDList after upsertList within one list change', () => {
    const storage = base();
    const { storage: next } = applyChangeSet(storage, {
      userList: { upsertList: [{ id: 7, name: 'g' }], removeIDList: [7] },
    }, primaryKeyList);
    expect(next.userList[7]).toBeUndefined();
  });

  it('no-op change on a missing list keeps the storage reference', () => {
    const storage = { userList: {} } as unknown as S;
    const empty = applyChangeSet(storage, { postList: {} }, primaryKeyList);
    expect(empty.storage).toBe(storage);
    expect(empty.changedList).toEqual([]);
    const removeMissing = applyChangeSet(storage, { postList: { removeIDList: [999] } }, primaryKeyList);
    expect(removeMissing.storage).toBe(storage);
    expect(removeMissing.changedList).toEqual([]);
  });
});
