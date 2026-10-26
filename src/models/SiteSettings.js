import mongoose from 'mongoose';

const siteSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'global',
      unique: true,
      immutable: true,
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    history: [{
      _id: false,
      savedAt: { type: Date, required: true },
      savedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
      name: { type: String, required: true },
      action: { type: String, enum: ['settings', 'logo'], required: true },
    }],
  },
  { timestamps: true }
);

const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);
export default SiteSettings;
