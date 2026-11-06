import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    messageId: { type: String, required: true, unique: true, maxlength: 300 },
    recipient: { type: String, required: true, match: /^\d{7,15}$/ },
    receivedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['Pending', 'Delivering', 'Delivered', 'Failed'],
      default: 'Pending',
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    leaseUntil: Date,
    claimToken: String,
  },
  { timestamps: true },
);
schema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 86400 });
schema.index({ status: 1, nextAttemptAt: 1 });
export default mongoose.model('WhatsAppReply', schema);
