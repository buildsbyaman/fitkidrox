import mongoose from 'mongoose'

/**
 * Opens the Atlas connection. Resolves once the first handshake succeeds so
 * the caller can refuse to listen on a database-less server.
 */
export async function connectDb(uri) {
  mongoose.set('strictQuery', true)

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    heartbeatFrequencyMS: 10_000,
  })

  return mongoose.connection
}

export function dbStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting']
  return states[mongoose.connection.readyState] ?? 'unknown'
}
