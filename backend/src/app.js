import express from 'express'
import { dbState } from './config/db.js'
import { loadSession, verifyCsrf } from './middleware/auth.js'
import { authRouter } from './routes/auth.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  // The Vite dev server proxies from the same machine and sets X-Forwarded-For.
  app.set('trust proxy', 'loopback')
  app.use(express.json({ limit: '1mb' }))

  // /api/health stays with the frontend's demo API (Layout.jsx reads its `mode`);
  // the Vite dev server forwards /api/backend/* here.
  app.get(['/api/health', '/api/backend/health'], (req, res) => {
    const database = dbState()
    const ok = database === 'connected'
    res.status(ok ? 200 : 503).json({ success: ok, status: ok ? 'ok' : 'degraded', database })
  })

  app.use('/api', loadSession, verifyCsrf)
  app.use('/api/auth', authRouter)

  app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Not found' })
  })

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500
    if (status >= 500) console.error(err)
    res.status(status).json({ success: false, error: status >= 500 ? 'Internal server error' : err.message })
  })

  return app
}
