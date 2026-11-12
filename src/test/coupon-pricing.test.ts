import { describe, it, expect, vi } from 'vitest'
import { formatINR } from '../lib/format'
// @ts-expect-error server code is plain JavaScript without d.ts
import { syncCouponUsageCount, syncAllCouponUsageCounts } from '../../server/src/lib/coupon.js'

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

describe('Individual Participant Coupon Engine (EARLY125, SIBLING250, GROUP500, FITKID100)', () => {
  const BASE_FEE = 1250

  interface ParticipantCoupon {
    code: string
    description?: string
    discountType: 'per_student_rate' | 'percentage' | 'fixed'
    discountValue: number
    applicableTo?: 'schools' | 'individual' | 'both'
    minPriorRegistrations?: number
    maxDiscount?: number | null
    isActive: boolean
    expiresAt?: string | null
  }

  function computeParticipantPricingTest({
    coupon,
    priorPaidCount = 0,
  }: {
    coupon: ParticipantCoupon | null
    priorPaidCount?: number
  }) {
    const grossAmount = BASE_FEE
    let discountAmount = 0
    let couponError: string | null = null

    if (coupon) {
      if (!coupon.isActive) {
        couponError = 'This coupon is currently inactive.'
      } else if (coupon.applicableTo === 'schools') {
        couponError = 'This coupon is valid for school delegations only.'
      } else if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        couponError = 'This coupon has expired.'
      } else {
        const minPrior =
          coupon.code === 'SIBLING250'
            ? 1
            : coupon.code === 'GROUP500'
              ? 4
              : Number(coupon.minPriorRegistrations) || 0

        if (minPrior > 0 && priorPaidCount < minPrior) {
          if (coupon.code === 'SIBLING250') {
            couponError =
              'SIBLING250 requires at least 1 previously paid registration under your account.'
          } else if (coupon.code === 'GROUP500') {
            couponError =
              'GROUP500 requires at least 4 previously paid registrations under your account (valid on your 5th child or more).'
          } else {
            couponError = `This coupon requires at least ${minPrior} previously paid registration(s) under your account.`
          }
        } else {
          if (coupon.discountType === 'percentage') {
            discountAmount = Math.round(
              (grossAmount * coupon.discountValue) / 100,
            )
          } else if (coupon.discountType === 'per_student_rate') {
            discountAmount = Math.max(0, grossAmount - coupon.discountValue)
          } else {
            discountAmount = coupon.discountValue
          }
          if (coupon.maxDiscount && coupon.maxDiscount > 0) {
            discountAmount = Math.min(discountAmount, coupon.maxDiscount)
          }
          discountAmount = Math.min(grossAmount, Math.max(0, discountAmount))
        }
      }
    }

    const finalAmount = Math.max(0, grossAmount - discountAmount)
    return { grossAmount, discountAmount, finalAmount, couponError }
  }

  it('EARLY125: provides ₹125 flat discount (final ₹1,125)', () => {
    const coupon: ParticipantCoupon = {
      code: 'EARLY125',
      description: 'Early Bird Discount (₹125 OFF)',
      discountType: 'fixed',
      discountValue: 125,
      applicableTo: 'individual',
      isActive: true,
    }
    const result = computeParticipantPricingTest({ coupon, priorPaidCount: 0 })
    expect(result.grossAmount).toBe(1250)
    expect(result.discountAmount).toBe(125)
    expect(result.finalAmount).toBe(1125)
    expect(result.couponError).toBeNull()
  })

  it('FITKID100: provides ₹100 flat discount (final ₹1,150)', () => {
    const coupon: ParticipantCoupon = {
      code: 'FITKID100',
      description: 'FITKID Promo (₹100 OFF)',
      discountType: 'fixed',
      discountValue: 100,
      applicableTo: 'individual',
      isActive: true,
    }
    const result = computeParticipantPricingTest({ coupon, priorPaidCount: 0 })
    expect(result.grossAmount).toBe(1250)
    expect(result.discountAmount).toBe(100)
    expect(result.finalAmount).toBe(1150)
    expect(result.couponError).toBeNull()
  })

  it('DRISHTI900: sets entry fee to ₹900 per registration (saves ₹350)', () => {
    const coupon: ParticipantCoupon = {
      code: 'DRISHTI900',
      description: 'Special Parent Rate (₹900 per registration)',
      discountType: 'per_student_rate',
      discountValue: 900,
      applicableTo: 'individual',
      isActive: true,
    }
    const result = computeParticipantPricingTest({ coupon, priorPaidCount: 0 })
    expect(result.grossAmount).toBe(1250)
    expect(result.discountAmount).toBe(350)
    expect(result.finalAmount).toBe(900)
    expect(result.couponError).toBeNull()
  })

  it('SIBLING250: rejects when user has 0 prior paid registrations', () => {
    const coupon: ParticipantCoupon = {
      code: 'SIBLING250',
      description: 'Sibling Discount (₹250 OFF on 2nd child onwards)',
      discountType: 'fixed',
      discountValue: 250,
      applicableTo: 'individual',
      minPriorRegistrations: 1,
      isActive: true,
    }
    const result = computeParticipantPricingTest({ coupon, priorPaidCount: 0 })
    expect(result.couponError).toBe(
      'SIBLING250 requires at least 1 previously paid registration under your account.',
    )
    expect(result.discountAmount).toBe(0)
    expect(result.finalAmount).toBe(1250)
  })

  it('SIBLING250: applies ₹250 OFF when user has 1 previously paid registration (2nd child)', () => {
    const coupon: ParticipantCoupon = {
      code: 'SIBLING250',
      description: 'Sibling Discount (₹250 OFF on 2nd child onwards)',
      discountType: 'fixed',
      discountValue: 250,
      applicableTo: 'individual',
      minPriorRegistrations: 1,
      isActive: true,
    }
    const result = computeParticipantPricingTest({ coupon, priorPaidCount: 1 })
    expect(result.couponError).toBeNull()
    expect(result.discountAmount).toBe(250)
    expect(result.finalAmount).toBe(1000)
  })

  it('SIBLING250: applies ₹250 OFF when user has 2 or more previously paid registrations (3rd child)', () => {
    const coupon: ParticipantCoupon = {
      code: 'SIBLING250',
      description: 'Sibling Discount (₹250 OFF on 2nd child onwards)',
      discountType: 'fixed',
      discountValue: 250,
      applicableTo: 'individual',
      minPriorRegistrations: 1,
      isActive: true,
    }
    const result = computeParticipantPricingTest({ coupon, priorPaidCount: 2 })
    expect(result.couponError).toBeNull()
    expect(result.discountAmount).toBe(250)
    expect(result.finalAmount).toBe(1000)
  })

  it('GROUP500: rejects when user has fewer than 4 previously paid registrations', () => {
    const coupon: ParticipantCoupon = {
      code: 'GROUP500',
      description: 'Group Discount (₹500 OFF on 5th child onwards)',
      discountType: 'fixed',
      discountValue: 500,
      applicableTo: 'individual',
      minPriorRegistrations: 4,
      isActive: true,
    }
    // 3 prior paid registrations (so this would be 4th child, not 5th)
    const result = computeParticipantPricingTest({ coupon, priorPaidCount: 3 })
    expect(result.couponError).toBe(
      'GROUP500 requires at least 4 previously paid registrations under your account (valid on your 5th child or more).',
    )
    expect(result.discountAmount).toBe(0)
    expect(result.finalAmount).toBe(1250)
  })

  it('GROUP500: applies ₹500 OFF when user has 4 previously paid registrations (5th child)', () => {
    const coupon: ParticipantCoupon = {
      code: 'GROUP500',
      description: 'Group Discount (₹500 OFF on 5th child onwards)',
      discountType: 'fixed',
      discountValue: 500,
      applicableTo: 'individual',
      minPriorRegistrations: 4,
      isActive: true,
    }
    const result = computeParticipantPricingTest({ coupon, priorPaidCount: 4 })
    expect(result.couponError).toBeNull()
    expect(result.discountAmount).toBe(500)
    expect(result.finalAmount).toBe(750)
  })

  it('GROUP500: applies ₹500 OFF when user has 6 previously paid registrations (7th child)', () => {
    const coupon: ParticipantCoupon = {
      code: 'GROUP500',
      description: 'Group Discount (₹500 OFF on 5th child onwards)',
      discountType: 'fixed',
      discountValue: 500,
      applicableTo: 'individual',
      minPriorRegistrations: 4,
      isActive: true,
    }
    const result = computeParticipantPricingTest({ coupon, priorPaidCount: 6 })
    expect(result.couponError).toBeNull()
    expect(result.discountAmount).toBe(500)
    expect(result.finalAmount).toBe(750)
  })

  it('rejects school-only coupon on individual participant registration', () => {
    const coupon: ParticipantCoupon = {
      code: 'PARTNER900',
      discountType: 'per_student_rate',
      discountValue: 900,
      applicableTo: 'schools',
      isActive: true,
    }
    const result = computeParticipantPricingTest({ coupon, priorPaidCount: 1 })
    expect(result.couponError).toBe(
      'This coupon is valid for school delegations only.',
    )
    expect(result.discountAmount).toBe(0)
    expect(result.finalAmount).toBe(1250)
  })
})

describe('Server-Side Payment & Amount Validation (Zero Client Trust)', () => {
  function simulateCreateOrderValidation({
    participantAmountInDb,
    clientSubmittedAmountPaise,
  }: {
    participantAmountInDb: number
    clientSubmittedAmountPaise?: number
  }) {
    const expectedPaise = Math.round(participantAmountInDb * 100)

    if (clientSubmittedAmountPaise !== undefined) {
      if (
        !Number.isFinite(clientSubmittedAmountPaise) ||
        !Number.isInteger(clientSubmittedAmountPaise)
      ) {
        return { error: 'amount must be an integer in paise.', status: 400 }
      }
      if (clientSubmittedAmountPaise < 100) {
        return { error: 'amount must be at least 100 paise.', status: 400 }
      }
      if (clientSubmittedAmountPaise !== expectedPaise) {
        return {
          error: 'Amount does not match the registration fee.',
          status: 400,
        }
      }
    }

    return {
      orderAmountPaise: expectedPaise,
      status: 200,
    }
  }

  it('rejects tampered amount when client attempts to pay ₹100 instead of standard ₹1,250', () => {
    const res = simulateCreateOrderValidation({
      participantAmountInDb: 1250,
      clientSubmittedAmountPaise: 10000, // ₹100 instead of ₹1,250 (125000 paise)
    })
    expect(res.status).toBe(400)
    expect(res.error).toBe('Amount does not match the registration fee.')
  })

  it('rejects tampered amount when client attempts to manipulate discounted fee', () => {
    // Participant registered with EARLY125 (₹1,125 = 112500 paise)
    // Client manipulates request to send 50000 paise (₹500)
    const res = simulateCreateOrderValidation({
      participantAmountInDb: 1125,
      clientSubmittedAmountPaise: 50000,
    })
    expect(res.status).toBe(400)
    expect(res.error).toBe('Amount does not match the registration fee.')
  })

  it('creates order with exact server DB amount when client amount matches verified discounted amount', () => {
    // Participant registered with SIBLING250 (₹1,000 = 100000 paise)
    const res = simulateCreateOrderValidation({
      participantAmountInDb: 1000,
      clientSubmittedAmountPaise: 100000,
    })
    expect(res.status).toBe(200)
    expect(res.orderAmountPaise).toBe(100000)
  })

  it('creates order with exact server DB amount even if client omits amount completely', () => {
    // Participant registered with DRISHTI900 (₹900 = 90000 paise)
    const res = simulateCreateOrderValidation({
      participantAmountInDb: 900,
      clientSubmittedAmountPaise: undefined,
    })
    expect(res.status).toBe(200)
    expect(res.orderAmountPaise).toBe(90000)
  })

  it('rejects fractional or non-integer paise values', () => {
    const res = simulateCreateOrderValidation({
      participantAmountInDb: 1250,
      clientSubmittedAmountPaise: 125000.5,
    })
    expect(res.status).toBe(400)
    expect(res.error).toBe('amount must be an integer in paise.')
  })
})

describe('Coupon Usage Count Synchronization', () => {
  it('syncCouponUsageCount computes exact total across Participant and School records', async () => {
    const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 })
    const participantCountDocuments = vi.fn().mockResolvedValue(2)
    const schoolCountDocuments = vi.fn().mockResolvedValue(1)

    const total = await syncCouponUsageCount(' scholarpass ', {
      CouponModel: { updateOne },
      ParticipantModel: { countDocuments: participantCountDocuments },
      SchoolModel: { countDocuments: schoolCountDocuments },
    })

    expect(total).toBe(3)
    expect(participantCountDocuments).toHaveBeenCalledWith({
      couponCode: 'SCHOLARPASS',
      'payment.status': { $in: ['paid', 'waived'] },
    })
    expect(schoolCountDocuments).toHaveBeenCalledWith({
      couponCode: 'SCHOLARPASS',
      'payment.status': { $in: ['paid', 'waived'] },
    })
    expect(updateOne).toHaveBeenCalledWith(
      { code: 'SCHOLARPASS' },
      { $set: { usageCount: 3 } },
    )
  })

  it('syncCouponUsageCount resets usageCount to 0 when no live paid/waived records remain', async () => {
    const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 })

    const total = await syncCouponUsageCount('SCHOLARPASS', {
      CouponModel: { updateOne },
      ParticipantModel: { countDocuments: vi.fn().mockResolvedValue(0) },
      SchoolModel: { countDocuments: vi.fn().mockResolvedValue(0) },
    })

    expect(total).toBe(0)
    expect(updateOne).toHaveBeenCalledWith(
      { code: 'SCHOLARPASS' },
      { $set: { usageCount: 0 } },
    )
  })

  it('syncAllCouponUsageCounts reconciles stale counts across all coupons', async () => {
    const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 })
    const find = vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { _id: '1', code: 'SCHOLARPASS', usageCount: 1 },
        { _id: '2', code: 'TLG100', usageCount: 0 },
        { _id: '3', code: 'EARLY125', usageCount: 1 },
      ]),
    })
    const participantAggregate = vi.fn().mockResolvedValue([
      { _id: 'TLG100', count: 2 },
      { _id: 'EARLY125', count: 1 },
    ])
    const schoolAggregate = vi.fn().mockResolvedValue([])

    const updated = await syncAllCouponUsageCounts({
      CouponModel: { find, updateOne },
      ParticipantModel: { aggregate: participantAggregate },
      SchoolModel: { aggregate: schoolAggregate },
    })

    expect(updated).toBe(2)
    expect(updateOne).toHaveBeenCalledTimes(2)
    expect(updateOne).toHaveBeenCalledWith(
      { _id: '1' },
      { $set: { usageCount: 0 } },
    )
    expect(updateOne).toHaveBeenCalledWith(
      { _id: '2' },
      { $set: { usageCount: 2 } },
    )
  })
})

