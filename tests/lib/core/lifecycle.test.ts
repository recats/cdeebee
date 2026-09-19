import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCdeebee } from '../../../lib/core/createCdeebee';
import { history } from '../../../lib/plugins/history';
import { retry } from '../../../lib/plugins/retry';
import { cancelation } from '../../../lib/plugins/cancelation';
import { queryQueue } from '../../../lib/plugins/queryQueue';
import type { CdeebeePlugin } from '../../../lib/core/types';
import { deferred, jsonResponse, mockFetch, tick } from '../test-helpers';

interface Item { id: number; version: number; name: string; detail?: string }
interface Storage { itemList: Record<number, Item> }
const primaryKeyList = { itemList: 'id' as const };
const item = { id: 1, version: 10, name: 'current' };
const response = { itemList: { primaryKey: 'id', data: [item] } };

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('initial storage freshness', () => {
  it('preserves the restored version while allowing missing details to be filled', () => {
    const db = createCdeebee<Storage>({
      fetch: {}, primaryKeyList,
      versionKeyList: { itemList: 'version' },
      initialStorage: { itemList: { 1: item } },
    });
    expect(db.getEntityMeta('itemList', '1')).toEqual({ version: 10, seq: 0, complete: false });
    db.commit({ itemList: { upsertList: [{ id: 1, version: 1, name: 'old', detail: 'detail' }] } }, { source: 'request', seq: 1 });
    expect(db.getState().storage.itemList[1]).toEqual({ ...item, detail: 'detail' });
    expect(db.getEntityMeta('itemList', 1)?.complete).toBe(false);
    db.commit({ itemList: { upsertList: [{ ...item, version: 11, name: 'new' }] } }, { source: 'request', seq: 2 });
    expect(db.getState().storage.itemList[1]).toEqual({ id: 1, version: 11, name: 'new' });
    expect(db.getEntityMeta('itemList', 1)?.complete).toBe(true);
  });
});

describe('request and observer boundaries', () => {
  it.each(['fetch', 'onRequest', 'onResponse'] as const)('abort settles promptly while %s ignores the signal, and observes its late rejection', async phase => {
    const pendingWork = deferred<Response>();
    const controller = new AbortController();
    const onSettled = vi.fn();
    const neverFinishes = () => pendingWork.promise.then(() => undefined);
    const fetch = phase === 'fetch' ? vi.fn(() => pendingWork.promise) : mockFetch([jsonResponse(response)]);
    const db = createCdeebee<Storage>({
      fetch: { fetch }, primaryKeyList,
      pluginList: [{ name: 'pending', ...(phase === 'fetch' ? {} : { [phase]: neverFinishes }), onSettled }],
    });
    const result = db.requestSettled({ api: '/read', signal: controller.signal });
    await tick();
    controller.abort();
    await expect(result).resolves.toMatchObject({ ok: false, error: { kind: 'abort' } });
    expect(db.getState().storage.itemList).toEqual({});
    expect(db.getState().activeRequestList).toEqual([]);
    expect(onSettled).toHaveBeenCalledTimes(1);
    pendingWork.reject(new Error('late failure'));
    await tick();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('an abort triggered inside normalize never commits', async () => {
    const controller = new AbortController();
    const db = createCdeebee<Storage>({ fetch: { fetch: mockFetch([jsonResponse(response)]) }, primaryKeyList });
    await expect(db.requestSettled({
      api: '/read', signal: controller.signal,
      normalize: () => { controller.abort(); return { itemList: { upsertList: [item] } }; },
    })).resolves.toMatchObject({ ok: false, error: { kind: 'abort' } });
    expect(db.getState().storage.itemList).toEqual({});
  });
  it('a failed commit observer cannot reject a saved request or starve later observers', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const later = vi.fn();
    const onError = vi.fn();
    const requestHistory = history<Storage>();
    const db = createCdeebee<Storage>({
      fetch: { fetch: mockFetch([jsonResponse(response)]) }, primaryKeyList,
      pluginList: [
        { name: 'broken', onCommit: () => { throw new Error('observer'); } },
        { name: 'later', onCommit: later, onError },
        requestHistory,
      ],
    });
    await expect(db.requestSettled({ api: '/save' })).resolves.toEqual({ ok: true, response });
    expect(db.getState().storage.itemList[1]).toEqual(item);
    expect(onError).not.toHaveBeenCalled();
    expect(requestHistory.getLast('/save')?.response).toEqual(response);
    expect(later).toHaveBeenCalledTimes(1);
    expect(() => db.setEntity('itemList', 1, { name: 'local' })).not.toThrow();
    expect(later).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it.each(['headerList', 'mergeWithData'] as const)('a throwing %s settles with a request error and detaches its signal', async key => {
    const fetch = mockFetch([jsonResponse(response)]);
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const onSettled = vi.fn();
    const onRequest = vi.fn();
    const db = createCdeebee<Storage>({
      fetch: { fetch, [key]: () => { throw new Error('configuration'); } }, primaryKeyList,
      pluginList: [{ name: 'probe', onRequest, onSettled }],
    });
    await expect(db.requestSettled({ api: '/save', signal: controller.signal })).resolves.toMatchObject({ ok: false, error: { kind: 'request' } });
    expect(fetch).not.toHaveBeenCalled();
    expect(onRequest).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(db.getState().activeRequestList).toEqual([]);
  });

  it('pre-aborted requests never evaluate dynamic settings', async () => {
    const controller = new AbortController();
    controller.abort();
    const headerList = vi.fn(() => { throw new Error('must not run'); });
    const db = createCdeebee<Storage>({ fetch: { headerList }, primaryKeyList });
    await expect(db.requestSettled({ api: '/save', signal: controller.signal })).resolves.toMatchObject({ ok: false, error: { kind: 'abort' } });
    expect(headerList).not.toHaveBeenCalled();
  });

  it('stops onRequest processing immediately after an abort', async () => {
    const later = vi.fn();
    const fetch = mockFetch([jsonResponse(response)]);
    const db = createCdeebee<Storage>({
      fetch: { fetch }, primaryKeyList,
      pluginList: [
        { name: 'aborter', onRequest: ctx => ctx.controller.abort() },
        { name: 'later', onRequest: later },
      ],
    });
    await expect(db.requestSettled({ api: '/save' })).resolves.toMatchObject({ ok: false, error: { kind: 'abort' } });
    expect(later).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('serialization failures are not retried even by a permissive retry policy', async () => {
    const data: Record<string, unknown> = {};
    data.self = data;
    const fetch = mockFetch([jsonResponse(response)]);
    const when = vi.fn(() => true);
    const db = createCdeebee<Storage>({ fetch: { fetch }, primaryKeyList, pluginList: [retry({ count: 3, when })] });
    await expect(db.requestSettled({ api: '/save', data })).resolves.toMatchObject({ ok: false, error: { kind: 'request' } });
    expect(fetch).not.toHaveBeenCalled();
    expect(when).not.toHaveBeenCalled();
    // GET does not serialize data that will never be sent.
    await expect(db.request({ api: '/read', method: 'GET', data })).resolves.toEqual(response);
  });
});

describe('retry lifecycle', () => {
  it.each(['throw', 'nan', 'negative', 'infinity'] as const)('reports an invalid retry hook (%s) as a plugin error', async mode => {
    const fetch = mockFetch([new TypeError('offline')]);
    const db = createCdeebee<Storage>({
      fetch: { fetch }, primaryKeyList,
      pluginList: [{ name: 'retry-policy', onRetry: () => {
        if (mode === 'throw') throw new Error('policy');
        return { nan: NaN, negative: -1, infinity: Infinity }[mode];
      } }],
    });
    await expect(db.requestSettled({ api: '/read' })).resolves.toMatchObject({ ok: false, error: { kind: 'plugin', message: expect.stringContaining('retry-policy') } });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(db.getState().activeRequestList).toEqual([]);
  });

  it.each([0, 10000])('an abort inside onRetry prevents the next attempt with delay %s', async delay => {
    vi.useFakeTimers();
    const fetch = mockFetch([new TypeError('offline'), jsonResponse(response)]);
    const db = createCdeebee<Storage>({
      fetch: { fetch }, primaryKeyList,
      pluginList: [{ name: 'aborter', onRetry: ctx => { ctx.controller.abort(); return delay; } }],
    });
    await expect(db.requestSettled({ api: '/read' })).resolves.toMatchObject({ ok: false, error: { kind: 'abort' } });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, true])('removes the retry wait listener when aborted=%s', async aborted => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    let add!: ReturnType<typeof vi.spyOn>;
    let remove!: ReturnType<typeof vi.spyOn>;
    const probe: CdeebeePlugin<Storage> = { name: 'probe', onRequest: ctx => {
      signal = ctx.controller.signal;
      add = vi.spyOn(signal, 'addEventListener');
      remove = vi.spyOn(signal, 'removeEventListener');
    } };
    const controller = new AbortController();
    const fetch = mockFetch([new TypeError('offline'), jsonResponse(response)]);
    const db = createCdeebee<Storage>({ fetch: { fetch }, primaryKeyList, pluginList: [probe, retry({ count: 1, backoffMs: 100 })] });
    const pending = db.requestSettled({ api: '/read', signal: controller.signal });
    await vi.advanceTimersByTimeAsync(0);
    const waitListener = add.mock.calls.at(-1)![1];
    if (aborted) controller.abort();
    else await vi.advanceTimersByTimeAsync(100);
    expect((await pending).ok).toBe(!aborted);
    expect(remove).toHaveBeenCalledWith('abort', waitListener);
    expect(vi.getTimerCount()).toBe(0);
    expect(db.getState().activeRequestList).toEqual([]);
  });
});

describe('store reset', () => {
  it('signals hooks already settling and suppresses their remaining callbacks and result after reset', async () => {
    const ready = deferred<void>();
    const release = deferred<void>();
    let signal!: AbortSignal;
    const later = vi.fn();
    const db = createCdeebee<Storage>({
      fetch: { fetch: mockFetch([jsonResponse(response)]) }, primaryKeyList,
      pluginList: [
        { name: 'pending', onSettled: async ctx => { signal = ctx.controller.signal; ready.resolve(); await release.promise; } },
        { name: 'later', onSettled: later },
      ],
    });
    const result = db.requestSettled({ api: '/read' });
    await ready.promise;
    db.reset();
    expect(signal.aborted).toBe(true);
    release.resolve();
    await expect(result).resolves.toMatchObject({ ok: false, error: { kind: 'abort' } });
    expect(later).not.toHaveBeenCalled();
    expect(db.getState().storage.itemList).toEqual({});
  });

  it('clears data, indexes, history and loading synchronously and rejects pending requests', async () => {
    const pendingFetch = deferred<Response>();
    const requestHistory = history<Storage>({ ignoreAbort: false });
    const onResponse = vi.fn();
    const onSettled = vi.fn();
    const db = createCdeebee<Storage>({
      fetch: { fetch: mockFetch([jsonResponse(response)]) }, primaryKeyList,
      indexList: { itemList: ['name'] },
      initialStorage: { itemList: { 1: item } },
      pluginList: [requestHistory, { name: 'probe', onResponse, onSettled }],
    });
    await db.request({ api: '/read' });
    db.settings.fetch.fetch = () => pendingFetch.promise;
    const old = db.requestSettled({ api: '/read' });
    await tick();
    const listener = vi.fn(() => {
      expect(db.getState().storage.itemList).toEqual({});
      expect(db.getState().activeRequestList).toEqual([]);
      expect(requestHistory.getLast('/read')).toBeUndefined();
    });
    const unsubscribe = db.subscribe(listener);
    db.reset();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(db.getIndex('itemList', 'name', item.name).size).toBe(0);
    await expect(old).resolves.toMatchObject({ ok: false, error: { kind: 'abort' } });
    pendingFetch.resolve(jsonResponse(response));
    await tick();
    expect(requestHistory.getState()).toEqual({ doneList: {}, errorList: {}, lastResultIDList: {} });
    expect(onResponse).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(db.getState().storage.itemList).toEqual({});
    unsubscribe();
    db.settings.fetch.fetch = mockFetch([jsonResponse(response)]);
    await db.request({ api: '/read' });
    expect(db.getState().storage.itemList[1]).toEqual(item);
    expect(db.getIndex('itemList', 'name', item.name).size).toBe(1);
    expect(requestHistory.getLast('/read')?.response).toEqual(response);
  });

  it('releases queue and cancellation slots without letting old requests affect new ones', async () => {
    const waiting = deferred<Response>();
    const requestHistory = history<Storage>();
    const fetch = vi.fn()
      .mockImplementationOnce(() => waiting.promise)
      .mockResolvedValue(jsonResponse(response));
    const db = createCdeebee<Storage>({
      fetch: { fetch }, primaryKeyList,
      pluginList: [queryQueue(), cancelation({ mode: 'latest' }), requestHistory],
    });
    const old = db.requestSettled({ api: '/read' });
    await tick();
    db.reset();
    const fresh = db.requestSettled({ api: '/read' });
    await expect(old).resolves.toMatchObject({ ok: false, error: { kind: 'abort' } });
    await expect(fresh).resolves.toEqual({ ok: true, response });
    expect(requestHistory.getState().doneList['/read']).toHaveLength(1);
    waiting.resolve(jsonResponse({ itemList: { primaryKey: 'id', data: [{ ...item, name: 'old' }] } }));
    await tick();
    expect(db.getState().storage.itemList[1].name).toBe('current');
  });

  it('keeps reset boundaries and existing subscriptions across repeated resets', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onReset = vi.fn();
    const db = createCdeebee<Storage>({ fetch: {}, primaryKeyList, pluginList: [
      { name: 'broken', onReset: () => { throw new Error('reset'); } },
      { name: 'later', onReset },
    ] });
    const listener = vi.fn();
    db.subscribe(listener, [{ listName: 'itemList', entityID: 1 }]);
    db.setEntity('itemList', 1, item);
    db.reset();
    db.reset();
    db.commit({ itemList: { upsertList: [item] } }, { source: 'request', seq: 1 });
    expect(db.getState().storage.itemList).toEqual({});
    db.setEntity('itemList', 1, item);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(onReset).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(2);
  });
});
