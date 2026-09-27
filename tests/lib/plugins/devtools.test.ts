import { describe, it, expect, vi, afterEach } from 'vitest';
import { createCdeebee } from '../../../lib/core/createCdeebee';
import { devtools } from '../../../lib/plugins/devtools';
import { history } from '../../../lib/plugins/history';
import type { CdeebeeChangedList, CdeebeeInstance, CdeebeePlugin } from '../../../lib/core/types';
import { jsonResponse, mockFetch, tick } from '../test-helpers';

interface S { userList: Record<number, { userID: number; count?: number }> }
const g = globalThis as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown };

describe('devtools plugin', () => {
  afterEach(() => { delete g.__REDUX_DEVTOOLS_EXTENSION__; });

  it('is a no-op without the extension', async () => {
    const db = createCdeebee<S>({ fetch: { fetch: mockFetch([jsonResponse({})]) }, primaryKeyList: { userList: 'userID' }, pluginList: [devtools<S>()] });
    db.setEntity('userList', 1, {});
    await expect(db.request({ api: '/x' })).resolves.toEqual({});
  });

  it('treats a user commit labelled reset as an ordinary action', () => {
    const connection = { init: vi.fn(), send: vi.fn() };
    g.__REDUX_DEVTOOLS_EXTENSION__ = { connect: () => connection };
    const db = createCdeebee<S>({ fetch: {}, primaryKeyList: { userList: 'userID' }, pluginList: [devtools<S>()] });
    const meta = { source: 'set', label: 'reset' } as const;
    db.commit({ userList: { patchList: [{ userID: 1 }] } }, meta);
    expect(connection.init).toHaveBeenCalledTimes(1);
    expect(connection.send).toHaveBeenLastCalledWith({ type: 'reset', meta }, db.getSnapshot());

    db.reset();
    expect(connection.init).toHaveBeenCalledTimes(2);
    db.commit({ userList: { patchList: [{ userID: 2 }] } }, meta);
    expect(connection.init).toHaveBeenCalledTimes(2);
    expect(connection.send).toHaveBeenLastCalledWith({ type: 'reset', meta }, db.getSnapshot());
  });

  it('rejects user commits with the reserved reset source', () => {
    const connection = { init: vi.fn(), send: vi.fn() };
    g.__REDUX_DEVTOOLS_EXTENSION__ = { connect: () => connection };
    const db = createCdeebee<S>({ fetch: {}, primaryKeyList: { userList: 'userID' }, pluginList: [devtools<S>()] });
    expect(() => db.commit({ userList: { patchList: [{ userID: 1 }] } }, { source: 'reset' } as never)).toThrow(TypeError);
    expect(db.getState().storage.userList).toEqual({});
    expect(connection.init).toHaveBeenCalledTimes(1);
    expect(connection.send).not.toHaveBeenCalled();
  });

  describe.each([false, true])('reentrant reset with devtools first=%s', first => {
    it.each(['onReset', 'abort', 'onCommit'])('records writes from %s after the reset snapshot', async phase => {
      const connection = { init: vi.fn(), send: vi.fn() };
      g.__REDUX_DEVTOOLS_EXTENSION__ = { connect: () => connection };
      let cleaned = false;
      let deferredChanges: CdeebeeChangedList<S>[] = [];
      const listener = vi.fn();
      const onCommit = vi.fn();
      const write = () => {
        deferredChanges = db.commit({ userList: { patchList: [{ userID: 2, count: 1 }] } }, { source: 'set', label: 'seed' });
        db.setEntity('userList', 2, previous => ({ userID: 2, count: previous!.count! + 1 }));
        db.flush();
        expect(db.getState().storage.userList).toEqual({});
        expect(deferredChanges).toEqual([]);
        expect(listener).not.toHaveBeenCalled();
      };
      const writer: CdeebeePlugin<S> = {
        name: 'writer',
        onRequest: ctx => { if (phase === 'abort') ctx.controller.signal.addEventListener('abort', write, { once: true }); },
        onReset: () => { if (phase === 'onReset') write(); },
        onCommit: (_changeSet, meta) => { if (meta.source === 'reset' && phase === 'onCommit') write(); },
      };
      const inspector = devtools<S>();
      const cleaner: CdeebeePlugin<S> = { name: 'cleaner', onReset: () => { cleaned = true; }, getState: () => cleaned, onCommit };
      const db: CdeebeeInstance<S> = createCdeebee<S>({
        fetch: { fetch: () => new Promise<Response>(() => {}) }, primaryKeyList: { userList: 'userID' },
        initialStorage: { userList: { 1: { userID: 1 } } }, indexList: { userList: ['count'] },
        pluginList: first ? [inspector, writer, cleaner] : [writer, cleaner, inspector],
      });
      db.subscribe(listener);
      const old = db.requestSettled({ api: '/old' });
      await tick();
      db.reset();
      await expect(old).resolves.toMatchObject({ ok: false, error: { kind: 'abort' } });
      expect(connection.init).toHaveBeenCalledTimes(2);
      expect(connection.init.mock.calls[1][0]).toMatchObject({ state: { storage: { userList: {} }, activeRequestList: [] }, pluginStateList: { cleaner: true } });
      expect(connection.send.mock.calls.map(([action]) => action.type)).toEqual(['seed', 'setEntity:userList']);
      expect(connection.init.mock.invocationCallOrder[1]).toBeLessThan(connection.send.mock.invocationCallOrder[0]);
      expect(connection.send.mock.calls[0][1].state.storage.userList).toEqual({ 2: { userID: 2, count: 1 } });
      expect(connection.send.mock.calls[1][1].state.storage.userList).toEqual({ 2: { userID: 2, count: 2 } });
      expect(onCommit.mock.calls.map(([, meta, changedList]) => [meta.source, changedList])).toEqual([
        ['reset', [{ listName: 'userList', entityIDList: [1] }]],
        ['set', [{ listName: 'userList', entityIDList: [2] }]],
        ['set', [{ listName: 'userList', entityIDList: [2] }]],
      ]);
      expect(deferredChanges).toEqual([{ listName: 'userList', entityIDList: [2] }]);
      expect(db.getIndex('userList', 'count', 2)).toEqual(new Set([2]));
    });
  });

  it.each([false, true])('resets with the final plugin state when devtools comes first=%s', async first => {
    const connection = { init: vi.fn(), send: vi.fn() };
    g.__REDUX_DEVTOOLS_EXTENSION__ = { connect: () => connection };
    const requestHistory = history<S>();
    const inspector = devtools<S>();
    const db = createCdeebee<S>({
      fetch: { fetch: mockFetch([jsonResponse({})]) }, primaryKeyList: { userList: 'userID' },
      pluginList: first ? [inspector, requestHistory] : [requestHistory, inspector],
    });
    await db.request({ api: '/x' });
    db.setEntity('userList', 1, {});
    db.reset();
    expect(connection.init).toHaveBeenCalledTimes(2);
    expect(connection.init).toHaveBeenLastCalledWith(db.getSnapshot());
    expect(connection.init.mock.calls[1][0].pluginStateList.history.doneList).toEqual({});
    db.setEntity('userList', 2, {});
    expect(connection.init.mock.invocationCallOrder[1]).toBeLessThan(connection.send.mock.invocationCallOrder.at(-1)!);
    expect(connection.send.mock.calls.at(-1)![1]).toEqual(db.getSnapshot());
    db.reset();
    connection.init.mockClear();
    await db.request({ api: '/x', ignoreStorage: true });
    expect(requestHistory.getLast('/x')).toBeDefined();
    db.reset();
    expect(connection.init).toHaveBeenCalledExactlyOnceWith(db.getSnapshot());
  });

  it('connects, inits with a snapshot, sends on commit and settle', async () => {
    const connection = { init: vi.fn(), send: vi.fn() };
    const connect = vi.fn(() => connection);
    g.__REDUX_DEVTOOLS_EXTENSION__ = { connect };
    const db = createCdeebee<S>({ fetch: { fetch: mockFetch([jsonResponse({})]) }, primaryKeyList: { userList: 'userID' }, pluginList: [devtools<S>({ name: 'dsp' })] });
    expect(connect).toHaveBeenCalledWith({ name: 'dsp' });
    expect(connection.init).toHaveBeenCalledWith(db.getSnapshot());

    db.setEntity('userList', 1, {});
    expect(connection.send).toHaveBeenLastCalledWith(
      { type: 'setEntity:userList', meta: { source: 'set', label: 'setEntity:userList' } },
      db.getSnapshot(),
    );

    await db.request({ api: '/x' });
    expect(connection.send).toHaveBeenLastCalledWith(
      { type: 'request:/x:done', meta: { api: '/x', requestID: expect.any(String), status: 200 } },
      db.getSnapshot(),
    );
  });
});
