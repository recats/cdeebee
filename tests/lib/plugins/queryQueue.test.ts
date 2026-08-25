import { describe, it, expect, vi } from 'vitest';
import { createCdeebee } from '../../../lib/core/createCdeebee';
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
  it('without the plugin the later-arriving response wins', async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch, []);
    const first = db.request({ api: '/x' });
    const second = db.request({ api: '/x' });
    deferredList[1].resolve(jsonResponse(envelope(2)));
    await second;
    deferredList[0].resolve(jsonResponse(envelope(1)));
    await first;
    expect(db.getState().storage.userList[1].v).toBe(1);
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
