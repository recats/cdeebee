export type CdeebeeModule = 'history' | 'listener' | 'storage' | 'cancelation';
export type CdeebeeStrategy = 'merge' | 'replace';

export type CdeebeeListStrategy<T> = Record<keyof T, CdeebeeStrategy>;

export interface CdeebeeSettings<T> {
  modules: CdeebeeModule[];
  fileKey: string;
  bodyKey: string;
  primaryKey: string;
  mergeWithData: unknown;
  listStrategy?: CdeebeeListStrategy<T>;
  normalize?: <T>(storage: CdeebeeState<T>, result: T, strategyList: CdeebeeListStrategy<T>) => T;
}

interface CdeebeeHistoryState {
  requestId: string, 
  api: string, 
  request: unknown,
}

export interface CdeebeeActiveRequest {
  api: string;
  requestId: string;
}

interface CdeebeeRequestState {
  active: CdeebeeActiveRequest[];
  errors: Record<string, CdeebeeHistoryState[]>;
  done: Record<string, CdeebeeHistoryState[]>;
}

export interface CdeebeeState<T> {
  settings: CdeebeeSettings<T>;
  storage: T;
  request: CdeebeeRequestState;
}

