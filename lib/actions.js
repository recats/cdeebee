'use strict';

exports.__esModule = true;
exports.setKeyValueList = setKeyValueList;
exports.setKeyValue = setKeyValue;
exports.commitEntity = commitEntity;

var _constants = require('./constants');

function setKeyValueList(entityList, entityID, list, options) {
  return function (dispatch, getState) {
    if (options && options.preChange) {
      options.preChange({
        entityList: entityList, entityID: entityID, list: list, dispatch: dispatch, getState: getState
      });
    }
    dispatch({
      type: _constants.types.CDEEBEE_ENTITY_CHANGE_FIELD,
      payload: { entityList: entityList, entityID: entityID, list: list }
    });
    if (options && options.postChange) {
      options.postChange({
        entityList: entityList, entityID: entityID, list: list, dispatch: dispatch, getState: getState
      });
    }
  };
}
function setKeyValue(entityList, entityID, key, value, options) {
  return setKeyValueList(entityList, entityID, [{ key: key, value: value }], options);
}

function commitEntity(entityList, entityID, entity, options) {
  return function (dispatch, getState) {
    if (options && options.preCommit) {
      options.preCommit({
        entityList: entityList, entityID: entityID, entity: entity, dispatch: dispatch, getState: getState
      });
    }
    dispatch({
      type: _constants.types.CDEEBEE_SET_ENTITY,
      payload: { entityList: entityList, entityID: entityID, entity: entity }
    });
    if (options && options.postCommit) {
      options.postCommit({
        entityList: entityList, entityID: entityID, entity: entity, dispatch: dispatch, getState: getState
      });
    }
  };
}