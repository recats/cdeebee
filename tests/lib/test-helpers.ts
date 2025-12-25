import { vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { factory } from '../../lib/reducer/index';
import { type CdeebeeSettings } from '../../lib/reducer/types';

// Mock fetch globally
global.fetch = vi.fn();

// Helper to create mock Response
export const createMockResponse = (options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  contentType?: string;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
  blob?: () => Promise<Blob>;
}): Response => {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    contentType = 'application/json',
    json = async () => ({}),
    text = async () => '',
    blob = async () => new Blob(),
  } = options;

  return {
    ok,
    status,
    statusText,
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'content-type') {
          return contentType;
        }
        return null;
      },
    },
    json,
    text,
    blob,
  } as unknown as Response;
};

// Helper to create store with proper middleware configuration for tests
export const createTestStore = <T = Record<string, unknown>>(
  customSettings?: CdeebeeSettings<T>,
  initialStorage?: T
) => {
  const slice = factory(customSettings || ({} as CdeebeeSettings<T>), initialStorage);
  return configureStore({
    reducer: {
      cdeebee: slice.reducer as any,
    },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredPaths: ['cdeebee.settings.normalize'],
        },
      }),
  });
};

// Helper to mock fetch with response
export const mockFetch = (response: Response) => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(response);
};

// Helper to mock fetch with multiple responses
export const mockFetchMultiple = (responses: Response[]) => {
  responses.forEach(response => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(response);
  });
};

// Helper to mock fetch that always returns the same response
export const mockFetchAlways = (response: Response) => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);
};

// Default settings for tests
export const defaultTestSettings = <T = Record<string, unknown>>(
  overrides?: Partial<CdeebeeSettings<T>>
): CdeebeeSettings<T> => ({
  modules: ['history', 'listener', 'storage', 'cancelation'],
  fileKey: 'file',
  bodyKey: 'value',
  mergeWithData: {},
  mergeWithHeaders: {},
  listStrategy: {},
  ...overrides,
} as CdeebeeSettings<T>);

