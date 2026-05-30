import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  optimizeDeps: {
    include: ['vue', 'pinia', '@tauri-apps/api/core', '@tauri-apps/api/window', '@tauri-apps/plugin-dialog']
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'pinia'],
          tauri: ['@tauri-apps/api/core', '@tauri-apps/api/window', '@tauri-apps/api/event', '@tauri-apps/plugin-dialog']
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
})