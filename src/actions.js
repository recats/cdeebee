import { types } from './constants';


export function setKeyValueList(
  entityList, entityID, list, options,
) {
  return (dispatch, getState) => {
    if (options && options.preChange) {
      options.preChange({
        entityList, entityID, list, dispatch, getState,
      });
    }
    dispatch({
      type: types.CDEEBEE_ENTITY_CHANGE_FIELD,
      payload: { entityList, entityID, list },
    });
    if (options && options.postChange) {
      options.postChange({
        entityList, entityID, list, dispatch, getState,
      });
    }
  };
}

export function setKeyValue(
  entityList,
  entityID,
  key,
  value,
  options,
) {
  return setKeyValueList(entityList, entityID, [{ key, value }], options);
}

export function commitEntity(
  entityList,
  entityID,
  entity,
  options,
) {
  return (dispatch, getState) => {
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
  entityList,
  entityID,
  options,
) {
  return (dispatch, getState) => {
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
