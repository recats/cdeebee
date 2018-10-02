import {
  slice, assocPath, omit, clone,
} from 'ramda';

import { set } from 'lodash';
import { types } from './constants';

import {
  cancelationRequest, editEntity, getSubEntity, resetEntity,
} from './helpers';

import { ICdeebee, IRequestAction, IRequestState } from './types';

export const INITIAL_STORAGE: any = {};

export const cdeebee = (state: any = INITIAL_STORAGE, action: ICdeebee) => {
  const { type, payload } = action;

  switch (type) {
    case types.CDEEBEEE_UPDATE:
      return { ...state, ...payload.response };
    case types.CDEEBEE_ENTITY_CHANGE_FIELD: {
      const entityList = state[payload.entityList];
      const entity = editEntity(entityList[payload.entityID]);
      const subEntity = clone(getSubEntity(entity));
      payload.list.forEach(({ key, value }: any) => set(subEntity, key, value));
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

const INITIAL_REQUEST: IRequestState = {
  activeRequest: [],
  requestByApiUrl: {},
  errorHandler: {},
};

export const requestManager = (state: IRequestState = INITIAL_REQUEST, action: IRequestAction) => {
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
      // @ts-ignore
      return cancelationRequest(state.activeRequest);
    default:
      return state;
  }
};
