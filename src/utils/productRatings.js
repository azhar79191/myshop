import Testimonial from '../models/Testimonial.js';
import mongoose from 'mongoose';
export const withRatings = async products => {
  if (!products.length) return products;
  const summaries = await Testimonial.aggregate([
    { $match: { productId: { $in: products.map(product => new mongoose.Types.ObjectId(product._id)) }, isApproved: true } },
    { $group: { _id: '$productId', average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const byId = new Map(summaries.map(item => [String(item._id), item]));
  return products.map(product => {
    const summary = byId.get(String(product._id));
    return { ...product, ratings: { average: summary?.average || 0, count: summary?.count || 0 } };
  });
};
