import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: mode === 'production'
    ? '/wp-content/plugins/rg-calculator/assets/'
    : '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'rg-calculator.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'rg-calculator.css'
          return '[name][extname]'
        },
      },
    },
  },
}))