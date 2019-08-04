import {
  slice, assocPath, omit, clone, dissoc,
} from 'ramda';

import { set } from 'lodash';
import { types } from './constants';

import {
  batchingUpdate,
  cancelationRequest, editEntity, resetEntity,
} from './helpers';

import { ICdeebee, IRequestAction, IRequestState, IActiveRequest } from './types';

export const INITIAL_STORAGE: any = {};

export const cdeebee = (state: any = INITIAL_STORAGE, action: ICdeebee) => {
  const { type, payload } = action;

  switch (type) {
    case types.CDEEBEEE_UPDATE:
      return { ...state, ...payload.response };
    case types.CDEEBEE_ENTITY_CHANGE_FIELD: {
      const objCreate = editEntity(state, payload.entityList, payload.entityID);
      return batchingUpdate(objCreate, payload.valueList, [payload.entityList, payload.entityID, '__entity']);
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
    case types.CDEEBEEE_DROP_REQUEST_BY_API_URL:
      return {
        ...state,
        requestByApiUrl: dissoc(payload.api, state.requestByApiUrl),
      };
    case types.CDEEBEE_ERRORHANDLER_SET:
      return {
        ...state,
        errorHandler: {
          ...state.errorHandler,
          [payload.api]: payload.cleanResponse,
        },
      };
    case types.CDEEBEE_INTERNAL_ERROR:
      return { ...state, activeRequest: [], requestByApiUrl: {} };

    case types.CHANGE_ROUTE:
      return { ...INITIAL_REQUEST, activeRequest: cancelationRequest((state.activeRequest as IActiveRequest[])) };
    default:
      return state;
  }
};
