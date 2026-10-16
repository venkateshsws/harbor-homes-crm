import { fileURLToPath } from 'node:url'
import path from 'node:path'
import dotenv from 'dotenv'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true })

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT) || 5000,
  mongodbUri: process.env.MONGODB_URI?.trim() || '',
  mongodbDbName: process.env.MONGODB_DB_NAME?.trim() || '',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS) > 0 ? Number(process.env.SESSION_TTL_HOURS) : 12,
}
