import { Dispatch } from 'redux';
import { cdeebeeTypes, cdeebeeValueList, EntityID } from './definition';

export function unsafe_updateStore(
  entityList: string,
  entityID: EntityID,
  value: unknown,
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: cdeebeeTypes.CDEEBEE_ENTITY_UNSAFE_UPDATE_STORE,
      payload: { entityList, entityID, value },
    });
  };
}

export function setKeyValue(
  entityList: string,
  entityID: EntityID,
  valueList: cdeebeeValueList[],
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: cdeebeeTypes.CDEEBEE_ENTITY_CHANGE_FIELD,
      payload: { entityList, entityID, valueList },
    });
  };
}

export function commitEntity(
  entityList: string,
  entityID: EntityID,
  entity: object,
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: cdeebeeTypes.CDEEBEE_SET_ENTITY,
      payload: { entityList, entityID, entity },
    });
  };
}

export function resetEntity(
  entityList: string,
  entityID: string | number,
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: cdeebeeTypes.CDEEBEE_RESET_ENTITY,
      payload: { entityList, entityID },
    });
  };
}

export function dropCdeebeePath(path: (string | number)[]) {
  return (dispatch: Dispatch) => dispatch({ type: cdeebeeTypes.CDEEBEEE_DROP_PATH, payload: { path } });
}

export function dropRequestByApiUrl(api: string) {
  return (dispatch: Dispatch) => dispatch({ type: cdeebeeTypes.CDEEBEEE_DROP_REQUEST_BY_API_URL, payload: { api } });
}

export function dropErrorsByApiUrl(api: string) {
  return (dispatch: Dispatch) => dispatch({ type: cdeebeeTypes.CDEEBEEE_DROP_ERROR_BY_API_URL, payload: { api } });
}
