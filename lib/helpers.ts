/* tslint:disable max-line-length */
import { assocPath, mergeDeepRight, omit } from 'ramda';
import {
  cdeebeActiveRequest,
  cdeebeeEntityState,
  cdeebeeMergeStrategy,
  cdeebeeValueList,
  IDefaultNormalize,
  IEntity
} from './definition';

const omitKeys = <T>(entity: T): T & any => omit<T, any>(['__entity', '__state'], entity);

export const dropRequestFromArray = (activeRequest: cdeebeActiveRequest[]): cdeebeActiveRequest[] => (
  activeRequest.filter(q => {
    if (q.requestCancel) {
      requestCancel(q);
      return false;
    }
    return true;
  })
);

export const requestCancel = (request: cdeebeActiveRequest): void => {
  if (request.controller && request.controller.abort instanceof Function) {
    request.controller.abort();
  }
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

export const getSubEntity = <T>(entity: T & IEntity): { __state: cdeebeeEntityState } | (T & IEntity) => Object.prototype.hasOwnProperty.call(entity, '__entity') ? entity.__entity! : entity;

export const getEntityState = <T>(entity: T & IEntity): cdeebeeEntityState => {
  // @ts-expect-error okok
  const entityState = entity?.__entity?.__state || entity?.__state;
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

export const editEntity = (store: IEntity & { [key: string]: any }, list: string, id: number | string) => {
  const arrayList = store[list];
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

export const defaultNormalize: (d: IDefaultNormalize) => object = (
  {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    response: { responseStatus, ...response },
    cdeebee, mergeListStrategy, primaryKey,
  },
) => {
  const keys = Object.keys(response);
  for (const key of keys) {
    const newStorageData: any = {};
    if (response[key] instanceof Object && Object.prototype.hasOwnProperty.call(response[key], primaryKey)) {
      for (const element of response[key].data) {
        newStorageData[element[response[key][primaryKey]]] = element;
      }

      if (mergeListStrategy[key] === cdeebeeMergeStrategy.replace) {
        response[key] = newStorageData;
      } else {
      // @ts-expect-error okok
        response[key] = mergeDeepRight(cdeebee[key], newStorageData);
      }
    } else if (response[key] === null || response[key] === undefined || typeof response[key] === 'string') {
      response = omit([key], response);
    }
  }

  return response;
};
