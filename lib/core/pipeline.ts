import { generateRequestID } from '../utils/requestID';
import { abortable } from './abort';
import { buildUrl, executeFetch, resolveData, resolveHeaderList } from './fetchClient';
import { defaultNormalize } from './normalize';
import { CdeebeeRequestError, toRequestError } from './requestError';
import type { CdeebeeInternal } from './createCdeebee';
import type { CdeebeeInstance, CdeebeeNormalize, CdeebeePlugin, CdeebeeRequestContext, CdeebeeRequestOptions, CdeebeeStrategyList } from './types';

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException('aborted', 'AbortError')); return; }
  if (ms <= 0) { resolve(); return; }
  const onAbort = () => {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
    reject(new DOMException('aborted', 'AbortError'));
  };
  const timer = setTimeout(() => {
    signal.removeEventListener('abort', onAbort);
    resolve();
  }, ms);
  signal.addEventListener('abort', onAbort, { once: true });
});

const abortError = (ctx: { api: string; requestID: string }, message?: string, cause?: unknown) => (
  new CdeebeeRequestError({ kind: 'abort', api: ctx.api, requestID: ctx.requestID, message, cause })
);

const runIsolated = async <S>(plugin: CdeebeePlugin<S>, hook: 'onError' | 'onSettled', ctx: CdeebeeRequestContext<S>): Promise<void> => {
  try {
    await plugin[hook]?.(ctx);
  } catch (error) {
    console.error(`[cdeebee] plugin "${plugin.name}" ${hook} failed`, error);
  }
};

const pluginError = <S>(error: unknown, plugin: CdeebeePlugin<S>, hook: 'onRequest' | 'onResponse' | 'onRetry', ctx: CdeebeeRequestContext<S>) => (
  toRequestError(error, ctx, 'plugin', `plugin "${plugin.name}" ${hook}`)
);

async function fetchWithRetry<S>(ctx: CdeebeeRequestContext<S>, db: CdeebeeInstance<S>): Promise<void> {
  for (;;) {
    if (ctx.controller.signal.aborted) throw abortError(ctx);
    try {
      const { response, status } = await abortable(executeFetch(ctx, db.settings.fetch), ctx.controller.signal);
      ctx.response = response;
      ctx.status = status;
      return;
    } catch (error) {
      const requestError = toRequestError(error, ctx);
      if (ctx.controller.signal.aborted) throw abortError(ctx, undefined, error);
      if (requestError.kind === 'abort' || requestError.kind === 'request') throw requestError;
      ctx.error = requestError;
      let delay: number | false = false;
      for (let i = 0; i < db.pluginList.length; i += 1) {
        const plugin = db.pluginList[i];
        let result: number | false | undefined;
        try {
          result = plugin.onRetry?.(ctx);
          if (typeof result === 'number' && (!Number.isFinite(result) || result < 0)) {
            throw new RangeError('retry delay must be a finite non-negative number', { cause: error });
          }
        } catch (error) {
          throw pluginError(error, plugin, 'onRetry', ctx);
        }
        if (ctx.controller.signal.aborted) throw abortError(ctx);
        if (typeof result === 'number') { delay = result; break; }
      }
      if (delay === false) throw requestError;
      ctx.error = undefined;
      ctx.attempt += 1;
      await sleep(delay, ctx.controller.signal);
    }
  }
}

export async function runRequest<S, R, D>(
  db: CdeebeeInstance<S>,
  internal: CdeebeeInternal,
  options: CdeebeeRequestOptions<S, R, D>,
): Promise<R> {
  const { settings, pluginList } = db;
  const requestID = generateRequestID();
  const generation = internal.getGeneration();
  const controller = new AbortController();
  let detachSignal: () => void = () => {};
  const externalSignal = options.signal;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else {
      const onAbort = () => controller.abort();
      externalSignal.addEventListener('abort', onAbort, { once: true });
      detachSignal = () => externalSignal.removeEventListener('abort', onAbort);
    }
  }

  const ctx: CdeebeeRequestContext<S> = {
    requestID,
    seq: internal.nextSeq(),
    api: options.api,
    url: options.api,
    method: options.method ?? 'POST',
    data: options.data,
    headerList: {},
    meta: options.meta ?? {},
    options: options as CdeebeeRequestOptions<S, unknown, unknown>,
    startedAt: Date.now(),
    attempt: 0,
    controller,
    db,
  };

  internal.addActiveRequest(ctx.api, requestID, controller);
  let settled = false;
  const settle = async () => {
    if (settled) return;
    settled = true;
    detachSignal();
    internal.removeActiveRequest(ctx.api, requestID);
    try {
      for (let i = 0; i < pluginList.length && generation === internal.getGeneration(); i += 1) await runIsolated(pluginList[i], 'onSettled', ctx);
    } finally {
      internal.finishRequest(requestID);
    }
  };

  try {
    if (controller.signal.aborted) throw abortError(ctx);
    try {
      ctx.url = buildUrl(settings.fetch.baseUrl, options.api);
      ctx.data = resolveData(settings.fetch, options.data);
      ctx.headerList = resolveHeaderList(settings.fetch, options.headerList);
    } catch (error) {
      throw toRequestError(error, ctx, 'request');
    }
    if (controller.signal.aborted) throw abortError(ctx);
    for (let i = 0; i < pluginList.length; i += 1) {
      let result: void | false;
      try {
        result = await abortable(pluginList[i].onRequest?.(ctx), controller.signal);
      } catch (error) {
        throw pluginError(error, pluginList[i], 'onRequest', ctx);
      }
      if (result === false) throw abortError(ctx, `[cdeebee] request ${ctx.api} skipped by plugin "${pluginList[i].name}"`);
      if (controller.signal.aborted) throw abortError(ctx);
    }
    if (controller.signal.aborted) throw abortError(ctx);

    await fetchWithRetry(ctx, db);
    if (controller.signal.aborted) throw abortError(ctx);

    for (let i = 0; i < pluginList.length; i += 1) {
      try {
        await abortable(pluginList[i].onResponse?.(ctx), controller.signal);
      } catch (error) {
        throw pluginError(error, pluginList[i], 'onResponse', ctx);
      }
      if (controller.signal.aborted) throw abortError(ctx);
    }

    if (controller.signal.aborted) throw abortError(ctx);

    if (!options.ignoreStorage) {
      const normalize = (options.normalize ?? settings.normalize ?? defaultNormalize) as CdeebeeNormalize<S, unknown>;
      const strategyList = { ...(settings.strategyList ?? {}), ...(settings.apiStrategyList?.[ctx.api] ?? {}), ...(options.strategyList ?? {}) } as CdeebeeStrategyList<S>;
      try {
        ctx.changeSet = normalize(ctx.response, {
          storage: db.getState().storage,
          primaryKeyList: settings.primaryKeyList,
          strategyList,
          api: ctx.api,
          requestID,
        });
        if (controller.signal.aborted) throw abortError(ctx);
        db.commit(ctx.changeSet, { source: 'request', api: ctx.api, requestID, seq: ctx.seq, label: `request:${ctx.api}` });
      } catch (error) {
        throw toRequestError(error, ctx, 'normalize');
      }
    }

    await settle();
    if (generation !== internal.getGeneration()) throw abortError(ctx);
    return ctx.response as R;
  } catch (error) {
    ctx.error = controller.signal.aborted ? abortError(ctx, undefined, error) : toRequestError(error, ctx);
    if (!settled) {
      for (let i = 0; i < pluginList.length && generation === internal.getGeneration(); i += 1) await runIsolated(pluginList[i], 'onError', ctx);
    }
    await settle();
    throw ctx.error;
  }
}
