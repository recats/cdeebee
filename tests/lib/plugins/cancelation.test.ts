import { describe, it, expect, vi } from 'vitest';
import { createCdeebee } from '../../../lib/core/createCdeebee';
import { cancelation } from '../../../lib/plugins/cancelation';
import type { CdeebeeRequestError } from '../../../lib/core/requestError';
import { jsonResponse, deferred, tick } from '../test-helpers';

interface S { userList: Record<number, { userID: number }> }

/** fetch that resolves when its deferred resolves and rejects on abort */
const controllableFetch = () => {
  const deferredList: Array<ReturnType<typeof deferred<Response>>> = [];
  const fetch = vi.fn((_url: string, init: RequestInit) => {
    const d = deferred<Response>();
    deferredList.push(d);
    return new Promise<Response>((resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      d.promise.then(resolve, reject);
    });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, deferredList };
};

const make = (fetch: typeof globalThis.fetch, options?: Parameters<typeof cancelation<S>>[0]) => createCdeebee<S>({
  fetch: { fetch },
  primaryKeyList: { userList: 'userID' },
  pluginList: [cancelation<S>(options)],
});

describe('cancelation plugin', () => {
  it("mode 'previous' aborts the earlier in-flight request for the same api", async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch);
    const first = db.request({ api: '/x' });
    const second = db.request({ api: '/x' });
    const firstError = await first.catch(e => e) as CdeebeeRequestError;
    expect(firstError.kind).toBe('abort');
    expect(fetch).toHaveBeenCalledTimes(1);
    deferredList[deferredList.length - 1].resolve(jsonResponse({ ok: true }));
    await expect(second).resolves.toEqual({ ok: true });
    expect(db.getState().activeRequestList).toEqual([]);
  });

  it('does not touch other apis', async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch);
    const a = db.request({ api: '/a' });
    const b = db.request({ api: '/b' });
    await tick();
    deferredList[0].resolve(jsonResponse({ a: 1 }));
    deferredList[1].resolve(jsonResponse({ b: 1 }));
    await expect(a).resolves.toEqual({ a: 1 });
    await expect(b).resolves.toEqual({ b: 1 });
  });

  it('apiList limits the plugin to listed apis', async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch, { apiList: ['/only'] });
    const first = db.request({ api: '/x' });
    const second = db.request({ api: '/x' });
    await tick();
    deferredList[0].resolve(jsonResponse({ n: 1 }));
    deferredList[1].resolve(jsonResponse({ n: 2 }));
    await expect(first).resolves.toEqual({ n: 1 });
    await expect(second).resolves.toEqual({ n: 2 });
  });

  it("mode 'latest' rejects the new request while one is in flight", async () => {
    const { fetch, deferredList } = controllableFetch();
    const db = make(fetch, { mode: 'latest' });
    const first = db.request({ api: '/x' });
    const secondError = await db.request({ api: '/x' }).catch(e => e) as CdeebeeRequestError;
    expect(secondError.kind).toBe('abort');
    expect(fetch).toHaveBeenCalledTimes(1);
    await tick();
    deferredList[0].resolve(jsonResponse({ ok: 1 }));
    await expect(first).resolves.toEqual({ ok: 1 });
    // slot is free again
    const third = db.request({ api: '/x' });
    await tick();
    deferredList[1].resolve(jsonResponse({ ok: 3 }));
    await expect(third).resolves.toEqual({ ok: 3 });
  });
});
