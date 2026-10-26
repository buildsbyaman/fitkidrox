/**
 * Bib Number Generation and Heat/Course Calculation System for FITKIDROX
 *
 * Rules:
 * 1. Category-Based Bib Numbering: 4 digits.
 *    - First digit = Category Prefix.
 *    - Last 3 digits = Serial Number.
 * 2. Categories & Ranges:
 *    - Mini FITKIDROX (ages 3–5): Prefix 1, Range 1001–1250, Heat Size 8
 *    - Kids Fitness Challenge (ages 6–8): Prefix 2, Range 2001–2400, Heat Size 10
 *    - Athletic Challenge (ages 9–12): Prefix 3, Range 3001–3400, Heat Size 10
 *    - Performance FITKIDROX (ages 13+): Prefix 4, Range 4001–4200, Heat Size 8
 * 3. Reserved Numbers:
 *    - The last 50 numbers of each category range are reserved for late
 *      registrations and replacement bibs (per race plan).
 * 4. Heat and Course Calculation:
 *    - Serial = bibNumber % 1000
 *    - Heat = Math.ceil(serial / heatSize)
 *    - Odd Heat -> Course A, Even Heat -> Course B
 * 5. Concurrency Safe & Permanent:
 *    - Atomic duplicate-checked allocation backed by database unique constraint.
 *    - Stored permanently; never regenerated on fetch or update.
 */

export const DEFAULT_BIB_CONFIG = {
  'Mini FITKIDROX': {
    name: 'Mini FITKIDROX',
    ages: '3–5 years',
    prefix: 1,
    minBib: 1001,
    maxBib: 1250,
    reservedCount: 50,
    heatSize: 8,
  },
  'Kids Fitness Challenge': {
    name: 'Kids Fitness Challenge',
    ages: '6–8 years',
    prefix: 2,
    minBib: 2001,
    maxBib: 2400,
    reservedCount: 50,
    heatSize: 10,
  },
  'Athletic Challenge': {
    name: 'Athletic Challenge',
    ages: '9–12 years',
    prefix: 3,
    minBib: 3001,
    maxBib: 3400,
    reservedCount: 50,
    heatSize: 10,
  },
  'Performance FITKIDROX': {
    name: 'Performance FITKIDROX',
    ages: '13+ years',
    prefix: 4,
    minBib: 4001,
    maxBib: 4200,
    reservedCount: 50,
    heatSize: 8,
  },
}

let activeBibConfig = { ...DEFAULT_BIB_CONFIG }

export function getBibConfig() {
  return activeBibConfig
}

export function configureBibSystem(customConfig) {
  activeBibConfig = { ...DEFAULT_BIB_CONFIG, ...customConfig }
}

/**
 * Resolves category config from a category string or DOB.
 */
export function resolveCategoryConfig(categoryInput, dob) {
  if (categoryInput) {
    const s = String(categoryInput).toLowerCase().trim()
    for (const [key, cfg] of Object.entries(activeBibConfig)) {
      if (
        s === key.toLowerCase() ||
        s === cfg.name.toLowerCase() ||
        s.includes(key.toLowerCase()) ||
        s.startsWith(key.toLowerCase().slice(0, 4))
      ) {
        return cfg
      }
    }
    if (s.includes('mini') || s.includes('3–5') || s.includes('3-5')) {
      return activeBibConfig['Mini FITKIDROX']
    }
    if (s.includes('kids') || s.includes('6–8') || s.includes('6-8')) {
      return activeBibConfig['Kids Fitness Challenge']
    }
    if (s.includes('athletic') || s.includes('9–12') || s.includes('9-12')) {
      return activeBibConfig['Athletic Challenge']
    }
    if (s.includes('performance') || s.includes('13+') || s.includes('13')) {
      return activeBibConfig['Performance FITKIDROX']
    }
  }

  if (dob) {
    const birth = new Date(dob)
    if (!Number.isNaN(birth.getTime())) {
      const eventDate = new Date('2026-11-28')
      let age = eventDate.getFullYear() - birth.getFullYear()
      const m = eventDate.getMonth() - birth.getMonth()
      if (m < 0 || (m === 0 && eventDate.getDate() < birth.getDate())) age--

      if (age >= 3 && age <= 5) return activeBibConfig['Mini FITKIDROX']
      if (age >= 6 && age <= 8) return activeBibConfig['Kids Fitness Challenge']
      if (age >= 9 && age <= 12) return activeBibConfig['Athletic Challenge']
      if (age >= 13) return activeBibConfig['Performance FITKIDROX']
    }
  }

  return null
}

/**
 * Calculates heat and course for a given bib number.
 * Odd heat -> Course A, Even heat -> Course B.
 */
export function calculateHeatAndCourse(bibNumber, categoryOrConfig = null) {
  const num = Number(bibNumber)
  if (!Number.isFinite(num) || num < 1000) {
    throw new Error(`Invalid bib number: ${bibNumber}`)
  }

  const prefix = Math.floor(num / 1000)
  const serialNumber = num % 1000

  let cfg = null
  if (typeof categoryOrConfig === 'string') {
    cfg = resolveCategoryConfig(categoryOrConfig)
  } else if (
    categoryOrConfig &&
    typeof categoryOrConfig === 'object' &&
    categoryOrConfig.heatSize
  ) {
    cfg = categoryOrConfig
  }

  if (!cfg) {
    for (const item of Object.values(activeBibConfig)) {
      if (item.prefix === prefix) {
        cfg = item
        break
      }
    }
  }

  const heatSize = cfg?.heatSize || 10
  const categoryName = cfg?.name || `Category ${prefix}`

  const heat = Math.ceil(serialNumber / heatSize)
  const isOdd = heat % 2 !== 0
  const course = isOdd ? 'Course A' : 'Course B'
  const courseCode = isOdd ? 'A' : 'B'

  return {
    bibNumber: num,
    prefix,
    serialNumber,
    heat,
    heatSize,
    course,
    courseCode,
    categoryName,
  }
}

/**
 * Determines the next available serial bib number within the category.
 * Prevents exceeding limits and keeps the last 50 numbers reserved for late/replacements.
 */
export async function getNextAvailableBibNumber({
  category,
  dob,
  ParticipantModel,
  allowReserved = false,
}) {
  const cfg = resolveCategoryConfig(category, dob)
  if (!cfg) {
    throw new Error(
      `Could not determine valid category for bib allocation (category="${category}", dob="${dob}").`,
    )
  }

  const minBib = cfg.minBib
  const maxLimit = allowReserved ? cfg.maxBib : cfg.maxBib - cfg.reservedCount

  const allocated = await ParticipantModel.find({
    bibNumber: { $gte: minBib, $lte: cfg.maxBib },
  })
    .select('bibNumber')
    .lean()

  const allocatedSet = new Set(allocated.map((p) => p.bibNumber))

  for (let n = minBib; n <= maxLimit; n++) {
    if (!allocatedSet.has(n)) {
      return {
        bibNumber: n,
        config: cfg,
      }
    }
  }

  if (!allowReserved) {
    const err = new Error(
      `Category "${cfg.name}" standard capacity reached (${maxLimit - minBib + 1} allocated). Remaining ${cfg.reservedCount} numbers are reserved for late registrations and replacements.`,
    )
    err.code = 'BIB_CAPACITY_REACHED'
    throw err
  }

  const err = new Error(
    `Category "${cfg.name}" bib allocation is completely full (configured limit ${cfg.maxBib} reached).`,
  )
  err.code = 'BIB_RANGE_EXHAUSTED'
  throw err
}

/**
 * Concurrency-safe bib number assignment.
 * Assigns next available serial number, computes heat/course, and persists permanently.
 * Never overwrites or changes an already assigned bib number.
 */
export async function assignBibToParticipant(
  participantIdOrDoc,
  { ParticipantModel, allowReserved = false },
) {
  let participant = null
  if (
    participantIdOrDoc &&
    typeof participantIdOrDoc === 'object' &&
    (participantIdOrDoc.childName !== undefined ||
      participantIdOrDoc.category !== undefined)
  ) {
    participant = participantIdOrDoc
  } else {
    participant = await ParticipantModel.findById(participantIdOrDoc)
  }

  if (!participant) {
    throw new Error('Participant record not found.')
  }

  // Idempotency: If bib number is already assigned, retain it permanently
  if (participant.bibNumber && participant.bibNumber >= 1000) {
    const heatInfo = calculateHeatAndCourse(
      participant.bibNumber,
      participant.category,
    )
    return {
      participant,
      bibNumber: participant.bibNumber,
      heat: participant.heat || heatInfo.heat,
      course: participant.course || heatInfo.course,
      alreadyAssigned: true,
    }
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const { bibNumber, config } = await getNextAvailableBibNumber({
      category: participant.category,
      dob: participant.dob,
      ParticipantModel,
      allowReserved,
    })

    const heatInfo = calculateHeatAndCourse(bibNumber, config)

    try {
      const updated = await ParticipantModel.findOneAndUpdate(
        {
          _id: participant._id,
          $or: [{ bibNumber: null }, { bibNumber: { $exists: false } }],
        },
        {
          $set: {
            bibNumber,
            heat: heatInfo.heat,
            course: heatInfo.course,
            category: config.name,
          },
        },
        { new: true, runValidators: true },
      )

      if (updated) {
        return {
          participant: updated,
          bibNumber: updated.bibNumber,
          heat: updated.heat,
          course: updated.course,
          alreadyAssigned: false,
        }
      }

      // Check if another concurrent thread just assigned this participant
      const fresh = await ParticipantModel.findById(participant._id).lean()
      if (fresh?.bibNumber) {
        return {
          participant: fresh,
          bibNumber: fresh.bibNumber,
          heat: fresh.heat,
          course: fresh.course,
          alreadyAssigned: true,
        }
      }
    } catch (err) {
      const isDuplicate = err?.code === 11000 || err?.code === 11001
      if (isDuplicate) {
        // Concurrency collision on bibNumber, retry with fresh scan
        continue
      }
      throw err
    }
  }

  throw new Error(
    'Failed to allocate unique bib number after multiple concurrent attempts.',
  )
}

/**
 * Backfills bib numbers for existing verified paid participants that lack one.
 */
export async function backfillPaidBibNumbers(ParticipantModel) {
  const unassignedPaid = await ParticipantModel.find({
    'payment.status': 'paid',
    $or: [{ bibNumber: null }, { bibNumber: { $exists: false } }],
  })
    .sort({ 'payment.paidAt': 1, createdAt: 1 })
    .lean()

  const results = []
  for (const p of unassignedPaid) {
    try {
      const res = await assignBibToParticipant(p._id, {
        ParticipantModel,
        allowReserved: p.isManual === true,
      })
      results.push(res)
    } catch (err) {
      console.error(
        `Failed to backfill bib for participant ${p.reference || p._id}:`,
        err.message,
      )
    }
  }
  return results
}
