import { Router } from 'express'

import { createWithUniqueReference } from '../lib/reference.js'
import { Participant } from '../models/Participant.js'

export const participantsRouter = Router()

/**
 * POST /api/participants — a parent registers interest for one child.
 */
participantsRouter.post('/', async (req, res, next) => {
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
      guardianEmail,
      relation,
      medicalNotes,
    } = req.body ?? {}

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
          guardianEmail:
            typeof guardianEmail === 'string' ? guardianEmail.trim() : '',
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
