export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;

  if (aIsArray && bIsArray) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!Object.is(a[i], b[i])) return false;
    }
    return true;
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeyList = Object.keys(aRecord);
  if (aKeyList.length !== Object.keys(bRecord).length) return false;
  for (let i = 0; i < aKeyList.length; i += 1) {
    const key = aKeyList[i];
    if (!Object.prototype.hasOwnProperty.call(bRecord, key) || !Object.is(aRecord[key], bRecord[key])) return false;
  }
  return true;
}
