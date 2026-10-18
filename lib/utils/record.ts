/** A JSON-serializable dictionary with no inherited entity IDs or API names. */
export function createRecord<T>(source?: Record<string, T>): Record<string, T> {
  // Starting with an ordinary spread preserves V8's fast numeric-key copy path.
  // A null-prototype object literal makes repeated 10k-row copies hundreds of times slower.
  return Object.setPrototypeOf({ ...source }, null);
}
