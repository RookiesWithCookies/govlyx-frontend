import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  define: {
    // sockjs-client (CommonJS) references Node's `global` — polyfill for browser
    global: "globalThis",
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080', 
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    },
  },
})