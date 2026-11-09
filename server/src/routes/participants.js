import { Router } from 'express'

import { createWithUniqueReference } from '../lib/reference.js'
import { Participant } from '../models/Participant.js'
import { Coupon } from '../models/Coupon.js'
import { requireUserAuth } from '../user-auth.js'
import { assignBibToParticipant } from '../lib/bib.js'
import { sendParticipantConfirmationEmail } from '../lib/mailer.js'
import { ENTRY_FEE_PAISE } from '../lib/razorpay.js'

export const participantsRouter = Router()

const BASE_ENTRY_FEE = ENTRY_FEE_PAISE ? ENTRY_FEE_PAISE / 100 : 1250

/**
 * Server-side helper to compute participant registration pricing and validate/apply coupon.
 * The coupon and amounts are ALWAYS resolved securely from backend database records.
 */
export async function computeParticipantPricing(user, couponCodeInput = '') {
  const grossAmount = BASE_ENTRY_FEE
  let discountAmount = 0
  let coupon = null
  let couponError = null

  const code =
    typeof couponCodeInput === 'string' ? couponCodeInput.trim().toUpperCase() : ''

  const userEmail = (user?.email || '').trim().toLowerCase()
  const emailPattern = userEmail
    ? new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    : null
  const userFilter = []
  if (user?._id) userFilter.push({ userId: user._id })
  if (emailPattern) userFilter.push({ guardianEmail: emailPattern })

  const priorPaidCount =
    userFilter.length > 0
      ? await Participant.countDocuments({
          $or: userFilter,
          'payment.status': 'paid',
        })
      : 0

  if (code) {
    coupon = await Coupon.findOne({ code }).lean()
    if (!coupon) {
      couponError = 'Invalid coupon code.'
    } else if (!coupon.isActive) {
      couponError = 'This coupon is currently inactive.'
    } else if (coupon.applicableTo === 'schools') {
      couponError = 'This coupon is valid for school delegations only.'
    } else if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      couponError = 'This coupon has expired.'
    } else {
      // Validate conditions based on prior paid registrations
      const minPrior =
        code === 'SIBLING250'
          ? 1
          : code === 'GROUP500'
            ? 4
            : Number(coupon.minPriorRegistrations) || 0

      if (minPrior > 0 && priorPaidCount < minPrior) {
        if (code === 'SIBLING250') {
          couponError =
            'SIBLING250 requires at least 1 previously paid registration under your account.'
        } else if (code === 'GROUP500') {
          couponError =
            'GROUP500 requires at least 4 previously paid registrations under your account (valid on your 5th child or more).'
        } else {
          couponError = `This coupon requires at least ${minPrior} previously paid registration(s) under your account.`
        }
      } else {
        if (coupon.discountType === 'percentage') {
          discountAmount = Math.round((grossAmount * coupon.discountValue) / 100)
        } else if (coupon.discountType === 'per_student_rate') {
          discountAmount = Math.max(0, grossAmount - coupon.discountValue)
        } else {
          // fixed
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

  return {
    grossAmount,
    discountAmount,
    finalAmount,
    coupon: couponError ? null : coupon,
    couponError,
    priorPaidCount,
  }
}

/**
 * POST /api/participants/validate-coupon — validate a coupon code and calculate discount dynamically.
 */
participantsRouter.post(
  '/validate-coupon',
  requireUserAuth,
  async (req, res, next) => {
    try {
      const code =
        typeof req.body?.code === 'string'
          ? req.body.code.trim().toUpperCase()
          : ''

      if (!code) {
        return res.status(400).json({ error: 'Coupon code is required.' })
      }

      const pricing = await computeParticipantPricing(req.user, code)
      if (pricing.couponError || !pricing.coupon) {
        return res
          .status(400)
          .json({ error: pricing.couponError || 'Invalid coupon code.' })
      }

      return res.json({
        valid: true,
        code: pricing.coupon.code,
        description: pricing.coupon.description,
        discountType: pricing.coupon.discountType,
        discountValue: pricing.coupon.discountValue,
        grossAmount: pricing.grossAmount,
        discountAmount: pricing.discountAmount,
        finalAmount: pricing.finalAmount,
        priorPaidCount: pricing.priorPaidCount,
      })
    } catch (err) {
      next(err)
    }
  },
)

/**
 * POST /api/participants — a logged-in parent registers a child with optional coupon code.
 * Guardian email is strictly derived from the authenticated Google user.
 */
participantsRouter.post('/', requireUserAuth, async (req, res, next) => {
  try {
    const {
      childName,
      dob,
      gender,
      tshirt,
      school,
      category,
      guardianName,
      guardianPhone,
      relation,
      medicalNotes,
      couponCode,
    } = req.body ?? {}

    // Strictly enforce Google account email and link user ID
    const guardianEmail = req.user.email
    const userId = req.user._id

    const pricing = await computeParticipantPricing(req.user, couponCode)
    if (pricing.couponError) {
      return res.status(400).json({ error: pricing.couponError })
    }

    const doc = await createWithUniqueReference(
      (reference) =>
        Participant.create({
          childName: typeof childName === 'string' ? childName.trim() : '',
          dob: typeof dob === 'string' ? dob.trim() : '',
          gender: typeof gender === 'string' ? gender.trim() : '',
          tshirt: typeof tshirt === 'string' ? tshirt.trim() : '',
          school: typeof school === 'string' ? school.trim() : '',
          category: typeof category === 'string' ? category.trim() : '',
          guardianName:
            typeof guardianName === 'string' ? guardianName.trim() : '',
          guardianPhone:
            typeof guardianPhone === 'string' ? guardianPhone.trim() : '',
          guardianEmail,
          userId,
          relation: typeof relation === 'string' ? relation.trim() : 'Parent',
          medicalNotes:
            typeof medicalNotes === 'string' ? medicalNotes.trim() : '',
          reference,
          consentParticipation: req.body?.consentParticipation === true,
          consentMedical: req.body?.consentMedical === true,
          consentPhotos: req.body?.consentPhotos === true,
          couponCode: pricing.coupon?.code || '',
          discountAmount: pricing.discountAmount || 0,
          payment: {
            status: pricing.finalAmount === 0 ? 'waived' : 'unpaid',
            amount: pricing.finalAmount,
            orderId: '',
            paymentId: pricing.finalAmount === 0 ? 'WAIVED' : '',
            paidAt: pricing.finalAmount === 0 ? new Date() : undefined,
          },
          isManual: false,
        }),
      'FKX',
    )

    if (pricing.finalAmount === 0) {
      // If 100% discount / waived, increment coupon usage and send confirmation email immediately
      if (pricing.coupon) {
        await Coupon.updateOne(
          { code: pricing.coupon.code },
          { $inc: { usageCount: 1 } },
        ).catch(() => null)
      }

      const bibResult = await assignBibToParticipant(doc._id, {
        ParticipantModel: Participant,
        allowReserved: false,
      })

      sendParticipantConfirmationEmail({
        participant: {
          ...doc.toObject(),
          payment: {
            status: 'waived',
            amount: 0,
            orderId: '',
            paymentId: 'WAIVED',
          },
        },
        bibNumber: bibResult.bibNumber,
        heat: bibResult.heat,
        course: bibResult.course,
      }).catch((err) =>
        console.error(
          '[mailer] Failed to send participant confirmation email:',
          err,
        ),
      )

      return res.status(201).json({
        reference: doc.reference,
        waived: true,
        bibNumber: bibResult.bibNumber,
        heat: bibResult.heat,
        course: bibResult.course,
        grossAmount: pricing.grossAmount,
        discountAmount: pricing.discountAmount,
        finalAmount: 0,
      })
    }

    res.status(201).json({
      reference: doc.reference,
      waived: false,
      grossAmount: pricing.grossAmount,
      discountAmount: pricing.discountAmount,
      finalAmount: pricing.finalAmount,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/participants/my — returns all registrations for the logged-in parent.
 * Automatically links and discovers existing student registrations matching the guardian's email.
 */
participantsRouter.get('/my', requireUserAuth, async (req, res, next) => {
  try {
    const userId = req.user._id
    const userEmail = (req.user.email || '').trim().toLowerCase()
    const emailPattern = new RegExp(
      `^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'i',
    )

    // Backfill & link any unlinked registrations that match this email
    await Participant.updateMany(
      {
        $or: [{ guardianEmail: emailPattern }, { guardianEmail: userEmail }],
        userId: { $ne: userId },
      },
      {
        $set: { userId },
      },
    ).catch(() => null)

    const registrations = await Participant.find({
      $or: [
        { userId },
        { guardianEmail: emailPattern },
        { guardianEmail: userEmail },
      ],
    })
      .sort({ createdAt: -1 })
      .lean()

    res.json({ ok: true, registrations })
  } catch (err) {
    next(err)
  }
})
