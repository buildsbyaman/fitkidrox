import mongoose from 'mongoose'

import { isEmail, isPhone, trimmed } from '../lib/validate.js'

const { Schema, model } = mongoose

/**
 * A parent's registration for one child. The payment block starts as
 * 'unpaid' and is only flipped to 'paid' when the Razorpay signature for the
 * order verifies. Consent flags are stored verbatim so they can be shown
 * later.
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
      validate: [
        {
          validator: (v) => !Number.isNaN(Date.parse(v)),
          message: 'dob must be a valid date.',
        },
        {
          validator: (v) => {
            const birth = new Date(v)
            const eventDate = new Date('2026-11-28')
            let age = eventDate.getFullYear() - birth.getFullYear()
            const m = eventDate.getMonth() - birth.getMonth()
            if (m < 0 || (m === 0 && eventDate.getDate() < birth.getDate())) age--
            return age >= 3
          },
          message:
            'Participants must be at least 3 years old on event day (born on or before 28 Nov 2023).',
        },
      ],
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

    payment: {
      status: {
        type: String,
        enum: ['unpaid', 'paid', 'failed'],
        default: 'unpaid',
      },
      amount: { type: Number, default: 1250 },
      orderId: { type: String, default: '' },
      paymentId: { type: String, default: '', index: true },
      paidAt: { type: Date },
    },

    isManual: { type: Boolean, default: false, index: true },

    bibNumber: {
      type: Number,
      index: { unique: true, sparse: true },
    },
    heat: { type: Number, index: true },
    course: { type: String, trim: true },
    checkedIn: { type: Boolean, default: false, index: true },
    checkedInAt: { type: Date },
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
