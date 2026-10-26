import { Router } from 'express'

import { createWithUniqueReference } from '../lib/reference.js'
import { Sponsor } from '../models/Sponsor.js'

export const sponsorsRouter = Router()

/**
 * POST /api/sponsors — a sponsor sends an enquiry about a package.
 */
sponsorsRouter.post('/', async (req, res, next) => {
  try {
    const { company, contact, email, phone, packageId, message } =
      req.body ?? {}

    const doc = await createWithUniqueReference(
      (reference) =>
        Sponsor.create({
          company: typeof company === 'string' ? company.trim() : '',
          contact: typeof contact === 'string' ? contact.trim() : '',
          email: typeof email === 'string' ? email.trim() : '',
          phone: typeof phone === 'string' ? phone.trim() : '',
          packageId: typeof packageId === 'string' ? packageId.trim() : '',
          message: typeof message === 'string' ? message.trim() : '',
          reference,
        }),
      'SPN',
    )

    res.status(201).json({ reference: doc.reference })
  } catch (err) {
    next(err)
  }
})
