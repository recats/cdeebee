import { describe, it, expect } from 'vitest';
import { CdeebeeRequestError, isAbortError, toRequestError } from '../../../lib/core/requestError';

const ctx = { api: '/x', requestID: 'r1' };

describe('CdeebeeRequestError', () => {
  it('carries kind, api, requestID, status, response', () => {
    const e = new CdeebeeRequestError({ kind: 'http', api: '/x', requestID: 'r1', status: 500, response: { m: 1 } });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('CdeebeeRequestError');
    expect(e.kind).toBe('http');
    expect(e.status).toBe(500);
    expect(e.response).toEqual({ m: 1 });
    expect(e.message).toBe('[cdeebee] http error on /x (500)');
  });

  it('isAbortError detects only abort kind', () => {
    expect(isAbortError(new CdeebeeRequestError({ kind: 'abort', ...ctx }))).toBe(true);
    expect(isAbortError(new CdeebeeRequestError({ kind: 'network', ...ctx }))).toBe(false);
    expect(isAbortError(new Error('x'))).toBe(false);
  });

  it('toRequestError passes CdeebeeRequestError through', () => {
    const e = new CdeebeeRequestError({ kind: 'parse', ...ctx });
    expect(toRequestError(e, ctx)).toBe(e);
  });

  it('toRequestError maps DOM AbortError to abort', () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError');
    const e = toRequestError(abort, ctx);
    expect(e.kind).toBe('abort');
    expect(e.api).toBe('/x');
  });

  it('toRequestError maps anything else to network and keeps the cause', () => {
    const cause = new TypeError('Failed to fetch');
    const e = toRequestError(cause, ctx);
    expect(e.kind).toBe('network');
    expect(e.cause).toBe(cause);
    expect(e.message).toContain('Failed to fetch');
  });
});
