import mongoose from 'mongoose'

import { isEmail, isPhone, trimmed } from '../lib/validate.js'

const { Schema, model } = mongoose

/**
 * A parent registering interest for one child. Nothing is charged at this
 * stage; consent flags are stored verbatim so they can be shown later.
 */
const ParticipantSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },

    childName: {
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
    gender: { type: String, required: true, trim: true },
    tshirt: { type: String, required: true, trim: true },
    school: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },

    guardianName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    guardianPhone: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isPhone,
        message: 'guardianPhone must be a 10-digit Indian mobile number.',
      },
    },
    guardianEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: isEmail,
        message: 'guardianEmail must be a valid email.',
      },
    },
    relation: { type: String, trim: true, default: 'Parent' },
    medicalNotes: { type: String, trim: true, maxlength: 2000, default: '' },

    consentParticipation: { type: Boolean, required: true },
    consentMedical: { type: Boolean, required: true },
    consentPhotos: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
)

ParticipantSchema.pre('validate', function normalise() {
  this.guardianName = trimmed(this.guardianName)
  this.childName = trimmed(this.childName)
})

export const Participant = model(
  'Participant',
  ParticipantSchema,
  'participants',
)
