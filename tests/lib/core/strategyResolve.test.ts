import { describe, it, expect, vi } from 'vitest';
import { createCdeebee } from '../../../lib/core/createCdeebee';
import { jsonResponse, deferred } from '../test-helpers';

interface Item { itemID: number; name: string; domainList: string[] }
interface S { itemList: Record<number, Item> }

const full = { itemID: 1, name: 'full', domainList: ['a.com'] };
const thin = { itemID: 1, name: 'thin', domainList: [] };
const envelope = (item: Item) => ({ itemList: { data: [item], primaryKey: 'itemID' } });

const controllableFetch = () => {
  const deferredList: Array<ReturnType<typeof deferred<Response>>> = [];
  const fetch = vi.fn(() => { const d = deferred<Response>(); deferredList.push(d); return d.promise; }) as unknown as typeof globalThis.fetch;
  return { fetch, deferredList };
};

const make = (fetch: typeof globalThis.fetch) => createCdeebee<S>({
  fetch: { fetch },
  primaryKeyList: { itemList: 'itemID' },
  apiStrategyList: { '/item/list': { itemList: 'upsert' } },
});

describe('strategy resolution', () => {
  it('apiStrategyList marks an endpoint full; every other endpoint patches by default', async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch);
    const fullRequest = db.request({ api: '/item/list' });
    const thinRequest = db.request({ api: '/analytics/stats' });
    deferredList[1].resolve(jsonResponse(envelope(thin)));
    await thinRequest;
    deferredList[0].resolve(jsonResponse(envelope(full)));
    await fullRequest;
    expect(db.getState().storage.itemList[1]).toEqual({ itemID: 1, name: 'thin', domainList: ['a.com'] });
    // no server version on this list: the earlier-sent full response filled every hole, so the entity counts as complete
    expect(db.getEntityMeta('itemList', 1)?.complete).toBe(true);
  });

  it('options.strategyList overrides apiStrategyList for one call', async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch);
    const request = db.request({ api: '/item/list', strategyList: { itemList: 'skip' } });
    deferredList[0].resolve(jsonResponse(envelope(full)));
    await request;
    expect(db.getState().storage.itemList).toEqual({});
  });

  it('setEntity is a patch: it never marks a thin entity complete', async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch);
    const request = db.request({ api: '/analytics/stats' });
    deferredList[0].resolve(jsonResponse(envelope(thin)));
    await request;
    db.setEntity('itemList', 1, { name: 'edited' });
    expect(db.getEntityMeta('itemList', 1)?.complete).toBe(false);
    const late = db.request({ api: '/item/list' });
    deferredList[1].resolve(jsonResponse(envelope(full)));
    await late;
    expect(db.getState().storage.itemList[1]).toEqual(full);
  });
});
