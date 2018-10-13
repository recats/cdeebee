// @ts-ignore
import axios from 'axios';
import { get } from 'lodash';
import { mergeDeepRight } from 'ramda';
import { Dispatch } from 'redux';
// @ts-ignore
import nanoid from 'nanoid';

import { defaultNormalize } from './helpers';

import { types, cdeebeeMergeStrategy } from './constants';

import { IOptions } from './types';

interface IResponse {
  [string: string]: {
    response: object,
    requestApi: string,
  };
}

let responsePosition: IResponse = {};

// tslint:disable-next-line
export default class requestManager {
  private requestObject: object;
  private options: IOptions;

  constructor(requestObject: object, options: IOptions) {
    this.requestObject = requestObject;
    this.options = {
      fileKey: 'files',
      bodyKey: 'body',
      method: 'POST',
      normalize: defaultNormalize,
      mergeStrategy: cdeebeeMergeStrategy.merge,
      responseKeyCode: 'responseStatus',
      headers: { 'content-type': 'application/json' },
      ...options,
    };
  }

  public send = (rq: IOptions) => async (dispatch: Dispatch, getState: () => any) => {
    const {
      api,
      preUpdate,
      postUpdate,
      preError,
      postError,
      data,
      files,
      requestCancel = true,
      fileKey = this.options.fileKey,
      bodyKey = this.options.bodyKey,
      method = this.options.method,
      normalize = this.options.normalize,
      mergeStrategy = this.options.mergeStrategy,
      headers = this.options.headers,
      responseKeyCode = this.options.responseKeyCode,
    } = mergeDeepRight(this.requestObject, rq);

    try {
      const nanoID = nanoid();

      let body: any = JSON.stringify({ ...data, requestID: nanoID });

      const source = axios.CancelToken.source();

      dispatch({
        type: types.CDEEBEE_REQUESTMANAGER_SET,
        payload: { nanoID, api, source, data, requestCancel },
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
        url: api, method, headers, data: body,
      });

      if (resp) {
        responsePosition = Object.assign(
          { [nanoID]: { response: resp.data, requestApi: api } },
          responsePosition,
        );

        while (responsePosition[get(getState().requestManager.activeRequest, '[0].nanoID')]) {
          const processID = getState().requestManager.activeRequest[0].nanoID;

          const { response, requestApi } = responsePosition[processID];

          delete responsePosition[processID];

          dispatch({ type: types.CDEEBEE_REQUESTMANAGER_SHIFT });
          // @ts-ignore
          if (responseKeyCode && response[responseKeyCode] === 0) {
            if (preUpdate) {
              preUpdate(resp.data);
            }
            dispatch({
              type: types.CDEEBEEE_UPDATE,
              payload: {
                response: normalize instanceof Function && normalize({
                  response,
                  cdeebee: getState().cdeebee,
                  mergeStrategy,
                }),
                cleanResponse: response,
                api: requestApi,
                mergeStrategy,
              },
            });
            if (postUpdate) {
              postUpdate(resp.data);
            }
          } else {
            if (preError) {
              preError(resp.data);
            }
            dispatch({
              type: types.CDEEBEE_ERRORHANDLER_SET,
              payload: { api: requestApi, cleanResponse: response },
            });
            if (postError) {
              postError(resp.data);
            }
          }
        }
      }
    } catch (error) {
      // tslint:disable-next-line
      console.warn('@@makeRequest', error);
    }
  }
}
