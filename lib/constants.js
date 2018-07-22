'use strict';

exports.__esModule = true;
var types = exports.types = {
  CDEEBEE_REQUESTMANAGER_SHIFT: '@@cdeebee/REQUESTMANAGER_SHIFT',
  CDEEBEE_REQUESTMANAGER_SET: '@@cdeebee/REQUESTMANAGER_SET',
  CDEEBEE_ERRORHANDLER_SET: '@@cdeebee/ERRORHANDLER_SET',

  CDEEBEE_ENTITY_CHANGE_FIELD: '@@cdeebee/ENTITY_CHANGE_FIELD',
  CDEEBEE_RESET_ENTITY: '@@cdeebee/RESET_ENTITY',
  CDEEBEE_SET_ENTITY: '@@cdeebee/SET_ENTITY',
  CDEEBEEE_UPDATE: '@@cdeebee/UPDATE',
  CDEEBEEE_DROP: '@@cdeebee/DROP',
  CDEEBEEE_DROP_ELEMENT: '@@cdeebee/DROP_ELEMENT',

  CHANGE_ROUTE: '@@router/LOCATION_CHANGE'
};

var EntityState = exports.EntityState = {
  NEW: 'NEW',
  EDITING: 'EDITING',
  NORMAL: 'NORMAL'
};

var cdeebeeMergeStrategy = exports.cdeebeeMergeStrategy = {
  merge: 'merge',
  replace: 'replace'
};