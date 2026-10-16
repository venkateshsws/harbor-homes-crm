import { env } from './config/env.js'
import { connectDB, disconnectDB, redactUri } from './config/db.js'
import { createApp } from './app.js'

try {
  await connectDB()
} catch (err) {
  console.error(`Failed to connect to MongoDB: ${redactUri(err?.message)}`)
  process.exit(1)
}

const server = createApp().listen(env.port, env.host, () => {
  console.log(`Harbor Homes API listening on http://${env.host}:${env.port} (${env.nodeEnv})`)
})

server.on('error', async (err) => {
  console.error(`Server error: ${err.message}`)
  await disconnectDB().catch(() => {})
  process.exit(1)
})

let shuttingDown = false
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${signal} received, shutting down...`)
  server.close(async () => {
    await disconnectDB().catch(() => {})
    console.log('Shutdown complete.')
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
