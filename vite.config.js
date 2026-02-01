import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/scouter/',
  plugins: [react()],
  server: {
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        chunkFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        assetFileNames: `assets/[name]-[hash]-${Date.now()}.[ext]`
      }
    }
  }
})
