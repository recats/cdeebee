// @flow
import { types } from './constants';

export type IKeyVaue = {
  key: string | Array<string>,
  value: any
}

export type ISetKeyValueProps = {
  preChange?: Function,
  postChange?: Function,
}

export type ICommitProps = {
  preCommit?: Function,
  postCommit?: Function,
}

export function setKeyValueList(
  entityList: $Keys<typeof types>,
  entityID: number,
  list: Array<IKeyVaue>,
  options?: ISetKeyValueProps,
): Function {
  return (dispatch: Function, getState: Function) => {
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
  entityList: $Keys<typeof types>,
  entityID: number,
  key: string | Array<string>,
  value: string,
  options?: ISetKeyValueProps,
): Function {
  return setKeyValueList(entityList, entityID, [{ key, value }], options);
}

export function commitEntity(
  entityList: $Keys<typeof types>,
  entityID: number,
  entity: Object,
  options?: ICommitProps,
): Function {
  return (dispatch: Function, getState: Function) => {
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
