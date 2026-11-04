import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['contact', 'service', 'quote'], required: true },
    reference: { type: mongoose.Schema.Types.ObjectId, required: true },
    status: {
      type: String,
      enum: ['Pending', 'Delivering', 'Delivered', 'Failed', 'Disabled'],
      default: 'Pending',
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    leaseUntil: { type: Date, default: null },
    claimToken: { type: String, default: null },
    lastAttemptAt: Date,
    deliveredAt: Date,
    lastError: { type: String, maxlength: 200, default: '' },
  },
  { timestamps: true },
);
schema.index({ kind: 1, reference: 1 }, { unique: true });
schema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });
export default mongoose.model('NotificationDelivery', schema);
