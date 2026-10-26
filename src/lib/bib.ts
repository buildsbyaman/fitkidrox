/**
 * Bib Number Generation and Heat/Course Calculation System for FITKIDROX
 */

export interface CategoryBibConfig {
  name: string
  ages: string
  prefix: number
  minBib: number
  maxBib: number
  reservedCount: number
  heatSize: number
}

export const DEFAULT_BIB_CONFIG: Record<string, CategoryBibConfig> = {
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

export interface HeatAndCourseResult {
  bibNumber: number
  prefix: number
  serialNumber: number
  heat: number
  heatSize: number
  course: 'Course A' | 'Course B'
  courseCode: 'A' | 'B'
  categoryName: string
}

/**
 * Resolves category config from a category string or DOB.
 */
export function resolveCategoryConfig(
  categoryInput?: string | null,
  dob?: string | null,
): CategoryBibConfig | null {
  if (categoryInput) {
    const s = String(categoryInput).toLowerCase().trim()
    for (const [key, cfg] of Object.entries(DEFAULT_BIB_CONFIG)) {
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
      return DEFAULT_BIB_CONFIG['Mini FITKIDROX']
    }
    if (s.includes('kids') || s.includes('6–8') || s.includes('6-8')) {
      return DEFAULT_BIB_CONFIG['Kids Fitness Challenge']
    }
    if (s.includes('athletic') || s.includes('9–12') || s.includes('9-12')) {
      return DEFAULT_BIB_CONFIG['Athletic Challenge']
    }
    if (s.includes('performance') || s.includes('13+') || s.includes('13')) {
      return DEFAULT_BIB_CONFIG['Performance FITKIDROX']
    }
  }

  if (dob) {
    const birth = new Date(dob)
    if (!Number.isNaN(birth.getTime())) {
      const eventDate = new Date('2026-11-28')
      let age = eventDate.getFullYear() - birth.getFullYear()
      const m = eventDate.getMonth() - birth.getMonth()
      if (m < 0 || (m === 0 && eventDate.getDate() < birth.getDate())) age--

      if (age >= 3 && age <= 5) return DEFAULT_BIB_CONFIG['Mini FITKIDROX']
      if (age >= 6 && age <= 8) return DEFAULT_BIB_CONFIG['Kids Fitness Challenge']
      if (age >= 9 && age <= 12) return DEFAULT_BIB_CONFIG['Athletic Challenge']
      if (age >= 13) return DEFAULT_BIB_CONFIG['Performance FITKIDROX']
    }
  }

  return null
}

/**
 * Calculates heat and course for a given bib number.
 * Odd heat -> Course A, Even heat -> Course B.
 */
export function calculateHeatAndCourse(
  bibNumber: number | string,
  categoryOrConfig?: string | CategoryBibConfig | null,
): HeatAndCourseResult {
  const num = Number(bibNumber)
  if (!Number.isFinite(num) || num < 1000) {
    throw new Error(`Invalid bib number: ${bibNumber}`)
  }

  const prefix = Math.floor(num / 1000)
  const serialNumber = num % 1000

  let cfg: CategoryBibConfig | null = null
  if (typeof categoryOrConfig === 'string') {
    cfg = resolveCategoryConfig(categoryOrConfig)
  } else if (
    categoryOrConfig &&
    typeof categoryOrConfig === 'object' &&
    'heatSize' in categoryOrConfig
  ) {
    cfg = categoryOrConfig
  }

  if (!cfg) {
    for (const item of Object.values(DEFAULT_BIB_CONFIG)) {
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
  const course: 'Course A' | 'Course B' = isOdd ? 'Course A' : 'Course B'
  const courseCode: 'A' | 'B' = isOdd ? 'A' : 'B'

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
