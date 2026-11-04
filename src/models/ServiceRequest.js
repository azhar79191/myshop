import mongoose from 'mongoose';

const serviceRequestSchema = new mongoose.Schema(
  {
    village: { type: String, trim: true, maxlength: 200 },
    crop: { type: String, trim: true, maxlength: 100 },
    acreage: { type: Number, min: 0, max: 1000000 },
    preferredDate: { type: Date },
    fieldPhotoIds: { type: [String], default: [], select: false },
    fieldPhotos: {
      type: [String],
      default: [],
      validate: (v) => v.length <= 3 && v.every((s) => /^https:\/\//i.test(s)),
    },
    serviceType: {
      type: String,
      required: [true, 'Service type is required'],
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      maxlength: [20, 'Phone cannot exceed 20 characters'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: ['New', 'In Progress', 'Completed', 'Cancelled'],
      default: 'New',
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    internalNotes: { type: String, maxlength: 5000, default: '' },
    followUpAt: { type: Date, default: null, index: true },
    ipAddress: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

serviceRequestSchema.index({ status: 1, createdAt: -1 });
serviceRequestSchema.index({ phone: 1 });

const ServiceRequest = mongoose.model('ServiceRequest', serviceRequestSchema);
export default ServiceRequest;
