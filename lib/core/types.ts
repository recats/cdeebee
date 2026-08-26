import type { EntityID } from '../utils/keyBy';
import type { CdeebeeRequestError } from './requestError';

export type { EntityID };

export type CdeebeeEntity = object;
export type CdeebeeList<E extends CdeebeeEntity = CdeebeeEntity> = Record<EntityID, E>;
export type CdeebeeStorage = Record<string, CdeebeeList>;
export type CdeebeeStorageShape<S> = { [K in keyof S]: Record<EntityID, object> };

export type EntityOf<L> = L extends Record<EntityID, infer E> ? E : never;
export type ListName<S> = Extract<keyof S, string>;

export type CdeebeeStrategy = 'upsert' | 'replaceList' | 'skip';
export type CdeebeeStrategyList<S> = Partial<Record<ListName<S>, CdeebeeStrategy>>;
export type CdeebeePrimaryKeyList<S> = { [K in ListName<S>]: Extract<keyof EntityOf<S[K]>, string> };
export type CdeebeeIndexList<S> = Partial<{ [K in ListName<S>]: Extract<keyof EntityOf<S[K]>, string>[] }>;

export interface CdeebeeListChange<E = CdeebeeEntity> {
  upsertList?: E[];
  removeIDList?: EntityID[];
  replaceList?: Record<EntityID, E>;
}
export type CdeebeeChangeSet<S> = { [K in ListName<S>]?: CdeebeeListChange<EntityOf<S[K]>> };

export interface CdeebeeChangedList<S> {
  listName: ListName<S>;
  entityIDList: EntityID[] | '*';
}

export interface CdeebeeCommitMeta {
  source: 'request' | 'set';
  api?: string;
  requestID?: string;
  label?: string;
}

export interface CdeebeeDependency<S> {
  listName: ListName<S>;
  entityID?: EntityID;
}

export interface CdeebeeActiveRequest {
  api: string;
  requestID: string;
}

export interface CdeebeeState<S> {
  storage: S;
  activeRequestList: CdeebeeActiveRequest[];
}

export interface CdeebeeSnapshot<S> {
  state: CdeebeeState<S>;
  pluginStateList: Record<string, unknown>;
}

export type CdeebeeErrorKind = 'http' | 'network' | 'abort' | 'parse';

export interface CdeebeeFetchSettings {
  baseUrl?: string;
  headerList?: Record<string, string> | (() => Record<string, string>);
  mergeWithData?: Record<string, unknown> | (() => Record<string, unknown>);
  fileKey?: string;
  bodyKey?: string;
  fetch?: typeof fetch;
}

export interface CdeebeeNormalizeContext<S> {
  storage: Readonly<S>;
  primaryKeyList: CdeebeePrimaryKeyList<S>;
  strategyList: CdeebeeStrategyList<S>;
  api: string;
  requestID: string;
}

export type CdeebeeNormalize<S, R = unknown> = (response: R, ctx: CdeebeeNormalizeContext<S>) => CdeebeeChangeSet<S>;

export type CdeebeeMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface CdeebeeRequestOptions<S, R = unknown, D = unknown> {
  api: string;
  data?: D;
  method?: CdeebeeMethod;
  headerList?: Record<string, string>;
  fileList?: File[];
  responseType?: 'json' | 'text' | 'blob';
  strategyList?: CdeebeeStrategyList<S>;
  normalize?: CdeebeeNormalize<S, R>;
  ignoreStorage?: boolean;
  signal?: AbortSignal;
  historyClear?: boolean;
  meta?: Record<string, unknown>;
}

export interface CdeebeeRequestContext<S> {
  requestID: string;
  api: string;
  url: string;
  method: CdeebeeMethod;
  data: unknown;
  headerList: Record<string, string>;
  meta: Record<string, unknown>;
  options: CdeebeeRequestOptions<S, unknown, unknown>;
  startedAt: number;
  attempt: number;
  controller: AbortController;
  response?: unknown;
  status?: number;
  error?: CdeebeeRequestError;
  changeSet?: CdeebeeChangeSet<S>;
  db: CdeebeeInstance<S>;
}

export interface CdeebeePlugin<S> {
  name: string;
  setup?: (db: CdeebeeInstance<S>) => void;
  onRequest?: (ctx: CdeebeeRequestContext<S>) => void | false | Promise<void | false>;
  onResponse?: (ctx: CdeebeeRequestContext<S>) => void | Promise<void>;
  onRetry?: (ctx: CdeebeeRequestContext<S>) => number | false;
  onError?: (ctx: CdeebeeRequestContext<S>) => void | Promise<void>;
  onSettled?: (ctx: CdeebeeRequestContext<S>) => void | Promise<void>;
  onCommit?: (changeSet: CdeebeeChangeSet<S>, meta: CdeebeeCommitMeta, changedList: CdeebeeChangedList<S>[]) => void;
  getState?: () => unknown;
}

export interface CdeebeeSettings<S> {
  fetch: CdeebeeFetchSettings;
  primaryKeyList: CdeebeePrimaryKeyList<S>;
  strategyList?: CdeebeeStrategyList<S>;
  indexList?: CdeebeeIndexList<S>;
  pluginList?: CdeebeePlugin<S>[];
  initialStorage?: Partial<S>;
  normalize?: CdeebeeNormalize<S>;
}

export type CdeebeeListener = () => void;

export interface CdeebeeInstance<S> {
  settings: CdeebeeSettings<S>;
  pluginList: CdeebeePlugin<S>[];
  getState: () => CdeebeeState<S>;
  getSnapshot: () => CdeebeeSnapshot<S>;
  getPlugin: <P extends CdeebeePlugin<S>>(name: string) => P | undefined;
  commit: (changeSet: CdeebeeChangeSet<S>, meta: CdeebeeCommitMeta) => CdeebeeChangedList<S>[];
  setEntity: <K extends ListName<S>>(
    listName: K,
    entityID: EntityID,
    patch: Partial<EntityOf<S[K]>> | ((prevEntity: EntityOf<S[K]> | undefined) => EntityOf<S[K]>),
  ) => void;
  removeEntityList: <K extends ListName<S>>(listName: K, entityIDList: EntityID[]) => void;
  clearList: <K extends ListName<S>>(listName: K) => void;
  replaceList: <K extends ListName<S>>(listName: K, entityRecord: Record<EntityID, EntityOf<S[K]>>) => void;
  subscribe: (listener: CdeebeeListener, dependencyList?: CdeebeeDependency<S>[]) => () => void;
  subscribeRequest: (listener: CdeebeeListener, apiList?: string[]) => () => void;
  getIndex: <K extends ListName<S>>(listName: K, fieldName: Extract<keyof EntityOf<S[K]>, string>, value: unknown) => ReadonlySet<EntityID>;
  request: <R = unknown, D = unknown>(options: CdeebeeRequestOptions<S, R, D>) => Promise<R>;
  flush: () => void;
}
