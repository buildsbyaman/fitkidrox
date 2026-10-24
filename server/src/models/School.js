import mongoose from 'mongoose'

import { isEmail, isPhone } from '../lib/validate.js'

const { Schema, model } = mongoose

/** One student on a school's bulk-entry roster. */
const RosterEntrySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    dob: {
      type: String,
      required: true,
      validate: {
        validator: (v) => !Number.isNaN(Date.parse(v)),
        message: 'dob must be a date.',
      },
    },
    gender: { type: String, trim: true, default: '' },
    tshirt: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
  },
  { _id: false },
)

/**
 * A school submitting a bulk entry. `participants` is the count of valid
 * roster rows at submit time; `roster` keeps the actual rows.
 */
const SchoolSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },

    schoolName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    city: { type: String, required: true, trim: true, maxlength: 120 },
    coordinator: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
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
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      validate: { validator: isEmail, message: 'email must be a valid email.' },
    },

    participants: { type: Number, required: true, min: 1 },
    roster: { type: [RosterEntrySchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
)

export const School = model('School', SchoolSchema, 'schools')
