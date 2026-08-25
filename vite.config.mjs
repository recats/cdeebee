/// <reference types="vite/client" />
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ include: ['lib'], outDir: 'dist', rollupTypes: false })],
  build: {
    lib: {
      entry: { index: resolve(__dirname, 'lib/index.ts'), core: resolve(__dirname, 'lib/core.ts') },
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: { external: ['react'], output: { globals: { react: 'React' } } },
    sourcemap: true,
  },
});
