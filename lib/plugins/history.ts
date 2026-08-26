import { RequestSubscriptionManager } from '../core/subscription';
import { extractResultIDList } from '../core/normalize';
import type { CdeebeeErrorKind, CdeebeeListener, CdeebeePlugin, CdeebeeRequestContext, EntityID } from '../core/types';

export interface CdeebeeHistoryError {
  kind: CdeebeeErrorKind;
  message: string;
  status?: number;
  response?: unknown;
}

export interface CdeebeeHistoryEntry {
  requestID: string;
  api: string;
  startedAt: number;
  endedAt: number;
  response?: unknown;
  error?: CdeebeeHistoryError;
}

export interface CdeebeeHistoryState {
  doneList: Record<string, CdeebeeHistoryEntry[]>;
  errorList: Record<string, CdeebeeHistoryEntry[]>;
  lastResultIDList: Record<string, Record<string, EntityID[]>>;
}

export interface CdeebeeHistoryOptions {
  /** entries kept per api; defaults to 20. `0` or `Infinity` keeps every entry */
  maxHistorySize?: number;
  /** skip recording requests that ended with `kind: 'abort'`; defaults to true */
  ignoreAbort?: boolean;
}

const DEFAULT_MAX_HISTORY_SIZE = 20;

export interface CdeebeeHistoryPlugin<S> extends CdeebeePlugin<S> {
  name: 'history';
  getState: () => CdeebeeHistoryState;
  subscribe: (listener: CdeebeeListener, apiList?: string[]) => () => void;
  clear: (api?: string) => void;
  /** The newest successful entry for `api`, or `undefined`. */
  getLast: (api: string) => CdeebeeHistoryEntry | undefined;
}

const append = (
  record: Record<string, CdeebeeHistoryEntry[]>,
  api: string,
  entry: CdeebeeHistoryEntry,
  max: number | undefined,
): Record<string, CdeebeeHistoryEntry[]> => {
  let entryList = [...(record[api] ?? []), entry];
  if (max && Number.isFinite(max) && entryList.length > max) entryList = entryList.slice(-max);
  return { ...record, [api]: entryList };
};

const omitKey = <V>(record: Record<string, V>, key: string): Record<string, V> => {
  const next = { ...record };
  delete next[key];
  return next;
};

export function history<S>(options: CdeebeeHistoryOptions = {}): CdeebeeHistoryPlugin<S> {
  let state: CdeebeeHistoryState = { doneList: {}, errorList: {}, lastResultIDList: {} };
  const subscriptionManager = new RequestSubscriptionManager();
  const maxHistorySize = options.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE;
  const ignoreAbort = options.ignoreAbort ?? true;

  const onSettled = (ctx: CdeebeeRequestContext<S>) => {
    const base = { requestID: ctx.requestID, api: ctx.api, startedAt: ctx.startedAt, endedAt: Date.now() };
    if (ctx.error) {
      if (ignoreAbort && ctx.error.kind === 'abort') return;
      const { kind, message, status, response } = ctx.error;
      state = { ...state, errorList: append(state.errorList, ctx.api, { ...base, error: { kind, message, status, response } }, maxHistorySize) };
    } else {
      const lastResultIDList = ctx.changeSet === undefined
        ? state.lastResultIDList
        : { ...state.lastResultIDList, [ctx.api]: extractResultIDList(ctx.changeSet, ctx.db.settings.primaryKeyList) };
      state = {
        ...state,
        doneList: append(state.doneList, ctx.api, { ...base, response: ctx.response }, maxHistorySize),
        lastResultIDList,
      };
    }
    subscriptionManager.notify(ctx.api);
  };

  const clear = (api?: string) => {
    if (api === undefined) {
      const apiList = new Set([...Object.keys(state.doneList), ...Object.keys(state.errorList)]);
      state = { doneList: {}, errorList: {}, lastResultIDList: {} };
      apiList.forEach(q => subscriptionManager.notify(q));
      return;
    }
    if (!(api in state.doneList) && !(api in state.errorList) && !(api in state.lastResultIDList)) return;
    state = {
      doneList: omitKey(state.doneList, api),
      errorList: omitKey(state.errorList, api),
      lastResultIDList: omitKey(state.lastResultIDList, api),
    };
    subscriptionManager.notify(api);
  };

  return {
    name: 'history',
    onRequest: ctx => {
      if (ctx.options.historyClear) clear(ctx.api);
    },
    onSettled,
    getState: () => state,
    getLast: api => {
      const entryList = state.doneList[api];
      return entryList === undefined ? undefined : entryList[entryList.length - 1];
    },
    subscribe: (listener, apiList) => subscriptionManager.subscribe(listener, apiList),
    clear,
  };
}
