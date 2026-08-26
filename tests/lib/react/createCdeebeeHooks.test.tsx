// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createCdeebee } from '../../../lib/core/createCdeebee';
import { createCdeebeeHooks } from '../../../lib/react/createCdeebeeHooks';
import { history } from '../../../lib/plugins/history';
import { jsonResponse, mockFetch, deferred } from '../test-helpers';

interface User { userID: number; name: string; orgID: number }
interface S { userList: Record<number, User>; postList: Record<number, { postID: number }> }

const make = (over: Partial<Parameters<typeof createCdeebee<S>>[0]> = {}) => {
  const db = createCdeebee<S>({
    fetch: {},
    primaryKeyList: { userList: 'userID', postList: 'postID' },
    indexList: { userList: ['orgID'] },
    initialStorage: { userList: { 1: { userID: 1, name: 'a', orgID: 10 }, 2: { userID: 2, name: 'b', orgID: 10 }, 3: { userID: 3, name: 'c', orgID: 20 } } },
    ...over,
  });
  return { db, hooks: createCdeebeeHooks(db) };
};

describe('createCdeebeeHooks', () => {
  it('useEntity re-renders only the row whose entity changed', async () => {
    const { db, hooks } = make();
    const renderCount = { 1: 0, 2: 0 };
    const Row = ({ userID }: { userID: 1 | 2 }) => {
      renderCount[userID] += 1;
      const user = hooks.useEntity('userList', userID);
      return <span data-testid={`row-${userID}`}>{user?.name}</span>;
    };
    render(<><Row userID={1} /><Row userID={2} /></>);
    expect(renderCount).toEqual({ 1: 1, 2: 1 });
    await act(async () => { db.setEntity('userList', 1, { name: 'A' }); });
    expect(screen.getByTestId('row-1').textContent).toBe('A');
    expect(renderCount).toEqual({ 1: 2, 2: 1 });
  });

  it('useEntity drives a controlled input without losing the caret', () => {
    const { db, hooks } = make();
    const Field = () => {
      const user = hooks.useEntity('userList', 1);
      return (
        <input
          data-testid='name'
          value={user?.name ?? ''}
          onChange={event => db.setEntity('userList', 1, { name: event.target.value })}
        />
      );
    };
    render(<Field />);
    const input = screen.getByTestId('name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ab' } });
    expect(input.value).toBe('ab');
    expect(db.getState().storage.userList[1].name).toBe('ab');

    input.setSelectionRange(1, 1);
    fireEvent.change(input, { target: { value: 'axb', selectionStart: 2, selectionEnd: 2 } });
    expect(input.value).toBe('axb');
    expect(input.selectionStart).toBe(2);
  });

  it('useEntity returns undefined for missing / null id and updates when it appears', async () => {
    const { db, hooks } = make();
    const Probe = ({ userID }: { userID: number | null }) => <span data-testid='p'>{String(hooks.useEntity('userList', userID)?.name)}</span>;
    render(<Probe userID={9} />);
    expect(screen.getByTestId('p').textContent).toBe('undefined');
    await act(async () => { db.setEntity('userList', 9, { name: 'nine', orgID: 1 }); });
    expect(screen.getByTestId('p').textContent).toBe('nine');
  });

  it('useList does not re-render when another list changes', async () => {
    const { db, hooks } = make();
    let renderCount = 0;
    const Comp = () => { renderCount += 1; const list = hooks.useList('userList'); return <span>{Object.keys(list).length}</span>; };
    render(<Comp />);
    await act(async () => { db.setEntity('postList', 1, {}); });
    expect(renderCount).toBe(1);
    await act(async () => { db.setEntity('userList', 4, { name: 'd', orgID: 1 }); });
    expect(renderCount).toBe(2);
  });

  it('useEntityList returns a stable array until one of its entities changes', async () => {
    const { db, hooks } = make();
    const resultList: User[][] = [];
    const Comp = () => { resultList.push(hooks.useEntityList('userList', [1, 2])); return null; };
    render(<Comp />);
    await act(async () => { db.setEntity('userList', 3, { name: 'C' }); });
    expect(resultList).toHaveLength(1);
    await act(async () => { db.setEntity('userList', 2, { name: 'B' }); });
    expect(resultList).toHaveLength(2);
    expect(resultList[1].map(u => u.name)).toEqual(['a', 'B']);
  });

  it('useListSelector keeps the old array when the selected set is unchanged', async () => {
    const { db, hooks } = make();
    let renderCount = 0;
    const Comp = () => {
      renderCount += 1;
      const idList = hooks.useListSelector('userList', list => Object.values(list).filter(u => u.orgID === 10).map(u => u.userID), []);
      return <span data-testid='ids'>{idList.join(',')}</span>;
    };
    render(<Comp />);
    expect(screen.getByTestId('ids').textContent).toBe('1,2');
    await act(async () => { db.setEntity('userList', 3, { name: 'zzz' }); });   // list changed, selection identical
    expect(renderCount).toBe(1);
    await act(async () => { db.setEntity('userList', 5, { name: 'e', orgID: 10 }); });
    expect(renderCount).toBe(2);
    expect(screen.getByTestId('ids').textContent).toBe('1,2,5');
  });

  it('useListSelector recomputes when depList changes', async () => {
    const { hooks } = make();
    const Comp = ({ orgID }: { orgID: number }) => {
      const count = hooks.useListSelector('userList', list => Object.values(list).filter(u => u.orgID === orgID).length, [orgID]);
      return <span data-testid='n'>{count}</span>;
    };
    const { rerender } = render(<Comp orgID={10} />);
    expect(screen.getByTestId('n').textContent).toBe('2');
    rerender(<Comp orgID={20} />);
    expect(screen.getByTestId('n').textContent).toBe('1');
  });

  it('useEntityListBy reads through the index and throws without one in dev', async () => {
    const { db, hooks } = make();
    const Comp = () => <span data-testid='by'>{hooks.useEntityListBy('userList', 'orgID', 10).map(u => u.name).join(',')}</span>;
    render(<Comp />);
    expect(screen.getByTestId('by').textContent).toBe('a,b');
    await act(async () => { db.setEntity('userList', 3, { orgID: 10 }); });
    expect(screen.getByTestId('by').textContent).toBe('a,b,c');

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Bad = () => { hooks.useEntityListBy('userList', 'name', 'a'); return null; };
    expect(() => render(<Bad />)).toThrow('[cdeebee] no index for userList.name');
    spy.mockRestore();
  });

  it('useLoading / useIsLoading follow activeRequestList per api', async () => {
    const d = deferred<Response>();
    const fetch = vi.fn(() => d.promise) as unknown as typeof globalThis.fetch;
    const { db, hooks } = make({ fetch: { fetch } });
    const Comp = () => <span data-testid='l'>{String(hooks.useLoading(['/x']))}|{String(hooks.useLoading(['/y']))}|{String(hooks.useIsLoading())}</span>;
    render(<Comp />);
    expect(screen.getByTestId('l').textContent).toBe('false|false|false');
    let promise!: Promise<unknown>;
    await act(async () => { promise = db.request({ api: '/x' }); });
    expect(screen.getByTestId('l').textContent).toBe('true|false|true');
    await act(async () => { d.resolve(jsonResponse({})); await promise; });
    expect(screen.getByTestId('l').textContent).toBe('false|false|false');
  });

  it('useStore with equalityFn bails out on equal results', async () => {
    const { db, hooks } = make();
    let renderCount = 0;
    const Comp = () => {
      renderCount += 1;
      const n = hooks.useStore(state => ({ n: Object.keys(state.storage.userList).length }), (a, b) => a.n === b.n);
      return <span data-testid='s'>{n.n}</span>;
    };
    render(<Comp />);
    await act(async () => { db.setEntity('userList', 1, { name: 'renamed' }); });
    expect(renderCount).toBe(1);
    await act(async () => { db.setEntity('userList', 7, { name: 'g', orgID: 1 }); });
    expect(screen.getByTestId('s').textContent).toBe('4');
  });

  it('history hooks require the plugin and expose done/error/lastResultIDList', async () => {
    const { hooks: noPlugin } = make();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Bad = () => { noPlugin.useRequestHistory('/x'); return null; };
    expect(() => render(<Bad />)).toThrow('history plugin');
    spy.mockRestore();

    const fetch = mockFetch([jsonResponse({ userList: { data: [{ userID: 8, name: 'h', orgID: 1 }], primaryKey: 'userID' } }), jsonResponse({}, { ok: false, status: 500 })]);
    const { db, hooks } = make({ fetch: { fetch }, pluginList: [history<S>()] });
    const Comp = () => {
      const done = hooks.useRequestHistory('/x');
      const errorList = hooks.useRequestErrorList('/x');
      const idList = hooks.useLastResultIDList('/x', 'userList');
      return <span data-testid='h'>{done.length}|{errorList.length}|{idList.join(',')}</span>;
    };
    render(<Comp />);
    expect(screen.getByTestId('h').textContent).toBe('0|0|');
    await act(async () => { await db.request({ api: '/x' }); });
    expect(screen.getByTestId('h').textContent).toBe('1|0|8');
    await act(async () => { await db.request({ api: '/x' }).catch(() => undefined); });
    expect(screen.getByTestId('h').textContent).toBe('1|1|8');
  });

  it('useStore sees activeRequestList changes and caches object selectors without equalityFn', async () => {
    const d = deferred<Response>();
    const fetch = vi.fn(() => d.promise) as unknown as typeof globalThis.fetch;
    const { db, hooks } = make({ fetch: { fetch } });
    let renderCount = 0;
    const Comp = () => {
      renderCount += 1;
      const s = hooks.useStore(state => ({ active: state.activeRequestList.length }));
      return <span data-testid='a'>{s.active}</span>;
    };
    render(<Comp />);
    expect(screen.getByTestId('a').textContent).toBe('0');
    let promise!: Promise<unknown>;
    await act(async () => { promise = db.request({ api: '/x' }); });
    expect(screen.getByTestId('a').textContent).toBe('1');
    await act(async () => { d.resolve(jsonResponse({})); await promise; });
    expect(screen.getByTestId('a').textContent).toBe('0');
    expect(renderCount).toBeLessThanOrEqual(4);
  });

  it('useEntityListBy recomputes when only the field changes', () => {
    const { hooks } = make({ indexList: { userList: ['orgID', 'name'] } });
    const Comp = ({ fieldName, value }: { fieldName: 'orgID' | 'name'; value: unknown }) => (
      <span data-testid='f'>{hooks.useEntityListBy('userList', fieldName, value).map(u => u.userID).join(',')}</span>
    );
    const { rerender } = render(<Comp fieldName='orgID' value={10} />);
    expect(screen.getByTestId('f').textContent).toBe('1,2');
    rerender(<Comp fieldName='name' value='a' />);
    expect(screen.getByTestId('f').textContent).toBe('1');
  });

  it('useEntityList keys do not collide on ids containing spaces', async () => {
    interface Tag { tagID: string }
    const tagDb = createCdeebee<{ tagList: Record<string, Tag> }>({
      fetch: {}, primaryKeyList: { tagList: 'tagID' },
      initialStorage: { tagList: { 'a b': { tagID: 'a b' }, a: { tagID: 'a' }, b: { tagID: 'b' } } },
    });
    const tagHooks = createCdeebeeHooks(tagDb);
    const Comp = ({ idList }: { idList: string[] }) => <span data-testid='t'>{tagHooks.useEntityList('tagList', idList).map(t => t.tagID).join('|')}</span>;
    const { rerender } = render(<Comp idList={['a b']} />);
    expect(screen.getByTestId('t').textContent).toBe('a b');
    rerender(<Comp idList={['a', 'b']} />);
    expect(screen.getByTestId('t').textContent).toBe('a|b');
  });

  it('useLastResponse returns the newest response for the api', async () => {
    const fetch = mockFetch([jsonResponse({ n: 1 }), jsonResponse({ n: 2 })]);
    const { db, hooks } = make({ fetch: { fetch }, pluginList: [history<S>()] });
    const Comp = () => <span data-testid='r'>{String(hooks.useLastResponse<{ n: number }>('/x')?.n)}</span>;
    render(<Comp />);
    expect(screen.getByTestId('r').textContent).toBe('undefined');
    await act(async () => { await db.request({ api: '/x' }); });
    expect(screen.getByTestId('r').textContent).toBe('1');
    await act(async () => { await db.request({ api: '/x' }); });
    expect(screen.getByTestId('r').textContent).toBe('2');
  });
});
