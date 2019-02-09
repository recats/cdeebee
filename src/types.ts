import { types, cdeebeeMergeStrategy, EntityState } from './constants';

export interface CDEEBEEUpadte {
  readonly type: types.CDEEBEEE_UPDATE;
  readonly payload: {
    response: object;
  };
}

export interface CDEEBEEChangeField {
  readonly type: types.CDEEBEE_ENTITY_CHANGE_FIELD;
  readonly payload: {
    list: Array<{ key: string, value: object }>,
    entityList: string,
    entityID: number | string,
  };
}

export interface CDEEBEESetEntity {
  readonly type: types.CDEEBEE_SET_ENTITY;
  readonly payload: {
    entityList: string,
    entityID: number | string,
    entity: any,
  };
}

export interface CDEEBEEResetEntity {
  readonly type: types.CDEEBEE_RESET_ENTITY;
  readonly payload: {
    entityList: string,
    entityID: number | string,
  };
}

export interface CDEEBEEDrop {
  readonly type: types.CDEEBEEE_DROP;
  readonly payload?: any;
}

export interface CDEEBEEDropElement {
  readonly type: types.CDEEBEEE_DROP_ELEMENT;
  readonly payload: {
    entityList: string,
    entityID: number | string,
  };
}

export type ICdeebee =
  | CDEEBEEUpadte
  | CDEEBEEChangeField
  | CDEEBEESetEntity
  | CDEEBEEResetEntity
  | CDEEBEEDrop
  | CDEEBEEDropElement
  ;

export interface CDEEBEERequestManager {
  readonly type: types.CDEEBEE_REQUESTMANAGER_SET;
  readonly payload: object;
}

export interface CDEEBEERequestShift {
  readonly type: types.CDEEBEE_REQUESTMANAGER_SHIFT;
  readonly payload?: any;
}

export interface CDEEBEEUpdate {
  readonly type: types.CDEEBEEE_UPDATE;
  readonly payload: { api: string, cleanResponse: object };
}

export interface CDEEBEEErrorSet {
  readonly type: types.CDEEBEE_ERRORHANDLER_SET;
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
  activeRequest: object[];
  requestByApiUrl: object;
  errorHandler: object;
}

export interface IDefaultNormolize {
  response: {
    responseStatus: string,
    [params: string]: any,
  };
  cdeebee: object;
  mergeStrategy: cdeebeeMergeStrategy;
}

export interface IActiveRequest {
  api: string;
  requestCancel: object;
  source: {
    cancel: (t: any) => void;
  };
}

export interface  IEntity {
  __entity: {
    __state: EntityState;
  };
}

export interface IOptions {
  api: string;
  data?: object;
  headers?: object;
  files?: string;
  fileKey?: string;
  bodyKey?: string;
  responseKeyCode?: string;
  method?: 'POST' | 'GET' | 'PUT' | 'DELETE';
  requestCancel?: boolean;
  mergeStrategy?: cdeebeeMergeStrategy;
  normalize?: (t: any) => void;
  preUpdate?: (payload: object) => void;
  postUpdate?: (payload: object) => void;
  preError?: (payload: object) => void;
  postError?: (payload: object) => void;
}

export type EntityID = string | number;
