export type CdeebeeModule = 'history' | 'listener' | 'state' | 'cancelation';
export type CdeebeeStrategy = 'merge' | 'replace';

export interface CdeebeeListStrategy {
  [key: string]: CdeebeeStrategy;
}

export interface CdeebeeSettings {
  modules: CdeebeeModule[];
  fileKey: string;
  bodyKey: string;
  primaryKey: string;
  mergeWithData: unknown;
  listStrategy: CdeebeeListStrategy;
}

interface CdeebeeHistoryState {
  requestId: string, 
  api: string, 
  settings: CdeebeeSettings,
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
  settings: CdeebeeSettings;
  state: T;
  request: CdeebeeRequestState;
}

