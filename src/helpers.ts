import { clone, omit, mergeDeepRight } from 'ramda';
import { cdeebeeMergeStrategy, EntityState } from './constants';

import { IEntity, IDefaultNormolize, IActiveRequest } from './types';

const omitKeys = (entity: object) => omit(['__entity', '__state'], entity);

export const cancelationRequest = (activeRequest: IActiveRequest[]) => {
  const act = activeRequest.filter(q => (
    q.requestCancel
      && q.source
      && q.source.cancel instanceof Function
      && q.source.cancel(q)
  ));
  return { activeRequest: act };
};

export function checkNetworkActivity(activeRequest: IActiveRequest[], apiUrl: string | string[]) {
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
  if (!entity.__entity) {
    return EntityState.NORMAL;
  }
  return entity.__entity.__state;
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

export const editEntity = (entity: IEntity) => {
  const state = getEntityState(entity);
  if (state === EntityState.EDITING) {
    return entity;
  }
  const newEntity: IEntity = clone(entity);
  // @ts-ignore
  newEntity.__entity = clone(entity);
  newEntity.__entity.__state = EntityState.EDITING;
  return newEntity;
};

export const defaultNormalize: (d: IDefaultNormolize) => object = (
  {
    response: { responseStatus, ...response },
    cdeebee,
    mergeStrategy,
  },
) => {
  const keys = Object.keys(response);
  for (const key of keys) {
    const newStorageData: any = {};
    if (response[key] instanceof Object) {
      for (const element of response[key].data) {
        newStorageData[element[response[key].primaryKey]] = element;
      }
      if (mergeStrategy === cdeebeeMergeStrategy.merge) {
        // @ts-ignore
        response[key] = mergeDeepRight(cdeebee[key], newStorageData);
      } else if (mergeStrategy === cdeebeeMergeStrategy.replace) {
        response[key] = newStorageData;
      }
    } else if (response[key] === null || response[key] === undefined) {
      response = omit([key], response);
    }
  }

  return response;
};