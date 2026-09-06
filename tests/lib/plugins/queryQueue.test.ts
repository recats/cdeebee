import { describe, it, expect, vi } from 'vitest';
import { createCdeebee } from '../../../lib/core/createCdeebee';
import { cancelation } from '../../../lib/plugins/cancelation';
import { queryQueue } from '../../../lib/plugins/queryQueue';
import { jsonResponse, deferred, tick } from '../test-helpers';

interface S { userList: Record<number, { userID: number; v: number }> }
const envelope = (v: number) => ({ userList: { data: [{ userID: 1, v }], primaryKey: 'userID' } });

const controllableFetch = () => {
  const deferredList: Array<ReturnType<typeof deferred<Response>>> = [];
  const fetch = vi.fn(() => { const d = deferred<Response>(); deferredList.push(d); return d.promise; }) as unknown as typeof globalThis.fetch;
  return { fetch, deferredList };
};

const make = (fetch: typeof globalThis.fetch, pluginList = [queryQueue<S>()]) => createCdeebee<S>({
  fetch: { fetch },
  primaryKeyList: { userList: 'userID' },
  pluginList,
});

describe('queryQueue plugin', () => {
  it('without the plugin the later-sent response still wins: commits are ordered by send sequence, not arrival', async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch, []);
    const first = db.request({ api: '/x' });
    const second = db.request({ api: '/x' });
    deferredList[1].resolve(jsonResponse(envelope(2)));
    await second;
    deferredList[0].resolve(jsonResponse(envelope(1)));
    await first;
    expect(db.getState().storage.userList[1].v).toBe(2);
  });

  it('commits in send order even when responses arrive out of order', async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch);
    const commitOrder: number[] = [];
    db.subscribe(() => commitOrder.push(db.getState().storage.userList[1].v), [{ listName: 'userList' }]);
    const first = db.request({ api: '/x' });
    const second = db.request({ api: '/x' });
    await tick();
    deferredList[1].resolve(jsonResponse(envelope(2)));
    await Promise.resolve();
    expect(db.getState().storage.userList).toEqual({});   // second is waiting for first
    deferredList[0].resolve(jsonResponse(envelope(1)));
    await Promise.all([first, second]);
    db.flush();
    expect(db.getState().storage.userList[1].v).toBe(2);
    expect(commitOrder[commitOrder.length - 1]).toBe(2);
  });

  it('a failed earlier request releases the queue', async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch);
    const first = db.request({ api: '/x' });
    const second = db.request({ api: '/x' });
    await tick();
    deferredList[1].resolve(jsonResponse(envelope(2)));
    deferredList[0].reject(new TypeError('down'));
    await expect(first).rejects.toMatchObject({ kind: 'network' });
    await second;
    expect(db.getState().storage.userList[1].v).toBe(2);
  });

  it('apiList restricts queueing; other apis commit immediately', async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch, [queryQueue<S>({ apiList: ['/queued'] })]);
    const queued = db.request({ api: '/queued' });
    const free = db.request({ api: '/free' });
    await tick();
    deferredList[1].resolve(jsonResponse(envelope(9)));
    await free;
    expect(db.getState().storage.userList[1].v).toBe(9);
    deferredList[0].resolve(jsonResponse(envelope(1)));
    await queued;
  });
});

describe('queue failure, cancellation, and independent keys', () => {
  it('failed middle ticket must not let third bypass first', async () => {
    const { fetch, deferredList: pending } = controllableFetch();
    const db = make(fetch);
    const first = db.request({ api: '/first' });
    const second = db.request({ api: '/second' }).catch(() => undefined);
    let thirdDone = false;
    const third = db.request({ api: '/third' }).then(() => { thirdDone = true; });
    await tick();
    pending[1].reject(new Error('failed'));
    pending[2].resolve(jsonResponse({}));
    await tick();
    const bypassed = thirdDone;
    pending[0].resolve(jsonResponse({}));
    await Promise.all([first, second, third]);
    expect(bypassed).toBe(false);
  });

  it('keyed queues commit independently', async () => {
    const { fetch, deferredList: pending } = controllableFetch();
    const db = make(fetch, [queryQueue({ key: ctx => ctx.api })]);
    const first = db.request({ api: '/slow' });
    const second = db.request({ api: '/fast' });
    await tick();
    pending[1].resolve(jsonResponse({}));
    await second;
    expect(db.getState().activeRequestList.map(q => q.api)).toEqual(['/slow']);
    pending[0].resolve(jsonResponse({}));
    await first;
  });

  it('aborting a response waiting in the queue settles promptly without releasing predecessors', async () => {
    const { fetch, deferredList: pending } = controllableFetch();
    const db = make(fetch);
    const controller = new AbortController();
    const first = db.request({ api: '/first' });
    const second = db.request({ api: '/second', signal: controller.signal }).catch(error => error);
    let thirdDone = false;
    const third = db.request({ api: '/third' }).then(() => { thirdDone = true; });
    await tick();
    pending[1].resolve(jsonResponse({}));
    pending[2].resolve(jsonResponse({}));
    await tick();
    controller.abort();
    expect(await second).toMatchObject({ kind: 'abort' });
    expect(db.getState().activeRequestList.map(q => q.api)).toEqual(['/first', '/third']);
    expect(thirdDone).toBe(false);
    pending[0].resolve(jsonResponse({}));
    await Promise.all([first, third]);
  });
});

describe('queryQueue with cancelation', () => {
  it.each(['previous', 'latest'] as const)('preserves predecessors with cancelation mode %s', async mode => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch, [queryQueue<S>(), cancelation<S>({ apiList: ['/search'], mode })]);
    const blocker = db.request({ api: '/blocker' });
    const first = db.request({ api: '/search' }).catch(error => error);
    await tick();
    deferredList[1].resolve(jsonResponse(envelope(1)));
    await tick(); // the first search response is waiting behind the blocker
    const second = db.request({ api: '/search' }).catch(error => error);
    await tick();
    if (mode === 'previous') {
      expect(await first).toMatchObject({ kind: 'abort' });
      deferredList[2].resolve(jsonResponse(envelope(2)));
    } else {
      expect(await second).toMatchObject({ kind: 'abort' });
      expect(fetch).toHaveBeenCalledTimes(2);
    }
    await tick();
    expect(db.getState().storage.userList).toEqual({});
    expect(db.getState().activeRequestList.map(q => q.api)).toEqual(['/blocker', '/search']);
    deferredList[0].resolve(jsonResponse({}));
    await Promise.all([blocker, first, second]);
    expect(db.getState().storage.userList[1].v).toBe(mode === 'previous' ? 2 : 1);
    expect(db.getState().activeRequestList).toEqual([]);
    // A settled queue must accept another request for the same API.
    const next = db.request({ api: '/search' });
    await tick();
    deferredList[deferredList.length - 1].resolve(jsonResponse(envelope(3)));
    await next;
    expect(db.getState().storage.userList[1].v).toBe(3);
  });
});

describe('save processed after list on the server', () => {
  interface Item { itemID: number; updatedAt: string; name: string }
  interface ItemStorage { itemList: Record<number, Item> }
  it.each(['none', 'per-api', 'shared'] as const)('keeps the saved version with %s queue', async queue => {
    const save = deferred<Response>();
    const list = deferred<Response>();
    const db = createCdeebee<ItemStorage>({
      fetch: { fetch: (async (url: string) => url === '/save' ? save.promise : list.promise) as typeof fetch },
      primaryKeyList: { itemList: 'itemID' },
      versionKeyList: { itemList: 'updatedAt' },
      apiStrategyList: { '/save': { itemList: 'replaceList' }, '/list': { itemList: 'replaceList' } },
      pluginList: queue === 'none' ? [] : [queryQueue<ItemStorage>(queue === 'per-api' ? { key: ctx => ctx.api } : {})],
    });
    const response = (name: string, updatedAt: string) => ({ itemList: { primaryKey: 'itemID', data: [{ itemID: 1, name, updatedAt }] } });
    const saved = response('saved', '2026-01-01T10:01:00Z');
    const saving = db.request({ api: '/save' });
    const listing = db.request({ api: '/list' });
    await tick();
    list.resolve(jsonResponse(response('listed', '2026-01-01T10:00:00Z')));
    if (queue !== 'shared') {
      await listing;
      expect(db.getState().storage.itemList[1].name).toBe('listed');
    }
    save.resolve(jsonResponse(saved));
    await Promise.all([saving, listing]);
    expect(db.getState().storage.itemList[1]).toEqual(saved.itemList.data[0]);
  });
});
