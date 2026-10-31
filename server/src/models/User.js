import mongoose from 'mongoose'

const { Schema, model } = mongoose

/**
 * Registered parent / user authenticated via Google Sign-In.
 */
const UserSchema = new Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    picture: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  },
)

export const User = mongoose.models.User || model('User', UserSchema)

