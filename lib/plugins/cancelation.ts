import type { CdeebeePlugin, CdeebeeRequestContext } from '../core/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- allow unparameterized options to be passed to a typed store
export interface CdeebeeCancelationOptions<S = any> {
  apiList?: string[];
  mode?: 'previous' | 'latest';
  /** Independent cancellation scopes; defaults to ctx.api. */
  key?: (ctx: CdeebeeRequestContext<S>) => string;
}

export function cancelation<S>(options: CdeebeeCancelationOptions<S> = {}): CdeebeePlugin<S> {
  const mode = options.mode ?? 'previous';
  const inFlightMap = new Map<string, CdeebeeRequestContext<S>>();
  const keyByRequest = new WeakMap<object, string>();
  const applies = (api: string) => !options.apiList || options.apiList.includes(api);

  return {
    name: 'cancelation',
    onReset: () => inFlightMap.clear(),
    onRequest: ctx => {
      if (!applies(ctx.api)) return;
      const key = options.key?.(ctx) ?? ctx.api;
      const previous = inFlightMap.get(key);
      if (previous && !previous.controller.signal.aborted && mode === 'latest') return false;
      keyByRequest.set(ctx, key);
      inFlightMap.set(key, ctx);
      previous?.controller.abort();
    },
    onSettled: ctx => {
      const key = keyByRequest.get(ctx);
      if (key === undefined) return;
      keyByRequest.delete(ctx);
      if (inFlightMap.get(key) === ctx) inFlightMap.delete(key);
    },
  };
}
