// Read-only MongoDB Atlas connectivity check.
// Connects with MONGODB_URI, sends a `ping`, and disconnects. Defines no models,
// creates no collections, and writes no data.
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true })

const uri = process.env.MONGODB_URI?.trim()

function redact(text) {
  let out = String(text ?? '')
  if (uri) out = out.split(uri).join('<MONGODB_URI>')
  return out.replace(/(mongodb(?:\+srv)?:\/\/)[^@\s/]+@/gi, '$1<credentials>@')
}

async function main() {
  if (!uri) {
    console.error('FAILED: MONGODB_URI is not set. Copy backend/.env.example to backend/.env and set your Atlas connection string.')
    return 1
  }
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    console.error('FAILED: MONGODB_URI must start with mongodb+srv:// or mongodb://')
    return 1
  }
  if (/<(username|password|cluster-host|database)>/.test(uri)) {
    console.error('FAILED: MONGODB_URI still contains placeholder values from .env.example.')
    return 1
  }

  mongoose.set('bufferCommands', false)
  mongoose.set('autoCreate', false)
  mongoose.set('autoIndex', false)

  console.log('Connecting to MongoDB Atlas...')
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
    await mongoose.connection.db.admin().command({ ping: 1 })
    const { host, name } = mongoose.connection
    console.log(`SUCCESS: Connected to MongoDB and ping succeeded (host: ${host}, database: ${name}).`)
    return 0
  } catch (err) {
    console.error(`FAILED: Could not connect to MongoDB (${err?.name ?? 'Error'}).`)
    console.error(`Reason: ${redact(err?.message)}`)
    return 1
  } finally {
    await mongoose.disconnect().catch(() => {})
    console.log('Disconnected.')
  }
}

process.exitCode = await main()
