'use strict';

exports.__esModule = true;
exports.default = undefined;

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _get = require('lodash/get');

var _get2 = _interopRequireDefault(_get);

var _ramda = require('ramda');

var _nanoid = require('nanoid');

var _nanoid2 = _interopRequireDefault(_nanoid);

var _helpers = require('./helpers');

var _constants = require('./constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
// $FlowIgnore


var responsePosition = {};

var requestManager = function requestManager(requestObject) {
  var _this = this;

  _classCallCheck(this, requestManager);

  this.send = function (rq) {
    return function () {
      var _ref = _asyncToGenerator( /*#__PURE__*/_regenerator2.default.mark(function _callee(dispatch, getState) {
        var _mergeDeepRight, api, preUpdate, postUpdate, preError, postError, data, files, _mergeDeepRight$reque, requestCancel, _mergeDeepRight$metho, method, _mergeDeepRight$norma, normalize, _mergeDeepRight$merge, mergeStrategy, _mergeDeepRight$heade, headers, _mergeDeepRight$respo, responseCode, _Object$assign, nanoID, body, source, formData, i, resp, processID, response;

        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _mergeDeepRight = (0, _ramda.mergeDeepRight)(_this.requestObject, rq), api = _mergeDeepRight.api, preUpdate = _mergeDeepRight.preUpdate, postUpdate = _mergeDeepRight.postUpdate, preError = _mergeDeepRight.preError, postError = _mergeDeepRight.postError, data = _mergeDeepRight.data, files = _mergeDeepRight.files, _mergeDeepRight$reque = _mergeDeepRight.requestCancel, requestCancel = _mergeDeepRight$reque === undefined ? true : _mergeDeepRight$reque, _mergeDeepRight$metho = _mergeDeepRight.method, method = _mergeDeepRight$metho === undefined ? 'POST' : _mergeDeepRight$metho, _mergeDeepRight$norma = _mergeDeepRight.normalize, normalize = _mergeDeepRight$norma === undefined ? _helpers.defaultNormalize : _mergeDeepRight$norma, _mergeDeepRight$merge = _mergeDeepRight.mergeStrategy, mergeStrategy = _mergeDeepRight$merge === undefined ? _constants.cdeebeeMergeStrategy.merge : _mergeDeepRight$merge, _mergeDeepRight$heade = _mergeDeepRight.headers, headers = _mergeDeepRight$heade === undefined ? { 'content-type': 'application/json' } : _mergeDeepRight$heade, _mergeDeepRight$respo = _mergeDeepRight.responseCode, responseCode = _mergeDeepRight$respo === undefined ? 'responseStatus' : _mergeDeepRight$respo;
                _context.prev = 1;
                nanoID = (0, _nanoid2.default)();
                body = JSON.stringify(_extends({}, data, {
                  requestID: nanoID
                }));
                source = _axios2.default.CancelToken.source();


                dispatch({
                  type: _constants.types.CDEEBEE_REQUESTMANAGER_SET,
                  payload: {
                    nanoID: nanoID, api: api, source: source, requestCancel: requestCancel
                  }
                });

                if (files) {
                  formData = new FormData();

                  for (i = 0; i < files.length; i += 1) {
                    formData.append('file', files[i]);
                  }

                  formData.append('body', encodeURIComponent(body));
                  body = formData;
                }

                _context.next = 9;
                return (0, _axios2.default)({
                  url: api, method: method, headers: headers, data: body
                });

              case 9:
                resp = _context.sent;


                if (resp) responsePosition = Object.assign((_Object$assign = {}, _Object$assign[nanoID] = resp.data, _Object$assign), responsePosition);

                while (responsePosition[(0, _get2.default)(getState().requestManager.activeRequest, '[0].nanoID')]) {
                  processID = getState().requestManager.activeRequest[0].nanoID;

                  dispatch({ type: _constants.types.CDEEBEE_REQUESTMANAGER_SHIFT });

                  response = responsePosition[processID];

                  delete responsePosition[processID];
                  if (response[responseCode] === 0) {
                    if (preUpdate) preUpdate(resp.data);
                    dispatch({
                      type: _constants.types.CDEEBEEE_UPDATE,
                      payload: {
                        response: normalize({
                          response: response,
                          cdeebee: getState().cdeebee,
                          mergeStrategy: mergeStrategy
                        }),
                        cleanResponse: response,
                        api: api,
                        mergeStrategy: mergeStrategy
                      }
                    });
                    if (postUpdate) postUpdate(resp.data);
                  } else {
                    if (preError) preError(resp.data);
                    dispatch({
                      type: _constants.types.CDEEBEE_ERRORHANDLER_SET,
                      payload: { api: api, cleanResponse: response }
                    });
                    if (postError) postError(resp.data);
                  }
                }
                _context.next = 17;
                break;

              case 14:
                _context.prev = 14;
                _context.t0 = _context['catch'](1);

                console.warn('@@makeRequest', _context.t0);

              case 17:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, _this, [[1, 14]]);
      }));

      return function (_x, _x2) {
        return _ref.apply(this, arguments);
      };
    }();
  };

  this.requestObject = requestObject;
};

exports.default = requestManager;
module.exports = exports['default'];