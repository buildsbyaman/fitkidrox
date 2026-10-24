import { Router } from 'express'

import { createWithUniqueReference } from '../lib/reference.js'
import { Participant } from '../models/Participant.js'

export const participantsRouter = Router()

/**
 * POST /api/participants — a parent registers interest for one child.
 */
participantsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body ?? {}

    const doc = await createWithUniqueReference(
      (reference) =>
        Participant.create({
          ...body,
          reference,
          consentParticipation: body.consentParticipation === true,
          consentMedical: body.consentMedical === true,
          consentPhotos: body.consentPhotos === true,
        }),
      'FKX',
    )

    res.status(201).json({ reference: doc.reference })
  } catch (err) {
    next(err)
  }
})
