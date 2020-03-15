/* tslint:disable max-line-length */
import { assocPath, mergeDeepRight, omit } from 'ramda';
import { get } from 'lodash';
import {
  cdeebeActiveRequest,
  cdeebeeEntityState,
  cdeebeeMergeStrategy,
  cdeebeeValueList,
  IDefaultNormolize,
  IEntity
} from './definition';

const omitKeys = <T>(entity: T): T & any => omit<T, any>(['__entity', '__state'], entity);

export const cancelationRequest = (activeRequest: cdeebeActiveRequest[]): cdeebeActiveRequest[] => {
  const act = activeRequest.filter(q => {
    if (q.requestCancel && q.controller && q.controller.abort instanceof Function) {
      q.controller.abort();
      return false;
    }
    return true;
  });
  return act;
};

export const checkNetworkActivity = (activeRequest: cdeebeActiveRequest[], apiUrl: string | string[]): boolean => {
  if (!apiUrl || activeRequest.length === 0) {
    return false;
  }

  const apiUrlList = apiUrl instanceof Array ? apiUrl : [apiUrl];
  const activeLinks: any = activeRequest.map(q => q.api);
  for (let i = 0; i < apiUrlList.length; i += 1) {
    if (activeLinks.includes(apiUrlList[i])) {
      return true;
    }
  }

  return false;
};

export const getSubEntity = <T>(entity: T & IEntity): { __state: cdeebeeEntityState } | (T & IEntity) => entity.__entity || entity;

export const getEntityState = <T>(entity: T & IEntity): cdeebeeEntityState => {
  const entityState = get(entity, '__entity.__state') || get(entity, '__state');
  if (!entityState) {
    return cdeebeeEntityState.NORMAL;
  }
  return entityState;
};

export const insertEntity = (entity: { __state: string }) => {
  entity.__state = cdeebeeEntityState.NEW;
  return entity;
};

export const commitEntity = <T>(entity: T & IEntity): T => {
  const state = getEntityState(entity);
  if (state === cdeebeeEntityState.NORMAL) {
    // tslint:disable-next-line
    console.warn('commit works only in editing and new states');
    return entity;
  }
  return omitKeys<T>(entity);
};

export const resetEntity = <T>(entity: T & IEntity): T => {
  const state = getEntityState(entity);
  if (state === cdeebeeEntityState.NORMAL) {
    // tslint:disable-next-line
    console.warn('reset works only in editing and new states');
    return entity;
  }
  return omitKeys<T>(entity);
};

export const editEntity = (store: IEntity, list: string, id: number | string) => {
  const arrayList = get(store, list);
  const state = getEntityState(arrayList[id]);

  if (state === cdeebeeEntityState.EDITING) {
    return store;
  }

  const newReturnStore = assocPath([list, id, '__entity'], arrayList[id], store);
  return assocPath([list, id, '__entity', '__state'], cdeebeeEntityState.EDITING, newReturnStore);
};

export const batchingUpdate = (
  state: object,
  valueList: cdeebeeValueList[],
  prePath?: (string | number)[],
) => {
  const prePathEnity = prePath ? prePath : [];

  let returnState: object = state;

  for (let i = 0; i < valueList.length; i++) {
    const arr = valueList[i];
    returnState = assocPath([...prePathEnity, ...arr.key], arr.value, returnState);
  }

  return returnState;
};

export const defaultNormalize: (d: IDefaultNormolize) => object = (
  {
    response: { responseStatus, ...response },
    cdeebee, mergeListStrategy, primaryKey,
  },
) => {
  const keys = Object.keys(response);
  for (const key of keys) {
    const newStorageData: any = {};
    if (response[key] instanceof Object && response[key].hasOwnProperty(primaryKey)) {
      for (const element of response[key].data) {
        newStorageData[element[response[key][primaryKey]]] = element;
      }

      if (mergeListStrategy[key] === cdeebeeMergeStrategy.replace) {
        response[key] = newStorageData;
      } else {
        // @ts-ignore
        response[key] = mergeDeepRight(cdeebee[key], newStorageData);
      }
    } else if (response[key] === null || response[key] === undefined || typeof response[key] === 'string') {
      response = omit([key], response);
    }
  }

  return response;
};
