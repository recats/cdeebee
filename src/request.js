// @flow
// $FlowIgnore
import axios from 'axios';
import get from 'lodash/get';
import { mergeDeepRight } from 'ramda';
import nanoid from 'nanoid';

import { defaultNormalize } from './helpers';

import { types, cdeebeeMergeStrategy } from './constants';

let responsePosition = {};

type IProps = {
  api: string,
  data?: Object,
  headers?: Object,
  files?: string,
  responseCode?: string,
  method?: 'POST' | 'GET' | 'PUT' | 'DELETE',
  requestCancel?: boolean,
  mergeStrategy?: $Keys<typeof cdeebeeMergeStrategy>,
  normalize?: (e: Object) => Object | Array<Object> => Object,
  preUpdate?: (payload: Object) => void,
  postUpdate?: (payload: Object) => void,
  preError?: (payload: Object) => void,
  postError?: (payload: Object) => void,
}


export default class requestManager {
  requestObject: Object;

  options: Object;

  constructor(requestObject: Object, options: Object) {
    this.requestObject = requestObject;
    this.options = {
      fileKey: 'files',
      bodyKey: 'body',
      method: 'POST',
      normalize: defaultNormalize,
      mergeStrategy: cdeebeeMergeStrategy.merge,
      responseKeyCode: 'responseStatus',
      header: { 'content-type': 'application/json' },
      ...options,
    };
  }

  send = (rq: IProps) => async (dispatch: Function, getState: Function) => {
    const {
      api,
      preUpdate,
      postUpdate,
      preError,
      postError,
      data,
      files,
      requestCancel = true,
      fileKey = this.options.defaultFileKey,
      bodyKey = this.options.defaultBodyKey,
      method = this.options.defaultMethod,
      normalize = this.options.defaultNormalize,
      mergeStrategy = this.options.defaultMergeStrategy,
      headers = this.options.defaultHeader,
      responseKeyCode = this.options.defaultResponseKeyCode,
    } = mergeDeepRight(this.requestObject, rq);

    try {
      const nanoID = nanoid();
      let body = JSON.stringify({
        ...data,
        requestID: nanoID,
      });
      const source = axios.CancelToken.source();

      dispatch({
        type: types.CDEEBEE_REQUESTMANAGER_SET,
        payload: {
          nanoID, api, source, requestCancel,
        },
      });

      if (files) {
        const formData = new FormData();
        for (let i = 0; i < files.length; i += 1) {
          formData.append(fileKey, files[i]);
        }

        formData.append(bodyKey, encodeURIComponent(body));
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

          if (response[responseKeyCode] === 0) {
            if (preUpdate) preUpdate(resp.data);
            dispatch({
              type: types.CDEEBEEE_UPDATE,
              payload: {
                response: normalize({
                  response,
                  cdeebee: getState().cdeebee,
                  mergeStrategy,
                }),
                cleanResponse: response,
                api: requestApi,
                mergeStrategy,
              },
            });
            if (postUpdate) postUpdate(resp.data);
          } else {
            if (preError) preError(resp.data);
            dispatch({
              type: types.CDEEBEE_ERRORHANDLER_SET,
              payload: { api: requestApi, cleanResponse: response },
            });
            if (postError) postError(resp.data);
          }
        }
      }
    } catch (error) {
      console.warn('@@makeRequest', error);
    }
  }
}
