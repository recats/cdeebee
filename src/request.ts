// @ts-ignore
import axios from 'axios';
import { get } from 'lodash';
import { mergeDeepRight } from 'ramda';
// @ts-ignore
import { Dispatch } from 'redux';
// @ts-ignore
import nanoid from 'nanoid/generate';

import { defaultNormalize } from './helpers';

import { EnumAlphabet } from './constants';
import { cdeebeeTypes, IDefaultOption, IRequestOptions } from './definition';

interface IResponse {
  [string: string]: {
    response: object,
    requestApi: string,
  };
}

let responsePosition: IResponse = {};

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

    const requestID = nanoid(EnumAlphabet, 15);
    const requestStartTime = new Date();

    try {
      let body: any = JSON.stringify({ ...data, requestID });

      const source = axios.CancelToken.source();

      dispatch({
        type: cdeebeeTypes.CDEEBEE_REQUESTMANAGER_SET,
        payload: { requestID, api, source, data, requestCancel, requestStartTime, requestEndTime: undefined },
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

      const resp = await axios({
        url: api,
        method,
        headers: { 'ui-request-id': requestID, ...headers },
        data: body,
      });

      if (resp) {
        responsePosition = Object.assign(
          { [requestID]: { response: resp.data, requestApi: api } },
          responsePosition,
        );

        while (responsePosition[get(getState().requestManager.activeRequest, '[0].requestID')]) {
          const processID = getState().requestManager.activeRequest[0].requestID;

          const { response, requestApi }: any = responsePosition[processID];

          delete responsePosition[processID];

          dispatch({
            type: cdeebeeTypes.CDEEBEE_REQUESTMANAGER_SHIFT,
            payload: { requestID, api, source, data, requestCancel, requestStartTime, requestEndTime: new Date() }
          });

          if (responseKeyCode && response[responseKeyCode] === 0) {
            if (preUpdate) {
              preUpdate(resp.data);
            }

            if (updateStore) {
              dispatch({
                type: cdeebeeTypes.CDEEBEEE_UPDATE,
                payload: {
                  response: normalize instanceof Function && normalize({
                    response, cdeebee: getState().cdeebee, mergeListStrategy, primaryKey,
                  }),
                  cleanResponse: response,
                  api: requestApi,
                  mergeListStrategy,
                }
              });
            }

            if (postUpdate) {
              postUpdate(resp.data);
            }
          } else {
            if (preError) {
              preError(resp.data);
            }

            dispatch({
              type: cdeebeeTypes.CDEEBEE_ERRORHANDLER_SET,
              payload: { api: requestApi, cleanResponse: response },
            });

            if (postError) {
              postError(resp.data);
            }
          }
        }
      }
    } catch (error) {
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
