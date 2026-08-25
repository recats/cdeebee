import type { CdeebeeRequestError } from '../core/requestError';
import type { CdeebeePlugin } from '../core/types';

export interface CdeebeeRetryOptions {
  count: number;
  backoffMs?: number | ((attempt: number) => number);
  when?: (error: CdeebeeRequestError) => boolean;
}

export function retry<S>(options: CdeebeeRetryOptions): CdeebeePlugin<S> {
  const when = options.when ?? (error => error.kind === 'network');
  const backoff = options.backoffMs ?? 0;

  return {
    name: 'retry',
    onRetry: ctx => {
      if (!ctx.error || ctx.attempt >= options.count || !when(ctx.error)) return false;
      return typeof backoff === 'function' ? backoff(ctx.attempt) : backoff;
    },
  };
}
