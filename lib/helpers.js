'use strict';

exports.__esModule = true;
exports.defaultNormalize = exports.editEntity = exports.resetEntity = exports.commitEntity = exports.insertEntity = exports.getEntityState = exports.getSubEntity = exports.cancelationRequest = undefined;
exports.checkNetworkActivity = checkNetworkActivity;

var _ramda = require('ramda');

var _constants = require('./constants');

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

/* eslint-disable no-underscore-dangle */
/* eslint-disable no-param-reassign */

var omitKeys = function omitKeys(entity) {
  return (0, _ramda.omit)(['__entity', '__state'], entity);
};

/**
 * @method cancelationRequest
 * @param  {Array<Object>} activeRequest
 * @return {array<Object>} active request array
 */
var cancelationRequest = exports.cancelationRequest = function cancelationRequest(activeRequest) {
  var act = activeRequest.filter(function (q) {
    return q.requestCancel && q.source.cancel(q);
  });
  return { activeRequest: act };
};

/**
 * @method checkNetworkActivity
 * @param  {Array<Object>} activeRequest
 * @param {string} api url
 * @return {string} boolean isLoading
 */
function checkNetworkActivity(activeRequest, apiUrl) {
  if (!apiUrl || activeRequest.length === 0) return false;

  var apiUrlList = apiUrl instanceof Array ? apiUrl : [apiUrl];
  var activeLinks = activeRequest.map(function (q) {
    return q.api;
  });
  for (var i = 0; i < apiUrlList.length; i += 1) {
    if (activeLinks.includes(apiUrlList[i])) return true;
  }

  return false;
}

/**
 * @method getSubEntity
 * @param  {Object} entity cdeebee object
 * @return {Object} object (editable)
 */
var getSubEntity = exports.getSubEntity = function getSubEntity(entity) {
  return entity.__entity || entity;
};

/**
 * @method getEntityState
 * @param  {Object} entity cdeebee object
 * @return {Object} object state
 */
var getEntityState = exports.getEntityState = function getEntityState(entity) {
  if (!entity.__entity) return _constants.EntityState.NORMAL;
  return entity.__entity.__state;
};

/**
 * @method insertEntity
 * @param  {Object} entity cdeebee object
 * @return {Object} with __state "EntityState.NEW"
 */
var insertEntity = exports.insertEntity = function insertEntity(entity) {
  entity.__state = _constants.EntityState.NEW;
  return entity;
};

/**
 * @method commitEntity
 * @param  {Object} entity cdeebee object
 * @return {Object} with __state "EDITING"
 */
var commitEntity = exports.commitEntity = function commitEntity(entity) {
  var state = getEntityState(entity);
  if (state === _constants.EntityState.NORMAL) {
    console.warn('commit works only in editing and new states');
    return entity;
  }
  return omitKeys(entity);
};

/**
 * @method resetEntity
 * @param  {Object} entity cdeebee object
 * @return {Object} with __state "EntityState.NORMAL"
 */
var resetEntity = exports.resetEntity = function resetEntity(entity) {
  var state = getEntityState(entity);
  if (state === _constants.EntityState.NORMAL) {
    console.warn('reset works only in editing and new states');
    return entity;
  }
  return omitKeys(entity);
};

/**
 * @method editEntity
 * @param  {Object} entity cdeebee object
 * @return {Object} with __state "EntityState.EDITING" and __entity deep object
 */
var editEntity = exports.editEntity = function editEntity(entity) {
  var state = getEntityState(entity);
  if (state === _constants.EntityState.EDITING) {
    return entity;
  }
  var newEntity = (0, _ramda.clone)(entity);
  newEntity.__entity = (0, _ramda.clone)(entity);
  newEntity.__entity.__state = _constants.EntityState.EDITING;
  return newEntity;
};

/**
 * @method defaultNormalize
 * @param  {number | string} errorCode
 * @param  {Object} response
 * @return {Object}
 */
var defaultNormalize = function defaultNormalize(_ref) {
  var _ref$response = _ref.response,
      errorCode = _ref$response.errorCode,
      response = _objectWithoutProperties(_ref$response, ['errorCode']),
      cdeebee = _ref.cdeebee,
      mergeStrategy = _ref.mergeStrategy;

  var keys = Object.keys(response);
  for (var _iterator = keys, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
    var _ref2;

    if (_isArray) {
      if (_i >= _iterator.length) break;
      _ref2 = _iterator[_i++];
    } else {
      _i = _iterator.next();
      if (_i.done) break;
      _ref2 = _i.value;
    }

    var key = _ref2;
    // eslint-disable-line
    var newStorageData = {};
    if (response[key] instanceof Object) {
      // eslint-disable-line
      for (var _iterator2 = response[key].data, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref3;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref3 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref3 = _i2.value;
        }

        var element = _ref3;
        // eslint-disable-line
        newStorageData[element[response[key].primaryKey]] = element;
      }
      if (mergeStrategy === _constants.cdeebeeMergeStrategy.merge) {
        response[key] = (0, _ramda.merge)(cdeebee[key], newStorageData);
      } else if (mergeStrategy === _constants.cdeebeeMergeStrategy.replace) {
        response[key] = newStorageData;
      }
    } else if (response[key] === null || response[key] === undefined) {
      response = (0, _ramda.omit)([key], response);
    }
  }

  return response;
};
exports.defaultNormalize = defaultNormalize;