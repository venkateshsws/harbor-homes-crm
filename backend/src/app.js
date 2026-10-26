
import express from 'express'
import { dbState } from './config/db.js'
import { loadSession, verifyCsrf } from './middleware/auth.js'
import { authRouter } from './routes/auth.js'
import { leadsRouter } from './routes/leads.js'
import { usersRouter } from './routes/users.js'
import { companiesRouter } from './routes/companies.js'
import { campaignsRouter } from './routes/campaigns.js'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback')

  app.use(express.json({ limit: '1mb' }))

  // Backend and database health check
  app.get(['/api/health', '/api/backend/health'], (req, res) => {
    const database = dbState()
    const ok = database === 'connected'

    res.status(ok ? 200 : 503).json({
      success: ok,
      status: ok ? 'ok' : 'degraded',
      database,
    })
  })

  // Load session and verify CSRF tokens for API requests
  app.use('/api', loadSession, verifyCsrf)

  // API routes
  app.use('/api/auth', authRouter)
  app.use('/api/leads', leadsRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/companies', companiesRouter)
  app.use('/api/campaigns', campaignsRouter)

  // Handle unknown routes
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not found',
    })
  })

  // Centralized error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500

    if (status >= 500) {
      console.error(err)
    }

    res.status(status).json({
      success: false,
      error: status >= 500
        ? 'Internal server error'
        : err.message,
    })
  })

  return app
}
