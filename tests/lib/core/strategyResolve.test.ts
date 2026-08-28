import { describe, it, expect, vi } from 'vitest';
import { createCdeebee } from '../../../lib/core/createCdeebee';
import { jsonResponse, deferred } from '../test-helpers';

interface Seller { sellerID: number; name: string; domainList: string[] }
interface S { sellerList: Record<number, Seller> }

const full = { sellerID: 1, name: 'full', domainList: ['a.com'] };
const thin = { sellerID: 1, name: 'thin', domainList: [] };
const envelope = (seller: Seller) => ({ sellerList: { data: [seller], primaryKey: 'sellerID' } });

const controllableFetch = () => {
  const deferredList: Array<ReturnType<typeof deferred<Response>>> = [];
  const fetch = vi.fn(() => { const d = deferred<Response>(); deferredList.push(d); return d.promise; }) as unknown as typeof globalThis.fetch;
  return { fetch, deferredList };
};

const make = (fetch: typeof globalThis.fetch) => createCdeebee<S>({
  fetch: { fetch },
  primaryKeyList: { sellerList: 'sellerID' },
  apiStrategyList: { '/seller/list': { sellerList: 'upsert' } },
});

describe('strategy resolution', () => {
  it('apiStrategyList marks an endpoint full; every other endpoint patches by default', async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch);
    const fullRequest = db.request({ api: '/seller/list' });
    const thinRequest = db.request({ api: '/analytics/stats' });
    deferredList[1].resolve(jsonResponse(envelope(thin)));
    await thinRequest;
    deferredList[0].resolve(jsonResponse(envelope(full)));
    await fullRequest;
    expect(db.getState().storage.sellerList[1]).toEqual({ sellerID: 1, name: 'thin', domainList: ['a.com'] });
    // no server version on this list: the earlier-sent full response filled every hole, so the entity counts as complete
    expect(db.getEntityMeta('sellerList', 1)?.complete).toBe(true);
  });

  it('options.strategyList overrides apiStrategyList for one call', async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch);
    const request = db.request({ api: '/seller/list', strategyList: { sellerList: 'skip' } });
    deferredList[0].resolve(jsonResponse(envelope(full)));
    await request;
    expect(db.getState().storage.sellerList).toEqual({});
  });

  it('setEntity is a patch: it never marks a thin entity complete', async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch);
    const request = db.request({ api: '/analytics/stats' });
    deferredList[0].resolve(jsonResponse(envelope(thin)));
    await request;
    db.setEntity('sellerList', 1, { name: 'edited' });
    expect(db.getEntityMeta('sellerList', 1)?.complete).toBe(false);
    const late = db.request({ api: '/seller/list' });
    deferredList[1].resolve(jsonResponse(envelope(full)));
    await late;
    expect(db.getState().storage.sellerList[1]).toEqual(full);
  });
});
