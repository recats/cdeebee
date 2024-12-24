import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
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
