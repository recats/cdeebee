import { describe, it, expect, vi } from 'vitest';
import { createCdeebee } from '../../../lib/core/createCdeebee';
import * as normalize from '../../../lib/core/normalize';
import { history, type CdeebeeHistoryOptions, type CdeebeeHistoryPlugin } from '../../../lib/plugins/history';
import type { CdeebeePlugin, CdeebeeRequestContext } from '../../../lib/core/types';
import { deferred, jsonResponse, mockFetch } from '../test-helpers';

interface S { userList: Record<number, { userID: number }> }
const envelope = (idList: number[]) => ({ userList: { data: idList.map(userID => ({ userID })), primaryKey: 'userID' } });

/** fetch mock answering `{ n }` with an incrementing counter */
const countingFetch = () => {
  let n = 0;
  return vi.fn(async () => { n += 1; return jsonResponse({ n }); }) as unknown as typeof globalThis.fetch;
};

/** fetch mock answering each call with its own deferred response, so a test controls arrival order */
const deferredFetch = () => {
  const pendingList: ReturnType<typeof deferred<Response>>[] = [];
  const fetch = vi.fn(() => {
    const pending = deferred<Response>();
    pendingList.push(pending);
    return pending.promise;
  }) as unknown as typeof globalThis.fetch;
  return { fetch, pendingList };
};

const make = (fetch: typeof globalThis.fetch, options: CdeebeeHistoryOptions<S> = {}) => {
  const plugin = history<S>(options);
  const db = createCdeebee<S>({ fetch: { fetch }, primaryKeyList: { userList: 'userID' }, pluginList: [plugin] });
  return { db, plugin };
};

describe('history plugin', () => {
  it.each([NaN, -1, 0.5])('rejects invalid history limit %s instead of silently retaining unbounded data', maxHistorySize => {
    expect(() => history({ maxHistorySize })).toThrow(RangeError);
  });

  it.each(['patch', 'upsert', 'replaceList'] as const)('an empty %s result clears IDs and records the latest response', async strategy => {
    const { db, plugin } = make(mockFetch([
      jsonResponse(envelope([1, 2])), jsonResponse(envelope([])), new Response(null, { status: 204 }),
    ]));
    const options = { api: '/x', strategyList: { userList: strategy } };
    await db.request(options);
    const before = plugin.getState();
    const listener = vi.fn();
    plugin.subscribe(listener, ['/x']);
    await db.request(options);
    db.flush();
    expect(plugin.getState().lastResultIDList['/x']).toEqual({ userList: [] });
    expect(plugin.getLast('/x')?.response).toEqual(envelope([]));
    expect(before.lastResultIDList['/x']).toEqual({ userList: [1, 2] });
    expect(listener).toHaveBeenCalledTimes(1);
    await db.request(options);
    expect(plugin.getState().lastResultIDList['/x']).toEqual({ userList: [] });
    expect(plugin.getLast('/x')?.response).toBeUndefined();
  });

  it('a response carrying no lists (empty body, plain ack) leaves lastResultIDList alone', async () => {
    const { db, plugin } = make(mockFetch([jsonResponse(envelope([1, 2])), new Response(null, { status: 204 }), jsonResponse({ ok: true })]));
    await db.request({ api: '/x' });
    await db.request({ api: '/x' });
    await db.request({ api: '/x' });
    expect(plugin.getState().lastResultIDList['/x']).toEqual({ userList: [1, 2] });
    expect(plugin.getState().doneList['/x']).toHaveLength(3);
  });

  it('records done entries with response and lastResultIDList', async () => {
    const { db, plugin } = make(mockFetch([jsonResponse(envelope([1, 2]))]));
    await db.request({ api: '/x' });
    const state = plugin.getState();
    expect(state.doneList['/x']).toHaveLength(1);
    expect(state.doneList['/x'][0]).toMatchObject({ api: '/x', response: envelope([1, 2]) });
    expect(state.doneList['/x'][0].endedAt).toBeGreaterThanOrEqual(state.doneList['/x'][0].startedAt);
    expect(state.lastResultIDList['/x']).toEqual({ userList: [1, 2] });
    expect(state.errorList['/x']).toBeUndefined();
  });

  it('records error entries as serializable data', async () => {
    const { db, plugin } = make(mockFetch([jsonResponse({ m: 'bad' }, { ok: false, status: 400 })]));
    await db.request({ api: '/x' }).catch(() => undefined);
    const entry = plugin.getState().errorList['/x'][0];
    expect(entry.error).toEqual({ kind: 'http', status: 400, response: { m: 'bad' }, message: expect.any(String) });
    expect(JSON.parse(JSON.stringify(entry))).toEqual(entry);
  });

  it('caps history per api at maxHistorySize keeping the newest', async () => {
    const { db, plugin } = make(mockFetch([jsonResponse({ n: 1 }), jsonResponse({ n: 2 }), jsonResponse({ n: 3 })]), { maxHistorySize: 2 });
    await db.request({ api: '/x' });
    await db.request({ api: '/x' });
    await db.request({ api: '/x' });
    expect(plugin.getState().doneList['/x'].map(e => (e.response as { n: number }).n)).toEqual([2, 3]);
  });

  it('caps history at 20 per api by default', async () => {
    const { db, plugin } = make(countingFetch());
    for (let i = 0; i < 22; i += 1) await db.request({ api: '/x' });
    const entryList = plugin.getState().doneList['/x'];
    expect(entryList).toHaveLength(20);
    expect((entryList[0].response as { n: number }).n).toBe(3);
    expect((entryList[19].response as { n: number }).n).toBe(22);
  });

  it('maxHistorySize 0 disables the cap', async () => {
    const { db, plugin } = make(countingFetch(), { maxHistorySize: 0 });
    for (let i = 0; i < 25; i += 1) await db.request({ api: '/x' });
    expect(plugin.getState().doneList['/x']).toHaveLength(25);
  });

  it('aborted requests are not recorded by default and are recorded with ignoreAbort false', async () => {
    const controller = new AbortController();
    controller.abort();
    const { db, plugin } = make(mockFetch([jsonResponse({})]));
    await db.request({ api: '/x', signal: controller.signal }).catch(() => undefined);
    expect(plugin.getState().errorList['/x']).toBeUndefined();

    const loud = make(mockFetch([jsonResponse({})]), { ignoreAbort: false });
    await loud.db.request({ api: '/x', signal: controller.signal }).catch(() => undefined);
    expect(loud.plugin.getState().errorList['/x']).toHaveLength(1);
    expect(loud.plugin.getState().errorList['/x'][0].error?.kind).toBe('abort');
  });

  it('keeps references of untouched apis and replaces touched ones', async () => {
    const { db, plugin } = make(mockFetch([jsonResponse({}), jsonResponse({})]));
    await db.request({ api: '/a' });
    const before = plugin.getState();
    await db.request({ api: '/b' });
    const after = plugin.getState();
    expect(after).not.toBe(before);
    expect(after.doneList['/a']).toBe(before.doneList['/a']);
  });

  it('notifies subscribers keyed by api', async () => {
    const { db, plugin } = make(mockFetch([jsonResponse({})]));
    const a = vi.fn();
    const b = vi.fn();
    plugin.subscribe(a, ['/a']);
    plugin.subscribe(b, ['/b']);
    await db.request({ api: '/a' });
    db.flush();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it('clear(api) and clear()', async () => {
    const { db, plugin } = make(mockFetch([jsonResponse({}), jsonResponse({})]));
    await db.request({ api: '/a' });
    await db.request({ api: '/b' });
    plugin.clear('/a');
    expect(plugin.getState().doneList['/a']).toBeUndefined();
    expect(plugin.getState().doneList['/b']).toHaveLength(1);
    plugin.clear();
    expect(plugin.getState()).toEqual({ doneList: {}, errorList: {}, lastResultIDList: {} });
  });

  it('is reachable through db.getPlugin and getSnapshot', async () => {
    const { db, plugin } = make(mockFetch([jsonResponse({})]));
    expect(db.getPlugin<CdeebeeHistoryPlugin<S>>('history')).toBe(plugin);
    await db.request({ api: '/a' });
    expect(db.getSnapshot().pluginStateList.history).toBe(plugin.getState());
  });

  it('ignoreStorage success keeps the previous lastResultIDList', async () => {
    const { db, plugin } = make(mockFetch([jsonResponse(envelope([1, 2])), jsonResponse(envelope([9]))]));
    await db.request({ api: '/x' });
    await db.request({ api: '/x', ignoreStorage: true });
    expect(plugin.getState().lastResultIDList['/x']).toEqual({ userList: [1, 2] });
    expect(plugin.getState().doneList['/x']).toHaveLength(2);
  });

  it('keeps lastResultIDList references when a response repeats the same ids', async () => {
    const { db, plugin } = make(mockFetch([jsonResponse(envelope([1, 2])), jsonResponse(envelope([1, 2])), jsonResponse(envelope([2, 1]))]));
    await db.request({ api: '/x' });
    const first = plugin.getState().lastResultIDList['/x'];
    await db.request({ api: '/x' });
    expect(plugin.getState().lastResultIDList['/x']).toBe(first);
    await db.request({ api: '/x' });
    expect(plugin.getState().lastResultIDList['/x']).not.toBe(first);
    expect(plugin.getState().lastResultIDList['/x']).toEqual({ userList: [2, 1] });
  });

  it('keeps the unchanged list array when another list in the same response changes', async () => {
    interface S2 { userList: Record<number, { userID: number }>; postList: Record<number, { postID: number }> }
    const plugin = history<S2>();
    const respond = (postID: number) => jsonResponse({ ...envelope([1]), postList: { data: [{ postID }], primaryKey: 'postID' } });
    const db = createCdeebee<S2>({ fetch: { fetch: mockFetch([respond(1), respond(2)]) }, primaryKeyList: { userList: 'userID', postList: 'postID' }, pluginList: [plugin] });
    await db.request({ api: '/x' });
    const first = plugin.getState().lastResultIDList['/x'];
    await db.request({ api: '/x' });
    const second = plugin.getState().lastResultIDList['/x'];
    expect(second).not.toBe(first);
    expect(second.userList).toBe(first.userList);
    expect(second.postList).toEqual([2]);
  });

  it('clear() notifies every recorded api in one flush', async () => {
    const { db, plugin } = make(mockFetch([jsonResponse({}), jsonResponse({}, { ok: false, status: 500 })]));
    await db.request({ api: '/a' });
    await db.request({ api: '/b' }).catch(() => undefined);
    const listener = vi.fn();
    plugin.subscribe(listener, ['/a', '/b']);
    plugin.clear();
    await new Promise<void>(resolve => queueMicrotask(resolve));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('getLast returns the newest done entry or undefined', async () => {
    const { db, plugin } = make(mockFetch([jsonResponse({ n: 1 }), jsonResponse({ n: 2 })]));
    expect(plugin.getLast('/x')).toBeUndefined();
    await db.request({ api: '/x' });
    await db.request({ api: '/x' });
    expect((plugin.getLast('/x')?.response as { n: number }).n).toBe(2);
  });

  it('historyClear request option clears the api before the request runs', async () => {
    const { db, plugin } = make(mockFetch([jsonResponse(envelope([1])), jsonResponse({ n: 2 })]));
    await db.request({ api: '/x' });
    expect(plugin.getState().lastResultIDList['/x']).toEqual({ userList: [1] });
    await db.request({ api: '/x', historyClear: true, ignoreStorage: true });
    expect(plugin.getState().doneList['/x']).toHaveLength(1);
    expect((plugin.getLast('/x')?.response as { n: number }).n).toBe(2);
    expect(plugin.getState().lastResultIDList['/x']).toBeUndefined();
  });

  it('clear(api) on an unknown api does not notify', () => {
    const { plugin } = make(mockFetch([jsonResponse({})]));
    const listener = vi.fn();
    plugin.subscribe(listener, ['/nope']);
    plugin.clear('/nope');
    expect(listener).not.toHaveBeenCalled();
  });

  describe('send order', () => {
    it('does not extract result ids from a response older than the last result', async () => {
      const extract = vi.spyOn(normalize, 'extractResultIDList');
      try {
        const { fetch, pendingList } = deferredFetch();
        const { db, plugin } = make(fetch);
        const first = db.request({ api: '/x' });
        const second = db.request({ api: '/x' });
        await vi.waitFor(() => expect(pendingList).toHaveLength(2));
        pendingList[1].resolve(jsonResponse(envelope([2])));
        await second;
        pendingList[0].resolve(jsonResponse(envelope([1])));
        await first;
        expect(extract).toHaveBeenCalledTimes(1);
        expect(plugin.getState().lastResultIDList['/x']).toEqual({ userList: [2] });
        expect(plugin.getState().doneList['/x']).toHaveLength(2);
      } finally {
        extract.mockRestore();
      }
    });

    it('an earlier-sent success arriving last does not replace the latest response or result ids', async () => {
      const { fetch, pendingList } = deferredFetch();
      const { db, plugin } = make(fetch);
      const first = db.request({ api: '/x' });
      const second = db.request({ api: '/x' });
      await vi.waitFor(() => expect(pendingList).toHaveLength(2));
      pendingList[1].resolve(jsonResponse(envelope([2])));
      await second;
      pendingList[0].resolve(jsonResponse(envelope([1])));
      await first;
      expect(plugin.getLast('/x')?.response).toEqual(envelope([2]));
      expect(plugin.getState().lastResultIDList['/x']).toEqual({ userList: [2] });
      expect(plugin.getState().doneList['/x'].map(entry => entry.response)).toEqual([envelope([1]), envelope([2])]);
    });

    it('orders error entries by send', async () => {
      const { fetch, pendingList } = deferredFetch();
      const { db, plugin } = make(fetch);
      const first = db.request({ api: '/x' }).catch(() => undefined);
      const second = db.request({ api: '/x' }).catch(() => undefined);
      await vi.waitFor(() => expect(pendingList).toHaveLength(2));
      pendingList[1].resolve(jsonResponse({ n: 2 }, { ok: false, status: 400 }));
      await second;
      pendingList[0].resolve(jsonResponse({ n: 1 }, { ok: false, status: 400 }));
      await first;
      expect(plugin.getState().errorList['/x'].map(entry => entry.error?.response)).toEqual([{ n: 1 }, { n: 2 }]);
    });

    it('an earlier-sent entry beyond the cap is dropped without notifying', async () => {
      const { fetch, pendingList } = deferredFetch();
      const { db, plugin } = make(fetch, { maxHistorySize: 1 });
      const first = db.request({ api: '/x', ignoreStorage: true });
      const second = db.request({ api: '/x', ignoreStorage: true });
      await vi.waitFor(() => expect(pendingList).toHaveLength(2));
      pendingList[1].resolve(jsonResponse({ n: 2 }));
      await second;
      const before = plugin.getState();
      const listener = vi.fn();
      plugin.subscribe(listener, ['/x']);
      pendingList[0].resolve(jsonResponse({ n: 1 }));
      await first;
      db.flush();
      expect(plugin.getState()).toBe(before);
      expect(listener).not.toHaveBeenCalled();
    });

    it('historyClear drops responses sent before it', async () => {
      const { fetch, pendingList } = deferredFetch();
      const { db, plugin } = make(fetch);
      const stale = db.request({ api: '/x' }).catch(() => undefined);
      const fresh = db.request({ api: '/x', historyClear: true });
      await vi.waitFor(() => expect(pendingList).toHaveLength(2));
      pendingList[0].resolve(jsonResponse({ m: 'bad' }, { ok: false, status: 400 }));
      await stale;
      expect(plugin.getState().errorList['/x']).toBeUndefined();
      pendingList[1].resolve(jsonResponse(envelope([2])));
      await fresh;
      expect(plugin.getState().doneList['/x'].map(entry => entry.response)).toEqual([envelope([2])]);
    });

    it.each([false, true])('a delayed historyClear preserves newer history (newer historyClear: %s)', async historyClear => {
      const gate = deferred<void>();
      const plugin = history<S>();
      const db = createCdeebee<S>({
        primaryKeyList: { userList: 'userID' },
        fetch: { fetch: mockFetch([
          jsonResponse(envelope([1])),
          jsonResponse({ error: 'old' }, { ok: false, status: 400 }),
          jsonResponse(envelope([3])),
          jsonResponse({ error: 'new' }, { ok: false, status: 400 }),
          jsonResponse(envelope([2])),
        ]) },
        pluginList: [
          { name: 'prepare', onRequest: ctx => ctx.meta.wait ? gate.promise : undefined },
          plugin,
        ],
      });
      await db.request({ api: '/x' });
      await db.requestSettled({ api: '/x' });
      const delayed = db.request({ api: '/x', historyClear: true, meta: { wait: true } });
      await db.request({ api: '/x', historyClear });
      await db.requestSettled({ api: '/x' });
      const latest = plugin.getLast('/x');
      const resultIDs = plugin.getState().lastResultIDList['/x'];
      const listener = vi.fn();
      plugin.subscribe(listener, ['/x']);

      gate.resolve();
      await delayed;

      expect(plugin.getLast('/x')).toBe(latest);
      expect(plugin.getState().lastResultIDList['/x']).toBe(resultIDs);
      expect(resultIDs).toEqual({ userList: [3] });
      expect(plugin.getState().doneList['/x'].map(entry => entry.response)).toEqual(
        historyClear ? [envelope([3])] : [envelope([2]), envelope([3])],
      );
      expect(plugin.getState().errorList['/x'].map(entry => entry.error?.response)).toEqual([{ error: 'new' }]);
      if (historyClear) expect(listener).not.toHaveBeenCalled();
    });

    it('a delayed historyClear clears older result ids while preserving a newer response without lists', async () => {
      const gate = deferred<void>();
      const plugin = history<S>();
      const db = createCdeebee<S>({
        primaryKeyList: { userList: 'userID' },
        fetch: { fetch: mockFetch([jsonResponse(envelope([1])), jsonResponse({ n: 3 }), jsonResponse({ n: 2 })]) },
        pluginList: [
          { name: 'prepare', onRequest: ctx => ctx.meta.wait ? gate.promise : undefined },
          plugin,
        ],
      });
      await db.request({ api: '/x' });
      const delayed = db.request({ api: '/x', historyClear: true, meta: { wait: true } });
      await db.request({ api: '/x' });
      gate.resolve();
      await delayed;
      expect(plugin.getLast('/x')?.response).toEqual({ n: 3 });
      expect(plugin.getState().lastResultIDList['/x']).toBeUndefined();
      expect(plugin.getState().doneList['/x'].map(entry => entry.response)).toEqual([{ n: 2 }, { n: 3 }]);
    });

    it('clear(key) ignores responses sent before the newest recorded one', async () => {
      const { fetch, pendingList } = deferredFetch();
      const { db, plugin } = make(fetch);
      const first = db.request({ api: '/x' });
      const second = db.request({ api: '/x' });
      await vi.waitFor(() => expect(pendingList).toHaveLength(2));
      pendingList[1].resolve(jsonResponse(envelope([2])));
      await second;
      plugin.clear('/x');
      pendingList[0].resolve(jsonResponse(envelope([1])));
      await first;
      expect(plugin.getState().lastResultIDList['/x']).toBeUndefined();
      expect(plugin.getLast('/x')).toBeUndefined();
      expect(plugin.getState().doneList['/x']).toBeUndefined();
    });

    it('clear() ignores responses sent before the newest recorded one under every key', async () => {
      const { fetch, pendingList } = deferredFetch();
      const { db, plugin } = make(fetch);
      const first = db.request({ api: '/x' });
      const second = db.request({ api: '/x' });
      await vi.waitFor(() => expect(pendingList).toHaveLength(2));
      pendingList[1].resolve(jsonResponse(envelope([2])));
      await second;
      plugin.clear();
      pendingList[0].resolve(jsonResponse(envelope([1])));
      await first;
      expect(plugin.getState().doneList['/x']).toBeUndefined();
    });

    it('clear(key) drops a pending response even when it is newer than everything recorded', async () => {
      const { fetch, pendingList } = deferredFetch();
      const { db, plugin } = make(fetch);
      const first = db.request({ api: '/x' });
      await vi.waitFor(() => expect(pendingList).toHaveLength(1));
      pendingList[0].resolve(jsonResponse(envelope([1])));
      await first;
      const second = db.request({ api: '/x' });
      await vi.waitFor(() => expect(pendingList).toHaveLength(2));
      plugin.clear('/x');
      pendingList[1].resolve(jsonResponse(envelope([2])));
      await second;
      expect(plugin.getLast('/x')).toBeUndefined();
      expect(plugin.getState().lastResultIDList['/x']).toBeUndefined();
    });

    it.each([false, true])('clear ignores pending requests without recorded history (all keys: %s)', async clearAll => {
      const { fetch, pendingList } = deferredFetch();
      const { db, plugin } = make(fetch, { key: ctx => String(ctx.meta.scope) });
      const left = db.request({ api: '/x', meta: { scope: 'left' } });
      const right = db.request({ api: '/x', meta: { scope: 'right' } });
      await vi.waitFor(() => expect(pendingList).toHaveLength(2));
      if (clearAll) plugin.clear();
      else plugin.clear('left');
      pendingList[0].resolve(jsonResponse(envelope([1])));
      pendingList[1].resolve(jsonResponse(envelope([2])));
      await Promise.all([left, right]);
      expect(plugin.getLast('left')).toBeUndefined();
      expect(plugin.getLast('right')?.response).toEqual(clearAll ? undefined : envelope([2]));

      const fresh = db.request({ api: '/x', meta: { scope: 'left' } });
      await vi.waitFor(() => expect(pendingList).toHaveLength(3));
      pendingList[2].resolve(jsonResponse(envelope([3])));
      await fresh;
      expect(plugin.getLast('left')?.response).toEqual(envelope([3]));
    });

    it('records the send sequence on every entry', async () => {
      const { db, plugin } = make(mockFetch([jsonResponse({ n: 1 }), jsonResponse({ n: 2 }, { ok: false, status: 500 })]));
      await db.request({ api: '/x' });
      await db.request({ api: '/x' }).catch(() => undefined);
      const [done] = plugin.getState().doneList['/x'];
      const [error] = plugin.getState().errorList['/x'];
      expect(error.seq).toBeGreaterThan(done.seq);
    });
  });

  describe('request lifetime', () => {
    it.each(['onRequest', 'onSettled'] as const)('keeps the clear floor while an older request waits in %s', async hook => {
      const entered = deferred<void>();
      const release = deferred<void>();
      const plugin = history<S>();
      const blocker: CdeebeePlugin<S> = {
        name: 'blocker',
        [hook]: (ctx: CdeebeeRequestContext<S>) => {
          if (!ctx.meta.wait) return;
          entered.resolve();
          return release.promise;
        },
      };
      const db = createCdeebee<S>({
        primaryKeyList: { userList: 'userID' },
        fetch: { fetch: mockFetch([jsonResponse(envelope([1]))]) },
        pluginList: [blocker, plugin],
      });
      const older = db.request({ api: '/x', meta: { wait: true } });
      await entered.promise;
      if (hook === 'onSettled') expect(db.getState().activeRequestList).toEqual([]);
      await db.request({ api: '/x' });
      plugin.clear('/x');
      release.resolve();
      await older;
      expect(plugin.getState()).toEqual({ doneList: {}, errorList: {}, lastResultIDList: {} });
      await db.request({ api: '/x' });
      expect(plugin.getState().doneList['/x']).toHaveLength(1);
      expect(plugin.getState().lastResultIDList['/x']).toEqual({ userList: [1] });
    });

    it.each(['abort', 'preparation'])('tracks an early %s failure while onError is delayed', async failure => {
      const entered = deferred<void>();
      const release = deferred<void>();
      const plugin = history<S>({ ignoreAbort: false });
      let failPreparation = failure === 'preparation';
      const db = createCdeebee<S>({
        primaryKeyList: { userList: 'userID' },
        fetch: {
          fetch: mockFetch([jsonResponse({ ok: true })]),
          mergeWithData: () => { if (failPreparation) throw new Error('preparation'); return {}; },
        },
        pluginList: [{ name: 'blocker', onError: () => { entered.resolve(); return release.promise; } }, plugin],
      });
      const controller = new AbortController();
      if (failure === 'abort') controller.abort();
      const older = db.requestSettled({ api: '/x', signal: controller.signal });
      await entered.promise;
      failPreparation = false;
      await db.request({ api: '/x' });
      plugin.clear();
      release.resolve();
      expect((await older).ok).toBe(false);
      expect(plugin.getState()).toEqual({ doneList: {}, errorList: {}, lastResultIDList: {} });
    });

    it('reset releases old tracking without affecting new requests under the same key', async () => {
      const entered = deferred<void>();
      const release = deferred<void>();
      const plugin = history<S>();
      const db = createCdeebee<S>({
        primaryKeyList: { userList: 'userID' },
        fetch: { fetch: mockFetch([jsonResponse({ ok: true })]) },
        pluginList: [{ name: 'blocker', onSettled: ctx => {
          if (!ctx.meta.wait) return;
          entered.resolve();
          return release.promise;
        } }, plugin],
      });
      const older = db.requestSettled({ api: '/x', meta: { wait: true } });
      await entered.promise;
      db.reset();
      await db.request({ api: '/x', historyClear: true });
      const fresh = plugin.getState();
      release.resolve();
      expect((await older).error?.kind).toBe('abort');
      expect(plugin.getState()).toBe(fresh);
      plugin.clear();
      await db.request({ api: '/x' });
      expect(plugin.getState().doneList['/x']).toHaveLength(1);
    });
  });

  describe('key option', () => {
    const byScope = { key: (ctx: { api: string; meta: Record<string, unknown> }) => typeof ctx.meta.scope === 'string' ? ctx.meta.scope : ctx.api };

    it('a throwing key rejects once as a plugin error without leaving history', async () => {
      const key = vi.fn(() => { throw new Error('invalid key'); });
      const fetch = mockFetch([jsonResponse({})]);
      const { db, plugin } = make(fetch, { key });
      const result = await db.requestSettled({ api: '/x' });
      expect(result.error?.kind).toBe('plugin');
      expect(key).toHaveBeenCalledTimes(1);
      expect(fetch).not.toHaveBeenCalled();
      expect(plugin.getState()).toEqual({ doneList: {}, errorList: {}, lastResultIDList: {} });
    });

    it('a reset during key capture stops further request tracking', async () => {
      const plugin = history<S>({ key: ctx => { ctx.db.reset(); return ctx.api; } });
      const laterKey = vi.fn(byScope.key);
      const later = history<S>({ key: laterKey });
      const db = createCdeebee<S>({
        primaryKeyList: { userList: 'userID' },
        fetch: { fetch: mockFetch([jsonResponse({})]) },
        pluginList: [plugin, later],
      });
      expect((await db.requestSettled({ api: '/x' })).error?.kind).toBe('abort');
      expect(laterKey).not.toHaveBeenCalled();
      expect(plugin.getState()).toEqual({ doneList: {}, errorList: {}, lastResultIDList: {} });
    });

    it('captures the key once before other plugins can change the context', async () => {
      const key = vi.fn(byScope.key);
      const plugin = history<S>({ key });
      const db = createCdeebee<S>({
        primaryKeyList: { userList: 'userID' },
        fetch: { fetch: mockFetch([jsonResponse(envelope([1]))]) },
        pluginList: [{ name: 'mutator', onRequest: ctx => { ctx.meta.scope = 'changed'; } }, plugin],
      });
      await db.request({ api: '/x', historyClear: true, meta: { scope: 'original' } });
      expect(key).toHaveBeenCalledTimes(1);
      expect(plugin.getLast('original')?.response).toEqual(envelope([1]));
      expect(plugin.getLast('changed')).toBeUndefined();
    });

    it('records each key separately for the same api', async () => {
      const { db, plugin } = make(mockFetch([jsonResponse(envelope([1])), jsonResponse(envelope([2]))]), byScope);
      await db.request({ api: '/x', meta: { scope: 'left' } });
      await db.request({ api: '/x', meta: { scope: 'right' } });
      expect(plugin.getLast('left')?.response).toEqual(envelope([1]));
      expect(plugin.getLast('right')?.response).toEqual(envelope([2]));
      expect(plugin.getState().lastResultIDList).toEqual({ left: { userList: [1] }, right: { userList: [2] } });
      expect(plugin.getLast('right')?.api).toBe('/x');
      expect(plugin.getState().doneList['/x']).toBeUndefined();
    });

    it('orders by send within a key, independently of other keys', async () => {
      const { fetch, pendingList } = deferredFetch();
      const { db, plugin } = make(fetch, byScope);
      const first = db.request({ api: '/x', meta: { scope: 'left' } });
      const second = db.request({ api: '/x', meta: { scope: 'right' } });
      await vi.waitFor(() => expect(pendingList).toHaveLength(2));
      pendingList[1].resolve(jsonResponse(envelope([2])));
      await second;
      pendingList[0].resolve(jsonResponse(envelope([1])));
      await first;
      expect(plugin.getState().lastResultIDList).toEqual({ left: { userList: [1] }, right: { userList: [2] } });
    });

    it('notifies subscribers of the key and honors historyClear per key', async () => {
      const { db, plugin } = make(mockFetch([jsonResponse({ n: 1 }), jsonResponse({ n: 2 }), jsonResponse({ n: 3 })]), byScope);
      await db.request({ api: '/x', meta: { scope: 'left' } });
      await db.request({ api: '/x', meta: { scope: 'right' } });
      const leftListener = vi.fn();
      const rightListener = vi.fn();
      plugin.subscribe(leftListener, ['left']);
      plugin.subscribe(rightListener, ['right']);
      await db.request({ api: '/x', meta: { scope: 'left' }, historyClear: true, ignoreStorage: true });
      db.flush();
      expect(leftListener).toHaveBeenCalled();
      expect(rightListener).not.toHaveBeenCalled();
      expect(plugin.getState().doneList.left).toHaveLength(1);
      expect(plugin.getState().doneList.right).toHaveLength(1);
    });
  });
});
