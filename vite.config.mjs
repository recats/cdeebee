import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'cdeebee',
      fileName: 'cdeebee',
    },
    outDir: 'dist',
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
