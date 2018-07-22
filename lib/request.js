'use strict';

exports.__esModule = true;

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _jsCookie = require('js-cookie');

var _jsCookie2 = _interopRequireDefault(_jsCookie);

var _get = require('lodash/get');

var _get2 = _interopRequireDefault(_get);

var _nanoid = require('nanoid');

var _nanoid2 = _interopRequireDefault(_nanoid);

var _helpers = require('./helpers');

var _constants = require('./constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }
// $FlowIgnore


var responsePosition = {};

exports.default = function (_ref) {
  var api = _ref.api,
      preUpdate = _ref.preUpdate,
      postUpdate = _ref.postUpdate,
      preError = _ref.preError,
      postError = _ref.postError,
      data = _ref.data,
      files = _ref.files,
      _ref$requestCancel = _ref.requestCancel,
      requestCancel = _ref$requestCancel === undefined ? true : _ref$requestCancel,
      _ref$method = _ref.method,
      method = _ref$method === undefined ? 'POST' : _ref$method,
      _ref$normalize = _ref.normalize,
      normalize = _ref$normalize === undefined ? _helpers.defaultNormalize : _ref$normalize,
      _ref$mergeStrategy = _ref.mergeStrategy,
      mergeStrategy = _ref$mergeStrategy === undefined ? _constants.cdeebeeMergeStrategy.merge : _ref$mergeStrategy,
      _ref$headers = _ref.headers,
      headers = _ref$headers === undefined ? { 'content-type': 'application/json' } : _ref$headers;
  return function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/_regenerator2.default.mark(function _callee(dispatch, getState) {
      var _Object$assign, body, nanoID, source, formData, i, resp, processID, response;

      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.prev = 0;
              body = JSON.stringify(_extends({}, data, {
                sessionToken: _jsCookie2.default.get('sessionToken')
              }));
              nanoID = (0, _nanoid2.default)();
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

              _context.next = 8;
              return (0, _axios2.default)({
                url: api, method: method, headers: headers, data: body
              });

            case 8:
              resp = _context.sent;


              if (resp) responsePosition = Object.assign((_Object$assign = {}, _Object$assign[nanoID] = resp.data, _Object$assign), responsePosition);

              while (responsePosition[(0, _get2.default)(getState().requestManager.activeRequest, '[0].nanoID')]) {
                processID = getState().requestManager.activeRequest[0].nanoID;

                dispatch({ type: _constants.types.CDEEBEE_REQUESTMANAGER_SHIFT });

                response = responsePosition[processID];

                delete responsePosition[processID];
                if (response.errorCode === 0) {
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
                    payload: { api: api, response: response }
                  });
                  if (postError) postError(resp.data);
                }
              }
              _context.next = 16;
              break;

            case 13:
              _context.prev = 13;
              _context.t0 = _context['catch'](0);

              console.warn('@@makeRequest', _context.t0);

            case 16:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, undefined, [[0, 13]]);
    }));

    return function (_x, _x2) {
      return _ref2.apply(this, arguments);
    };
  }();
};

module.exports = exports['default'];