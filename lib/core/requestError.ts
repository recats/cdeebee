import type { CdeebeeErrorKind } from './types';

export interface CdeebeeRequestErrorInit {
  kind: CdeebeeErrorKind;
  api: string;
  requestID: string;
  message?: string;
  status?: number;
  response?: unknown;
  cause?: unknown;
}

export class CdeebeeRequestError extends Error {
  readonly kind: CdeebeeErrorKind;
  readonly api: string;
  readonly requestID: string;
  readonly status?: number;
  readonly response?: unknown;

  constructor(init: CdeebeeRequestErrorInit) {
    const suffix = init.status !== undefined ? ` (${init.status})` : '';
    super(init.message ?? `[cdeebee] ${init.kind} error on ${init.api}${suffix}`, { cause: init.cause });
    this.name = 'CdeebeeRequestError';
    this.kind = init.kind;
    this.api = init.api;
    this.requestID = init.requestID;
    this.status = init.status;
    this.response = init.response;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof CdeebeeRequestError && error.kind === 'abort';
}

export function toRequestError(error: unknown, ctx: { api: string; requestID: string }): CdeebeeRequestError {
  if (error instanceof CdeebeeRequestError) return error;
  if (error instanceof Error && error.name === 'AbortError') {
    return new CdeebeeRequestError({ kind: 'abort', api: ctx.api, requestID: ctx.requestID, cause: error });
  }
  const message = error instanceof Error ? error.message : String(error);
  return new CdeebeeRequestError({
    kind: 'network',
    api: ctx.api,
    requestID: ctx.requestID,
    message: `[cdeebee] network error on ${ctx.api}: ${message}`,
    cause: error,
  });
}
