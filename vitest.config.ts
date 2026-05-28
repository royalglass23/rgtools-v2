import { defineConfig, defaultExclude } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: [...defaultExclude, 'workers/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
