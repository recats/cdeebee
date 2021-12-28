import {
  slice, assocPath, omit, dissoc,
} from 'ramda';

import { cdeebeeTypes } from './index';

import {
  batchingUpdate, dropRequestFromArray, editEntity, resetEntity,
} from './helpers';

import { ICdeebee, IRequestAction, IRequestState, cdeebeActiveRequest } from './definition';

export const INITIAL_STORAGE: any = {};

export const cdeebee = (state: any = INITIAL_STORAGE, action: ICdeebee) => {
  const { type, payload } = action;

  switch (type) {
    case cdeebeeTypes.CDEEBEEE_UPDATE:
      return { ...state, ...payload.response };
    case cdeebeeTypes.CDEEBEE_ENTITY_CHANGE_FIELD: {
      const objCreate = editEntity(state, payload.entityList, payload.entityID);
      return batchingUpdate(objCreate, payload.valueList, [payload.entityList, payload.entityID, '__entity']);
    }
    case cdeebeeTypes.CDEEBEE_ENTITY_UNSAFE_UPDATE_STORE:
      return assocPath([payload.entityList, payload.entityID], payload.value, state);
    case cdeebeeTypes.CDEEBEE_SET_ENTITY:
      return assocPath([payload.entityList, payload.entityID], payload.entity, state);
    case cdeebeeTypes.CDEEBEE_RESET_ENTITY: {
      const entityList = state[payload.entityList];
      return assocPath(
        [payload.entityList, payload.entityID],
        resetEntity(entityList[payload.entityID]),
        state,
      );
    }
    case cdeebeeTypes.CDEEBEEE_DROP:
      return INITIAL_STORAGE;
    case cdeebeeTypes.CDEEBEEE_DROP_PATH:
      return omit(payload.path, state);
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
    case cdeebeeTypes.CDEEBEE_REQUESTMANAGER_SET:
      return { ...state, activeRequest: [...state.activeRequest, payload] };
    case cdeebeeTypes.CDEEBEE_REQUESTMANAGER_SHIFT:
      return { ...state, activeRequest: slice(1, Infinity, state.activeRequest) };
    case cdeebeeTypes.CDEEBEEE_UPDATE:
      return {
        ...state,
        requestByApiUrl: {
          ...state.requestByApiUrl,
          [payload.api]: payload.cleanResponse,
        },
      };
    case cdeebeeTypes.CDEEBEEE_DROP_REQUEST_BY_API_URL:
      return {
        ...state,
        requestByApiUrl: dissoc<any, any>(payload.api, state.requestByApiUrl),
      };
    case cdeebeeTypes.CDEEBEEE_DROP_ERROR_BY_API_URL:
      return {
        ...state,
        errorHandler: dissoc<any, any>(payload.api, state.errorHandler),
      };
    case cdeebeeTypes.CDEEBEE_ERRORHANDLER_SET:
      return {
        ...state,
        errorHandler: {
          ...state.errorHandler,
          [payload.api]: payload.cleanResponse,
        },
      };
    case cdeebeeTypes.CDEEBEE_INTERNAL_ERROR:
      return { ...state, activeRequest: [], requestByApiUrl: {} };

    case cdeebeeTypes.CHANGE_ROUTE:
      return { ...INITIAL_REQUEST, activeRequest: dropRequestFromArray((state.activeRequest as cdeebeActiveRequest[])) };
    default:
      return state;
  }
};
