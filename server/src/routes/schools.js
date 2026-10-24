import { Router } from 'express'

import { createWithUniqueReference } from '../lib/reference.js'
import { School } from '../models/School.js'

export const schoolsRouter = Router()

/**
 * POST /api/schools — a school submits a bulk entry with a student roster.
 */
schoolsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body ?? {}
    const roster = Array.isArray(body.roster) ? body.roster : []

    const parsedParticipants = Number(body.participants)
    const participants =
      Number.isFinite(parsedParticipants) && parsedParticipants > 0
        ? parsedParticipants
        : roster.length

    const doc = await createWithUniqueReference(
      (reference) =>
        School.create({
          ...body,
          reference,
          participants,
          roster,
        }),
      'SCH',
    )

    res.status(201).json({ reference: doc.reference })
  } catch (err) {
    next(err)
  }
})
