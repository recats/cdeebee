export enum types {
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

export enum EntityState {
  NEW = 'NEW',
  EDITING = 'EDITING',
  NORMAL = 'NORMAL',
}

export enum cdeebeeMergeStrategy {
  merge = 'merge',
  replace = 'replace',
}
