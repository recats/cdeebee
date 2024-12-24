/// <reference types="vite/client" />

import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({ include: ['lib'] }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'lib/index.ts'),
      name: 'cdeebee',
      fileName: 'cdeebee',
    },
    rollupOptions: {
      external: ['redux'],
      output: {
        globals: {
          redux: 'redux',
        },
      },
    },
  },
})
