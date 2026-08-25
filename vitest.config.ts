import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.d.ts', 'lib/**/types.ts', 'tests/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './lib'),
    },
  },
});

