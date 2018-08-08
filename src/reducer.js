// @flow
import {
  slice, assocPath, omit, clone,
} from 'ramda';
import set from 'lodash/set';
import { types } from './constants';

import {
  cancelationRequest, editEntity, getSubEntity, resetEntity,
} from './helpers';

export const INITIAL_STORAGE = {};

export const cdeebee = (state: Object = INITIAL_STORAGE, action: Object) => {
  const { type, payload } = action;

  switch (type) {
    case types.CDEEBEEE_UPDATE:
      return { ...state, ...payload.response };
    case types.CDEEBEE_ENTITY_CHANGE_FIELD: {
      const entityList = state[payload.entityList];
      const entity = editEntity(entityList[payload.entityID]);
      const subEntity = clone(getSubEntity(entity));
      payload.list.forEach(({ key, value }) => set(subEntity, key, value));
      return assocPath([payload.entityList, payload.entityID, '__entity'], subEntity, state);
    }
    case types.CDEEBEE_SET_ENTITY:
      return assocPath([payload.entityList, payload.entityID], payload.entity, state);
    case types.CDEEBEE_RESET_ENTITY: {
      const entityList = state[payload.entityList];
      return assocPath(
        [payload.entityList, payload.entityID],
        resetEntity(entityList[payload.entityID]),
        state,
      );
    }
    case types.CDEEBEEE_DROP:
      return INITIAL_STORAGE;
    case types.CDEEBEEE_DROP_ELEMENT:
      return omit([payload.entityList, payload.entityID], state);
    default:
      return state;
  }
};

const INITIAL_REQUEST = {
  activeRequest: [],
  requestByApiUrl: {},
  errorHandler: {},
};

export const requestManager = (state: Object = INITIAL_REQUEST, action: Object) => {
  const { type, payload } = action;
  switch (type) {
    case types.CDEEBEE_REQUESTMANAGER_SET:
      return { ...state, activeRequest: [...state.activeRequest, payload] };
    case types.CDEEBEE_REQUESTMANAGER_SHIFT:
      return { ...state, activeRequest: slice(1, Infinity, state.activeRequest) };
    case types.CDEEBEEE_UPDATE:
      return {
        ...state,
        requestByApiUrl: {
          ...state.requestByApiUrl,
          [payload.api]: payload.cleanResponse,
        },
      };
    case types.CDEEBEE_ERRORHANDLER_SET:
      return {
        ...state,
        errorHandler: {
          ...state.errorHandler,
          [payload.api]: payload.cleanResponse,
        },
      };

    case types.CHANGE_ROUTE:
      return cancelationRequest(state.activeRequest);
    default:
      return state;
  }
};
