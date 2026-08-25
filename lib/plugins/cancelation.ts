import type { CdeebeePlugin, CdeebeeRequestContext } from '../core/types';

export interface CdeebeeCancelationOptions {
  apiList?: string[];
  mode?: 'previous' | 'latest';
}

export function cancelation<S>(options: CdeebeeCancelationOptions = {}): CdeebeePlugin<S> {
  const mode = options.mode ?? 'previous';
  const inFlightMap = new Map<string, Set<CdeebeeRequestContext<S>>>();
  const applies = (api: string) => !options.apiList || options.apiList.includes(api);

  return {
    name: 'cancelation',
    onRequest: ctx => {
      if (!applies(ctx.api)) return;
      let inFlight = inFlightMap.get(ctx.api);
      if (!inFlight) { inFlight = new Set(); inFlightMap.set(ctx.api, inFlight); }
      if (inFlight.size > 0) {
        if (mode === 'latest') return false;
        inFlight.forEach(prev => prev.controller.abort());
        inFlight.clear();
      }
      inFlight.add(ctx);
    },
    onSettled: ctx => {
      const inFlight = inFlightMap.get(ctx.api);
      if (!inFlight) return;
      inFlight.delete(ctx);
      if (inFlight.size === 0) inFlightMap.delete(ctx.api);
    },
  };
}
