import { Router } from 'express'

import { createWithUniqueReference } from '../lib/reference.js'
import { sendSchoolConfirmationEmail } from '../lib/mailer.js'
import { School } from '../models/School.js'
import { Coupon } from '../models/Coupon.js'
import {
  createOrder,
  razorpayConfigured,
  verifySignature,
  ENTRY_FEE_PAISE,
} from '../lib/razorpay.js'

export const schoolsRouter = Router()

const BASE_ENTRY_FEE = ENTRY_FEE_PAISE ? ENTRY_FEE_PAISE / 100 : 1250

/**
 * Server-side helper to compute school delegation pricing and validate/apply coupon.
 * The coupon and amounts are ALWAYS resolved securely from backend database records.
 */
async function computeSchoolPricing(participants, couponCodeInput = '') {
  const count = Math.max(1, Number(participants) || 1)
  const grossAmount = count * BASE_ENTRY_FEE

  let discountAmount = 0
  let coupon = null
  let couponError = null

  const code =
    typeof couponCodeInput === 'string' ? couponCodeInput.trim().toUpperCase() : ''

  if (code) {
    coupon = await Coupon.findOne({ code }).lean()
    if (!coupon) {
      couponError = 'Invalid coupon code.'
    } else if (!coupon.isActive) {
      couponError = 'This coupon is currently inactive.'
    } else if (coupon.applicableTo === 'individual') {
      couponError = 'This coupon is valid for individual parent registrations only.'
    } else if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      couponError = 'This coupon has expired.'
    } else if (coupon.minStudents && count < coupon.minStudents) {
      couponError = `This coupon requires a minimum delegation of ${coupon.minStudents} students.`
    } else {
      if (coupon.discountType === 'per_student_rate') {
        const ratePerStudent = Math.max(0, Number(coupon.discountValue) || 0)
        const targetTotal = count * ratePerStudent
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

  return {
    grossAmount,
    discountAmount,
    finalAmount,
    coupon: couponError ? null : coupon,
    couponError,
  }
}

/**
 * POST /api/schools/validate-coupon — validate a coupon code and calculate discount dynamically.
 */
schoolsRouter.post('/validate-coupon', async (req, res, next) => {
  try {
    const code =
      typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : ''
    const participants = Number(req.body?.participants) || 1

    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required.' })
    }

    const pricing = await computeSchoolPricing(participants, code)
    if (pricing.couponError || !pricing.coupon) {
      return res
        .status(400)
        .json({ error: pricing.couponError || 'Invalid coupon code.' })
    }

    const perStudentRate =
      pricing.coupon.discountType === 'per_student_rate'
        ? pricing.coupon.discountValue
        : Math.round(pricing.finalAmount / participants)

    return res.json({
      valid: true,
      code: pricing.coupon.code,
      description: pricing.coupon.description,
      discountType: pricing.coupon.discountType,
      discountValue: pricing.coupon.discountValue,
      grossAmount: pricing.grossAmount,
      discountAmount: pricing.discountAmount,
      finalAmount: pricing.finalAmount,
      perStudentRate,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/schools — a school submits registration with delegation & optional coupon code.
 */
schoolsRouter.post('/', async (req, res, next) => {
  try {
    const { schoolName, city, coordinator, phone, email, couponCode } =
      req.body ?? {}
    const roster = Array.isArray(req.body?.roster)
      ? req.body.roster.map((r) => ({
          name: typeof r?.name === 'string' ? r.name.trim() : '',
          dob: typeof r?.dob === 'string' ? r.dob.trim() : '',
          gender: typeof r?.gender === 'string' ? r.gender.trim() : '',
          tshirt: typeof r?.tshirt === 'string' ? r.tshirt.trim() : '',
          category: typeof r?.category === 'string' ? r.category.trim() : '',
        }))
      : []

    const parsedParticipants = Number(req.body?.participants)
    const participants =
      Number.isFinite(parsedParticipants) && parsedParticipants > 0
        ? parsedParticipants
        : (roster.length || 1)

    // Calculate official amounts strictly from backend logic
    const pricing = await computeSchoolPricing(participants, couponCode)
    if (pricing.couponError) {
      return res.status(400).json({ error: pricing.couponError })
    }
    const requiresPayment = pricing.finalAmount > 0
    const initialPaymentStatus = requiresPayment ? 'unpaid' : 'waived'

    const doc = await createWithUniqueReference(
      (reference) =>
        School.create({
          schoolName: typeof schoolName === 'string' ? schoolName.trim() : '',
          city: typeof city === 'string' ? city.trim() : '',
          coordinator: typeof coordinator === 'string' ? coordinator.trim() : '',
          phone: typeof phone === 'string' ? phone.trim() : '',
          email: typeof email === 'string' ? email.trim() : '',
          reference,
          participants,
          roster,
          couponCode: pricing.coupon?.code || '',
          grossAmount: pricing.grossAmount,
          discountAmount: pricing.discountAmount,
          payment: {
            status: initialPaymentStatus,
            amount: pricing.finalAmount,
            paidAt: requiresPayment ? undefined : new Date(),
          },
        }),
      'SCH',
    )

    // If 100% discount / waived, increment coupon usage and send confirmation email immediately
    if (!requiresPayment) {
      if (pricing.coupon) {
        await Coupon.updateOne(
          { code: pricing.coupon.code },
          { $inc: { usageCount: 1 } },
        )
      }
      sendSchoolConfirmationEmail({ school: doc }).catch((err) =>
        console.error(
          '[mailer] Failed to send waived school confirmation email:',
          err,
        ),
      )
    }

    res.status(201).json({
      reference: doc.reference,
      grossAmount: pricing.grossAmount,
      discountAmount: pricing.discountAmount,
      finalAmount: pricing.finalAmount,
      requiresPayment,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/schools/create-order — create Razorpay order for the remaining amount of a school delegation.
 */
schoolsRouter.post('/create-order', async (req, res) => {
  if (!razorpayConfigured()) {
    return res
      .status(503)
      .json({ error: 'Payments are not configured on the server.' })
  }

  const body = req.body ?? {}
  const receipt = typeof body.receipt === 'string' ? body.receipt.trim() : ''

  if (!receipt) {
    return res.status(400).json({ error: 'receipt is required.' })
  }

  try {
    const school = await School.findOne({ reference: receipt })
    if (!school) {
      return res
        .status(404)
        .json({ error: 'Unknown school registration reference.' })
    }

    if (
      school.payment?.status === 'paid' ||
      school.payment?.status === 'waived'
    ) {
      return res
        .status(400)
        .json({ error: 'This school registration is already paid.' })
    }

    const amountInRupees = Number(school.payment?.amount ?? 0)
    const amountPaise = Math.round(amountInRupees * 100)

    // Cross-check of the browser's figure against the registration's recorded fee
    if (body.amount !== undefined && body.amount !== null) {
      const amount = Number(body.amount)
      if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
        return res
          .status(400)
          .json({ error: 'amount must be an integer in paise.' })
      }
      if (amount !== amountPaise) {
        return res
          .status(400)
          .json({ error: 'Amount does not match the registration fee.' })
      }
    }

    // If remaining amount is 0, waive and complete immediately
    if (amountPaise <= 0) {
      await School.updateOne(
        { reference: receipt },
        {
          $set: {
            'payment.status': 'waived',
            'payment.paidAt': new Date(),
          },
        },
      )
      sendSchoolConfirmationEmail({ school }).catch((err) =>
        console.error(
          '[mailer] Failed to send waived school confirmation email:',
          err,
        ),
      )
      return res.json({ waived: true, reference: receipt })
    }

    const order = await createOrder({
      amountPaise,
      receipt,
    })

    await School.updateOne(
      { reference: receipt },
      { $set: { 'payment.orderId': order.id } },
    )

    return res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('school create-order failed:', err?.error ?? err)
    return res
      .status(500)
      .json({ error: 'Could not create the payment order for school.' })
  }
})

/**
 * POST /api/schools/verify-payment — verifies Razorpay payment for a school and sends confirmation email.
 */
schoolsRouter.post('/verify-payment', async (req, res) => {
  if (!razorpayConfigured()) {
    return res
      .status(503)
      .json({ error: 'Payments are not configured on the server.' })
  }

  const paymentId =
    typeof req.body?.razorpay_payment_id === 'string'
      ? req.body.razorpay_payment_id.trim()
      : ''
  const orderId =
    typeof req.body?.razorpay_order_id === 'string'
      ? req.body.razorpay_order_id.trim()
      : ''
  const signature =
    typeof req.body?.razorpay_signature === 'string'
      ? req.body.razorpay_signature.trim()
      : ''
  const reference =
    typeof req.body?.reference === 'string' ? req.body.reference.trim() : ''

  if (!paymentId || !orderId || !signature) {
    return res.status(400).json({
      error:
        'razorpay_payment_id, razorpay_order_id and razorpay_signature are required strings.',
    })
  }
  if (!reference) {
    return res.status(400).json({ error: 'reference string is required.' })
  }

  const valid = verifySignature({ orderId, paymentId, signature })
  if (!valid) {
    return res
      .status(400)
      .json({ error: 'Payment signature verification failed.' })
  }

  try {
    const school = await School.findOne({ reference })
    if (!school) {
      return res
        .status(404)
        .json({ error: 'Unknown school registration reference.' })
    }

    const storedOrderId = school.payment?.orderId ?? ''
    if (storedOrderId && storedOrderId !== orderId) {
      return res
        .status(400)
        .json({ error: 'This order was not created for this school registration.' })
    }

    // Prevent duplicate crediting
    const duplicatePayment = await School.findOne({
      'payment.paymentId': paymentId,
      reference: { $ne: reference },
    }).lean()

    if (duplicatePayment) {
      return res.status(409).json({
        error:
          'This payment ID has already been credited to another registration.',
      })
    }

    const updatedSchool = await School.findOneAndUpdate(
      { reference },
      {
        $set: {
          'payment.status': 'paid',
          'payment.orderId': orderId,
          'payment.paymentId': paymentId,
          'payment.paidAt': new Date(),
        },
      },
      { new: true },
    ).lean()

    // Increment coupon usage count
    if (updatedSchool.couponCode) {
      await Coupon.updateOne(
        { code: updatedSchool.couponCode },
        { $inc: { usageCount: 1 } },
      )
    }

    // Send confirmation email asynchronously
    sendSchoolConfirmationEmail({ school: updatedSchool }).catch((err) =>
      console.error(
        '[mailer] Failed to send school confirmation email upon payment:',
        err,
      ),
    )

    return res.json({
      ok: true,
      reference,
      paymentId,
    })
  } catch (err) {
    console.error('school verify-payment failed:', err)
    return res
      .status(500)
      .json({ error: 'Could not record the school payment. Please contact support.' })
  }
})
