import { Router } from 'express'

import { createWithUniqueReference } from '../lib/reference.js'
import { School } from '../models/School.js'

export const schoolsRouter = Router()

/**
 * POST /api/schools — a school submits a bulk entry with a student roster.
 */
schoolsRouter.post('/', async (req, res, next) => {
  try {
    const { schoolName, city, coordinator, phone, email } = req.body ?? {}
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
        : roster.length

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
        }),
      'SCH',
    )

    res.status(201).json({ reference: doc.reference })
  } catch (err) {
    next(err)
  }
})
