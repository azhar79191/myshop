import 'dotenv/config';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Testimonial from '../models/Testimonial.js';
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
const apply = process.argv.includes('--apply');
try {
  await mongoose.connect(process.env.MONGODB_URI);
  let linked = 0, unresolved = 0;
  for await (const review of Testimonial.find({ productId: { $exists: false }, productUsed: { $type: 'string', $ne: '' } }).cursor()) {
    const candidates = await Product.find({ name: review.productUsed }).select('_id').limit(2).lean();
    if (candidates.length !== 1) { unresolved++; continue; }
    if (apply) await Testimonial.updateOne({ _id: review._id, productId: { $exists: false } }, { $set: { productId: candidates[0]._id } });
    linked++;
  }
  console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', unambiguousMatches: linked, unresolved }));
} finally { await mongoose.disconnect(); }
