import { createSubscription } from '../core/subscription';
import { extractResultIDList } from '../core/normalize';
import { shallowEqual } from '../utils/shallowEqual';
import { createRecord } from '../utils/record';
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
  maxHistorySize?: number;
  ignoreAbort?: boolean;
}

const DEFAULT_MAX_HISTORY_SIZE = 20;

export interface CdeebeeHistoryPlugin<S> extends CdeebeePlugin<S> {
  name: 'history';
  getState: () => CdeebeeHistoryState;
  subscribe: (listener: CdeebeeListener, apiList?: string[]) => () => void;
  clear: (api?: string) => void;
  getLast: (api: string) => CdeebeeHistoryEntry | undefined;
}

const append = (
  record: Record<string, CdeebeeHistoryEntry[]>,
  api: string,
  entry: CdeebeeHistoryEntry,
  maxHistorySize: number,
): Record<string, CdeebeeHistoryEntry[]> => {
  let entryList = [...(record[api] ?? []), entry];
  if (maxHistorySize && Number.isFinite(maxHistorySize) && entryList.length > maxHistorySize) entryList = entryList.slice(-maxHistorySize);
  return Object.assign(createRecord(record), { [api]: entryList });
};

const omitKey = <V>(record: Record<string, V>, key: string): Record<string, V> => {
  const next = createRecord(record);
  delete next[key];
  return next;
};

const keepIDList = (prev: Record<string, EntityID[]> | undefined, next: Record<string, EntityID[]>): Record<string, EntityID[]> => {
  if (prev === undefined) return next;
  const listNameList = Object.keys(next);
  let same = listNameList.length === Object.keys(prev).length;
  for (let i = 0; i < listNameList.length; i += 1) {
    const listName = listNameList[i];
    const prevIDList = prev[listName];
    if (prevIDList !== undefined && shallowEqual(prevIDList, next[listName])) next[listName] = prevIDList;
    else same = false;
  }
  return same ? prev : next;
};

export function history<S>(options: CdeebeeHistoryOptions = {}): CdeebeeHistoryPlugin<S> {
  const emptyState = (): CdeebeeHistoryState => ({ doneList: createRecord(), errorList: createRecord(), lastResultIDList: createRecord() });
  let state = emptyState();
  const subscription = createSubscription();
  const maxHistorySize = options.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE;
  if (maxHistorySize !== Infinity && (!Number.isSafeInteger(maxHistorySize) || maxHistorySize < 0)) {
    throw new RangeError('[cdeebee] maxHistorySize must be a non-negative safe integer or Infinity');
  }
  const ignoreAbort = options.ignoreAbort ?? true;

  const onSettled = (ctx: CdeebeeRequestContext<S>) => {
    const base = { requestID: ctx.requestID, api: ctx.api, startedAt: ctx.startedAt, endedAt: Date.now() };
    if (ctx.error) {
      if (ignoreAbort && ctx.error.kind === 'abort') return;
      const { kind, message, status, response } = ctx.error;
      state = { ...state, errorList: append(state.errorList, ctx.api, { ...base, error: { kind, message, status, response } }, maxHistorySize) };
    } else {
      const resultIDList = ctx.changeSet === undefined ? undefined : extractResultIDList(ctx.changeSet, ctx.db.settings.primaryKeyList);
      const lastResultIDList = resultIDList === undefined || Object.keys(resultIDList).length === 0
        ? state.lastResultIDList
        : Object.assign(createRecord(state.lastResultIDList), { [ctx.api]: keepIDList(state.lastResultIDList[ctx.api], resultIDList) });
      state = {
        ...state,
        doneList: append(state.doneList, ctx.api, { ...base, response: ctx.response }, maxHistorySize),
        lastResultIDList,
      };
    }
    subscription.notify(ctx.api);
  };

  const clear = (api?: string) => {
    if (api === undefined) {
      const apiList = [...new Set([...Object.keys(state.doneList), ...Object.keys(state.errorList), ...Object.keys(state.lastResultIDList)])];
      state = emptyState();
      subscription.notify(apiList);
      return;
    }
    if (!(api in state.doneList) && !(api in state.errorList) && !(api in state.lastResultIDList)) return;
    state = {
      doneList: omitKey(state.doneList, api),
      errorList: omitKey(state.errorList, api),
      lastResultIDList: omitKey(state.lastResultIDList, api),
    };
    subscription.notify(api);
  };

  return {
    name: 'history',
    onReset: () => clear(),
    onRequest: ctx => {
      if (ctx.options.historyClear) clear(ctx.api);
    },
    onSettled,
    getState: () => state,
    getLast: api => {
      const entryList = state.doneList[api];
      return entryList === undefined ? undefined : entryList[entryList.length - 1];
    },
    subscribe: subscription.subscribe,
    clear,
  };
}
