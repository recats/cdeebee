export type CdeebeeModule = 'history' | 'listener' | 'storage' | 'cancelation' | 'queryQueue';
export type CdeebeeStrategy = 'merge' | 'replace' | 'skip';

export type CdeebeeListStrategy<T> = Record<keyof T, CdeebeeStrategy>;

export interface CdeebeeSettings<T> {
  modules: CdeebeeModule[];
  fileKey: string;
  bodyKey: string;
  mergeWithData: unknown;
  mergeWithHeaders: unknown;
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

export interface CdeebeeRequestOptions<T> extends Partial<Pick<CdeebeeSettings<T>, 'fileKey' | 'bodyKey' | 'normalize' | 'listStrategy'>> {
  api: string;
  files?: File[];
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  onResult?: (response: T) => void;
  ignore?: boolean;
  responseType?: 'json' | 'text' | 'blob';
}

type KeyOf<T> = Extract<keyof T, string | number>;
type Append<P extends readonly (string | number)[], K extends string | number> = [...P, K];
type IsArray<T> = T extends readonly unknown[] ? true : T extends unknown[] ? true : false;
type ArrayElement<T> = T extends readonly (infer U)[] ? U : T extends (infer U)[] ? U : never;
type Paths<T, P extends readonly (string | number)[] = []> =
  IsArray<T> extends true
    ? P | Paths<ArrayElement<T>, Append<P, number>>
    : T extends object
      ? { [K in KeyOf<T>]: Paths<T[K], Append<P, K>> }[KeyOf<T>]
      : P;
type NonEmptyPaths<T> = Exclude<Paths<T>, []>;
type ValueAtPath<T, P extends readonly (string | number)[]> =
  P extends []
    ? T
    : P extends readonly [infer K, ...infer R]
      ? K extends keyof T
        ? ValueAtPath<T[K], Extract<R, readonly (string | number)[]>>
        : T extends readonly (infer U)[] | (infer U)[]
          ? K extends number | `${number}`
            ? ValueAtPath<U, Extract<R, readonly (string | number)[]>>
            : never
          : never
      : never;

export type CdeebeeValueItem<T> =
  NonEmptyPaths<T> extends infer P
    ? P extends readonly (string | number)[]
      ? { key: P; value: ValueAtPath<T, P> }
      : never
    : never;

export type CdeebeeValueList<T> = ReadonlyArray<CdeebeeValueItem<T>>;
