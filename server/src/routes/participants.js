import { Router } from 'express'

import { createWithUniqueReference } from '../lib/reference.js'
import { Participant } from '../models/Participant.js'
import { requireUserAuth } from '../user-auth.js'

export const participantsRouter = Router()

/**
 * POST /api/participants — a logged-in parent registers interest for one child.
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
    } = req.body ?? {}

    // Strictly enforce Google account email and link user ID
    const guardianEmail = req.user.email
    const userId = req.user._id

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
          payment: {
            status: 'unpaid',
            orderId: '',
            paymentId: '',
          },
          isManual: false,
        }),
      'FKX',
    )

    res.status(201).json({ reference: doc.reference })
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
