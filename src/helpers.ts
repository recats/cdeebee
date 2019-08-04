import { assocPath, omit, mergeDeepRight } from 'ramda';
import { cdeebeeMergeStrategy, EntityState } from './constants';
import { get } from 'lodash';
import { IEntity, IDefaultNormolize, IActiveRequest } from './types';

const omitKeys = (entity: object) => omit(['__entity', '__state'], entity);

export const cancelationRequest = (activeRequest: IActiveRequest[]): IActiveRequest[] => {
  const act = activeRequest.filter(q => (
    !q.requestCancel && q.source && q.source.cancel instanceof Function
  ));
  return act;
};

export function checkNetworkActivity(activeRequest: IActiveRequest[], apiUrl: string | string[]): boolean {
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
}

export const getSubEntity = (entity: IEntity ) => entity.__entity || entity;

export const getEntityState = (entity: IEntity) => {
  const entityState = get(entity, '__entity.__state') || get(entity, '__state');
  if (!entityState) {
    return EntityState.NORMAL;
  }
  return entityState;
};

export const insertEntity = (entity: { __state: string }) => {
  entity.__state = EntityState.NEW;
  return entity;
};

export const commitEntity = (entity: IEntity) => {
  const state = getEntityState(entity);
  if (state === EntityState.NORMAL) {
    // tslint:disable-next-line
    console.warn('commit works only in editing and new states');
    return entity;
  }
  return omitKeys(entity);
};

export const resetEntity = (entity: IEntity) => {
  const state = getEntityState(entity);
  if (state === EntityState.NORMAL) {
    // tslint:disable-next-line
    console.warn('reset works only in editing and new states');
    return entity;
  }
  return omitKeys(entity);
};

export const editEntity = (store: IEntity, list: string, id: number | string) => {
  const arrayList = get(store, list);
  const state = getEntityState(arrayList[id]);

  if (state === EntityState.EDITING) {
    // tslint:disable-next-line:no-console
    console.log('editing');
    return store;
  }

    // tslint:disable-next-line:no-console
  console.log('createNew');
  const newReturnStore = assocPath([list, id, '__entity'], arrayList[id], store);
  return assocPath([list, id, '__entity', '__state'], EntityState.EDITING, newReturnStore);
};

export const batchingUpdate = (
  state: object,
  valueList: Array<{ key: Array<string | number >, value: any }>,
  prePath?: Array<string | number>,
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
    cdeebee, mergeStrategy, primaryKey,
  },
) => {
  const keys = Object.keys(response);
  for (const key of keys) {
    const newStorageData: any = {};
    if (response[key] instanceof Object && response[key].hasOwnProperty(primaryKey)) {
      for (const element of response[key].data) {
        newStorageData[element[response[key][primaryKey]]] = element;
      }
      if (mergeStrategy === cdeebeeMergeStrategy.merge) {
        // @ts-ignore
        response[key] = mergeDeepRight(cdeebee[key], newStorageData);
      } else if (mergeStrategy === cdeebeeMergeStrategy.replace) {
        response[key] = newStorageData;
      }
    } else if (response[key] === null || response[key] === undefined || typeof response[key] === 'string') {
      response = omit([key], response);
    }
  }

  return response;
};
