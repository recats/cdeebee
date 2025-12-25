import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { request } from '../../../lib/reducer/request';
import { type CdeebeeSettings, type CdeebeeRequestOptions } from '../../../lib/reducer/types';
import { createMockResponse, createTestStore, defaultTestSettings, mockFetch } from '../test-helpers';

describe('request', () => {
  let store: ReturnType<typeof createTestStore>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dispatch: any;
  let settings: CdeebeeSettings<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    settings = defaultTestSettings({
      modules: ['history', 'listener', 'cancelation'],
      mergeWithData: { defaultKey: 'defaultValue' },
    });

    store = createTestStore(settings);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dispatch = store.dispatch as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful requests', () => {
    it('should handle a successful POST request', async () => {
      const mockResponse = { data: 'test' };
      mockFetch(createMockResponse({ json: async () => mockResponse }));

      const options: CdeebeeRequestOptions<unknown> = {
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
      mockFetch(createMockResponse({ json: async () => mockResponse }));

      const options: CdeebeeRequestOptions<unknown> = {
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
      mockFetch(createMockResponse({ json: async () => mockResponse }));

      const options: CdeebeeRequestOptions<unknown> = {
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
      mockFetch(createMockResponse({ json: async () => mockResponse }));

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/test',
        headers: { 'Authorization': 'Bearer token' },
      };

      await dispatch(request(options));

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].headers).toHaveProperty('Authorization', 'Bearer token');
    });

    it('should include requestId in headers', async () => {
      const mockResponse = { data: 'test' };
      mockFetch(createMockResponse({ json: async () => mockResponse }));

      const options: CdeebeeRequestOptions<unknown> = {
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
      mockFetch(createMockResponse({ json: async () => mockResponse }));

      const file1 = new File(['content1'], 'file1.txt', { type: 'text/plain' });
      const file2 = new File(['content2'], 'file2.txt', { type: 'text/plain' });

      const options: CdeebeeRequestOptions<unknown> = {
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
      mockFetch(createMockResponse({ json: async () => mockResponse }));

      const file = new File(['content'], 'file.txt', { type: 'text/plain' });

      const options: CdeebeeRequestOptions<unknown> = {
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
      const mockResponse = createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

      const options: CdeebeeRequestOptions<unknown> = {
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

      const options: CdeebeeRequestOptions<unknown> = {
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

      const options: CdeebeeRequestOptions<unknown> = {
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

      const options: CdeebeeRequestOptions<unknown> = {
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
      mockFetch(createMockResponse({ json: async () => mockResponse }));

      const options: CdeebeeRequestOptions<unknown> = {
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
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({
          json: async () => mockResponse,
        })
      );

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/test',
        onResult,
      };

      await dispatch(request(options));

      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith(mockResponse);
    });

    it('should not call onResult when it is not provided', async () => {
      const mockResponse = { data: 'test' };
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({
          json: async () => mockResponse,
        })
      );

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/test',
      };

      await dispatch(request(options));

      // No error should occur when onResult is not provided
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should call onResult with error result when request fails', async () => {
      const onResult = vi.fn();
      const errorResponse = { error: 'Not found' };
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 404,
          contentType: 'application/json',
          json: async () => errorResponse,
        })
      );

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/test',
        onResult,
      };

      await dispatch(request(options));

      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith(errorResponse);
    });
  });

  describe('ignore option', () => {
    it('should not store result in storage when ignore is true', async () => {
      settings.modules = ['history', 'listener', 'storage', 'cancelation'];
      store = createTestStore(settings);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatch = store.dispatch as any;

      const mockResponse = { user: { id: 1, name: 'Test' } };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({
          contentType: 'application/json',
          json: async () => mockResponse,
        })
      );

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/user',
        ignore: true,
      };

      await dispatch(request(options));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state = (store.getState() as any).cdeebee;
      expect(state.storage).toEqual({});
    });

    it('should still call onResult when ignore is true', async () => {
      const onResult = vi.fn();
      const mockResponse = { data: 'test' };
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({
          contentType: 'application/json',
          json: async () => mockResponse,
        })
      );

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/test',
        ignore: true,
        onResult,
      };

      await dispatch(request(options));

      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith(mockResponse);
    });
  });

  describe('responseType option', () => {
    it('should use json by default', async () => {
      const jsonData = { id: 1, name: 'Test' };
      mockFetch(createMockResponse({ json: async () => jsonData }));

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/test',
      };

      const result = await dispatch(request(options));

      expect(result.type).toBe('cdeebee/request/fulfilled');
      if (result.type === 'cdeebee/request/fulfilled' && 'payload' in result) {
        expect(result.payload.result).toEqual(jsonData);
      }
    });

    it('should use text when responseType is text', async () => {
      const textData = 'CSV data here';
      mockFetch(createMockResponse({ text: async () => textData }));

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/export',
        responseType: 'text',
      };

      const result = await dispatch(request(options));

      expect(result.type).toBe('cdeebee/request/fulfilled');
      if (result.type === 'cdeebee/request/fulfilled' && 'payload' in result) {
        expect(result.payload.result).toBe(textData);
      }
    });

    it('should use blob when responseType is blob', async () => {
      const blobData = new Blob(['binary data'], { type: 'image/png' });
      mockFetch(createMockResponse({ blob: async () => blobData }));

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/image',
        responseType: 'blob',
      };

      const result = await dispatch(request(options));

      expect(result.type).toBe('cdeebee/request/fulfilled');
      if (result.type === 'cdeebee/request/fulfilled' && 'payload' in result) {
        expect(result.payload.result).toBe(blobData);
      }
    });

    it('should use json when responseType is json explicitly', async () => {
      const jsonData = { data: 'test' };
      mockFetch(createMockResponse({ json: async () => jsonData }));

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/test',
        responseType: 'json',
      };

      const result = await dispatch(request(options));

      expect(result.type).toBe('cdeebee/request/fulfilled');
      if (result.type === 'cdeebee/request/fulfilled' && 'payload' in result) {
        expect(result.payload.result).toEqual(jsonData);
      }
    });

    it('should call onResult with correct type based on responseType', async () => {
      const textData = 'CSV content';
      const onResult = vi.fn();
      mockFetch(createMockResponse({ text: async () => textData }));

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/export',
        responseType: 'text',
        onResult,
      };

      await dispatch(request(options));

      expect(onResult).toHaveBeenCalledWith(textData);
    });
  });

  describe('mergeWithHeaders', () => {
    it('should merge headers from settings with request headers', async () => {
      const mockResponse = { data: 'test' };
      mockFetch(createMockResponse({ json: async () => mockResponse }));

      settings.mergeWithHeaders = { 'X-Custom-Header': 'from-settings', 'X-Another': 'settings-value' };

      store = createTestStore(settings);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatch = store.dispatch as any;

      const options: CdeebeeRequestOptions<unknown> = {
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
      mockFetch(createMockResponse({ json: async () => mockResponse }));

      settings.mergeWithHeaders = { 'X-Settings-Header': 'settings-only' };

      store = createTestStore(settings);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatch = store.dispatch as any;

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/test',
      };

      await dispatch(request(options));

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].headers).toHaveProperty('X-Settings-Header', 'settings-only');
    });

    it('should handle empty mergeWithHeaders', async () => {
      const mockResponse = { data: 'test' };
      mockFetch(createMockResponse({ json: async () => mockResponse }));

      settings.mergeWithHeaders = {};

      store = createTestStore(settings);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatch = store.dispatch as any;

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/test',
        headers: { 'Authorization': 'Bearer token' },
      };

      await dispatch(request(options));

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].headers).toHaveProperty('Authorization', 'Bearer token');
    });

    it('should handle undefined mergeWithHeaders', async () => {
      const mockResponse = { data: 'test' };
      mockFetch(createMockResponse({ json: async () => mockResponse }));

      settings.mergeWithHeaders = undefined;

      store = createTestStore(settings);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatch = store.dispatch as any;

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/test',
        headers: { 'Authorization': 'Bearer token' },
      };

      await dispatch(request(options));

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].headers).toHaveProperty('Authorization', 'Bearer token');
    });
  });

  describe('edge cases', () => {
    it('should handle request without body', async () => {
      const mockResponse = { data: 'test' };
      mockFetch(createMockResponse({ json: async () => mockResponse }));

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/test',
        method: 'GET',
      };

      await dispatch(request(options));

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body).toEqual({ defaultKey: 'defaultValue' });
    });

    it('should handle response without content-type header', async () => {
      const mockResponse = { data: 'test' };
      const response = createMockResponse({ 
        json: async () => mockResponse,
        contentType: '', // Empty content-type
      });
      // Override headers.get to return null
      response.headers.get = () => null;
      mockFetch(response);

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/test',
      };

      const result = await dispatch(request(options));
      expect(result.type).toBe('cdeebee/request/fulfilled');
    });

    it('should call onResult with error in catch block', async () => {
      const onResult = vi.fn();
      const networkError = new Error('Network error');
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(networkError);

      const options: CdeebeeRequestOptions<unknown> = {
        api: '/api/test',
        onResult,
      };

      await dispatch(request(options));

      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith(networkError);
    });
  });
});

