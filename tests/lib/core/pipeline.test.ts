import { describe, it, expect, vi } from 'vitest';
import { createCdeebee } from '../../../lib/core/createCdeebee';
import { CdeebeeRequestError } from '../../../lib/core/requestError';
import { cancelation } from '../../../lib/plugins/cancelation';
import type { CdeebeePlugin, CdeebeeRequestContext } from '../../../lib/core/types';
import { jsonResponse, createMockResponse, mockFetch, deferred, tick } from '../test-helpers';

interface User { userID: number; name: string }
interface S { userList: Record<number, User> }

const envelope = (userList: User[]) => ({ responseStatus: 'Success', userList: { data: userList, primaryKey: 'userID' } });

const make = (fetch: typeof globalThis.fetch, over: Partial<Parameters<typeof createCdeebee<S>>[0]> = {}) => createCdeebee<S>({
  fetch: { fetch, mergeWithData: () => ({ sessionToken: 'T' }), headerList: { 'X-App': 'dsp' } },
  primaryKeyList: { userList: 'userID' },
  ...over,
});

/** fetch that stays pending until its deferred resolves and rejects on abort */
const controllableFetch = () => {
  const deferredList: Array<ReturnType<typeof deferred<Response>>> = [];
  const fetch = vi.fn((_url: string, init: RequestInit) => {
    const d = deferred<Response>();
    deferredList.push(d);
    return new Promise<Response>((resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      d.promise.then(resolve, reject);
    });
  }) as unknown as typeof globalThis.fetch & { mock: { calls: Array<[string, RequestInit]> } };
  return { fetch, deferredList };
};

describe('runRequest', () => {
  it('resolves with the full response and commits normalized lists', async () => {
    const fetch = mockFetch([jsonResponse(envelope([{ userID: 1, name: 'a' }]))]);
    const db = make(fetch);
    const response = await db.request<ReturnType<typeof envelope>, { q: number }>({ api: '/user/list', data: { q: 1 } });
    expect(response.responseStatus).toBe('Success');
    expect(db.getState().storage.userList[1]).toEqual({ userID: 1, name: 'a' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/user/list');
    expect(JSON.parse(init.body as string)).toEqual({ sessionToken: 'T', q: 1 });
    expect((init.headers as Record<string, string>)['X-App']).toBe('dsp');
  });

  it('tracks activeRequestList and notifies request subscribers', async () => {
    const d = deferred<Response>();
    const fetch = vi.fn(() => d.promise) as unknown as typeof globalThis.fetch;
    const db = make(fetch);
    const listener = vi.fn();
    db.subscribeRequest(listener, ['/x']);
    const promise = db.request({ api: '/x' });
    expect(db.getState().activeRequestList).toEqual([{ api: '/x', requestID: expect.any(String) }]);
    d.resolve(jsonResponse({}));
    await promise;
    expect(db.getState().activeRequestList).toEqual([]);
    db.flush();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('ignoreStorage skips normalize and commit', async () => {
    const db = make(mockFetch([jsonResponse(envelope([{ userID: 1, name: 'a' }]))]));
    await db.request({ api: '/x', ignoreStorage: true });
    expect(db.getState().storage.userList).toEqual({});
  });

  it('per-request strategyList and normalize override settings', async () => {
    const db = make(mockFetch([jsonResponse(envelope([{ userID: 2, name: 'b' }]))]), {
      initialStorage: { userList: { 1: { userID: 1, name: 'a' } } },
    });
    await db.request({ api: '/x', strategyList: { userList: 'replaceList' } });
    expect(Object.keys(db.getState().storage.userList)).toEqual(['2']);

    await db.request<ReturnType<typeof envelope>>({
      api: '/x',
      normalize: (response, ctx) => ({ userList: { upsertList: response.userList.data.map(u => ({ ...u, name: `${u.name}+${Object.keys(ctx.storage.userList).length}` })) } }),
    });
    expect(db.getState().storage.userList[2].name).toBe('b+1');
  });

  it('http error rejects with CdeebeeRequestError and no commit', async () => {
    const db = make(mockFetch([jsonResponse({ ...envelope([{ userID: 9, name: 'x' }]) }, { ok: false, status: 500 })]));
    const error = await db.request({ api: '/x' }).catch(e => e) as CdeebeeRequestError;
    expect(error).toBeInstanceOf(CdeebeeRequestError);
    expect(error.kind).toBe('http');
    expect(error.status).toBe(500);
    expect(db.getState().storage.userList).toEqual({});
    expect(db.getState().activeRequestList).toEqual([]);
  });

  it('external signal abort rejects with kind abort and never commits', async () => {
    const d = deferred<Response>();
    const controller = new AbortController();
    const fetch = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      d.promise.then(resolve);
    })) as unknown as typeof globalThis.fetch;
    const db = make(fetch);
    const promise = db.request({ api: '/x', signal: controller.signal });
    controller.abort();
    const error = await promise.catch(e => e) as CdeebeeRequestError;
    expect(error.kind).toBe('abort');
    expect(db.getState().activeRequestList).toEqual([]);
  });

  it('plugin hook order: onRequest → onResponse → onSettled, with ctx mutations', async () => {
    const callList: string[] = [];
    const plugin: CdeebeePlugin<S> = {
      name: 'p',
      onRequest: ctx => { callList.push('request'); ctx.headerList['X-Auth'] = 'tok'; (ctx.data as Record<string, unknown>).extra = 1; },
      onResponse: ctx => { callList.push('response'); ctx.response = { ...(ctx.response as object), patched: true }; },
      onError: () => { callList.push('error'); },
      onSettled: ctx => { callList.push(`settled:${ctx.changeSet ? 'committed' : 'none'}`); },
    };
    const fetch = mockFetch([jsonResponse(envelope([]))]);
    const db = make(fetch, { pluginList: [plugin] });
    const response = await db.request<{ patched: boolean }, object>({ api: '/x', data: {} });
    expect(response.patched).toBe(true);
    expect(callList).toEqual(['request', 'response', 'settled:committed']);
    const [, init] = fetch.mock.calls[0];
    expect((init.headers as Record<string, string>)['X-Auth']).toBe('tok');
    expect(JSON.parse(init.body as string).extra).toBe(1);
  });

  it('onRequest returning false skips fetch and rejects with abort', async () => {
    const fetch = mockFetch([jsonResponse({})]);
    const onSettled = vi.fn();
    const db = make(fetch, { pluginList: [{ name: 'p', onRequest: () => false, onSettled }] });
    const error = await db.request({ api: '/x' }).catch(e => e) as CdeebeeRequestError;
    expect(error.kind).toBe('abort');
    expect(fetch).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('error path calls onError then onSettled once each', async () => {
    const callList: string[] = [];
    const db = make(mockFetch([new TypeError('down')]), { pluginList: [{
      name: 'p',
      onError: (ctx: CdeebeeRequestContext<S>) => { callList.push(`error:${ctx.error?.kind}`); },
      onSettled: () => { callList.push('settled'); },
    }] });
    await db.request({ api: '/x' }).catch(() => undefined);
    expect(callList).toEqual(['error:network', 'settled']);
  });

  it('onRetry returning a delay re-runs fetch; false gives up', async () => {
    const fetch = mockFetch([new TypeError('down'), jsonResponse(envelope([{ userID: 1, name: 'a' }]))]);
    const attemptList: number[] = [];
    const db = make(fetch, { pluginList: [{ name: 'retry', onRetry: ctx => { attemptList.push(ctx.attempt); return ctx.attempt < 2 ? 0 : false; } }] });
    await db.request({ api: '/x' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(attemptList).toEqual([0]);
    expect(db.getState().storage.userList[1]).toBeDefined();

    const fetch2 = mockFetch([new TypeError('down')]);
    const db2 = make(fetch2, { pluginList: [{ name: 'retry', onRetry: () => false }] });
    await expect(db2.request({ api: '/x' })).rejects.toMatchObject({ kind: 'network' });
    expect(fetch2).toHaveBeenCalledTimes(1);
  });

  it('GET sends no body; responseType text', async () => {
    const fetch = mockFetch([createMockResponse({ text: async () => 'plain' })]);
    const db = make(fetch);
    const response = await db.request<string>({ api: '/x', method: 'GET', responseType: 'text', data: { a: 1 } });
    expect(response).toBe('plain');
    expect(fetch.mock.calls[0][1].body).toBeUndefined();
  });

  it('a throwing onError does not leak the active request or skip onSettled', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSettled = vi.fn();
    const db = make(mockFetch([new TypeError('down')]), { pluginList: [
      { name: 'bad', onError: () => { throw new Error('plugin bug'); } },
      { name: 'good', onSettled },
    ] });
    const error = await db.request({ api: '/x' }).catch(e => e) as CdeebeeRequestError;
    expect(error).toBeInstanceOf(CdeebeeRequestError);
    expect(error.kind).toBe('network');
    expect(db.getState().activeRequestList).toEqual([]);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('a throwing onSettled does not fail a successful request or skip later plugins', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const later = vi.fn();
    const db = make(mockFetch([jsonResponse(envelope([{ userID: 1, name: 'a' }]))]), { pluginList: [
      { name: 'bad', onSettled: () => { throw new Error('plugin bug'); } },
      { name: 'later', onSettled: later },
    ] });
    await expect(db.request({ api: '/x' })).resolves.toBeDefined();
    expect(db.getState().storage.userList[1]).toBeDefined();
    expect(later).toHaveBeenCalledTimes(1);
    expect(db.getState().activeRequestList).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('a request commit stays microtask-batched: listeners run after onCommit, not during it', async () => {
    const listener = vi.fn();
    let callCountAtCommit = -1;
    const db = make(mockFetch([jsonResponse(envelope([{ userID: 1, name: 'a' }]))]), {
      pluginList: [{ name: 'probe', onCommit: () => { callCountAtCommit = listener.mock.calls.length; } }],
    });
    db.subscribe(listener, [{ listName: 'userList' }]);
    await db.request({ api: '/x' });
    expect(callCountAtCommit).toBe(0);
    await tick();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('a pre-aborted signal rejects before onRequest runs', async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch, { pluginList: [cancelation<S>()] });
    const first = db.request({ api: '/x' });
    const controller = new AbortController();
    controller.abort();
    const error = await db.request({ api: '/x', signal: controller.signal }).catch(e => e) as CdeebeeRequestError;
    expect(error.kind).toBe('abort');
    expect(fetch).toHaveBeenCalledTimes(1);
    deferredList[0].resolve(jsonResponse(envelope([{ userID: 1, name: 'a' }])));
    await expect(first).resolves.toBeDefined();
    expect(db.getState().storage.userList[1]).toBeDefined();
  });

  it('an abort between two onResponse hooks skips the later hook and never commits', async () => {
    const controller = new AbortController();
    const later = vi.fn();
    const db = make(mockFetch([jsonResponse(envelope([{ userID: 1, name: 'a' }]))]), { pluginList: [
      { name: 'aborter', onResponse: async () => { controller.abort(); } },
      { name: 'later', onResponse: later },
    ] });
    const error = await db.request({ api: '/x', signal: controller.signal }).catch(e => e) as CdeebeeRequestError;
    expect(error.kind).toBe('abort');
    expect(later).not.toHaveBeenCalled();
    expect(db.getState().storage.userList).toEqual({});
  });

  it('abort during onResponse never commits', async () => {
    const controller = new AbortController();
    const db = make(mockFetch([jsonResponse(envelope([{ userID: 1, name: 'a' }]))]), { pluginList: [
      { name: 'aborter', onResponse: () => { controller.abort(); } },
    ] });
    const error = await db.request({ api: '/x', signal: controller.signal }).catch(e => e) as CdeebeeRequestError;
    expect(error.kind).toBe('abort');
    expect(db.getState().storage.userList).toEqual({});
    expect(db.getState().activeRequestList).toEqual([]);
  });

  it('removes its listener from a shared external signal once the request settles', async () => {
    const controller = new AbortController();
    const addSpy = vi.spyOn(controller.signal, 'addEventListener');
    const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');
    const db = make(mockFetch([jsonResponse(envelope([]))]));
    await db.request({ api: '/x', signal: controller.signal });
    await db.request({ api: '/x', signal: controller.signal });
    expect(addSpy).toHaveBeenCalledTimes(2);
    expect(removeSpy).toHaveBeenCalledTimes(2);
    const [, onAbort] = addSpy.mock.calls[0];
    expect(removeSpy.mock.calls[0][1]).toBe(onAbort);
  });

  it('removes the listener when the request rejects', async () => {
    const controller = new AbortController();
    const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');
    const db = make(mockFetch([new TypeError('down')]));
    await db.request({ api: '/x', signal: controller.signal }).catch(() => undefined);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('a throwing onRequest / onResponse rejects with kind plugin naming the plugin', async () => {
    const db = make(mockFetch([jsonResponse(envelope([]))]), { pluginList: [{ name: 'bad', onResponse: () => { throw new Error('hook bug'); } }] });
    const error = await db.request({ api: '/x' }).catch(e => e) as CdeebeeRequestError;
    expect(error.kind).toBe('plugin');
    expect(error.message).toBe('[cdeebee] plugin error on /x (plugin "bad" onResponse): hook bug');
    expect(db.getState().storage.userList).toEqual({});

    const db2 = make(mockFetch([jsonResponse(envelope([]))]), { pluginList: [{ name: 'bad', onRequest: () => { throw new Error('early'); } }] });
    await expect(db2.request({ api: '/x' })).rejects.toMatchObject({ kind: 'plugin', message: '[cdeebee] plugin error on /x (plugin "bad" onRequest): early' });

    const db3 = make(mockFetch([jsonResponse(envelope([]))]), { pluginList: [{ name: 'async', onRequest: async () => { throw new Error('later'); } }] });
    await expect(db3.request({ api: '/x' })).rejects.toMatchObject({ kind: 'plugin', message: '[cdeebee] plugin error on /x (plugin "async" onRequest): later' });
  });

  it('a synchronous onRequest reaches fetch one microtask after request()', async () => {
    const fetch = mockFetch([jsonResponse(envelope([]))]);
    const db = make(fetch, { pluginList: [{ name: 'sync', onRequest: () => undefined }, { name: 'bare' }] });
    const pending = db.request({ api: '/x' });
    await Promise.resolve();
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(1);
    await pending;
  });

  it('a throwing normalize rejects with kind normalize and commits nothing', async () => {
    const db = make(mockFetch([jsonResponse(envelope([{ userID: 1, name: 'a' }]))]), { normalize: () => { throw new Error('shape'); } });
    const error = await db.request({ api: '/x' }).catch(e => e) as CdeebeeRequestError;
    expect(error.kind).toBe('normalize');
    expect(error.message).toBe('[cdeebee] normalize error on /x: shape');
    expect(db.getState().storage.userList).toEqual({});
    expect(db.getState().activeRequestList).toEqual([]);
  });

  it('options.meta is exposed to plugins as ctx.meta (empty object by default)', async () => {
    const seen: unknown[] = [];
    const db = make(mockFetch([jsonResponse({})]), { pluginList: [{
      name: 'p',
      onRequest: ctx => { seen.push(ctx.meta); },
      onSettled: ctx => { seen.push(ctx.meta); },
    }] });
    await db.request({ api: '/x', meta: { silentError: true } });
    await db.request({ api: '/y' });
    expect(seen).toEqual([{ silentError: true }, { silentError: true }, {}, {}]);
  });
});
