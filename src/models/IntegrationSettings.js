import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    key: { type: String, enum: ['global'], unique: true, required: true },
    revision: { type: Number, default: 0, min: 0 },
    encrypted: { type: String, required: true, select: false },
    history: [
      { _id: false, savedAt: Date, savedBy: mongoose.Schema.Types.ObjectId, fields: [String] },
    ],
  },
  { timestamps: true },
);
export default mongoose.model('IntegrationSettings', schema);
