import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
// @ts-ignore
import { fetch } from 'whatwg-fetch';
import nodeFetch from 'node-fetch';

import { mergeDeepRight } from 'ramda';
// @ts-ignore
import { Dispatch } from 'redux';

import { defaultNormalize } from './helpers';

import { cdeebeeTypes, IDefaultOption, IRequestOptions, IResponsePropObject } from './definition';

interface IResponse {
  [string: string]: {
    response: object,
    requestApi: string,
  };
}

let responsePosition: IResponse = {};


const abortableFetch = typeof window !== 'undefined' ? (('signal' in new Request('')) ? window.fetch : fetch) : nodeFetch;

// tslint:disable-next-line
export default class requestManager {
  public requestObject: object;
  private options: IDefaultOption;

  constructor(requestObject: object, options: IDefaultOption) {
    this.requestObject = requestObject;
    this.options = {
      fileKey: 'files',
      bodyKey: 'body',
      method: 'POST',
      primaryKey: 'primaryKey',
      normalize: defaultNormalize,
      responseKeyCode: 'responseStatus',
      headers: { 'content-type': 'application/json' },
      ...options,
    };
  }

  public send = (rq: IRequestOptions) => async (dispatch: Dispatch, getState: () => any) => {
    const {
      api,
      preUpdate,
      postUpdate,
      preError,
      postError,
      data,
      files,
      requestCancel = true,
      updateStore = true,
      fileKey = this.options.fileKey,
      primaryKey = this.options.primaryKey,
      bodyKey = this.options.bodyKey,
      method = this.options.method,
      normalize = this.options.normalize,
      mergeListStrategy = this.options.mergeListStrategy,
      headers = this.options.headers,
      responseKeyCode = this.options.responseKeyCode,
    } = mergeDeepRight(this.requestObject, rq);

    const requestID = Math.random().toString(36).substr(2);
    const requestStartTime = new Date();

    try {
      let body: any = JSON.stringify({ ...data, requestID });

      const controller = new AbortController();
      const { signal } = controller;

      dispatch({
        type: cdeebeeTypes.CDEEBEE_REQUESTMANAGER_SET,
        payload: { requestID, api, controller, data, requestCancel, requestStartTime, requestEndTime: undefined },
      });

      if (files) {
        const formData = new FormData();
        for (let i = 0; i < files.length; i += 1) {
          if (fileKey) {
            formData.append(fileKey, files[i]);
          }
        }

        if (bodyKey) {
          formData.append(bodyKey, body);
        }
        body = formData;
      }

      const responseData = await (await abortableFetch(api, {
        method,
        signal,
        headers: { 'ui-request-id': requestID, ...headers },
        body,
      })).json();


      if (responseData) {
        responsePosition = Object.assign(
          {
            [requestID]: {
              response: responseData,
              requestApi: api,
              requestStartTime,
              preUpdate,
              postUpdate,
              normalize,
              preError,
              postError,
              mergeListStrategy
            },
          },
          responsePosition,
        );

        while (responsePosition[getState().requestManager.activeRequest?.[0]?.requestID]) {
          const processID = getState().requestManager.activeRequest[0].requestID;
          const responsePropsObject: IResponsePropObject = responsePosition[processID];
          delete responsePosition[processID];

          dispatch({
            type: cdeebeeTypes.CDEEBEE_REQUESTMANAGER_SHIFT,
            payload: {
              requestID,
              api: responsePropsObject.requestApi,
              controller,
              data,
              requestCancel,
              requestStartTime: responsePropsObject.requestStartTime,
              requestEndTime: new Date(),
            }
          });


          if (responseKeyCode && responsePropsObject.response[responseKeyCode] === 0) {
            if (responsePropsObject.preUpdate) {
              responsePropsObject.preUpdate(responsePropsObject.response);
            }

            if (updateStore) {
              dispatch({
                type: cdeebeeTypes.CDEEBEEE_UPDATE,
                payload: {
                  response: responsePropsObject.normalize instanceof Function && responsePropsObject.normalize({
                    response: responsePropsObject.response,
                    cdeebee: getState().cdeebee,
                    mergeListStrategy: responsePropsObject.mergeListStrategy,
                    primaryKey,
                  }),
                  cleanResponse: responsePropsObject.response,
                  api: responsePropsObject.requestApi,
                  mergeListStrategy: responsePropsObject.mergeListStrategy,
                }
              });
            }

            if (responsePropsObject.postUpdate) {
              responsePropsObject.postUpdate(responsePropsObject.response);
            }
          } else {
            if (responsePropsObject.preError) {
              responsePropsObject.preError(responsePropsObject.response);
            }

            dispatch({
              type: cdeebeeTypes.CDEEBEE_ERRORHANDLER_SET,
              payload: { api: responsePropsObject.requestApi, cleanResponse: responsePropsObject.response },
            });

            if (responsePropsObject.postError) {
              responsePropsObject.postError(responseData);
            }
          }
        }
      }
    } catch (error) {
        if (error.name === 'AbortError') {
          dispatch({ type: cdeebeeTypes.CDEEBEE_REQUEST_ABORTED, payload: { requestID, api } });
        } else {
          const requestEndTime = new Date();
          dispatch({
            type: cdeebeeTypes.CDEEBEE_INTERNAL_ERROR,
            payload: { requestStartTime, requestEndTime, requestID, api },
          });
          // tslint:disable-next-line
          console.warn('@@makeRequest-error', error);
          // tslint:disable-next-line
          console.warn('@@makeRequest-object', mergeDeepRight(this.requestObject, rq));
          // tslint:disable-next-line
          console.warn('@@makeRequest-info', { requestStartTime, requestEndTime, requestID });

          if (this.options.hasOwnProperty('globalErrorHandler') && this.options.globalErrorHandler instanceof Function) {
            this.options.globalErrorHandler(
              error,
              mergeDeepRight(this.requestObject, rq),
              { requestStartTime, requestEndTime, requestID }
            )(dispatch, getState);
          }
        }
      }
  }
}
