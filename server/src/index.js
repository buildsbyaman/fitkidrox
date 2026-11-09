import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

import { createApp } from './app.js'
import { connectDb } from './db.js'
import { feeConfigured } from './lib/razorpay.js'

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

  // Ensure all existing verified paid participants have permanent bib numbers assigned
  const { backfillPaidBibNumbers } = await import('./lib/bib.js')
  const { Participant } = await import('./models/Participant.js')
  backfillPaidBibNumbers(Participant)
    .then((res) => {
      if (res && res.length > 0) {
        console.log(`Assigned bib numbers to ${res.length} existing paid participants.`)
      }
    })
    .catch((err) => console.error('Bib backfill error:', err.message))

  // Seed standard coupons for schools if none exist
  const { Coupon } = await import('./models/Coupon.js')
  Coupon.countDocuments()
    .then(async () => {
      const initialCoupons = [
        // School delegation coupons
        {
          code: 'AFFILIATE26',
          description: 'Partner School Delegation Rate (₹900 per student)',
          discountType: 'per_student_rate',
          discountValue: 900,
          applicableTo: 'schools',
          isActive: true,
        },
        {
          code: 'SPORTSWING',
          description: 'Institutional Sports Council Rate (₹700 per student)',
          discountType: 'per_student_rate',
          discountValue: 700,
          applicableTo: 'schools',
          isActive: true,
        },
        {
          code: 'VIDYALAYA',
          description: 'Subsidized Community School Rate (₹500 per student)',
          discountType: 'per_student_rate',
          discountValue: 500,
          applicableTo: 'schools',
          isActive: true,
        },
        {
          code: 'SCHOLARPASS',
          description: '100% Scholarship / Direct Delegation Pass (₹0 per student)',
          discountType: 'per_student_rate',
          discountValue: 0,
          applicableTo: 'schools',
          isActive: true,
        },
        // Individual parent registration coupons
        {
          code: 'EARLY125',
          description: 'Early Bird Discount (₹125 OFF)',
          discountType: 'fixed',
          discountValue: 125,
          applicableTo: 'individual',
          minPriorRegistrations: 0,
          isActive: true,
        },
        {
          code: 'SIBLING250',
          description: 'Sibling Discount (₹250 OFF on 2nd child onwards)',
          discountType: 'fixed',
          discountValue: 250,
          applicableTo: 'individual',
          minPriorRegistrations: 1,
          isActive: true,
        },
        {
          code: 'GROUP500',
          description: 'Group Discount (₹500 OFF on 5th child onwards)',
          discountType: 'fixed',
          discountValue: 500,
          applicableTo: 'individual',
          minPriorRegistrations: 4,
          isActive: true,
        },
        {
          code: 'FITKID100',
          description: 'FITKID Promo (₹100 OFF)',
          discountType: 'fixed',
          discountValue: 100,
          applicableTo: 'individual',
          minPriorRegistrations: 0,
          isActive: true,
        },
        {
          code: 'DRISHTI900',
          description: 'Special Parent Rate (₹900 per registration)',
          discountType: 'per_student_rate',
          discountValue: 900,
          applicableTo: 'individual',
          minPriorRegistrations: 0,
          isActive: true,
        },
      ]
      for (const c of initialCoupons) {
        await Coupon.updateOne(
          { code: c.code },
          { $setOnInsert: c },
          { upsert: true },
        )
      }
      console.log('Seeded / verified default discount coupons.')
    })
    .catch((err) => console.error('Coupon seed error:', err.message))
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

if (!feeConfigured()) {
  console.warn(
    'ENTRY_FEE_PAISE is missing or invalid — /api/create-order will refuse every order with a 503.',
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
