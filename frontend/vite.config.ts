import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 8888,
    strictPort: true,
    proxy: {
      // 开发期将 /api 代理到后端，免 CORS
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // React 运行时与路由单独成 chunk
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('react-router')) return 'vendor'
          return undefined
        },
      },
    },
  },
})
