import { Router } from 'express'

import {
  ENTRY_FEE_PAISE,
  MIN_AMOUNT_PAISE,
  createOrder,
  feeConfigured,
  razorpayConfigured,
  verifySignature,
} from '../lib/razorpay.js'
import { assignBibToParticipant } from '../lib/bib.js'
import { syncCouponUsageCount } from '../lib/coupon.js'
import { sendParticipantConfirmationEmail } from '../lib/mailer.js'
import { Participant } from '../models/Participant.js'

export const paymentsRouter = Router()

/**
 * POST /api/create-order — body { amount? (paise), currency?, receipt }.
 *
 * The order is always created for ENTRY_FEE_PAISE, never the client's
 * figure: if a stale (or tampered) bundle sends a different amount we answer
 * 400 instead of charging the wrong price. The secret key is used here and
 * nowhere else.
 */
paymentsRouter.post('/create-order', async (req, res) => {
  if (!razorpayConfigured()) {
    return res
      .status(503)
      .json({ error: 'Payments are not configured on the server.' })
  }
  if (!feeConfigured()) {
    return res
      .status(503)
      .json({ error: 'The entry fee is not configured on the server.' })
  }

  const body = req.body ?? {}
  const receipt = typeof body.receipt === 'string' ? body.receipt.trim() : ''

  if (!receipt) {
    return res.status(400).json({ error: 'receipt is required.' })
  }

  try {
    // Only an existing participant registration can get an order; arbitrary
    // receipts would otherwise create orphan orders against the Razorpay account.
    const participant = await Participant.findOne({ reference: receipt })
    if (!participant) {
      return res
        .status(400)
        .json({ error: 'Unknown registration reference.' })
    }

    if (
      participant.payment?.status === 'paid' ||
      participant.payment?.status === 'waived'
    ) {
      return res
        .status(400)
        .json({ error: 'Registration has already been paid.' })
    }

    const expectedAmount = Number(
      participant.payment?.amount ?? (ENTRY_FEE_PAISE / 100),
    )
    const expectedPaise = Math.round(expectedAmount * 100)

    // If remaining fee is zero or fully waived, mark waived and bypass Razorpay
    if (expectedPaise <= 0) {
      await Participant.updateOne(
        { reference: receipt },
        {
          $set: {
            'payment.status': 'waived',
            'payment.paidAt': new Date(),
          },
        },
      )
      if (participant.couponCode) {
        await syncCouponUsageCount(participant.couponCode).catch(() => null)
      }
      return res.json({ waived: true, reference: receipt })
    }

    if (expectedPaise < MIN_AMOUNT_PAISE) {
      return res
        .status(400)
        .json({ error: `amount must be at least ${MIN_AMOUNT_PAISE} paise.` })
    }

    // Cross-check of the browser's figure against the registration's recorded fee
    if (body.amount !== undefined && body.amount !== null) {
      const amount = Number(body.amount)

      if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
        return res
          .status(400)
          .json({ error: 'amount must be an integer in paise.' })
      }
      if (amount < MIN_AMOUNT_PAISE) {
        return res
          .status(400)
          .json({ error: `amount must be at least ${MIN_AMOUNT_PAISE} paise.` })
      }
      if (amount !== expectedPaise) {
        return res
          .status(400)
          .json({ error: 'Amount does not match the registration fee.' })
      }
    }

    const order = await createOrder({
      amountPaise: expectedPaise,
      receipt,
    })
    await Participant.updateOne(
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
    if (err?.statusCode === 401) {
      return res
        .status(401)
        .json({ error: 'Razorpay authentication failed. Check the API keys.' })
    }
    console.error('create-order failed:', err?.error ?? err)
    return res
      .status(500)
      .json({ error: 'Could not create the payment order.' })
  }
})

/**
 * POST /api/verify-payment — body
 * { razorpay_payment_id, razorpay_order_id, razorpay_signature, reference }.
 *
 * A mismatch answers 400 and leaves the participant 'unpaid'.
 */
paymentsRouter.post('/verify-payment', async (req, res) => {
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
    const participant = await Participant.findOne({ reference }).lean()

    if (!participant) {
      return res.status(404).json({ error: 'Unknown registration reference.' })
    }

    // The order was bound to this reference when create-order ran. A signature
    // for any *other* order in the account — including one whose first verify
    // never landed — must not be able to credit this registration.
    const storedOrderId = participant.payment?.orderId ?? ''
    if (storedOrderId && storedOrderId !== orderId) {
      return res
        .status(400)
        .json({ error: 'This order was not created for this registration.' })
    }

    // Prevent replay attacks: ensure paymentId hasn't been used on another participant
    const duplicatePayment = await Participant.findOne({
      'payment.paymentId': paymentId,
      reference: { $ne: reference },
    }).lean()

    if (duplicatePayment) {
      return res.status(409).json({
        error:
          'This payment ID has already been credited to another registration.',
      })
    }

    // Atomic update: only transition if not already marked paid, and only for
    // an order that belongs to this reference (re-checked under the lock so
    // the binding can't be raced between the read above and this write).
    const result = await Participant.updateOne(
      {
        reference,
        'payment.status': { $ne: 'paid' },
        $or: [
          { 'payment.orderId': { $in: ['', null] } },
          { 'payment.orderId': orderId },
        ],
      },
      {
        $set: {
          'payment.status': 'paid',
          'payment.orderId': orderId,
          'payment.paymentId': paymentId,
          'payment.paidAt': new Date(),
        },
      },
    )

    if (result.matchedCount === 0 && participant.payment?.status !== 'paid') {
      return res
        .status(400)
        .json({ error: 'Could not update registration payment.' })
    }

    // Assign unique category-based bib number permanently upon verified payment
    const bibResult = await assignBibToParticipant(participant._id, {
      ParticipantModel: Participant,
      allowReserved: false,
    })

    // Sync coupon usage count if a coupon was used
    if (participant.couponCode) {
      await syncCouponUsageCount(participant.couponCode).catch(() => null)
    }

    // Send branded confirmation email to parent/guardian
    sendParticipantConfirmationEmail({
      participant: {
        ...participant,
        payment: {
          ...participant.payment,
          status: 'paid',
          orderId,
          paymentId,
        },
      },
      bibNumber: bibResult.bibNumber,
      heat: bibResult.heat,
      course: bibResult.course,
    }).catch((err) =>
      console.error('[mailer] Failed to send participant confirmation email:', err),
    )

    return res.json({
      ok: true,
      paymentId,
      bibNumber: bibResult.bibNumber,
      heat: bibResult.heat,
      course: bibResult.course,
      courseCode: bibResult.courseCode,
      message:
        result.matchedCount === 0 && participant.payment?.status === 'paid'
          ? 'Already marked as paid.'
          : undefined,
    })
  } catch (err) {
    console.error('verify-payment failed:', err)
    return res
      .status(500)
      .json({ error: 'Could not record the payment. Please contact support.' })
  }
})

