import { applyChangeSet } from './commit';
import { IndexManager } from './indexManager';
import { runRequest } from './pipeline';
import { SubscriptionManager, RequestSubscriptionManager } from './subscription';
import type {
  CdeebeeChangeSet, CdeebeeCommitMeta, CdeebeeInstance, CdeebeePlugin, CdeebeeRequestOptions,
  CdeebeeSettings, CdeebeeState, CdeebeeStorage, CdeebeeStorageShape, EntityID, EntityOf, ListName,
} from './types';

export interface CdeebeeInternal {
  addActiveRequest: (api: string, requestID: string) => void;
  removeActiveRequest: (api: string, requestID: string) => void;
}

export type RequestRunner = <S, R, D>(
  db: CdeebeeInstance<S>,
  internal: CdeebeeInternal,
  options: CdeebeeRequestOptions<S, R, D>,
) => Promise<R>;

export function createCdeebee<S extends CdeebeeStorageShape<S>>(settings: CdeebeeSettings<S>, runner: RequestRunner = runRequest): CdeebeeInstance<S> {
  const { primaryKeyList } = settings;
  const pluginList: CdeebeePlugin<S>[] = settings.pluginList ?? [];

  const storage = {} as CdeebeeStorage;
  const listNameList = Object.keys(primaryKeyList) as ListName<S>[];
  for (let i = 0; i < listNameList.length; i += 1) {
    storage[listNameList[i]] = (settings.initialStorage as CdeebeeStorage | undefined)?.[listNameList[i]] ?? {};
  }
  let state: CdeebeeState<S> = { storage: storage as S, activeRequestList: [] };

  const subscriptionManager = new SubscriptionManager<S>();
  const requestSubscriptionManager = new RequestSubscriptionManager();
  const indexManager = new IndexManager<S>(settings.indexList);
  indexManager.rebuild(state.storage);

  const commit = (changeSet: CdeebeeChangeSet<S>, meta: CdeebeeCommitMeta) => {
    const prevStorage = state.storage;
    const { storage: nextStorage, changedList } = applyChangeSet(prevStorage, changeSet, primaryKeyList);
    if (nextStorage === prevStorage) return changedList;
    state = { ...state, storage: nextStorage };
    indexManager.update(prevStorage, nextStorage, changedList);
    subscriptionManager.notify(changedList);
    // local mutations notify synchronously so controlled inputs never lose their caret
    if (meta.source === 'set') subscriptionManager.flush();
    for (let i = 0; i < pluginList.length; i += 1) pluginList[i].onCommit?.(changeSet, meta, changedList);
    return changedList;
  };

  const internal: CdeebeeInternal = {
    addActiveRequest(api, requestID) {
      state = { ...state, activeRequestList: [...state.activeRequestList, { api, requestID }] };
      requestSubscriptionManager.notify(api);
    },
    removeActiveRequest(api, requestID) {
      const nextList = state.activeRequestList.filter(q => !(q.api === api && q.requestID === requestID));
      if (nextList.length === state.activeRequestList.length) return;
      state = { ...state, activeRequestList: nextList };
      requestSubscriptionManager.notify(api);
    },
  };

  const db: CdeebeeInstance<S> = {
    settings,
    pluginList,
    getState: () => state,
    getSnapshot: () => {
      const pluginStateList: Record<string, unknown> = {};
      for (let i = 0; i < pluginList.length; i += 1) {
        const plugin = pluginList[i];
        if (plugin.getState) pluginStateList[plugin.name] = plugin.getState();
      }
      return { state, pluginStateList };
    },
    getPlugin: <P extends CdeebeePlugin<S>>(name: string) => pluginList.find(q => q.name === name) as P | undefined,
    commit,
    setEntity: (listName, entityID, patch) => {
      const primaryKey = primaryKeyList[listName] as string;
      const prevEntity = (state.storage[listName] as unknown as Record<EntityID, EntityOf<S[typeof listName]>> | undefined)?.[entityID];
      const nextEntity = {
        ...(typeof patch === 'function' ? patch(prevEntity) : { ...(prevEntity ?? {}), ...patch }),
        [primaryKey]: entityID,
      } as unknown as EntityOf<S[typeof listName]>;
      commit({ [listName]: { upsertList: [nextEntity] } } as unknown as CdeebeeChangeSet<S>, { source: 'set', label: `setEntity:${listName}` });
    },
    removeEntityList: (listName, entityIDList) => {
      commit({ [listName]: { removeIDList: entityIDList } } as CdeebeeChangeSet<S>, { source: 'set', label: `removeEntityList:${listName}` });
    },
    clearList: listName => {
      commit({ [listName]: { replaceList: {} } } as CdeebeeChangeSet<S>, { source: 'set', label: `clearList:${listName}` });
    },
    replaceList: (listName, entityRecord) => {
      commit({ [listName]: { replaceList: entityRecord } } as unknown as CdeebeeChangeSet<S>, { source: 'set', label: `replaceList:${listName}` });
    },
    subscribe: (listener, dependencyList) => subscriptionManager.subscribe(listener, dependencyList),
    subscribeRequest: (listener, apiList) => requestSubscriptionManager.subscribe(listener, apiList),
    getIndex: (listName, fieldName, value) => indexManager.get(listName, fieldName, value),
    request: options => runner(db, internal, options),
    flush: () => {
      subscriptionManager.flush();
      requestSubscriptionManager.flush();
    },
  };

  for (let i = 0; i < pluginList.length; i += 1) pluginList[i].setup?.(db);

  return db;
}
