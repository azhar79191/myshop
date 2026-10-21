import mongoose from 'mongoose';
const gallerySchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500 },
  mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
  image: { type: String, required: function () { return this.mediaType !== 'video'; } },
  video: { type: String, required: function () { return this.mediaType === 'video'; } },
  poster: { type: String, default: '' },
  storageKey: { type: String, default: '' },
  posterKey: { type: String, default: '' },
  mimeType: String,
  fileSize: Number,
  category: { type: String, trim: true, maxlength: 50, default: 'Other' },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
gallerySchema.index({ category: 1, order: 1 });
gallerySchema.index({ isActive: 1 });
export default mongoose.model('Gallery', gallerySchema);
