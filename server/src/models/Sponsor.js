import mongoose from 'mongoose'

import { isEmail, isPhone } from '../lib/validate.js'

const { Schema, model } = mongoose

/** A sponsor enquiry against one of the packages in src/data/fixtures.ts. */
const SponsorSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },

    company: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    contact: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      validate: { validator: isEmail, message: 'email must be a valid email.' },
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isPhone,
        message: 'phone must be a 10-digit Indian mobile number.',
      },
    },

    packageId: { type: String, required: true, trim: true },
    message: { type: String, trim: true, maxlength: 4000, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
)

export const Sponsor = model('Sponsor', SponsorSchema, 'sponsors')
