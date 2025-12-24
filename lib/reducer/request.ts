import { createAsyncThunk } from '@reduxjs/toolkit';
import { checkModule } from './helpers';
import { abortManager } from './abortController';
import { type CdeebeeState, type CdeebeeRequestOptions } from './types';

export const request = createAsyncThunk(
  'cdeebee/request',
  async (options: CdeebeeRequestOptions<unknown>, { rejectWithValue,  getState, requestId, signal }) => {
    const startedAt = new Date().toUTCString();
    const { cdeebee: { settings } } = getState() as { cdeebee: CdeebeeState<unknown> };

    const abort = abortManager(signal, options.api, requestId);

    checkModule(settings, 'cancelation', abort.init);

    try {
      const { method = 'POST', body, headers = {} } = options;

      const b = { ...(settings.mergeWithData ?? {}), ...(body ?? {}) };
      let requestData: FormData | string = JSON.stringify(b);

      // handling files
      if (options.files) {
        const formData = new FormData();
        const fileKey = options.fileKey || settings.fileKey;
        const bodyKey = options.bodyKey || settings.bodyKey;

        for (let i = 0; i < options.files.length; i += 1) {
          if (fileKey) {
            formData.append(fileKey, options.files[i]);
          }
        }

        if (bodyKey) {
          formData.append(bodyKey, requestData);
        }
        requestData = formData;
      }
      // [end] handling files
      
      const response = await fetch(options.api, {
        method,
        headers: {
          'ui-request-id': requestId,
          'Content-Type': 'application/json',
          ...headers,
        },
        signal: abort.controller.signal,
        body: requestData,
      });

      checkModule(settings, 'cancelation', abort.drop);

      if (!response.ok) {
        return rejectWithValue(response);
      }
      const result = await response.json();
      return { result, startedAt, endedAt: new Date().toUTCString() };
    } catch (error) {
      checkModule(settings, 'cancelation', abort.drop);
      if (error instanceof Error && error.name === 'AbortError') {
        return rejectWithValue({
          message: 'Request was cancelled',
          cancelled: true,
        });
      }
      return rejectWithValue({
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  },
);

