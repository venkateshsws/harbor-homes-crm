import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { localDemoMiddleware } from './demo/demoApi.js'

function demoApiPlugin() {
  const attach = (server) => {
    server.middlewares.use(localDemoMiddleware())
  }
  return {
    name: 'harbor-frontend-data',
    enforce: 'pre',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), demoApiPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: false,
    allowedHosts: true,
  },
})
