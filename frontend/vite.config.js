
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { localDemoMiddleware } from './demo/demoApi.js'

function backendRoutes() {
  return [
    '/api/backend',
    '/api/auth',
    '/api/companies',
    '/api/users',
    '/api/leads',
    '/api/campaigns',
  ]
}

function demoApiPlugin({ routes, backendUrl }) {
  const isBackendRoute = (url = '') => {
    const pathname = url.split('?')[0]

    return routes.some(
      (route) =>
        pathname === route || pathname.startsWith(`${route}/`),
    )
  }

  const attach = (server) => {
    const demo = localDemoMiddleware({ backendUrl })

    server.middlewares.use((req, res, next) => {
      if (isBackendRoute(req.url)) {
        return next()
      }

      return demo(req, res, next)
    })
  }

  return {
    name: 'yahoo-crm-api-routing',
    enforce: 'pre',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'HH_')
  const backendUrl =
    env.HH_BACKEND_URL || 'http://127.0.0.1:5000'

  const routes = backendRoutes()

  const proxy = Object.fromEntries(
    routes.map((route) => [
      `^${route}(/|\\?|$)`,
      {
        target: backendUrl,
        changeOrigin: true,
        xfwd: true,
      },
    ]),
  )

  return {
    plugins: [
      react(),
      tailwindcss(),
      demoApiPlugin({ routes, backendUrl }),
    ],

    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: false,
      allowedHosts: true,
      proxy,
    },

    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: false,
      allowedHosts: true,
      proxy,
    },
  }
})
