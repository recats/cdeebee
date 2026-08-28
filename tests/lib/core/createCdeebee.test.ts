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
