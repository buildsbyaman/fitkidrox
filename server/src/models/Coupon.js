import mongoose from 'mongoose'

const { Schema, model } = mongoose

/**
 * Coupon model for dynamic discount codes (e.g. for partner schools).
 */
const CouponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    discountType: {
      type: String,
      enum: ['per_student_rate', 'percentage', 'fixed'],
      default: 'per_student_rate',
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    applicableTo: {
      type: String,
      enum: ['schools', 'individual', 'both'],
      default: 'both',
      index: true,
    },
    minPriorRegistrations: {
      type: Number,
      min: 0,
      default: 0,
    },
    minStudents: {
      type: Number,
      min: 0,
      default: 0,
    },
    maxDiscount: {
      type: Number,
      min: 0,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
)

export const Coupon = model('Coupon', CouponSchema, 'coupons')

