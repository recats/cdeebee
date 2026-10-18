import type { CdeebeeRequestError } from '../core/requestError';
import type { CdeebeePlugin } from '../core/types';

export interface CdeebeeRetryOptions {
  count: number;
  backoffMs?: number | ((attempt: number) => number);
  when?: (error: CdeebeeRequestError) => boolean;
}

export function retry<S>(options: CdeebeeRetryOptions): CdeebeePlugin<S> {
  if (!Number.isSafeInteger(options.count) || options.count < 0) throw new RangeError('[cdeebee] retry count must be a non-negative safe integer');
  const when = options.when ?? (error => error.kind === 'network');
  const backoff = options.backoffMs ?? 0;
  if (typeof backoff === 'number' && (!Number.isFinite(backoff) || backoff < 0)) throw new RangeError('[cdeebee] retry delay must be a finite non-negative number');

  return {
    name: 'retry',
    onRetry: ctx => {
      if (!ctx.error || ctx.attempt >= options.count || !when(ctx.error)) return false;
      return typeof backoff === 'function' ? backoff(ctx.attempt) : backoff;
    },
  };
}
