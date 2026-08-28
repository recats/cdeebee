import { generateRequestID } from '../utils/requestID';
import { buildUrl, executeFetch, resolveData, resolveHeaderList } from './fetchClient';
import { defaultNormalize } from './normalize';
import { CdeebeeRequestError, toRequestError } from './requestError';
import type { CdeebeeInternal } from './createCdeebee';
import type { CdeebeeInstance, CdeebeeNormalize, CdeebeePlugin, CdeebeeRequestContext, CdeebeeRequestOptions, CdeebeeStrategyList } from './types';

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (ms <= 0) { resolve(); return; }
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
});

const abortError = (ctx: { api: string; requestID: string }, message?: string) => (
  new CdeebeeRequestError({ kind: 'abort', api: ctx.api, requestID: ctx.requestID, message })
);

const runIsolated = async <S>(plugin: CdeebeePlugin<S>, hook: 'onError' | 'onSettled', ctx: CdeebeeRequestContext<S>): Promise<void> => {
  try {
    await plugin[hook]?.(ctx);
  } catch (error) {
    console.error(`[cdeebee] plugin "${plugin.name}" ${hook} failed`, error);
  }
};

async function fetchWithRetry<S>(ctx: CdeebeeRequestContext<S>, db: CdeebeeInstance<S>): Promise<void> {
  for (;;) {
    try {
      const { response, status } = await executeFetch(ctx, db.settings.fetch);
      ctx.response = response;
      ctx.status = status;
      return;
    } catch (error) {
      const requestError = toRequestError(error, ctx);
      if (requestError.kind === 'abort') throw requestError;
      ctx.error = requestError;
      let delay: number | false = false;
      for (let i = 0; i < db.pluginList.length; i += 1) {
        const result = db.pluginList[i].onRetry?.(ctx);
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
  const controller = new AbortController();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const ctx: CdeebeeRequestContext<S> = {
    requestID,
    seq: internal.nextSeq(),
    api: options.api,
    url: buildUrl(settings.fetch.baseUrl, options.api),
    method: options.method ?? 'POST',
    data: resolveData(settings.fetch, options.data),
    headerList: resolveHeaderList(settings.fetch, options.headerList),
    meta: options.meta ?? {},
    options: options as CdeebeeRequestOptions<S, unknown, unknown>,
    startedAt: Date.now(),
    attempt: 0,
    controller,
    db,
  };

  internal.addActiveRequest(ctx.api, requestID);
  let settled = false;
  const settle = async () => {
    if (settled) return;
    settled = true;
    internal.removeActiveRequest(ctx.api, requestID);
    for (let i = 0; i < pluginList.length; i += 1) await runIsolated(pluginList[i], 'onSettled', ctx);
  };

  try {
    if (controller.signal.aborted) throw abortError(ctx);
    for (let i = 0; i < pluginList.length; i += 1) {
      const result = await pluginList[i].onRequest?.(ctx);
      if (result === false) throw abortError(ctx, `[cdeebee] request ${ctx.api} skipped by plugin "${pluginList[i].name}"`);
    }
    if (controller.signal.aborted) throw abortError(ctx);

    await fetchWithRetry(ctx, db);

    for (let i = 0; i < pluginList.length; i += 1) {
      await pluginList[i].onResponse?.(ctx);
      if (controller.signal.aborted) throw abortError(ctx);
    }

    if (controller.signal.aborted) throw abortError(ctx);

    if (!options.ignoreStorage) {
      const normalize = (options.normalize ?? settings.normalize ?? defaultNormalize) as CdeebeeNormalize<S, unknown>;
      const strategyList = { ...(settings.strategyList ?? {}), ...(settings.apiStrategyList?.[ctx.api] ?? {}), ...(options.strategyList ?? {}) } as CdeebeeStrategyList<S>;
      ctx.changeSet = normalize(ctx.response, {
        storage: db.getState().storage,
        primaryKeyList: settings.primaryKeyList,
        strategyList,
        api: ctx.api,
        requestID,
      });
      db.commit(ctx.changeSet, { source: 'request', api: ctx.api, requestID, seq: ctx.seq, label: `request:${ctx.api}` });
    }

    await settle();
    return ctx.response as R;
  } catch (error) {
    ctx.error = toRequestError(error, ctx);
    if (!settled) {
      for (let i = 0; i < pluginList.length; i += 1) await runIsolated(pluginList[i], 'onError', ctx);
    }
    await settle();
    throw ctx.error;
  }
}
