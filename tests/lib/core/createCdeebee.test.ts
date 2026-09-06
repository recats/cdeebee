import { describe, it, expect, vi } from 'vitest';
import { createCdeebee } from '../../../lib/core/createCdeebee';
import type { CdeebeePlugin } from '../../../lib/core/types';

interface User { userID: number; name: string; orgID: number }
interface S { userList: Record<number, User>; postList: Record<number, { postID: number }> }

const make = (over: Partial<Parameters<typeof createCdeebee<S>>[0]> = {}) => createCdeebee<S>({
  fetch: {},
  primaryKeyList: { userList: 'userID', postList: 'postID' },
  indexList: { userList: ['orgID'] },
  ...over,
});

describe('createCdeebee store', () => {
  it('initializes every list from primaryKeyList and applies initialStorage', () => {
    const db = make({ initialStorage: { userList: { 1: { userID: 1, name: 'a', orgID: 1 } } } });
    expect(db.getState().storage.postList).toEqual({});
    expect(db.getState().storage.userList[1].name).toBe('a');
    expect(db.getState().activeRequestList).toEqual([]);
  });

  it('commit applies a change set, returns changedList, notifies keyed listeners', () => {
    const db = make();
    const listener = vi.fn();
    const other = vi.fn();
    db.subscribe(listener, [{ listName: 'userList', entityID: 1 }]);
    db.subscribe(other, [{ listName: 'postList' }]);
    const changedList = db.commit({ userList: { upsertList: [{ userID: 1, name: 'a', orgID: 1 }] } }, { source: 'set' });
    expect(changedList).toEqual([{ listName: 'userList', entityIDList: [1] }]);
    db.flush();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it('commit with no effective change keeps state reference and notifies nobody', () => {
    const db = make({ initialStorage: { userList: { 1: { userID: 1, name: 'a', orgID: 1 } } } });
    const listener = vi.fn();
    db.subscribe(listener);
    const before = db.getState();
    db.commit({ userList: { upsertList: [{ userID: 1, name: 'a', orgID: 1 }] } }, { source: 'set' });
    db.flush();
    expect(db.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('setEntity merges a patch, sets the primary key, accepts an updater', () => {
    const db = make();
    db.setEntity('userList', 1, { name: 'a', orgID: 2 } as Partial<User>);
    expect(db.getState().storage.userList[1]).toEqual({ userID: 1, name: 'a', orgID: 2 });
    db.setEntity('userList', 1, prev => ({ ...prev!, name: prev!.name + '!' }));
    expect(db.getState().storage.userList[1].name).toBe('a!');
  });

  it('setEntity forces the primary key on the updater result', () => {
    const db = make({ initialStorage: { userList: { 1: { userID: 1, name: 'a', orgID: 1 } } } });
    db.setEntity('userList', 1, prev => ({ name: prev!.name + '!', orgID: prev!.orgID } as User));
    expect(db.getState().storage.userList[1]).toEqual({ userID: 1, name: 'a!', orgID: 1 });
  });

  it('removeEntityList / clearList / replaceList', () => {
    const db = make({ initialStorage: { userList: { 1: { userID: 1, name: 'a', orgID: 1 }, 2: { userID: 2, name: 'b', orgID: 1 } } } });
    db.removeEntityList('userList', [1]);
    expect(Object.keys(db.getState().storage.userList)).toEqual(['2']);
    db.clearList('userList');
    expect(db.getState().storage.userList).toEqual({});
    db.replaceList('userList', { 5: { userID: 5, name: 'e', orgID: 3 } });
    expect(db.getState().storage.userList[5].name).toBe('e');
  });

  it('keeps indexes in sync through commits', () => {
    const db = make({ initialStorage: { userList: { 1: { userID: 1, name: 'a', orgID: 1 } } } });
    expect(Array.from(db.getIndex('userList', 'orgID', 1))).toEqual([1]);
    db.setEntity('userList', 1, { orgID: 2 } as Partial<User>);
    db.setEntity('userList', 2, { name: 'b', orgID: 2 } as Partial<User>);
    expect(db.getIndex('userList', 'orgID', 1).size).toBe(0);
    expect(Array.from(db.getIndex('userList', 'orgID', 2)).sort()).toEqual([1, 2]);
  });

  it('getSnapshot includes plugin state; getPlugin finds by name; setup is called', () => {
    const setup = vi.fn();
    const plugin: CdeebeePlugin<S> = { name: 'p', setup, getState: () => ({ hello: 1 }) };
    const db = make({ pluginList: [plugin] });
    expect(setup).toHaveBeenCalledWith(db);
    expect(db.getPlugin('p')).toBe(plugin);
    expect(db.getPlugin('nope')).toBeUndefined();
    expect(db.getSnapshot()).toEqual({ state: db.getState(), pluginStateList: { p: { hello: 1 } } });
  });

  it('setEntity notifies synchronously so controlled inputs keep their value', () => {
    const db = make();
    const listener = vi.fn();
    db.subscribe(listener, [{ listName: 'userList', entityID: 1 }]);
    db.setEntity('userList', 1, { name: 'a', orgID: 1 } as Partial<User>);
    expect(listener).toHaveBeenCalledTimes(1);
    db.removeEntityList('userList', [1]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('a local commit flushes before plugin onCommit runs', () => {
    const callList: string[] = [];
    const db = make({ pluginList: [{ name: 'p', onCommit: () => { callList.push('onCommit'); } }] });
    db.subscribe(() => { callList.push('listener'); }, [{ listName: 'userList' }]);
    db.setEntity('userList', 1, { name: 'a', orgID: 1 } as Partial<User>);
    expect(callList).toEqual(['listener', 'onCommit']);
  });

  it('onCommit plugin hook receives changeSet, meta, changedList', () => {
    const onCommit = vi.fn();
    const db = make({ pluginList: [{ name: 'p', onCommit }] });
    db.setEntity('postList', 3, {});
    expect(onCommit).toHaveBeenCalledWith(
      { postList: { setList: [{ postID: 3 }] } },
      { source: 'set', label: 'setEntity:postList' },
      [{ listName: 'postList', entityIDList: [3] }],
    );
  });

});

describe('deletion and list reset ordering', () => {
  type S = { userList: Record<number, { userID: number; v: number }> };
  const settings = { fetch: {}, primaryKeyList: { userList: 'userID' as const } };

  it('old response must not resurrect locally deleted entity', () => {
    const db = createCdeebee<S>(settings);
    db.setEntity('userList', 1, { v: 1 });
    db.removeEntityList('userList', [1]);
    db.commit({ userList: { upsertList: [{ userID: 1, v: 0 }] } }, { source: 'request', seq: 1 });
    expect(db.getState().storage.userList[1]).toBeUndefined();
  });

  it.each(['upsertList', 'patchList', 'setList', 'replaceList'] as const)('list reset blocks unknown entities from an older %s response', mode => {
    const db = createCdeebee<S>(settings);
    db.clearList('userList');
    const entity = { userID: 9, v: 1 };
    db.commit({ userList: { [mode]: mode === 'replaceList' ? { 9: entity } : [entity] } }, { source: 'request', seq: 0 });
    expect(db.getState().storage.userList).toEqual({});
    db.setEntity('userList', 9, { v: 2 });
    expect(db.getState().storage.userList[9].v).toBe(2);
  });

  it('stale deletion cannot remove a newer entity', () => {
    const db = createCdeebee<S>(settings);
    db.setEntity('userList', 1, { v: 1 });
    db.commit({ userList: { removeIDList: [1] } }, { source: 'request', seq: 0 });
    expect(db.getState().storage.userList[1].v).toBe(1);
  });

  it('a caller-supplied seq advances the internal counter, so later local writes still win', () => {
    const db = createCdeebee<S>(settings);
    db.commit({ userList: { replaceList: { 1: { userID: 1, v: 1 } } } }, { source: 'request', seq: 1000 });
    db.removeEntityList('userList', [1]);
    expect(db.getState().storage.userList[1]).toBeUndefined();
    db.setEntity('userList', 2, { v: 2 });
    expect(db.getState().storage.userList[2].v).toBe(2);
  });

  it('getEntityMeta hides tombstones: a removed entity has no meta, like one never seen', () => {
    const db = createCdeebee<S>(settings);
    db.setEntity('userList', 1, { v: 1 });
    expect(db.getEntityMeta('userList', 1)).toBeDefined();
    db.removeEntityList('userList', [1]);
    expect(db.getEntityMeta('userList', 1)).toBeUndefined();
    db.commit({ userList: { upsertList: [{ userID: 1, v: 0 }] } }, { source: 'request', seq: 1 });
    expect(db.getState().storage.userList[1]).toBeUndefined();
  });

  it('replaceList deletion blocks stale replacement and allows fresh re-add', () => {
    const db = createCdeebee<S>(settings);
    db.setEntity('userList', 1, { v: 1 });
    db.replaceList('userList', {});
    db.commit({ userList: { replaceList: { 1: { userID: 1, v: 0 } } } }, { source: 'request', seq: 1 });
    expect(db.getState().storage.userList).toEqual({});
    db.setEntity('userList', 1, { v: 3 });
    expect(db.getState().storage.userList[1].v).toBe(3);
    expect(db.getEntityMeta('userList', 1)?.complete).toBe(false);
  });
});

describe('public entity metadata', () => {
  it.each(['remove', 'clear'] as const)('hides the %s boundary and returns a detached value', kind => {
    const db = make();
    db.setEntity('userList', 1, { name: 'old', orgID: 1 });
    if (kind === 'remove') db.removeEntityList('userList', [1]);
    else db.clearList('userList');
    db.setEntity('userList', 1, { name: 'new', orgID: 2 });
    const meta = db.getEntityMeta('userList', 1)!;
    expect(meta).toEqual({ version: undefined, seq: 3, complete: false });
    expect(Object.keys(meta).sort()).toEqual(['complete', 'seq', 'version']);
    meta.seq = 0;
    meta.complete = true;
    expect(db.getEntityMeta('userList', 1)).toEqual({ version: undefined, seq: 3, complete: false });
    db.commit({ userList: { upsertList: [{ userID: 1, name: 'stale', orgID: 9 }] } }, { source: 'request', seq: 1 });
    expect(db.getState().storage.userList[1].name).toBe('new');
  });
});

describe('metadata ID normalization', () => {
  it('numeric and canonical string IDs refer to the same metadata', () => {
    const db = make();
    db.setEntity('userList', 1, { name: 'one', orgID: 1 });
    expect(db.getEntityMeta('userList', '1')).toEqual(db.getEntityMeta('userList', 1));
    expect(db.getEntityMeta('userList', '01')).toBeUndefined();
    db.removeEntityList('userList', ['1']);
    expect(db.getEntityMeta('userList', 1)).toBeUndefined();
    expect(db.getEntityMeta('userList', '1')).toBeUndefined();
  });
});

describe('optimistic deletion sequence contract', () => {
  it('removing before sending a request allows its deletion confirmation', async () => {
    const db = make({ fetch: { fetch: async () => new Response('{}') } });
    db.setEntity('userList', 1, { name: 'one', orgID: 1 });
    db.removeEntityList('userList', [1]);
    await db.request({ api: '/delete', normalize: () => ({ userList: { removeIDList: [1] } }) });
    expect(db.getState().storage.userList[1]).toBeUndefined();
  });

  it('a local write after sending deletion protects the newer entity', async () => {
    const db = make({ fetch: { fetch: async () => new Response('{}') } });
    db.setEntity('userList', 1, { name: 'one', orgID: 1 });
    const request = db.request({ api: '/delete', normalize: () => ({ userList: { removeIDList: [1] } }) });
    db.setEntity('userList', 1, { name: 'local edit' });
    await request;
    expect(db.getState().storage.userList[1].name).toBe('local edit');
  });
});
