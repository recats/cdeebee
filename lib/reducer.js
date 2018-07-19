'use strict';

exports.__esModule = true;
exports.requestManager = exports.storage = exports.INITIAL_STORAGE = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _ramda = require('ramda');

var _set = require('lodash/set');

var _set2 = _interopRequireDefault(_set);

var _constants = require('./constants');

var _helpers = require('./helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var INITIAL_STORAGE = exports.INITIAL_STORAGE = {};

var storage = exports.storage = function storage() {
  var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : INITIAL_STORAGE;
  var action = arguments[1];
  var type = action.type,
      payload = action.payload;


  switch (type) {
    case _constants.types.CDEEBEEE_UPDATE:
      return (0, _ramda.mergeDeepRight)(state, payload.response);

    case _constants.types.CDEEBEE_ENTITY_CHANGE_FIELD:
      {
        var entityList = state[payload.entityList];
        var entity = (0, _helpers.editEntity)(entityList[payload.entityID]);
        var subEntity = (0, _ramda.clone)((0, _helpers.getSubEntity)(entity));
        payload.list.forEach(function (_ref) {
          var key = _ref.key,
              value = _ref.value;
          return (0, _set2.default)(subEntity, key, value);
        });
        return (0, _ramda.assocPath)([payload.entityList, payload.entityID, '__entity'], subEntity, state);
      }
    case _constants.types.CDEEBEE_SET_ENTITY:
      return (0, _ramda.assocPath)([payload.entityList, payload.entityID], payload.entity, state);
    case _constants.types.CDEEBEE_RESET_ENTITY:
      {
        var _entityList = state[payload.entityList];
        return (0, _ramda.assocPath)([payload.entityList, payload.entityID], (0, _helpers.resetEntity)(_entityList[payload.entityID]), state);
      }
    case _constants.types.CDEEBEEE_DROP:
      return INITIAL_STORAGE;
    case _constants.types.CDEEBEEE_DROP_ELEMENT:
      return (0, _ramda.omit)([payload.entityList, payload.entityID], state);
    default:
      return state;
  }
};

var INITIAL_REQUEST = {
  activeRequest: [],
  requestByApiUrl: {},
  errorHandler: {}
};

var requestManager = exports.requestManager = function requestManager() {
  var _extends2, _extends3;

  var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : INITIAL_REQUEST;
  var action = arguments[1];
  var type = action.type,
      payload = action.payload;

  switch (type) {
    case _constants.types.CDEEBEE_REQUESTMANAGER_SET:
      return _extends({}, state, { activeRequest: [].concat(state.activeRequest, [payload]) });
    case _constants.types.CDEEBEE_REQUESTMANAGER_SHIFT:
      return _extends({}, state, { activeRequest: (0, _ramda.slice)(1, Infinity, state.activeRequest) });
    case _constants.types.CDEEBEEE_UPDATE:
      return _extends({}, state, {
        requestByApiUrl: _extends({}, state.requestByApiUrl, (_extends2 = {}, _extends2[payload.api] = payload.response, _extends2))
      });
    case _constants.types.CDEEBEE_ERRORHANDLER_SET:
      return _extends({}, state, {
        errorHandler: _extends({}, state.activeRequest, (_extends3 = {}, _extends3[payload.api] = payload.response, _extends3))
      });

    case _constants.types.CHANGE_ROUTE:
      return (0, _helpers.cancelationRequest)(state.activeRequest);
    default:
      return state;
  }
};