import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { request, type CdeebeeRequestOptions } from '../../../lib/reducer/request';
import { factory } from '../../../lib/reducer/index';
import { type CdeebeeSettings } from '../../../lib/reducer/types';

// Mock fetch globally
global.fetch = vi.fn();

describe('request', () => {
  let store: ReturnType<typeof configureStore>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dispatch: any;
  let settings: CdeebeeSettings;

  beforeEach(() => {
    vi.clearAllMocks();
    
    settings = {
      modules: ['history', 'listener', 'cancelation'],
      fileKey: 'file',
      bodyKey: 'value',
      primaryKey: 'id',
      mergeWithData: { defaultKey: 'defaultValue' },
      listStrategy: {},
    };

    const slice = factory(settings);
    store = configureStore({
      reducer: {
        cdeebee: slice.reducer,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dispatch = store.dispatch as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful requests', () => {
    it('should handle a successful POST request', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
        method: 'POST',
        body: { test: 'data' },
      };

      const result = await dispatch(request(options));

      expect(result.type).toBe('cdeebee/request/fulfilled');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should merge mergeWithData with request body', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
        method: 'POST',
        body: { customKey: 'customValue' },
      };

      await dispatch(request(options));

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);

      expect(body).toHaveProperty('defaultKey', 'defaultValue');
      expect(body).toHaveProperty('customKey', 'customValue');
    });

    it('should handle GET request', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
        method: 'GET',
      };

      await dispatch(request(options));

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should include custom headers', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
        headers: { 'Authorization': 'Bearer token' },
      };

      await dispatch(request(options));

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].headers).toHaveProperty('Authorization', 'Bearer token');
    });

    it('should include requestId in headers', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
      };

      await dispatch(request(options));

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].headers).toHaveProperty('ui-request-id');
    });
  });

  describe('file uploads', () => {
    it('should handle file uploads with FormData', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const file1 = new File(['content1'], 'file1.txt', { type: 'text/plain' });
      const file2 = new File(['content2'], 'file2.txt', { type: 'text/plain' });

      const options: CdeebeeRequestOptions = {
        api: '/api/upload',
        files: [file1, file2],
        body: { metadata: 'test' },
      };

      await dispatch(request(options));

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].body).toBeInstanceOf(FormData);
    });

    it('should use custom fileKey and bodyKey', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const file = new File(['content'], 'file.txt', { type: 'text/plain' });

      const options: CdeebeeRequestOptions = {
        api: '/api/upload',
        files: [file],
        fileKey: 'customFile',
        bodyKey: 'customBody',
        body: { metadata: 'test' },
      };

      await dispatch(request(options));

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const formData = callArgs[1].body as FormData;
      
      expect(formData.has('customFile')).toBe(true);
      expect(formData.has('customBody')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should reject with response when response is not ok', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse as Response);

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
      };

      const result = await dispatch(request(options));

      expect(result.type).toBe('cdeebee/request/rejected');
      if ('payload' in result) {
        expect(result.payload).toBe(mockResponse);
      }
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(networkError);

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
      };

      const result = await dispatch(request(options));

      expect(result.type).toBe('cdeebee/request/rejected');
      if ('payload' in result) {
        expect(result.payload).toHaveProperty('message', 'Network error');
      }
    });

    it('should handle AbortError specifically', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(abortError);

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
      };

      const result = await dispatch(request(options));

      expect(result.type).toBe('cdeebee/request/rejected');
      if ('payload' in result) {
        expect(result.payload).toHaveProperty('cancelled', true);
        expect(result.payload).toHaveProperty('message', 'Request was cancelled');
      }
    });

    it('should handle unknown errors', async () => {
      const unknownError = 'String error';
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(unknownError);

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
      };

      const result = await dispatch(request(options));

      expect(result.type).toBe('cdeebee/request/rejected');
      if ('payload' in result) {
        expect(result.payload).toHaveProperty('message', 'Unknown error occurred');
      }
    });
  });

  describe('response data', () => {
    it('should return result with startedAt and endedAt', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
      };

      const result = await dispatch(request(options));

      if (result.type === 'cdeebee/request/fulfilled' && 'payload' in result) {
        expect(result.payload).toHaveProperty('result', mockResponse);
        expect(result.payload).toHaveProperty('startedAt');
        expect(result.payload).toHaveProperty('endedAt');
      }
    });

    it('should call onResult callback with response data when provided', async () => {
      const mockResponse = { data: 'test', id: 123 };
      const onResult = vi.fn();
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
        onResult,
      };

      await dispatch(request(options));

      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith(mockResponse);
    });

    it('should not call onResult when it is not provided', async () => {
      const mockResponse = { data: 'test' };
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
      };

      await dispatch(request(options));

      // No error should occur when onResult is not provided
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should not call onResult when request fails', async () => {
      const onResult = vi.fn();
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
        onResult,
      };

      await dispatch(request(options));

      expect(onResult).not.toHaveBeenCalled();
    });
  });

  describe('mergeWithHeaders', () => {
    it('should merge headers from settings with request headers', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      settings.mergeWithHeaders = { 'X-Custom-Header': 'from-settings', 'X-Another': 'settings-value' };

      const slice = factory(settings);
      store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatch = store.dispatch as any;

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
        headers: { 'Authorization': 'Bearer token', 'X-Another': 'request-value' },
      };

      await dispatch(request(options));

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].headers).toHaveProperty('X-Custom-Header', 'from-settings');
      expect(callArgs[1].headers).toHaveProperty('Authorization', 'Bearer token');
      // Request headers should override settings headers
      expect(callArgs[1].headers).toHaveProperty('X-Another', 'request-value');
    });

    it('should use only settings headers when request headers are not provided', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      settings.mergeWithHeaders = { 'X-Settings-Header': 'settings-only' };

      const slice = factory(settings);
      store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatch = store.dispatch as any;

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
      };

      await dispatch(request(options));

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].headers).toHaveProperty('X-Settings-Header', 'settings-only');
    });

    it('should handle empty mergeWithHeaders', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      settings.mergeWithHeaders = {};

      const slice = factory(settings);
      store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatch = store.dispatch as any;

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
        headers: { 'Authorization': 'Bearer token' },
      };

      await dispatch(request(options));

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].headers).toHaveProperty('Authorization', 'Bearer token');
    });

    it('should handle undefined mergeWithHeaders', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      settings.mergeWithHeaders = undefined;

      const slice = factory(settings);
      store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatch = store.dispatch as any;

      const options: CdeebeeRequestOptions = {
        api: '/api/test',
        headers: { 'Authorization': 'Bearer token' },
      };

      await dispatch(request(options));

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].headers).toHaveProperty('Authorization', 'Bearer token');
    });
  });
});

