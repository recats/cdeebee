import { describe, it, expect, vi, afterEach } from 'vitest';
import { createCdeebee } from '../../../lib/core/createCdeebee';
import { devtools } from '../../../lib/plugins/devtools';
import { jsonResponse, mockFetch } from '../test-helpers';

interface S { userList: Record<number, { userID: number }> }
const g = globalThis as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown };

describe('devtools plugin', () => {
  afterEach(() => { delete g.__REDUX_DEVTOOLS_EXTENSION__; });

  it('is a no-op without the extension', async () => {
    const db = createCdeebee<S>({ fetch: { fetch: mockFetch([jsonResponse({})]) }, primaryKeyList: { userList: 'userID' }, pluginList: [devtools<S>()] });
    db.setEntity('userList', 1, {});
    await expect(db.request({ api: '/x' })).resolves.toEqual({});
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
