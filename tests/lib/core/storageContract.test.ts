import { describe, expect, it } from 'vitest';
import { createCdeebee } from '../../../lib/core/createCdeebee';
import { history } from '../../../lib/plugins/history';
import type { CdeebeeChangeSet } from '../../../lib/core/types';

interface Row { id: string; value: number }
interface Storage { rowList: Record<string, Row> }
const primaryKeyList = { rowList: 'id' as const };
const idList = ['__proto__', 'constructor', 'toString'];

describe('storage dictionaries', () => {
  it.each(['patch', 'upsert', 'replaceList'] as const)('stores arbitrary string IDs with strategy %s, including across resets', async strategy => {
    const response = { rowList: { data: idList.map(id => ({ id, value: 1 })), primaryKey: 'id' } };
    const db = createCdeebee<Storage>({
      fetch: { fetch: async () => new Response(JSON.stringify(response)) }, primaryKeyList,
      strategyList: { rowList: strategy }, indexList: { rowList: ['value'] },
    });
    for (const id of idList) expect(db.getState().storage.rowList[id]).toBeUndefined();
    await db.request({ api: '/read' });
    expect(Object.keys(db.getState().storage.rowList)).toEqual(idList);
    expect(Array.from(db.getIndex('rowList', 'value', 1))).toEqual(idList);
    const before = db.getState();
    db.setEntity('rowList', '__proto__', { value: 2 });
    expect(before.storage.rowList.__proto__).toEqual({ id: '__proto__', value: 1 });
    expect(db.getState().storage.rowList.__proto__).toEqual({ id: '__proto__', value: 2 });
    db.removeEntityList('rowList', idList);
    for (const id of idList) expect(db.getState().storage.rowList[id]).toBeUndefined();
    db.reset();
    await db.request({ api: '/read' });
    expect(JSON.parse(JSON.stringify(db.getState().storage))).toEqual({ rowList: Object.fromEntries(response.rowList.data.map(row => [row.id, row])) });
  });

  it('history treats arbitrary API names as keys rather than inherited properties', async () => {
    const plugin = history<Storage>();
    const db = createCdeebee<Storage>({ fetch: { fetch: async () => new Response('{}') }, primaryKeyList, pluginList: [plugin] });
    for (const api of idList) {
      expect(plugin.getLast(api)).toBeUndefined();
      await db.request({ api });
      expect(plugin.getLast(api)?.api).toBe(api);
      plugin.clear(api);
      expect(plugin.getLast(api)).toBeUndefined();
    }
  });

  it('ignores undeclared response lists consistently for all strategies', async () => {
    const response = { extraList: { primaryKey: 'id', data: [{ id: 'extra', value: 1 }] } };
    const db = createCdeebee<Storage>({ fetch: { fetch: async () => new Response(JSON.stringify(response)) }, primaryKeyList });
    await expect(db.request({ api: '/read' })).resolves.toEqual(response);
    expect(Object.keys(db.getState().storage)).toEqual(['rowList']);
  });

  it('rejects a change set containing an undeclared list before writing any data or metadata', async () => {
    const db = createCdeebee<Storage>({ fetch: { fetch: async () => new Response('{}') }, primaryKeyList });
    const changeSet = {
      rowList: { upsertList: [{ id: 'one', value: 1 }] },
      extraList: { replaceList: {} },
    } as CdeebeeChangeSet<Storage>;
    const before = db.getState();
    expect(() => db.commit(changeSet, { source: 'set' })).toThrow('unknown list "extraList"');
    expect(db.getState()).toBe(before);
    expect(db.getEntityMeta('rowList', 'one')).toBeUndefined();
    await expect(db.requestSettled({ api: '/read', normalize: () => changeSet })).resolves.toMatchObject({ ok: false, error: { kind: 'normalize' } });
    expect(db.getState().storage.rowList).toEqual({});
  });
});
