// @ts-ignore
import { Dispatch } from 'redux';
import { cdeebeeTypes, cdeebeeValueList, EntityID } from './definition';

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

export function dropRequestByApiUrl(api: string) {
  return (dispatch: Dispatch) => dispatch({ type: cdeebeeTypes.CDEEBEEE_DROP_REQUEST_BY_API_URL, payload: { api } });
}
