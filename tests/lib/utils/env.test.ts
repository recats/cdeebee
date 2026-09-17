import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDev } from '../../../lib/utils/env';

describe('isDev', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('is true unless NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isDev()).toBe(true);
    vi.stubEnv('NODE_ENV', 'production');
    expect(isDev()).toBe(false);
  });

  it('is false when process is not defined (plain browser)', () => {
    const saved = globalThis.process;
    Reflect.deleteProperty(globalThis, 'process');
    try {
      expect(isDev()).toBe(false);
    } finally {
      globalThis.process = saved;
    }
  });
});
