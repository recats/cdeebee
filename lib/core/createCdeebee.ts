import { toEntityID } from '../utils/entityID';
import { createRecord } from '../utils/record';
import { applyChangeSet, readVersion, type EntityMetaList } from './commit';
import { IndexManager } from './indexManager';
import { runRequest } from './pipeline';
import { CdeebeeRequestError } from './requestError';
import { SubscriptionManager, createSubscription } from './subscription';
import type {
  CdeebeeChangeSet, CdeebeeChangedList, CdeebeeCommitMeta, CdeebeeInstance, CdeebeePlugin, CdeebeeRequestOptions,
  CdeebeeSettings, CdeebeeState, CdeebeeStorage, CdeebeeStorageShape, EntityID, EntityOf, ListName,
} from './types';

export interface CdeebeeInternal {
  addActiveRequest: (api: string, requestID: string, controller: AbortController) => void;
  removeActiveRequest: (api: string, requestID: string) => void;
  finishRequest: (requestID: string) => void;
  nextSeq: () => number;
  getGeneration: () => number;
}

export type RequestRunner = <S, R, D>(
  db: CdeebeeInstance<S>,
  internal: CdeebeeInternal,
  options: CdeebeeRequestOptions<S, R, D>,
) => Promise<R>;

export function createCdeebee<S extends CdeebeeStorageShape<S>>(settings: CdeebeeSettings<S>, runner: RequestRunner = runRequest): CdeebeeInstance<S> {
  const { primaryKeyList } = settings;
  const pluginList: CdeebeePlugin<S>[] = settings.pluginList ?? [];

  const storage = createRecord<CdeebeeStorage[string]>();
  const listNameList = Object.keys(primaryKeyList) as ListName<S>[];
  for (let i = 0; i < listNameList.length; i += 1) {
    const listName = listNameList[i];
    storage[listName] = createRecord(settings.initialStorage && Object.hasOwn(settings.initialStorage, listName) ? settings.initialStorage[listName] : undefined);
  }
  let state: CdeebeeState<S> = { storage: storage as S, activeRequestList: [] };
  const metaList = new Map<string, EntityMetaList>();
  for (const listName of listNameList) {
    const list = storage[listName];
    const entityMeta: EntityMetaList = new Map();
    for (const key of Object.keys(list)) {
      entityMeta.set(toEntityID(key), {
        version: readVersion(list[key], settings.versionKeyList?.[listName]),
        seq: 0,
        writeSeq: 0,
        complete: false,
      });
    }
    if (entityMeta.size > 0) metaList.set(listName, entityMeta);
  }
  const listSeqMap = new Map<string, number>();
  let seqCounter = 0;
  let generation = 0;
  let resetQueue: (() => void)[] | undefined;
  const controllerMap = new Map<string, AbortController>();
  const nextSeq = () => { seqCounter += 1; return seqCounter; };

  const subscriptionManager = new SubscriptionManager<S>();
  const requestSubscription = createSubscription();
  const indexManager = new IndexManager<S>(settings.indexList);
  indexManager.rebuild(state.storage);

  const notifyCommit = (changeSet: CdeebeeChangeSet<S>, meta: CdeebeeCommitMeta, changedList: CdeebeeChangedList<S>[]) => {
    for (let i = 0; i < pluginList.length; i += 1) {
      const plugin = pluginList[i];
      try {
        plugin.onCommit?.(changeSet, meta, changedList);
      } catch (error) {
        console.error(`[cdeebee] plugin "${plugin.name}" onCommit failed`, error);
      }
    }
  };

  const commitNow = (changeSet: CdeebeeChangeSet<S>, meta: CdeebeeCommitMeta, deferObservers = false) => {
    const prevStorage = state.storage;
    const seq = meta.seq ?? nextSeq();
    if (seq > seqCounter) seqCounter = seq; // later local writes must outrank a caller-supplied seq
    const { storage: nextStorage, changedList } = applyChangeSet(prevStorage, changeSet, primaryKeyList, { metaList, listSeqMap, seq, versionKeyList: settings.versionKeyList });
    if (nextStorage === prevStorage) return changedList;
    state = { ...state, storage: nextStorage };
    indexManager.update(prevStorage, nextStorage, changedList);
    subscriptionManager.notify(changedList);
    if (!deferObservers) {
      if (meta.source === 'set') subscriptionManager.flush();
      notifyCommit(changeSet, meta, changedList);
    }
    return changedList;
  };

  const commit: CdeebeeInstance<S>['commit'] = (changeSet, meta) => {
    if (meta.source !== 'request' && meta.source !== 'set') throw new TypeError('[cdeebee] commit source must be request or set; use db.reset() to reset');
    if (resetQueue) {
      const changedList: CdeebeeChangedList<S>[] = [];
      resetQueue.push(() => { changedList.push(...commitNow(changeSet, meta)); });
      return changedList;
    }
    return commitNow(changeSet, meta);
  };

  const internal: CdeebeeInternal = {
    nextSeq,
    getGeneration: () => generation,
    finishRequest: requestID => { controllerMap.delete(requestID); },
    addActiveRequest(api, requestID, controller) {
      controllerMap.set(requestID, controller);
      state = { ...state, activeRequestList: [...state.activeRequestList, { api, requestID }] };
      requestSubscription.notify(api);
    },
    removeActiveRequest(api, requestID) {
      const nextList = state.activeRequestList.filter(request => !(request.api === api && request.requestID === requestID));
      if (nextList.length === state.activeRequestList.length) return;
      state = { ...state, activeRequestList: nextList };
      requestSubscription.notify(api);
    },
  };

  const db: CdeebeeInstance<S> = {
    settings,
    pluginList,
    getState: () => state,
    getSnapshot: () => {
      const pluginStateList = createRecord<unknown>();
      for (let i = 0; i < pluginList.length; i += 1) {
        const plugin = pluginList[i];
        if (plugin.getState) pluginStateList[plugin.name] = plugin.getState();
      }
      return { state, pluginStateList };
    },
    getPlugin: <P extends CdeebeePlugin<S>>(name: string) => pluginList.find(plugin => plugin.name === name) as P | undefined,
    getEntityMeta: (listName, entityID) => {
      const meta = metaList.get(listName)?.get(toEntityID(String(entityID)));
      if (meta === undefined || meta.deleted) return undefined;
      const { version, seq, complete } = meta;
      return { version, seq, complete };
    },
    commit,
    setEntity: (listName, entityID, patch) => {
      if (resetQueue) {
        resetQueue.push(() => db.setEntity(listName, entityID, patch));
        return;
      }
      const primaryKey = primaryKeyList[listName] as string;
      const prevEntity = (state.storage[listName] as unknown as Record<EntityID, EntityOf<S[typeof listName]> | undefined>)[entityID];
      const nextEntity = {
        ...(typeof patch === 'function' ? patch(prevEntity) : { ...(prevEntity ?? {}), ...patch }),
        [primaryKey]: entityID,
      } as unknown as EntityOf<S[typeof listName]>;
      commitNow({ [listName]: { setList: [nextEntity] } } as unknown as CdeebeeChangeSet<S>, { source: 'set', label: `setEntity:${listName}` });
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
    reset: () => {
      if (resetQueue) return;
      const pending: (() => void)[] = [];
      resetQueue = pending;
      try {
        generation += 1;
        const controllerList = Array.from(controllerMap.values());
        const apiList = state.activeRequestList.map(request => request.api);
        controllerMap.clear();
        if (state.activeRequestList.length > 0) state = { ...state, activeRequestList: [] };
        const changeSet = Object.fromEntries(Object.keys(state.storage).map(listName => [listName, { replaceList: {} }])) as CdeebeeChangeSet<S>;
        const meta: CdeebeeCommitMeta = { source: 'reset', label: 'reset' };
        const changedList = commitNow(changeSet, meta, true);
        for (const plugin of pluginList) {
          try {
            plugin.onReset?.();
          } catch (error) {
            console.error(`[cdeebee] plugin "${plugin.name}" onReset failed`, error);
          }
        }
        for (const controller of controllerList) controller.abort();
        notifyCommit(changeSet, meta, changedList);
        if (apiList.length > 0) requestSubscription.notify(apiList);
      } finally {
        resetQueue = undefined;
      }
      let firstError: unknown;
      let hasError = false;
      for (const apply of pending) {
        try { apply(); } catch (error) {
          if (!hasError) { firstError = error; hasError = true; }
        }
      }
      db.flush();
      if (hasError) throw firstError;
    },
    subscribe: (listener, dependencyList) => subscriptionManager.subscribe(listener, dependencyList),
    subscribeRequest: (listener, apiList) => requestSubscription.subscribe(listener, apiList),
    getIndex: (listName, fieldName, value) => indexManager.get(listName, fieldName, value),
    request: <R = unknown, D = unknown>(options: CdeebeeRequestOptions<S, R, D>): Promise<R> => {
      if (!resetQueue) return runner(db, internal, options);
      return new Promise<R>((resolve, reject) => {
        resetQueue!.push(() => {
          try { resolve(runner(db, internal, options)); } catch (error) { reject(error); }
        });
      });
    },
    requestSettled: async options => {
      try {
        return { ok: true, response: await db.request(options) };
      } catch (error) {
        if (!(error instanceof CdeebeeRequestError)) throw error;
        return { ok: false, error };
      }
    },
    flush: () => {
      if (resetQueue) return;
      subscriptionManager.flush();
      requestSubscription.flush();
    },
  };

  for (let i = 0; i < pluginList.length; i += 1) pluginList[i].setup?.(db);

  return db;
}
