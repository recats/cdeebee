// Type definitions for cdeebee v1.6
// Project: https://github.com/recats/cdeebee
// Definitions by: Strelkov Dmitry <https://github.com/stk-dmitry>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 3.4
export as namespace cdeebee;

export enum cdeebeeTypes {
  CDEEBEE_REQUESTMANAGER_SHIFT = '@@cdeebee/REQUESTMANAGER_SHIFT',
  CDEEBEE_REQUESTMANAGER_SET = '@@cdeebee/REQUESTMANAGER_SET',
  CDEEBEE_ERRORHANDLER_SET = '@@cdeebee/ERRORHANDLER_SET',

  CDEEBEE_ENTITY_CHANGE_FIELD = '@@cdeebee/ENTITY_CHANGE_FIELD',
  CDEEBEE_RESET_ENTITY = '@@cdeebee/RESET_ENTITY',
  CDEEBEE_SET_ENTITY = '@@cdeebee/SET_ENTITY',
  CDEEBEEE_UPDATE = '@@cdeebee/UPDATE',
  CDEEBEEE_DROP = '@@cdeebee/DROP',
  CDEEBEEE_DROP_ELEMENT = '@@cdeebee/DROP_ELEMENT',

  CDEEBEE_INTERNAL_ERROR = '@@cdeebee/INTERNAL_ERROR',

  CDEEBEEE_DROP_REQUEST_BY_API_URL = '@@cdeebee/DROP_REQUEST_BY_API_URL',

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

export interface IOptions {
  api: string;
  data?: object;
  headers?: object;
  files?: any;
  fileKey?: string;
  bodyKey?: string;
  primaryKey?: string;
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

export interface __Entity {
  __entity?: { __state: cdeebeeEntityState; };
}

export interface ICdeebeeHelpers {
  getSubEntity<T>(entity: T & __Entity): T & { __state: cdeebeeEntityState } | T & __Entity;
  commitEntity<T>(entity: T & __Entity): T & { __state: cdeebeeEntityState } | T & __Entity;
  getEntityState<T>(entity: T & __Entity): cdeebeeEntityState;
  
  checkNetworkActivity(activeRequest: object[], api: string[] | string): boolean;
  cancelationRequest(activeRequest: object[]): object;
  
  resetEntity<T>(activeRequest: T & __Entity): T & __Entity;
}

export const cdeebeeHelpers: ICdeebeeHelpers;

export interface ICdeebeeActions {
  setKeyValueList(entityList: string, entityID: string | number, dataList: Array<{ key: string, value: any }>, options?: IOptions): void;
  setKeyValue(entityList: string, entityID: string | number, key: string, value: any, options?: IOptions): void;
  commitEntity(entityList: string, entityID: string | number, entity: object, options?: IOptions): void;
  resetEntity(entityList: string, entityID: string | number, options?: IOptions): void;
}

export interface ActionCreator<A> { (...args: any[]): A; }
export const cdeebeeActions: ActionCreator<ICdeebeeActions>;

export class CdeebeeRequest {
  public requestObject: any;
  
  constructor(
    defaultRequest: object,
    options: {
      fileKey?: string,
      bodyKey?: string,
      method?: string,
      primaryKey?: string,
      normalize?: (data: object) => object,
      mergeStrategy?: cdeebeeMergeStrategy,
      responseKeyCode?: string,
      header?: object,
    },
  );
  
  public send(requestData: IOptions): (dispatch: any, getState: any) => void;
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
  activeRequest: object[],
  requestByApiUrl: object,
  errorHandler: object,
}
export function requestManager(state: IRequestState, action: IRequestAction): object;


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

export interface CDEEBEEDropElement {
  readonly type: cdeebeeTypes.CDEEBEEE_DROP_ELEMENT;
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

  export function cdeebee(state: IRequestState, action: ICdeebee): object;
