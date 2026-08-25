import { describe, it, expect } from 'vitest';
import { buildUrl, resolveHeaderList, resolveData, buildRequestInit, executeFetch, type FetchContext } from '../../../lib/core/fetchClient';
import { CdeebeeRequestError } from '../../../lib/core/requestError';
import { jsonResponse, createMockResponse, mockFetch } from '../test-helpers';

const baseCtx = (over: Partial<FetchContext> = {}): FetchContext => ({
  requestID: 'r1',
  method: 'POST' as const,
  data: { a: 1 },
  headerList: { 'X-Test': '1' },
  controller: new AbortController(),
  options: { api: '/x' },
  api: '/x',
  url: '/x',
  ...over,
});

describe('buildUrl', () => {
  it('joins baseUrl and api', () => {
    expect(buildUrl('https://h/api/', '/user/list')).toBe('https://h/api/user/list');
    expect(buildUrl('https://h/api', 'user/list')).toBe('https://h/api/user/list');
  });
  it('keeps absolute api and api without baseUrl', () => {
    expect(buildUrl('https://h', 'https://other/x')).toBe('https://other/x');
    expect(buildUrl(undefined, '/x')).toBe('/x');
  });
});

describe('resolveHeaderList / resolveData', () => {
  it('merges static settings with request values, request wins', () => {
    expect(resolveHeaderList({ headerList: { A: '1', B: '1' } }, { B: '2' })).toEqual({ A: '1', B: '2' });
    expect(resolveData({ mergeWithData: { token: 't', a: 0 } }, { a: 1 })).toEqual({ token: 't', a: 1 });
  });
  it('calls dynamic functions per request', () => {
    let n = 0;
    const settings = { headerList: () => ({ N: String(++n) }), mergeWithData: () => ({ n }) };
    expect(resolveHeaderList(settings)).toEqual({ N: '1' });
    expect(resolveHeaderList(settings)).toEqual({ N: '2' });
    expect(resolveData(settings, undefined)).toEqual({ n: 2 });
  });
  it('non-object data is passed through untouched', () => {
    expect(resolveData({ mergeWithData: { t: 1 } }, [1, 2])).toEqual([1, 2]);
  });
});

describe('buildRequestInit', () => {
  it('POST sends JSON body with content-type and ui-request-id', () => {
    const init = buildRequestInit(baseCtx(), {});
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect(init.headers).toEqual({ 'ui-request-id': 'r1', 'Content-Type': 'application/json', 'X-Test': '1' });
  });
  it('GET sends no body', () => {
    const init = buildRequestInit(baseCtx({ method: 'GET' }), {});
    expect(init.body).toBeUndefined();
  });
  it('fileList builds FormData without Content-Type', () => {
    const file = new File(['x'], 'x.txt');
    const init = buildRequestInit(baseCtx({ options: { api: '/x', fileList: [file] } }), { fileKey: 'file', bodyKey: 'value' });
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get('file')).toBe(file);
    expect(form.get('value')).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });
  it('passes the abort signal', () => {
    const ctx = baseCtx();
    expect(buildRequestInit(ctx, {}).signal).toBe(ctx.controller.signal);
  });
  it('ui-request-id cannot be overridden and Content-Type is stripped for FormData', () => {
    const file = new File(['x'], 'x.txt');
    const init = buildRequestInit(
      baseCtx({ headerList: { 'content-type': 'text/plain', 'ui-request-id': 'spoof' }, options: { api: '/x', fileList: [file] } }),
      {},
    );
    const headers = init.headers as Record<string, string>;
    expect(headers['ui-request-id']).toBe('r1');
    expect(Object.keys(headers).some(k => k.toLowerCase() === 'content-type')).toBe(false);
  });
  it('a caller may override Content-Type for JSON bodies', () => {
    const init = buildRequestInit(baseCtx({ headerList: { 'Content-Type': 'application/vnd.api+json' } }), {});
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/vnd.api+json');
  });
});

describe('executeFetch', () => {
  it('returns parsed json and status', async () => {
    const fetch = mockFetch([jsonResponse({ ok: 1 })]);
    const result = await executeFetch(baseCtx(), { fetch });
    expect(result).toEqual({ response: { ok: 1 }, status: 200 });
    expect(fetch.mock.calls[0][0]).toBe('/x');
  });
  it('text and blob response types', async () => {
    const text = await executeFetch(baseCtx({ options: { api: '/x', responseType: 'text' } }), { fetch: mockFetch([createMockResponse({ text: async () => 'hi' })]) });
    expect(text.response).toBe('hi');
    const blob = await executeFetch(baseCtx({ options: { api: '/x', responseType: 'blob' } }), { fetch: mockFetch([createMockResponse()]) });
    expect(blob.response).toBeInstanceOf(Blob);
  });
  it('http error: parsed body, kind http, status', async () => {
    const fetch = mockFetch([jsonResponse({ error: 'bad' }, { ok: false, status: 422, statusText: 'Unprocessable' })]);
    const error = await executeFetch(baseCtx(), { fetch }).catch(e => e);
    expect(error).toBeInstanceOf(CdeebeeRequestError);
    expect(error.kind).toBe('http');
    expect(error.status).toBe(422);
    expect(error.response).toEqual({ error: 'bad' });
  });
  it('http error with unparsable body keeps response undefined', async () => {
    const fetch = mockFetch([createMockResponse({ ok: false, status: 502, json: async () => { throw new Error('x'); } })]);
    const error = await executeFetch(baseCtx(), { fetch }).catch(e => e);
    expect(error.kind).toBe('http');
    expect(error.response).toBeUndefined();
  });
  it('parse error on ok response', async () => {
    const fetch = mockFetch([createMockResponse({ json: async () => { throw new SyntaxError('bad json'); } })]);
    const error = await executeFetch(baseCtx(), { fetch }).catch(e => e);
    expect(error.kind).toBe('parse');
  });
  it('network error', async () => {
    const error = await executeFetch(baseCtx(), { fetch: mockFetch([new TypeError('Failed to fetch')]) }).catch(e => e);
    expect(error.kind).toBe('network');
  });
  it('abort error', async () => {
    const error = await executeFetch(baseCtx(), { fetch: mockFetch([new DOMException('aborted', 'AbortError')]) }).catch(e => e);
    expect(error.kind).toBe('abort');
  });
  it('abort while parsing a non-ok body is reported as abort, not http', async () => {
    const fetch = mockFetch([createMockResponse({ ok: false, status: 500, json: async () => { throw new DOMException('aborted', 'AbortError'); } })]);
    const error = await executeFetch(baseCtx(), { fetch }).catch(e => e);
    expect(error.kind).toBe('abort');
  });
  it('uses global fetch when settings.fetch is missing', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = mockFetch([jsonResponse({ g: 1 })]);
    try {
      expect((await executeFetch(baseCtx(), {})).response).toEqual({ g: 1 });
    } finally {
      globalThis.fetch = original;
    }
  });
});
