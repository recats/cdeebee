import { vi } from 'vitest';

export interface MockResponseInit {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
  blob?: () => Promise<Blob>;
}

export const createMockResponse = (init: MockResponseInit = {}): Response => {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    json = async () => ({}),
    text = async () => '',
    blob = async () => new Blob(),
  } = init;
  return { ok, status, statusText, json, text, blob, headers: new Headers() } as unknown as Response;
};

export const jsonResponse = (body: unknown, init: Omit<MockResponseInit, 'json'> = {}): Response => (
  createMockResponse({ ...init, json: async () => body, text: async () => JSON.stringify(body) })
);

/** fetch mock returning responses in order; last one repeats. Records calls in `.mock.calls`. */
export const mockFetch = (responseList: Array<Response | Error>) => {
  let index = 0;
  return vi.fn(async (_url: string, _init?: RequestInit) => {
    const item = responseList[Math.min(index, responseList.length - 1)];
    index += 1;
    if (item instanceof Error) throw item;
    return item;
  }) as unknown as typeof fetch & { mock: { calls: Array<[string, RequestInit]> } };
};

export const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

export const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
