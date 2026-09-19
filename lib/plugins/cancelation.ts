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
  const inFlightMap = new Map<string, Set<CdeebeeRequestContext<S>>>();
  const keyByRequest = new WeakMap<object, string>();
  const applies = (api: string) => !options.apiList || options.apiList.includes(api);

  return {
    name: 'cancelation',
    onReset: () => inFlightMap.clear(),
    onRequest: ctx => {
      if (!applies(ctx.api)) return;
      const key = options.key?.(ctx) ?? ctx.api;
      keyByRequest.set(ctx, key);
      let inFlight = inFlightMap.get(key);
      if (!inFlight) { inFlight = new Set(); inFlightMap.set(key, inFlight); }
      if (inFlight.size > 0) {
        if (mode === 'latest') return false;
        inFlight.forEach(prev => prev.controller.abort());
        inFlight.clear();
      }
      inFlight.add(ctx);
    },
    onSettled: ctx => {
      const key = keyByRequest.get(ctx);
      if (key === undefined) return;
      keyByRequest.delete(ctx);
      const inFlight = inFlightMap.get(key);
      if (!inFlight) return;
      inFlight.delete(ctx);
      if (inFlight.size === 0) inFlightMap.delete(key);
    },
  };
}
