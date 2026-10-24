import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

import { createApp } from './app.js'
import { connectDb } from './db.js'

const MONGODB_URI = process.env.MONGODB_URI
const PORT = Number(process.env.PORT) || 4000
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

if (!MONGODB_URI) {
  console.error(
    'MONGODB_URI is not set. Copy server/.env.example to server/.env and fill it in.',
  )
  process.exit(1)
}
if (MONGODB_URI.includes('<db_password>')) {
  console.error(
    'MONGODB_URI still has the <db_password> placeholder. Fill in the real password first.',
  )
  process.exit(1)
}

try {
  await connectDb(MONGODB_URI)
  console.log('Connected to MongoDB.')
} catch (err) {
  console.error('Could not connect to MongoDB:', err.message)
  console.error(
    'Check the password, the database user, and the Atlas network access allowlist.',
  )
  process.exit(1)
}

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.warn(
    'ADMIN_EMAIL / ADMIN_PASSWORD are not set — /admin will refuse every login with a 503.',
  )
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDir = path.resolve(__dirname, '../../dist/client')
const serverEntry = path.resolve(__dirname, '../../dist/server/server.js')

let ssrHandler = null
if (existsSync(serverEntry)) {
  try {
    const mod = await import(serverEntry)
    ssrHandler = mod.default
    console.log('Loaded TanStack Start SSR bundle.')
  } catch (err) {
    console.warn('Could not load SSR bundle:', err.message)
  }
}

const app = createApp({
  adminEmail: ADMIN_EMAIL,
  adminPassword: ADMIN_PASSWORD,
  ssrHandler,
  clientDir,
})

app.listen(PORT, () => {
  console.log(`FITKIDROX app listening on http://localhost:${PORT}`)
})
