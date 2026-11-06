import mongoose from 'mongoose';
const audio = { bytes: { type: Buffer, required: true }, mime: { type: String, required: true } };
export const VoiceEnquiry = mongoose.model(
  'VoiceEnquiry',
  new mongoose.Schema(
    {
      phone: { type: String, required: true },
      category: { type: String, enum: ['crop', 'product', 'service'], required: true },
      status: { type: String, enum: ['New', 'Replied'], default: 'New' },
      audio,
    },
    { timestamps: true },
  ),
);
export const VoicePrompt = mongoose.model(
  'VoicePrompt',
  new mongoose.Schema(
    {
      key: { type: String, unique: true, enum: ['welcome', 'received'] },
      audio,
    },
    { timestamps: true },
  ),
);
