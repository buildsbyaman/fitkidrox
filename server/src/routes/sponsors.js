import { Router } from 'express'

import { createWithUniqueReference } from '../lib/reference.js'
import { Sponsor } from '../models/Sponsor.js'

export const sponsorsRouter = Router()

/**
 * POST /api/sponsors — a sponsor sends an enquiry about a package.
 */
sponsorsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body ?? {}

    const doc = await createWithUniqueReference(
      (reference) => Sponsor.create({ ...body, reference }),
      'SPN',
    )

    res.status(201).json({ reference: doc.reference })
  } catch (err) {
    next(err)
  }
})
