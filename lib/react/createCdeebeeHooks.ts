import { useCallback, useRef, useSyncExternalStore } from 'react';
import { shallowEqual } from '../utils/shallowEqual';
import type { CdeebeeHistoryEntry, CdeebeeHistoryPlugin } from '../plugins/history';
import type { CdeebeeInstance, CdeebeeList, CdeebeeState, CdeebeeStorageShape, EntityID, EntityOf, ListName } from '../core/types';

const EMPTY_LIST: never[] = [];
const noopSubscribe = () => () => {};

interface SelectorCache<R> {
  list: unknown;
  key: unknown;
  result: R;
}

interface IndexSelectorCache<R> {
  list: unknown;
  fieldName: string;
  value: unknown;
  result: R;
}

type FieldName<S, K extends ListName<S>> = Extract<keyof EntityOf<S[K]>, string>;

/** Returns `prev` when `next` is an array shallow-equal to it, so consumers keep the reference. */
const keepIfEqual = <R>(prev: R | undefined, next: R): R => (
  prev !== undefined && Array.isArray(next) && shallowEqual(prev, next) ? prev : next
);

export function createCdeebeeHooks<S extends CdeebeeStorageShape<S>>(db: CdeebeeInstance<S>) {
  const getList = <K extends ListName<S>>(listName: K) => db.getState().storage[listName] as unknown as CdeebeeList<EntityOf<S[K]>>;

  const useEntity = <K extends ListName<S>>(listName: K, entityID: EntityID | null | undefined): EntityOf<S[K]> | undefined => {
    const subscribe = useCallback(
      (listener: () => void) => (entityID == null ? noopSubscribe() : db.subscribe(listener, [{ listName, entityID }])),
      [listName, entityID],
    );
    const getSnapshot = useCallback(
      () => (entityID == null ? undefined : getList(listName)[entityID]),
      [listName, entityID],
    );
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  };

  const useList = <K extends ListName<S>>(listName: K): S[K] => {
    const subscribe = useCallback((listener: () => void) => db.subscribe(listener, [{ listName }]), [listName]);
    const getSnapshot = useCallback(() => db.getState().storage[listName], [listName]);
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  };

  const useEntityList = <K extends ListName<S>>(listName: K, entityIDList: EntityID[]): EntityOf<S[K]>[] => {
    const key = entityIDList.join('\0');
    const cacheRef = useRef<SelectorCache<EntityOf<S[K]>[]>>(undefined);
    const subscribe = useCallback(
      (listener: () => void) => db.subscribe(listener, entityIDList.map(entityID => ({ listName, entityID }))),
      [listName, key],
    );
    const getSnapshot = useCallback(() => {
      const list = getList(listName);
      const cache = cacheRef.current;
      if (cache && cache.list === list && cache.key === key) return cache.result;
      const next: EntityOf<S[K]>[] = [];
      for (let i = 0; i < entityIDList.length; i += 1) {
        const entity = list[entityIDList[i]];
        if (entity !== undefined) next.push(entity);
      }
      const result = keepIfEqual(cache?.result, next);
      cacheRef.current = { list, key, result };
      return result;
    }, [listName, key]);
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  };

  const useListSelector = <K extends ListName<S>, R>(listName: K, selector: (list: S[K]) => R, depList: unknown[] = EMPTY_LIST): R => {
    const selectorRef = useRef(selector);
    selectorRef.current = selector;
    const cacheRef = useRef<SelectorCache<R>>(undefined);
    const subscribe = useCallback((listener: () => void) => db.subscribe(listener, [{ listName }]), [listName]);
    const getSnapshot = () => {
      const list = db.getState().storage[listName];
      const cache = cacheRef.current;
      if (cache && cache.list === list && shallowEqual(cache.key, depList)) return cache.result;
      const result = keepIfEqual(cache?.result, selectorRef.current(list));
      cacheRef.current = { list, key: depList, result };
      return result;
    };
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  };

  const useEntityListBy = <K extends ListName<S>>(listName: K, fieldName: FieldName<S, K>, value: unknown): EntityOf<S[K]>[] => {
    if (!(db.settings.indexList?.[listName] as string[] | undefined)?.includes(fieldName)) {
      throw new Error(`[cdeebee] no index for ${listName}.${fieldName} — add it to settings.indexList`);
    }
    const cacheRef = useRef<IndexSelectorCache<EntityOf<S[K]>[]>>(undefined);
    const subscribe = useCallback((listener: () => void) => db.subscribe(listener, [{ listName }]), [listName]);
    const getSnapshot = () => {
      const list = getList(listName);
      const cache = cacheRef.current;
      if (cache && cache.list === list && cache.fieldName === fieldName && Object.is(cache.value, value)) return cache.result;
      const next: EntityOf<S[K]>[] = [];
      db.getIndex(listName, fieldName, value).forEach(entityID => {
        const entity = list[entityID];
        if (entity !== undefined) next.push(entity);
      });
      const result = keepIfEqual(cache?.result, next);
      cacheRef.current = { list, fieldName, value, result };
      return result;
    };
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  };

  const useLoading = (apiList: string[]): boolean => {
    const key = apiList.join('\0');
    const subscribe = useCallback((listener: () => void) => db.subscribeRequest(listener, apiList), [key]);
    const getSnapshot = useCallback(() => db.getState().activeRequestList.some(q => apiList.includes(q.api)), [key]);
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  };

  const useIsLoading = (): boolean => {
    const subscribe = useCallback((listener: () => void) => db.subscribeRequest(listener), []);
    const getSnapshot = useCallback(() => db.getState().activeRequestList.length > 0, []);
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  };

  const useStore = <R>(selector: (state: CdeebeeState<S>) => R, equalityFn: (a: R, b: R) => boolean = Object.is): R => {
    const selectorRef = useRef(selector);
    selectorRef.current = selector;
    const cacheRef = useRef<{ state: CdeebeeState<S>; result: R } | undefined>(undefined);
    const subscribe = useCallback((listener: () => void) => {
      const unsubscribeStorage = db.subscribe(listener);
      const unsubscribeRequest = db.subscribeRequest(listener);
      return () => { unsubscribeStorage(); unsubscribeRequest(); };
    }, []);
    const getSnapshot = () => {
      const state = db.getState();
      const cache = cacheRef.current;
      if (cache && cache.state === state) return cache.result;
      const next = selectorRef.current(state);
      const result = cache && equalityFn(cache.result, next) ? cache.result : next;
      cacheRef.current = { state, result };
      return result;
    };
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  };

  const getHistoryPlugin = (): CdeebeeHistoryPlugin<S> => {
    const plugin = db.getPlugin<CdeebeeHistoryPlugin<S>>('history');
    if (!plugin) throw new Error('[cdeebee] history plugin is not configured — add history() to settings.pluginList');
    return plugin;
  };

  const useHistorySlice = <R>(api: string, select: (plugin: CdeebeeHistoryPlugin<S>) => R): R => {
    const plugin = getHistoryPlugin();
    const subscribe = useCallback((listener: () => void) => plugin.subscribe(listener, [api]), [plugin, api]);
    const getSnapshot = useCallback(() => select(plugin), [plugin, api, select]);
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  };

  const useRequestHistory = (api: string): CdeebeeHistoryEntry[] => (
    useHistorySlice(api, useCallback((plugin: CdeebeeHistoryPlugin<S>) => plugin.getState().doneList[api] ?? EMPTY_LIST, [api]))
  );

  const useRequestErrorList = (api: string): CdeebeeHistoryEntry[] => (
    useHistorySlice(api, useCallback((plugin: CdeebeeHistoryPlugin<S>) => plugin.getState().errorList[api] ?? EMPTY_LIST, [api]))
  );

  const useLastResultIDList = <K extends ListName<S>>(api: string, listName: K): EntityID[] => (
    useHistorySlice(api, useCallback((plugin: CdeebeeHistoryPlugin<S>) => plugin.getState().lastResultIDList[api]?.[listName] ?? EMPTY_LIST, [api, listName]))
  );

  return {
    useEntity,
    useList,
    useEntityList,
    useListSelector,
    useEntityListBy,
    useLoading,
    useIsLoading,
    useStore,
    useRequestHistory,
    useRequestErrorList,
    useLastResultIDList,
  };
}

export type CdeebeeHooks<S extends CdeebeeStorageShape<S>> = ReturnType<typeof createCdeebeeHooks<S>>;
