import mongoose from 'mongoose'
import { env } from './env.js'

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting']

export function redactUri(text) {
  let out = String(text ?? '')
  if (env.mongodbUri) out = out.split(env.mongodbUri).join('<MONGODB_URI>')
  return out.replace(/(mongodb(?:\+srv)?:\/\/)[^@\s/]+@/gi, '$1<credentials>@')
}

export async function connectDB() {
  if (!env.mongodbUri) {
    throw new Error('MONGODB_URI is not set. Copy backend/.env.example to backend/.env and set your Atlas connection string.')
  }
  await mongoose.connect(env.mongodbUri, {
    serverSelectionTimeoutMS: 10000,
    ...(env.mongodbDbName ? { dbName: env.mongodbDbName } : {}),
  })
  const { host, name } = mongoose.connection
  console.log(`MongoDB connected (host: ${host}, database: ${name}).`)

  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected.'))
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected.'))
  mongoose.connection.on('error', (err) => console.error(`MongoDB error: ${redactUri(err?.message)}`))
}

export async function disconnectDB() {
  await mongoose.disconnect()
}

export function dbState() {
  return STATES[mongoose.connection.readyState] ?? 'unknown'
}
