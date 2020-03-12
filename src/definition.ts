import { Dispatch } from 'redux';

export enum cdeebeeTypes {
  CDEEBEE_REQUESTMANAGER_SHIFT = '@@cdeebee/REQUESTMANAGER_SHIFT',
  CDEEBEE_REQUESTMANAGER_SET = '@@cdeebee/REQUESTMANAGER_SET',
  CDEEBEE_ERRORHANDLER_SET = '@@cdeebee/ERRORHANDLER_SET',

  CDEEBEE_ENTITY_CHANGE_FIELD = '@@cdeebee/ENTITY_CHANGE_FIELD',
  CDEEBEE_RESET_ENTITY = '@@cdeebee/RESET_ENTITY',
  CDEEBEE_SET_ENTITY = '@@cdeebee/SET_ENTITY',
  CDEEBEEE_UPDATE = '@@cdeebee/UPDATE',
  CDEEBEEE_DROP = '@@cdeebee/DROP',
  CDEEBEEE_DROP_PATH = '@@cdeebee/DROP_PATH',

  CDEEBEE_INTERNAL_ERROR = '@@cdeebee/INTERNAL_ERROR',

  CDEEBEEE_DROP_REQUEST_BY_API_URL = '@@cdeebee/DROP_REQUEST_BY_API_URL',
  CDEEBEEE_DROP_ERROR_BY_API_URL = '@@cdeebee/DROP_ERROR_BY_API_URL',

  CHANGE_ROUTE = '@@router/LOCATION_CHANGE',
}

export enum cdeebeeEntityState {
  NEW = 'NEW',
  EDITING = 'EDITING',
  NORMAL = 'NORMAL',
}

export enum cdeebeeMergeStrategy {
  merge = 'merge',
  replace = 'replace',
}

export type IDefaultOption = {
  headers?: object;
  files?: File[];
  fileKey?: string;
  bodyKey?: string;
  primaryKey?: string;
  responseKeyCode?: string;
  requestCancel?: boolean;
  updateStore?: boolean;
  mergeListStrategy?: { [key: string]: cdeebeeMergeStrategy };
  normalize?: (t: any) => void;
  preUpdate?: (payload: object) => void;
  postUpdate?: (payload: object) => void;
  preError?: (payload: object) => void;
  method?: 'POST' | 'GET' | 'PUT' | 'DELETE';
  postError?: (payload: object) => void;
  globalErrorHandler?: (
    error: object,
    request: object,
    meta: { requestStartTime: Date, requestEndTime: Date, requestID: string }
  )
    => (dispatch: Dispatch, getState: () => object)
    => void;
};

export interface IRequestOptions extends IDefaultOption {
  api: string;
  data?: object;
}

export interface IEntity {
  __entity?: { __state: cdeebeeEntityState; };
}

export type cdeebeeValueList = {
  key: Array<string | number>;
  value: any;
};

export type cdeebeActiveRequest = {
  api: string;
  requestCancel: object;
  source: {
    cancel: (t: any) => void;
  };
};

export type EntityID = string | number;

// tslint:disable-next-line:class-name
export interface cdeebeeIActions {
  dropRequestByApiUrl: (api: string) => void;
  dropErrorsByApiUrl: (api: string) => void;
  dropCdeebeePath: (path: (string | number)[]) => void;

  setKeyValue: (
    entityList: string, entityID: EntityID, valueList: cdeebeeValueList[],
  ) => void;

  commitEntity: (entityList: string, entityID: EntityID, entity: object) => void;
  resetEntity: (entityList: string, entityID: EntityID) => void;
}

export type ActionCreator<A> = (...args: any[]) => A;

export class CdeebeeRequest {
  public requestObject: any;

  // @ts-ignore
  constructor(
    defaultRequest: object,
    options: {
      fileKey?: string,
      bodyKey?: string,
      method?: string,
      primaryKey?: string,
      normalize?: (data: object) => object,
      mergeListStrategy?: { [key: string]: cdeebeeMergeStrategy },
      responseKeyCode?: string,
      header?: object,
    },
  );

}

export interface CDEEBEERequestManager {
  readonly type: cdeebeeTypes.CDEEBEE_REQUESTMANAGER_SET;
  readonly payload: object;
}

export interface CDEEBEERequestShift {
  readonly type: cdeebeeTypes.CDEEBEE_REQUESTMANAGER_SHIFT;
  readonly payload?: any;
}

export interface CDEEBEEUpdate {
  readonly type: cdeebeeTypes.CDEEBEEE_UPDATE;
  readonly payload: { api: string, cleanResponse: object };
}

export interface CDEEBEEErrorSet {
  readonly type: cdeebeeTypes.CDEEBEE_ERRORHANDLER_SET;
  readonly payload: { api: string, cleanResponse: object };
}

export interface CDEEBEEChangeRoute {
  readonly type?: any;
  readonly payload?: any;
}

export type IRequestAction =
  | CDEEBEERequestManager
  | CDEEBEERequestShift
  | CDEEBEEUpdate
  | CDEEBEEErrorSet
  | CDEEBEEChangeRoute
  ;

export interface IRequestState {
  activeRequest: cdeebeActiveRequest[];
  requestByApiUrl: object;
  errorHandler: object;
}

export interface CDEEBEEUpadte {
  readonly type: cdeebeeTypes.CDEEBEEE_UPDATE;
  readonly payload: {
    response: object;
  };
}

export interface CDEEBEEChangeField {
  readonly type: cdeebeeTypes.CDEEBEE_ENTITY_CHANGE_FIELD;
  readonly payload: {
    list: Array<{ key: string, value: object }>,
    entityList: string,
    entityID: number | string,
  };
}

export interface CDEEBEESetEntity {
  readonly type: cdeebeeTypes.CDEEBEE_SET_ENTITY;
  readonly payload: {
    entityList: string,
    entityID: number | string,
    entity: any,
  };
}

export interface CDEEBEEResetEntity {
  readonly type: cdeebeeTypes.CDEEBEE_RESET_ENTITY;
  readonly payload: {
    entityList: string,
    entityID: number | string,
  };
}

export interface CDEEBEEDrop {
  readonly type: cdeebeeTypes.CDEEBEEE_DROP;
  readonly payload?: any;
}

export interface CDEEBEEDropPath {
  readonly type: cdeebeeTypes.CDEEBEEE_DROP_PATH;
  readonly payload: { path: (string | number)[] };
}

export type ICdeebee =
  | CDEEBEEUpadte
  | CDEEBEEChangeField
  | CDEEBEESetEntity
  | CDEEBEEResetEntity
  | CDEEBEEDrop
  | CDEEBEEDropPath
  ;

export interface IDefaultNormolize {
  response: {
    responseStatus: string,
    [params: string]: any,
  };
  cdeebee: object;
  primaryKey: string;
  mergeListStrategy: { [key: string]: cdeebeeMergeStrategy };
}
