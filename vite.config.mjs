/// <reference types="vite/client" />

import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({ 
      include: ['lib'],
      outDir: 'dist',
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'lib/index.ts'),
      name: 'cdeebee',
      fileName: (format) => {
        if (format === 'es') return 'index.js';
        if (format === 'cjs') return 'index.cjs';
        return 'index.umd.js';
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['@reduxjs/toolkit', 'redux', 'react', 'react-redux'],
      output: {
        globals: {
          '@reduxjs/toolkit': 'ReduxToolkit',
          redux: 'Redux',
          react: 'React',
          'react-redux': 'ReactRedux',
        },
      },
    },
    sourcemap: true,
  },
})
