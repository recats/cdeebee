// @vitest-environment jsdom
import { StrictMode, type PropsWithChildren } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { createCdeebee } from '../../../lib/core/createCdeebee';
import { createCdeebeeHooks } from '../../../lib/react/createCdeebeeHooks';
import { history } from '../../../lib/plugins/history';
import { shallowEqual } from '../../../lib/utils/shallowEqual';
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

describe('useStore selector changes', () => {
  type S = { userList: Record<number, { userID: number; v: number }> };
  const settings = { fetch: {}, primaryKeyList: { userList: 'userID' as const } };

  it('useStore must recompute when selector props change', () => {
    const db = createCdeebee<S>(settings);
    db.setEntity('userList', 1, { v: 1 });
    db.setEntity('userList', 2, { v: 2 });
    const hooks = createCdeebeeHooks(db);
    const { result, rerender } = renderHook(({ id }) => hooks.useStore(s => s.storage.userList[id]), { initialProps: { id: 1 } });
    rerender({ id: 2 });
    expect(result.current.v).toBe(2);
  });

  it('useStore with an inline selector keeps a stable reference across parent re-renders', () => {
    const db = createCdeebee<S>(settings);
    db.setEntity('userList', 1, { v: 1 });
    const hooks = createCdeebeeHooks(db);
    let selectorCallCount = 0;
    const { result, rerender } = renderHook(() => hooks.useStore(s => { selectorCallCount += 1; return Object.keys(s.storage.userList); }, shallowEqual));
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
    expect(selectorCallCount).toBeLessThanOrEqual(3);
  });

  it('useStore applies a changed equality function and stays subscribed', async () => {
    const db = createCdeebee<S>(settings);
    db.setEntity('userList', 1, { v: 1 });
    const hooks = createCdeebeeHooks(db);
    const selector = (s: ReturnType<typeof db.getState>) => s.storage.userList[1].v;
    const { result, rerender } = renderHook(({ equal }) => hooks.useStore(selector, equal), { initialProps: { equal: (_a: number, _b: number) => true } });
    await act(async () => { db.setEntity('userList', 1, { v: 2 }); });
    expect(result.current).toBe(1);
    rerender({ equal: Object.is });
    expect(result.current).toBe(2);
    await act(async () => { db.setEntity('userList', 1, { v: 3 }); });
    expect(result.current).toBe(3);
  });
});

describe('entity hook lifecycle', () => {
  it.each([null, undefined])('does not subscribe for %s ID and subscribes when an ID is supplied', emptyID => {
    const { db, hooks } = make();
    const subscribe = vi.spyOn(db, 'subscribe');
    const { result, rerender } = renderHook(({ id }: { id: number | null | undefined }) => hooks.useEntity('userList', id), { initialProps: { id: emptyID as number | null | undefined } });
    expect(result.current).toBeUndefined();
    expect(subscribe).not.toHaveBeenCalled();
    rerender({ id: 1 });
    expect(result.current?.name).toBe('a');
    expect(subscribe).toHaveBeenCalledTimes(1);
    rerender({ id: emptyID });
    expect(result.current).toBeUndefined();
  });

  it('switches entity subscriptions without responding to the previous ID', async () => {
    const { db, hooks } = make();
    let renders = 0;
    const { result, rerender } = renderHook(({ id }) => { renders += 1; return hooks.useEntity('userList', id); }, { initialProps: { id: 1 } });
    rerender({ id: 2 });
    const before = renders;
    await act(async () => { db.setEntity('userList', 1, { name: 'old subscription' }); });
    expect(renders).toBe(before);
    await act(async () => { db.setEntity('userList', 2, { name: 'current subscription' }); });
    expect(result.current?.name).toBe('current subscription');
  });

  it.each(['remove', 'clear', 'replace'] as const)('observes %s and subsequent re-addition', operation => {
    const { db, hooks } = make();
    const { result } = renderHook(() => hooks.useEntity('userList', 1));
    act(() => {
      if (operation === 'remove') db.removeEntityList('userList', [1]);
      else if (operation === 'clear') db.clearList('userList');
      else db.replaceList('userList', {});
    });
    expect(result.current).toBeUndefined();
    act(() => { db.setEntity('userList', 1, { name: 'reborn', orgID: 1 }); });
    expect(result.current).toEqual({ userID: 1, name: 'reborn', orgID: 1 });
  });

  it.each([0, '007', 'uuid-a', 'a b'])('supports ID %s', id => {
    interface Item { itemID: string | number; name: string }
    const db = createCdeebee<{ itemList: Record<string | number, Item> }>({ fetch: {}, primaryKeyList: { itemList: 'itemID' } });
    const hooks = createCdeebeeHooks(db);
    const { result } = renderHook(() => hooks.useEntity('itemList', id));
    act(() => { db.setEntity('itemList', id, { name: 'found' }); });
    expect(result.current).toEqual({ itemID: id, name: 'found' });
  });

  it('keeps the entity reference for a no-op update', async () => {
    const { db, hooks } = make();
    const { result } = renderHook(() => hooks.useEntity('userList', 1));
    const before = result.current;
    await act(async () => { db.setEntity('userList', 1, { name: 'a' }); });
    expect(result.current).toBe(before);
  });
});

describe('list hook changes', () => {
  it('useList switches lists and observes replacement', () => {
    const { db, hooks } = make();
    const { result, rerender } = renderHook(({ listName }: { listName: 'userList' | 'postList' }) => hooks.useList(listName), { initialProps: { listName: 'userList' } });
    rerender({ listName: 'postList' });
    expect(result.current).toBe(db.getState().storage.postList);
    act(() => { db.replaceList('postList', { 4: { postID: 4 } }); });
    expect(result.current).toEqual({ 4: { postID: 4 } });
  });

  it('useEntityList preserves requested order and duplicates, omits missing IDs, and switches subscriptions', () => {
    const { db, hooks } = make();
    const { result, rerender } = renderHook(({ ids }) => hooks.useEntityList('userList', ids), { initialProps: { ids: [2, 9, 1, 2] } });
    expect(result.current.map(user => user.userID)).toEqual([2, 1, 2]);
    act(() => { db.setEntity('userList', 9, { name: 'nine', orgID: 10 }); });
    expect(result.current.map(user => user.userID)).toEqual([2, 9, 1, 2]);
    rerender({ ids: [3] });
    const before = result.current;
    act(() => { db.setEntity('userList', 2, { name: 'ignored' }); });
    expect(result.current).toBe(before);
    act(() => { db.removeEntityList('userList', [3]); });
    expect(result.current).toEqual([]);
    rerender({ ids: [] });
    const empty = result.current;
    act(() => { db.setEntity('userList', 3, { name: 'not selected', orgID: 20 }); });
    expect(result.current).toBe(empty);
  });

  it('useEntityList keeps references when a parent supplies equivalent IDs', () => {
    const { hooks } = make();
    const { result, rerender } = renderHook(({ ids }) => hooks.useEntityList('userList', ids), { initialProps: { ids: [1, 2] } });
    const before = result.current;
    rerender({ ids: [1, 2] });
    expect(result.current).toBe(before);
    rerender({ ids: [2, 1] });
    expect(result.current.map(user => user.userID)).toEqual([2, 1]);
  });

  it('useListSelector uses the latest selector on the next store update', () => {
    const { db, hooks } = make();
    const { result, rerender } = renderHook(({ prefix }) => hooks.useListSelector('userList', list => prefix + list[1].name), { initialProps: { prefix: 'first:' } });
    rerender({ prefix: 'second:' });
    act(() => { db.setEntity('userList', 1, { name: 'changed' }); });
    expect(result.current).toBe('second:changed');
  });

  it('useEntityListBy responds to value changes, index moves, deletions and reset', () => {
    const { db, hooks } = make();
    const { result, rerender } = renderHook(({ group }) => hooks.useEntityListBy('userList', 'orgID', group), { initialProps: { group: 10 } });
    rerender({ group: 20 });
    expect(result.current.map(user => user.userID)).toEqual([3]);
    act(() => { db.setEntity('userList', 1, { orgID: 20 }); });
    expect(result.current.map(user => user.userID).sort()).toEqual([1, 3]);
    act(() => { db.setEntity('userList', 3, { orgID: 10 }); });
    expect(result.current.map(user => user.userID)).toEqual([1]);
    act(() => { db.removeEntityList('userList', [1]); });
    expect(result.current).toEqual([]);
    act(() => { db.replaceList('userList', { 9: { userID: 9, name: 'nine', orgID: 20 } }); });
    expect(result.current.map(user => user.userID)).toEqual([9]);
    act(() => { db.clearList('userList'); });
    expect(result.current).toEqual([]);
  });

  it('useEntityListBy retains the selected reference when another group changes', () => {
    const { db, hooks } = make();
    const { result } = renderHook(() => hooks.useEntityListBy('userList', 'orgID', 10));
    const before = result.current;
    act(() => { db.setEntity('userList', 3, { name: 'other' }); });
    expect(result.current).toBe(before);
  });
});

const strictWrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;

describe('subscriptions under StrictMode', () => {
  const hookNames = ['useEntity', 'useList', 'useEntityList', 'useListSelector', 'useEntityListBy', 'useLoading', 'useIsLoading', 'useStore', 'useRequestHistory', 'useRequestErrorList', 'useLastResultIDList', 'useLastResponse'] as const;
  it.each(hookNames)('%s cleans up all subscriptions on unmount', async hookName => {
    const plugin = history<S>();
    const { db, hooks } = make({ pluginList: [plugin] });
    let active = 0;
    const track = <A extends unknown[]>(subscribe: (...args: A) => () => void) => (...args: A) => {
      const unsubscribe = subscribe(...args);
      active += 1;
      return () => { active -= 1; unsubscribe(); };
    };
    const storageSubscribe = track(db.subscribe);
    const requestSubscribe = track(db.subscribeRequest);
    const historySubscribe = track(plugin.subscribe);
    vi.spyOn(db, 'subscribe').mockImplementation(storageSubscribe);
    vi.spyOn(db, 'subscribeRequest').mockImplementation(requestSubscribe);
    vi.spyOn(plugin, 'subscribe').mockImplementation(historySubscribe);
    const useSelectedHook = () => {
      switch (hookName) {
        case 'useEntity': return hooks.useEntity('userList', 1);
        case 'useList': return hooks.useList('userList');
        case 'useEntityList': return hooks.useEntityList('userList', [1, 2]);
        case 'useListSelector': return hooks.useListSelector('userList', list => Object.keys(list));
        case 'useEntityListBy': return hooks.useEntityListBy('userList', 'orgID', 10);
        case 'useLoading': return hooks.useLoading(['/x']);
        case 'useIsLoading': return hooks.useIsLoading();
        case 'useStore': return hooks.useStore(state => state.storage.userList);
        case 'useRequestHistory': return hooks.useRequestHistory('/x');
        case 'useRequestErrorList': return hooks.useRequestErrorList('/x');
        case 'useLastResultIDList': return hooks.useLastResultIDList('/x', 'userList');
        case 'useLastResponse': return hooks.useLastResponse('/x');
      }
    };
    const { unmount } = renderHook(useSelectedHook, { wrapper: strictWrapper });
    expect(active).toBe(hookName === 'useStore' ? 2 : 1);
    unmount();
    expect(active).toBe(0);
    await act(async () => { db.setEntity('userList', 1, { name: 'after unmount' }); plugin.clear(); });
    expect(active).toBe(0);
  });

  it('useStore observes atomic changes across lists', () => {
    const { db, hooks } = make();
    const observations: string[] = [];
    renderHook(() => {
      const selected = hooks.useStore(state => `${state.storage.userList[1].name}:${Object.keys(state.storage.postList).length}`);
      observations.push(selected);
    }, { wrapper: strictWrapper });
    act(() => { db.commit({ userList: { patchList: [{ userID: 1, name: 'changed', orgID: 10 }] }, postList: { upsertList: [{ postID: 1 }] } }, { source: 'set' }); });
    expect(observations.at(-1)).toBe('changed:1');
    expect(observations.every(value => value === 'a:0' || value === 'changed:1')).toBe(true);
  });

  it('server rendering reads initial storage and history without subscriptions', () => {
    const plugin = history<S>();
    const { db, hooks } = make({ pluginList: [plugin] });
    const subscribe = vi.spyOn(db, 'subscribe');
    const Probe = () => <span>{hooks.useEntity('userList', 1)?.name}|{hooks.useEntityList('userList', [2, 1]).length}|{String(hooks.useIsLoading())}|{hooks.useRequestHistory('/x').length}</span>;
    expect(renderToString(<Probe />)).toBe('<span>a<!-- -->|<!-- -->2<!-- -->|<!-- -->false<!-- -->|<!-- -->0</span>');
    expect(subscribe).not.toHaveBeenCalled();
  });
});

describe('request hook lifecycle', () => {
  it.each(['success', 'http', 'network', 'parse', 'abort'] as const)('clears loading after %s', async outcome => {
    const pending = deferred<Response>();
    const controller = new AbortController();
    const { db, hooks } = make({ fetch: { fetch: () => pending.promise }, pluginList: [history<S>()] });
    const { result } = renderHook(() => ({ loading: hooks.useLoading(['/x']), any: hooks.useIsLoading(), errors: hooks.useRequestErrorList('/x') }));
    let request: Promise<unknown> = Promise.resolve();
    await act(async () => { request = db.request({ api: '/x', signal: controller.signal }).catch(error => error); });
    expect(result.current.loading).toBe(true);
    expect(result.current.any).toBe(true);
    await act(async () => {
      if (outcome === 'network') pending.reject(new TypeError('network failed'));
      else if (outcome === 'abort') { controller.abort(); pending.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }
      else if (outcome === 'http') pending.resolve(jsonResponse({}, { ok: false, status: 500 }));
      else if (outcome === 'parse') pending.resolve(new Response('not json'));
      else pending.resolve(jsonResponse({}));
      await request;
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.any).toBe(false);
    expect(result.current.errors.map(entry => entry.error?.kind)).toEqual(outcome === 'success' || outcome === 'abort' ? [] : [outcome]);
  });

  it('tracks multiple requests to one API and switches the watched APIs', async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const pending = [first, second];
    let index = 0;
    const { db, hooks } = make({ fetch: { fetch: () => pending[index++].promise } });
    const { result, rerender } = renderHook(({ apis }) => ({ loading: hooks.useLoading(apis), any: hooks.useIsLoading() }), { initialProps: { apis: ['/x'] } });
    let one: Promise<unknown> = Promise.resolve();
    let two: Promise<unknown> = Promise.resolve();
    await act(async () => { one = db.request({ api: '/x' }); two = db.request({ api: '/x' }); });
    expect(result.current.loading).toBe(true);
    await act(async () => { first.resolve(jsonResponse({})); await one; });
    expect(result.current.loading).toBe(true);
    rerender({ apis: ['/y'] });
    expect(result.current).toEqual({ loading: false, any: true });
    rerender({ apis: [] });
    expect(result.current.loading).toBe(false);
    await act(async () => { second.resolve(jsonResponse({})); await two; });
    expect(result.current.any).toBe(false);
  });
});

describe('history hook contracts', () => {
  const envelope = (idList: number[]) => ({ userList: { primaryKey: 'userID', data: idList.map(userID => ({ userID, name: String(userID), orgID: 10 })) } });

  it.each([{ ids: [] as number[] }, { ids: [1, 2] }])('keeps ID references and avoids re-renders for repeated result $ids', async ({ ids }) => {
    const { db, hooks } = make({ fetch: { fetch: mockFetch([jsonResponse(envelope(ids))]) }, pluginList: [history<S>()] });
    let renders = 0;
    const { result } = renderHook(() => { renders += 1; return hooks.useLastResultIDList('/x', 'userList'); });
    await act(async () => { await db.request({ api: '/x' }); });
    const first = result.current;
    const count = renders;
    await act(async () => { await db.request({ api: '/x' }); });
    expect(result.current).toBe(first);
    expect(renders).toBe(count);
  });

  it('clears result IDs for an empty envelope, keeps IDs on 204, and records the actual latest response', async () => {
    const { db, hooks } = make({ fetch: { fetch: mockFetch([jsonResponse(envelope([8])), jsonResponse(envelope([])), new Response(null, { status: 204 })]) }, pluginList: [history<S>()] });
    const { result } = renderHook(() => ({ ids: hooks.useLastResultIDList('/x', 'userList'), response: hooks.useLastResponse('/x'), done: hooks.useRequestHistory('/x') }));
    await act(async () => { await db.request({ api: '/x' }); });
    expect(result.current.ids).toEqual([8]);
    await act(async () => { await db.request({ api: '/x' }); });
    expect(result.current.ids).toEqual([]);
    expect(result.current.response).toEqual(envelope([]));
    const empty = result.current.ids;
    await act(async () => { await db.request({ api: '/x' }); });
    expect(result.current.ids).toBe(empty);
    expect(result.current.response).toBeUndefined();
    expect(result.current.done).toHaveLength(3);
  });

  it('switches history APIs and list names without retaining previous selections', async () => {
    const plugin = history<S>();
    const { db, hooks } = make({ fetch: { fetch: mockFetch([jsonResponse(envelope([8])), jsonResponse({ postList: { primaryKey: 'postID', data: [{ postID: 9 }] } })]) }, pluginList: [plugin] });
    const { result, rerender } = renderHook(({ api, listName }: { api: string; listName: 'userList' | 'postList' }) => ({ ids: hooks.useLastResultIDList(api, listName), done: hooks.useRequestHistory(api), errors: hooks.useRequestErrorList(api), response: hooks.useLastResponse(api) }), { initialProps: { api: '/a', listName: 'userList' } });
    await act(async () => { await db.request({ api: '/a' }); await db.request({ api: '/b' }); });
    expect(result.current.ids).toEqual([8]);
    rerender({ api: '/b', listName: 'postList' });
    expect(result.current.ids).toEqual([9]);
    expect(result.current.done[0].api).toBe('/b');
    rerender({ api: '/b', listName: 'userList' });
    expect(result.current.ids).toEqual([]);
    rerender({ api: '/unknown', listName: 'userList' });
    expect(result.current).toEqual({ ids: [], done: [], errors: [], response: undefined });
  });

  it.each(['api', 'all'] as const)('clear(%s) resets all history hooks', async kind => {
    const plugin = history<S>();
    const { db, hooks } = make({ fetch: { fetch: mockFetch([jsonResponse(envelope([8])), jsonResponse({}, { ok: false, status: 500 })]) }, pluginList: [plugin] });
    const { result } = renderHook(() => ({ ids: hooks.useLastResultIDList('/x', 'userList'), done: hooks.useRequestHistory('/x'), errors: hooks.useRequestErrorList('/x'), response: hooks.useLastResponse('/x') }));
    await act(async () => { await db.request({ api: '/x' }); await db.request({ api: '/x' }).catch(() => undefined); });
    expect(result.current.done).toHaveLength(1);
    expect(result.current.errors).toHaveLength(1);
    await act(async () => { if (kind === 'api') plugin.clear('/x'); else plugin.clear(); });
    expect(result.current).toEqual({ ids: [], done: [], errors: [], response: undefined });
  });

  it('does not re-render history consumers for unrelated APIs', async () => {
    const { db, hooks } = make({ fetch: { fetch: mockFetch([jsonResponse(envelope([8]))]) }, pluginList: [history<S>()] });
    let renders = 0;
    renderHook(() => { renders += 1; hooks.useRequestHistory('/a'); hooks.useRequestErrorList('/a'); hooks.useLastResponse('/a'); hooks.useLastResultIDList('/a', 'userList'); });
    const before = renders;
    await act(async () => { await db.request({ api: '/b' }); });
    expect(renders).toBe(before);
  });

  it('history describes the response even when a clear during fetch prevents entity insertion', async () => {
    const pending = deferred<Response>();
    const { db, hooks } = make({ fetch: { fetch: () => pending.promise }, pluginList: [history<S>()] });
    const { result } = renderHook(() => ({ ids: hooks.useLastResultIDList('/x', 'userList'), user: hooks.useEntity('userList', 8) }));
    let request: Promise<unknown> = Promise.resolve();
    await act(async () => { request = db.request({ api: '/x' }); });
    act(() => { db.clearList('userList'); });
    await act(async () => { pending.resolve(jsonResponse(envelope([8]))); await request; });
    expect(result.current).toEqual({ ids: [8], user: undefined });
  });

  it.each(['useRequestHistory', 'useRequestErrorList', 'useLastResultIDList', 'useLastResponse'] as const)('%s reports a missing history plugin', name => {
    const { hooks } = make();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => renderHook(() => name === 'useLastResultIDList' ? hooks.useLastResultIDList('/x', 'userList') : hooks[name]('/x'))).toThrow('history plugin is not configured');
    } finally { error.mockRestore(); }
  });
});

describe('additional hook edge cases', () => {
  it('indexed selections skip IDs no longer available in storage', () => {
    const { db, hooks } = make();
    vi.spyOn(db, 'getIndex').mockReturnValue(new Set([1, 99]));
    const { result } = renderHook(() => hooks.useEntityListBy('userList', 'orgID', 10));
    expect(result.current.map(user => user.userID)).toEqual([1]);
  });

  it('useStore obeys equalityFn even across selector changes', () => {
    const { hooks } = make();
    const { result, rerender } = renderHook(({ id }) => hooks.useStore(state => [state.storage.userList[id]], (a, b) => a.length === b.length), { initialProps: { id: 1 } });
    const first = result.current;
    rerender({ id: 2 });
    // This comparator declares all one-element lists equivalent, regardless of contents.
    expect(result.current).toBe(first);
    expect(result.current[0].userID).toBe(1);
  });

  it('useStore with shallowEqual updates when selector props select different contents', () => {
    const { hooks } = make();
    const { result, rerender } = renderHook(({ id }) => hooks.useStore(state => [state.storage.userList[id]], shallowEqual), { initialProps: { id: 1 } });
    rerender({ id: 2 });
    expect(result.current[0].userID).toBe(2);
  });

  it('historyClear resets hooks before a pending request settles', async () => {
    const pending = deferred<Response>();
    let calls = 0;
    const { db, hooks } = make({ fetch: { fetch: async () => ++calls === 1 ? jsonResponse({ value: 1 }) : pending.promise }, pluginList: [history<S>()] });
    const { result } = renderHook(() => ({ done: hooks.useRequestHistory('/x'), response: hooks.useLastResponse('/x'), loading: hooks.useLoading(['/x']) }));
    await act(async () => { await db.request({ api: '/x' }); });
    let request: Promise<unknown> = Promise.resolve();
    await act(async () => { request = db.request({ api: '/x', historyClear: true }); });
    expect(result.current).toEqual({ done: [], response: undefined, loading: true });
    await act(async () => { pending.resolve(jsonResponse({ value: 2 })); await request; });
    expect(result.current.done).toHaveLength(1);
    expect(result.current.response).toEqual({ value: 2 });
  });
});
