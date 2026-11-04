import mongoose from 'mongoose';
import { quoteStatuses } from '../utils/quotes.js';
const quoteSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true, select: false },
    requestHash: { type: String, required: true, select: false },
    name: { type: String, required: true, maxlength: 100 },
    phone: { type: String, required: true, maxlength: 20 },
    fulfillment: {
      type: String,
      enum: ['collection', 'delivery', 'undecided'],
      default: 'undecided',
    },
    location: { type: String, maxlength: 200, default: '' },
    items: [
      {
        _id: false,
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        size: { type: String, required: true },
        quantity: { type: Number, min: 1, max: 999, required: true },
        unitPrice: { type: Number, min: 0, default: null },
      },
    ],
    currency: { type: String, enum: ['PKR'], default: 'PKR' },
    deliveryCharge: { type: Number, min: 0, default: null },
    total: { type: Number, min: 0, default: null },
    status: { type: String, enum: quoteStatuses, default: 'New' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    followUpAt: { type: Date, default: null },
    internalNotes: { type: String, maxlength: 5000, default: '' },
    history: [
      {
        _id: false,
        type: { type: String, enum: ['status', 'pricing'], default: 'status' },
        actorName: { type: String, maxlength: 200 },
        changes: [
          {
            _id: false,
            field: { type: String, enum: ['unitPrice', 'deliveryCharge', 'total'] },
            productId: mongoose.Schema.Types.ObjectId,
            productName: String,
            pack: String,
            before: { type: Number, default: null },
            after: { type: Number, default: null },
          },
        ],
        status: { type: String, enum: quoteStatuses },
        at: Date,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      },
    ],
  },
  { timestamps: true },
);
quoteSchema.index({ status: 1, createdAt: -1 });
quoteSchema.index({ followUpAt: 1, status: 1 });
export default mongoose.model('Quote', quoteSchema);
