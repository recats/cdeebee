import { describe, it, expect, vi } from 'vitest';
import { createCdeebee } from '../../../lib/core/createCdeebee';
import { history, type CdeebeeHistoryOptions, type CdeebeeHistoryPlugin } from '../../../lib/plugins/history';
import { jsonResponse, mockFetch } from '../test-helpers';

interface S { userList: Record<number, { userID: number }> }
const envelope = (idList: number[]) => ({ userList: { data: idList.map(userID => ({ userID })), primaryKey: 'userID' } });

/** fetch mock answering `{ n }` with an incrementing counter */
const countingFetch = () => {
  let n = 0;
  return vi.fn(async () => { n += 1; return jsonResponse({ n }); }) as unknown as typeof globalThis.fetch;
};

const make = (fetch: typeof globalThis.fetch, options: CdeebeeHistoryOptions = {}) => {
  const plugin = history<S>(options);
  const db = createCdeebee<S>({ fetch: { fetch }, primaryKeyList: { userList: 'userID' }, pluginList: [plugin] });
  return { db, plugin };
};

describe('history plugin', () => {
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
});
