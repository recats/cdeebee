// @flow
// $FlowIgnore
import axios from 'axios';
import Cookies from 'js-cookie';
import get from 'lodash/get';
import nanoid from 'nanoid';

import { defaultNormalize } from './helpers';

import { types, cdeebeeMergeStrategy } from './constants';

let responsePosition = {};

type IProps = {
  api: string,
  data?: Object,
  headers?: Object,
  files?: string,
  method?: 'POST' | 'GET' | 'PUT' | 'DELETE',
  requestCancel?: boolean,
  mergeStrategy?: $Keys<typeof cdeebeeMergeStrategy>,
  normalize?: (e: Object) => Object | Array<Object> => Object,
  preUpdate?: (payload: Object) => void,
  postUpdate?: (payload: Object) => void,
  preError?: (payload: Object) => void,
  postError?: (payload: Object) => void,
}

export default ({
  api,
  preUpdate,
  postUpdate,
  preError,
  postError,
  data,
  files,
  requestCancel = true,
  method = 'POST',
  normalize = defaultNormalize,
  mergeStrategy = cdeebeeMergeStrategy.merge,
  headers = { 'content-type': 'application/json' },
}: IProps) => async (dispatch: Function, getState: Function) => {
  try {
    const nanoID = nanoid();
    let body = JSON.stringify({
      ...data,
      sessionToken: Cookies.get('sessionToken'),
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
        formData.append('file', files[i]);
      }

      formData.append('body', encodeURIComponent(body));
      body = formData;
    }

    const resp = await axios({
      url: api, method, headers, data: body,
    });

    if (resp) responsePosition = Object.assign({ [nanoID]: resp.data }, responsePosition);


    while (responsePosition[get(getState().requestManager.activeRequest, '[0].nanoID')]) {
      const processID = getState().requestManager.activeRequest[0].nanoID;
      dispatch({ type: types.CDEEBEE_REQUESTMANAGER_SHIFT });

      const response = responsePosition[processID];
      delete responsePosition[processID];
      if (response.errorCode === 0) {
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
            api,
            mergeStrategy,
          },
        });
        if (postUpdate) postUpdate(resp.data);
      } else {
        if (preError) preError(resp.data);
        dispatch({
          type: types.CDEEBEE_ERRORHANDLER_SET,
          payload: { api, cleanResponse: response },
        });
        if (postError) postError(resp.data);
      }
    }
  } catch (error) {
    console.warn('@@makeRequest', error);
  }
};
