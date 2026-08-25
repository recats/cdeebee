import { describe, it, expect } from 'vitest';
import { generateRequestID } from '../../../lib/utils/requestID';

describe('generateRequestID', () => {
  it('returns unique non-empty strings', () => {
    const a = generateRequestID();
    const b = generateRequestID();
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});
