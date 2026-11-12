import { Coupon } from '../models/Coupon.js'
import { Participant } from '../models/Participant.js'
import { School } from '../models/School.js'

const ACTIVE_PAYMENT_STATUSES = ['paid', 'waived']

/**
 * Recomputes a coupon's usageCount from live paid/waived Participant and School
 * records so deletes, status edits, or repeated verify calls cannot drift.
 */
export async function syncCouponUsageCount(
  code,
  {
    CouponModel = Coupon,
    ParticipantModel = Participant,
    SchoolModel = School,
  } = {},
) {
  const normalized =
    typeof code === 'string' ? code.trim().toUpperCase() : ''
  if (!normalized) return 0

  const [participantCount, schoolCount] = await Promise.all([
    ParticipantModel.countDocuments({
      couponCode: normalized,
      'payment.status': { $in: ACTIVE_PAYMENT_STATUSES },
    }),
    SchoolModel.countDocuments({
      couponCode: normalized,
      'payment.status': { $in: ACTIVE_PAYMENT_STATUSES },
    }),
  ])

  const total = participantCount + schoolCount
  await CouponModel.updateOne(
    { code: normalized },
    { $set: { usageCount: total } },
  )

  return total
}

/**
 * Reconciles usageCount for every coupon in the database against live
 * paid/waived registrations.
 */
export async function syncAllCouponUsageCounts({
  CouponModel = Coupon,
  ParticipantModel = Participant,
  SchoolModel = School,
} = {}) {
  const [coupons, participantAgg, schoolAgg] = await Promise.all([
    CouponModel.find({}, { code: 1, usageCount: 1 }).lean(),
    ParticipantModel.aggregate([
      {
        $match: {
          couponCode: { $exists: true, $ne: '' },
          'payment.status': { $in: ACTIVE_PAYMENT_STATUSES },
        },
      },
      { $group: { _id: { $toUpper: '$couponCode' }, count: { $sum: 1 } } },
    ]),
    SchoolModel.aggregate([
      {
        $match: {
          couponCode: { $exists: true, $ne: '' },
          'payment.status': { $in: ACTIVE_PAYMENT_STATUSES },
        },
      },
      { $group: { _id: { $toUpper: '$couponCode' }, count: { $sum: 1 } } },
    ]),
  ])

  const counts = new Map()
  for (const row of [...participantAgg, ...schoolAgg]) {
    if (!row?._id) continue
    counts.set(row._id, (counts.get(row._id) || 0) + Number(row.count || 0))
  }

  const updates = []
  for (const c of coupons) {
    const actual = counts.get(c.code) || 0
    if ((c.usageCount || 0) !== actual) {
      updates.push(
        CouponModel.updateOne(
          { _id: c._id },
          { $set: { usageCount: actual } },
        ),
      )
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates)
  }

  return updates.length
}

