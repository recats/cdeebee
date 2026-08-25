import { describe, it, expect } from 'vitest';
import { createCdeebee } from '../../../lib/core/createCdeebee';
import { retry } from '../../../lib/plugins/retry';
import { jsonResponse, mockFetch } from '../test-helpers';

interface S { userList: Record<number, { userID: number }> }
const make = (fetch: typeof globalThis.fetch, options: Parameters<typeof retry<S>>[0]) => createCdeebee<S>({
  fetch: { fetch }, primaryKeyList: { userList: 'userID' }, pluginList: [retry<S>(options)],
});

describe('retry plugin', () => {
  it('retries network errors up to count', async () => {
    const fetch = mockFetch([new TypeError('down'), new TypeError('down'), jsonResponse({ ok: 1 })]);
    await expect(make(fetch, { count: 2 }).request({ api: '/x' })).resolves.toEqual({ ok: 1 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('gives up after count attempts', async () => {
    const fetch = mockFetch([new TypeError('down')]);
    await expect(make(fetch, { count: 2 }).request({ api: '/x' })).rejects.toMatchObject({ kind: 'network' });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('does not retry http errors by default; custom when() can', async () => {
    const fetch = mockFetch([jsonResponse({}, { ok: false, status: 503 }), jsonResponse({ ok: 1 })]);
    await expect(make(fetch, { count: 1 }).request({ api: '/x' })).rejects.toMatchObject({ kind: 'http' });
    expect(fetch).toHaveBeenCalledTimes(1);

    const fetch2 = mockFetch([jsonResponse({}, { ok: false, status: 503 }), jsonResponse({ ok: 1 })]);
    await expect(make(fetch2, { count: 1, when: e => e.status === 503 }).request({ api: '/x' })).resolves.toEqual({ ok: 1 });
  });

  it('backoffMs function receives the attempt number', async () => {
    const attemptList: number[] = [];
    const fetch = mockFetch([new TypeError('down'), new TypeError('down'), jsonResponse({ ok: 1 })]);
    await make(fetch, { count: 2, backoffMs: attempt => { attemptList.push(attempt); return 0; } }).request({ api: '/x' });
    expect(attemptList).toEqual([0, 1]);
  });
});
