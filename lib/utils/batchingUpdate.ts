import { isRecord } from './isRecord';

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

export function batchingUpdate<T extends Record<string, unknown>>(
  state: T,
  valueList: CdeebeeValueList<T>
): void {
  for (let i = 0; i < valueList.length; i++) {
    const item = valueList[i] as { key: readonly (string | number)[]; value: unknown };
    const path = item.key;
    const value = item.value;

    if (path.length === 0) {
      continue;
    }

    let current: Record<string, unknown> | unknown[] = state as Record<string, unknown>;

    for (let j = 0; j < path.length - 1; j++) {
      const pathKey = path[j];

      if (Array.isArray(current)) {
        const index = typeof pathKey === 'number' ? pathKey : Number(pathKey);
        if (!(index in current) || !isRecord(current[index])) {
          current[index] = {};
        }
        current = current[index] as Record<string, unknown>;
      } else {
        const key = String(pathKey);
        if (!(key in current)) {
          const nextIsNumeric = typeof path[j + 1] === 'number' || (!isNaN(Number(path[j + 1])) && String(Number(path[j + 1])) === String(path[j + 1]));
          current[key] = nextIsNumeric ? [] : {};
        }
        const next = current[key];
        current = (Array.isArray(next) ? next : (isRecord(next) ? next : {})) as Record<string, unknown> | unknown[];
      }
    }

    const lastKey = path[path.length - 1];
    if (Array.isArray(current)) {
      const index = typeof lastKey === 'number' ? lastKey : Number(lastKey);
      current[index] = value;
    } else {
      current[String(lastKey)] = value;
    }
  }
}
