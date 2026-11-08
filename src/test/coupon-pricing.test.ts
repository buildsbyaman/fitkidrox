import { describe, it, expect } from 'vitest'
import { formatINR } from '../lib/format'

describe('School Coupon & Pricing Engine', () => {
  const BASE_FEE = 1250

  function computePricing(
    participants: number,
    coupon: {
      code: string
      isActive: boolean
      discountType: 'per_student_rate' | 'percentage' | 'fixed'
      discountValue: number
      minStudents?: number
      maxDiscount?: number | null
      expiresAt?: string | null
    } | null,
  ) {
    const count = Math.max(1, participants || 1)
    const grossAmount = count * BASE_FEE
    let discountAmount = 0
    let couponError: string | null = null

    if (coupon) {
      if (!coupon.isActive) {
        couponError = 'This coupon is currently inactive.'
      } else if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        couponError = 'This coupon has expired.'
      } else if (coupon.minStudents && count < coupon.minStudents) {
        couponError = `This coupon requires a minimum delegation of ${coupon.minStudents} students.`
      } else {
        if (coupon.discountType === 'per_student_rate') {
          const rate = Math.max(0, coupon.discountValue)
          const targetTotal = count * rate
          discountAmount = Math.max(0, grossAmount - targetTotal)
        } else if (coupon.discountType === 'percentage') {
          discountAmount = Math.round((grossAmount * coupon.discountValue) / 100)
        } else {
          discountAmount = coupon.discountValue
        }
        if (coupon.maxDiscount && coupon.maxDiscount > 0) {
          discountAmount = Math.min(discountAmount, coupon.maxDiscount)
        }
        discountAmount = Math.min(grossAmount, Math.max(0, discountAmount))
      }
    }

    const finalAmount = Math.max(0, grossAmount - discountAmount)
    return { grossAmount, discountAmount, finalAmount, couponError }
  }

  it('calculates ₹900 per student rate correctly for 10 students', () => {
    const coupon = {
      code: 'AFFILIATE26',
      isActive: true,
      discountType: 'per_student_rate' as const,
      discountValue: 900,
    }
    const result = computePricing(10, coupon)
    expect(result.grossAmount).toBe(12500)
    expect(result.finalAmount).toBe(9000) // 10 * 900
    expect(result.discountAmount).toBe(3500) // 10 * 350
    expect(result.couponError).toBeNull()
  })

  it('calculates ₹700 per student rate correctly for 10 students', () => {
    const coupon = {
      code: 'SPORTSWING',
      isActive: true,
      discountType: 'per_student_rate' as const,
      discountValue: 700,
    }
    const result = computePricing(10, coupon)
    expect(result.grossAmount).toBe(12500)
    expect(result.finalAmount).toBe(7000) // 10 * 700
    expect(result.discountAmount).toBe(5500) // 10 * 550
    expect(result.couponError).toBeNull()
  })

  it('calculates ₹500 per student rate correctly for 10 students', () => {
    const coupon = {
      code: 'VIDYALAYA',
      isActive: true,
      discountType: 'per_student_rate' as const,
      discountValue: 500,
    }
    const result = computePricing(10, coupon)
    expect(result.grossAmount).toBe(12500)
    expect(result.finalAmount).toBe(5000) // 10 * 500
    expect(result.discountAmount).toBe(7500) // 10 * 750
    expect(result.couponError).toBeNull()
  })

  it('calculates standard gross amount without coupon', () => {
    const result = computePricing(10, null)
    expect(result.grossAmount).toBe(12500)
    expect(result.discountAmount).toBe(0)
    expect(result.finalAmount).toBe(12500)
    expect(result.couponError).toBeNull()
  })

  it('calculates 50% discount correctly', () => {
    const coupon = {
      code: 'FITKID50',
      isActive: true,
      discountType: 'percentage' as const,
      discountValue: 50,
      minStudents: 5,
    }
    const result = computePricing(10, coupon)
    expect(result.grossAmount).toBe(12500)
    expect(result.discountAmount).toBe(6250)
    expect(result.finalAmount).toBe(6250)
    expect(result.couponError).toBeNull()
  })

  it('enforces minStudents constraint', () => {
    const coupon = {
      code: 'BULK20',
      isActive: true,
      discountType: 'percentage' as const,
      discountValue: 20,
      minStudents: 15,
    }
    const result = computePricing(10, coupon)
    expect(result.couponError).toContain('minimum delegation of 15 students')
    expect(result.discountAmount).toBe(0)
    expect(result.finalAmount).toBe(12500)
  })

  it('enforces maxDiscount cap', () => {
    const coupon = {
      code: 'BIGDISCOUNT',
      isActive: true,
      discountType: 'percentage' as const,
      discountValue: 50,
      maxDiscount: 3000,
    }
    // 10 students * 1250 = 12500. 50% = 6250, but cap is 3000
    const result = computePricing(10, coupon)
    expect(result.grossAmount).toBe(12500)
    expect(result.discountAmount).toBe(3000)
    expect(result.finalAmount).toBe(9500)
  })

  it('handles 100% full waiver coupon', () => {
    const coupon = {
      code: 'PSSS2026',
      isActive: true,
      discountType: 'percentage' as const,
      discountValue: 100,
    }
    const result = computePricing(20, coupon)
    expect(result.grossAmount).toBe(25000)
    expect(result.discountAmount).toBe(25000)
    expect(result.finalAmount).toBe(0)
  })

  it('rejects inactive coupon', () => {
    const coupon = {
      code: 'OLDCODE',
      isActive: false,
      discountType: 'fixed' as const,
      discountValue: 1000,
    }
    const result = computePricing(5, coupon)
    expect(result.couponError).toBe('This coupon is currently inactive.')
    expect(result.discountAmount).toBe(0)
  })

  it('rejects expired coupon', () => {
    const coupon = {
      code: 'EXPIRED10',
      isActive: true,
      discountType: 'percentage' as const,
      discountValue: 10,
      expiresAt: '2020-01-01T00:00:00Z',
    }
    const result = computePricing(5, coupon)
    expect(result.couponError).toBe('This coupon has expired.')
    expect(result.discountAmount).toBe(0)
  })

  it('formats INR correctly for display', () => {
    expect(formatINR(1250)).toBe('₹1,250')
    expect(formatINR(0)).toBe('₹0')
    expect(formatINR(25000)).toBe('₹25,000')
  })
})

