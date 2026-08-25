import { describe, it, expect, vi, afterEach } from 'vitest';
import { isListEnvelope, defaultNormalize, extractResultIDList } from '../../../lib/core/normalize';
import type { CdeebeeNormalizeContext } from '../../../lib/core/types';

interface S { userList: Record<number, { id: number; name: string }>; postList: Record<number, { id: number }> }

const ctx = (strategyList: CdeebeeNormalizeContext<S>['strategyList'] = {}): CdeebeeNormalizeContext<S> => ({
  storage: { userList: {}, postList: {} },
  primaryKeyList: { userList: 'id', postList: 'id' },
  strategyList,
  api: '/x',
  requestID: 'r1',
});

describe('isListEnvelope', () => {
  it('accepts { data: [], primaryKey: string }', () => {
    expect(isListEnvelope({ data: [], primaryKey: 'id' })).toBe(true);
  });
  it('rejects everything else', () => {
    expect(isListEnvelope({ data: [] })).toBe(false);
    expect(isListEnvelope({ data: {}, primaryKey: 'id' })).toBe(false);
    expect(isListEnvelope(null)).toBe(false);
    expect(isListEnvelope('ok')).toBe(false);
  });
});

describe('defaultNormalize', () => {
  afterEach(() => vi.restoreAllMocks());

  it('maps envelopes to upsertList by default and ignores non-list keys', () => {
    const changeSet = defaultNormalize<S>({
      responseStatus: 'Success',
      rawResponse: { x: 1 },
      userList: { data: [{ id: 1, name: 'a' }], primaryKey: 'id' },
    }, ctx());
    expect(changeSet).toEqual({ userList: { upsertList: [{ id: 1, name: 'a' }] } });
  });

  it('replaceList strategy produces a keyed record', () => {
    const changeSet = defaultNormalize<S>({
      userList: { data: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }], primaryKey: 'id' },
    }, ctx({ userList: 'replaceList' }));
    expect(changeSet).toEqual({ userList: { replaceList: { 1: { id: 1, name: 'a' }, 2: { id: 2, name: 'b' } } } });
  });

  it('skip strategy omits the list', () => {
    const changeSet = defaultNormalize<S>({ userList: { data: [{ id: 1, name: 'a' }], primaryKey: 'id' } }, ctx({ userList: 'skip' }));
    expect(changeSet).toEqual({});
  });

  it('settings primaryKey wins over backend primaryKey and warns in dev', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const changeSet = defaultNormalize<S>({
      userList: { data: [{ id: 1, name: 'a' }], primaryKey: 'userID' },
    }, ctx({ userList: 'replaceList' }));
    expect(changeSet).toEqual({ userList: { replaceList: { 1: { id: 1, name: 'a' } } } });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('unknown list (not in primaryKeyList) uses backend primaryKey', () => {
    const changeSet = defaultNormalize<S>({
      extraList: { data: [{ extraID: 5 }], primaryKey: 'extraID' },
    }, ctx());
    expect(changeSet).toEqual({ extraList: { upsertList: [{ extraID: 5 }] } });
  });

  it('non-object response yields an empty change set', () => {
    expect(defaultNormalize<S>('text', ctx())).toEqual({});
    expect(defaultNormalize<S>(null, ctx())).toEqual({});
  });
});

describe('extractResultIDList', () => {
  it('collects ids from upsertList and replaceList', () => {
    const result = extractResultIDList<S>({
      userList: { upsertList: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] },
      postList: { replaceList: { 7: { id: 7 } } },
    }, { userList: 'id', postList: 'id' });
    expect(result).toEqual({ userList: [1, 2], postList: [7] });
  });
  it('ignores removeIDList-only changes', () => {
    expect(extractResultIDList<S>({ userList: { removeIDList: [1] } }, { userList: 'id', postList: 'id' })).toEqual({});
  });
  it('normalizes numeric-looking string ids on both paths, keeping non-numeric ones', () => {
    const result = extractResultIDList<S>({
      userList: { upsertList: [{ id: '1', name: 'a' }, { id: '007', name: 'b' }] as unknown as { id: number; name: string }[] },
      postList: { replaceList: { '2': { id: 2 } } },
    }, { userList: 'id', postList: 'id' });
    expect(result).toEqual({ userList: [1, '007'], postList: [2] });
  });
});
