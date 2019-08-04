import { Dispatch } from 'redux';
import { types } from './constants';
import { EntityID } from './types';

interface IOptions {
  postCommit?: (d: object) => void;
  preChange?: (d: object) => void;
  postChange?: (d: object) => void;
  preCommit?: (d: object) => void;
  prePath?: Array<string | number>;
}

export function setKeyValue(
  entityList: string,
  entityID: EntityID,
  valueList: Array<{ key: Array<string | number>, value: any }>,
  options: IOptions,
) {
  return (dispatch: Dispatch, getState: () => object) => {
    if (options && options.preChange) {
      options.preChange({
        entityList, entityID, valueList, dispatch, getState,
      });
    }
    dispatch({
      type: types.CDEEBEE_ENTITY_CHANGE_FIELD,
      payload: { entityList, entityID, valueList },
    });
    if (options && options.postChange) {
      options.postChange({
        entityList, entityID, valueList, dispatch, getState,
      });
    }
  };
}

export function commitEntity(
  entityList: string,
  entityID: EntityID,
  entity: object,
  options: IOptions,
) {
  return (dispatch: Dispatch, getState: () => object) => {
    if (options && options.preCommit) {
      options.preCommit({
        entityList, entityID, entity, dispatch, getState,
      });
    }
    dispatch({
      type: types.CDEEBEE_SET_ENTITY,
      payload: { entityList, entityID, entity },
    });
    if (options && options.postCommit) {
      options.postCommit({
        entityList, entityID, entity, dispatch, getState,
      });
    }
  };
}

export function resetEntity(
  entityList: string,
  entityID: string | number,
  options: IOptions,
) {
  return (dispatch: Dispatch, getState: () => object) => {
    if (options && options.preCommit) {
      options.preCommit({
        entityList, entityID, dispatch, getState,
      });
    }
    dispatch({
      type: types.CDEEBEE_RESET_ENTITY,
      payload: { entityList, entityID },
    });
    if (options && options.postCommit) {
      options.postCommit({
        entityList, entityID, dispatch, getState,
      });
    }
  };
}

export function dropRequestByApiUrl(api: string) {
  return (dispatch: Dispatch) => dispatch({ type: types.CDEEBEEE_DROP_REQUEST_BY_API_URL, payload: { api } });
}
