import mongoose from 'mongoose'

const { Schema, model } = mongoose

/**
 * Persistent user session stored in MongoDB with a TTL index.
 * Automatically removed by MongoDB after expiresAt.
 */
const UserSessionSchema = new Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  },
)

export const UserSession =
  mongoose.models.UserSession || model('UserSession', UserSessionSchema)

