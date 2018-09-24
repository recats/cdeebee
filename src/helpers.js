// @flow
import { clone, omit, mergeDeepRight } from 'ramda';
import { cdeebeeMergeStrategy, EntityState } from './constants';

/* eslint-disable no-underscore-dangle, no-restricted-syntax, no-param-reassign */

const omitKeys = entity => omit(['__entity', '__state'], entity);

/**
 * @method cancelationRequest
 * @param  {Array<Object>} activeRequest
 * @return {array<Object>} active request array
 */
export const cancelationRequest = (activeRequest: Array<Object>): Object => {
  const act: Array<Object> = activeRequest.filter(q => (
    q.requestCancel
      && q.source
      && q.source.cancel instanceof Function
      && q.source.cancel(q)
  ));
  return { activeRequest: act };
};

/**
 * @method checkNetworkActivity
 * @param  {Array<Object>} activeRequest
 * @param {string} api url
 * @return {string} boolean isLoading
 */
export function checkNetworkActivity(activeRequest: Array<Object>, apiUrl: string | Array<string>) {
  if (!apiUrl || activeRequest.length === 0) return false;

  const apiUrlList = apiUrl instanceof Array ? apiUrl : [apiUrl];
  const activeLinks = activeRequest.map(q => q.api);
  for (let i = 0; i < apiUrlList.length; i += 1) {
    if (activeLinks.includes(apiUrlList[i])) return true;
  }

  return false;
}

/**
 * @method getSubEntity
 * @param  {Object} entity cdeebee object
 * @return {Object} object (editable)
 */
export const getSubEntity = (entity: Object) => entity.__entity || entity;

/**
 * @method getEntityState
 * @param  {Object} entity cdeebee object
 * @return {Object} object state
 */
export const getEntityState = (entity: Object): $Keys<typeof EntityState> => {
  if (!entity.__entity) return EntityState.NORMAL;
  return entity.__entity.__state;
};


/**
 * @method insertEntity
 * @param  {Object} entity cdeebee object
 * @return {Object} with __state "EntityState.NEW"
 */
export const insertEntity = (entity: Object) => {
  entity.__state = EntityState.NEW;
  return entity;
};

/**
 * @method commitEntity
 * @param  {Object} entity cdeebee object
 * @return {Object} with __state "EDITING"
 */
export const commitEntity = (entity: Object) => {
  const state = getEntityState(entity);
  if (state === EntityState.NORMAL) {
    console.warn('commit works only in editing and new states');
    return entity;
  }
  return omitKeys(entity);
};

/**
 * @method resetEntity
 * @param  {Object} entity cdeebee object
 * @return {Object} with __state "EntityState.NORMAL"
 */
export const resetEntity = (entity: Object) => {
  const state = getEntityState(entity);
  if (state === EntityState.NORMAL) {
    console.warn('reset works only in editing and new states');
    return entity;
  }
  return omitKeys(entity);
};


/**
 * @method editEntity
 * @param  {Object} entity cdeebee object
 * @return {Object} with __state "EntityState.EDITING" and __entity deep object
 */
export const editEntity = (entity: Object) => {
  const state = getEntityState(entity);
  if (state === EntityState.EDITING) {
    return entity;
  }
  const newEntity = clone(entity);
  newEntity.__entity = clone(entity);
  newEntity.__entity.__state = EntityState.EDITING;
  return newEntity;
};

/**
 * @method defaultNormalize
 * @param  {number | string} responseStatus
 * @param  {Object} response
 * @return {Object}
 */
export const defaultNormalize = (
  {
    response: { responseStatus, ...response },
    cdeebee,
    mergeStrategy,
  }: Object,
) => {
  const keys = Object.keys(response);
  for (const key of keys) {
    const newStorageData = {};
    if (response[key] instanceof Object) {
      for (const element of response[key].data) {
        newStorageData[element[response[key].primaryKey]] = element;
      }
      if (mergeStrategy === cdeebeeMergeStrategy.merge) {
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
