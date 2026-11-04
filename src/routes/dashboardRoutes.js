import express from 'express';
import Quote from '../models/Quote.js';
import { lowStockFilter, missingProductFilter } from '../utils/catalogAttention.js';
import Product from '../models/Product.js';
import Contact from '../models/Contact.js';
import ServiceRequest from '../models/ServiceRequest.js';
import Testimonial from '../models/Testimonial.js';
import Gallery from '../models/Gallery.js';
import FAQ from '../models/FAQ.js';
import Brand from '../models/Brand.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler, successResponse } from '../utils/apiResponse.js';
const router = express.Router();
router.get(
  '/',
  protect,
  asyncHandler(async (req, res) => {
    const now = new Date();
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: 'numeric',
      })
        .formatToParts(now)
        .map((part) => [part.type, part.value]),
    );
    const year = Number(parts.year),
      month = Number(parts.month) - 1;
    const start = new Date(Date.UTC(year, month - 5, 1) - 5 * 60 * 60 * 1000);
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(Date.UTC(year, month - 5 + index, 1));
      return {
        key: date.toISOString().slice(0, 7),
        label: date.toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      };
    });
    const monthly = (Model) =>
      Model.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'Asia/Karachi' },
            },
            count: { $sum: 1 },
          },
        },
      ]);
    const [
      products,
      contacts,
      services,
      pendingReviews,
      lowStock,
      overdueContacts,
      overdueServices,
      newContacts,
      newServices,
      categories,
      contactMonths,
      productMonths,
      gallery,
      faqs,
      brands,
      testimonials,
      newQuotes,
      overdueQuotes,
      missingDetails,
    ] = await Promise.all([
      Product.countDocuments(),
      Contact.countDocuments(),
      ServiceRequest.countDocuments(),
      Testimonial.countDocuments({ isApproved: false }),
      Product.countDocuments(lowStockFilter),
      Contact.countDocuments({
        followUpAt: { $lt: now },
        status: { $nin: ['Replied', 'Archived'] },
      }),
      ServiceRequest.countDocuments({
        followUpAt: { $lt: now },
        status: { $nin: ['Completed', 'Cancelled'] },
      }),
      Contact.countDocuments({ status: 'New' }),
      ServiceRequest.countDocuments({ status: 'New' }),
      Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      monthly(Contact),
      monthly(Product),
      Gallery.countDocuments(),
      FAQ.countDocuments(),
      Brand.countDocuments(),
      Testimonial.countDocuments(),
      Quote.countDocuments({ status: 'New' }),
      Quote.countDocuments({ followUpAt: { $lt: now }, status: { $ne: 'Closed' } }),
      Product.countDocuments(missingProductFilter),
    ]);
    successResponse(res, {
      months,
      products,
      contacts,
      services,
      pendingReviews,
      lowStock,
      overdue: overdueContacts + overdueServices + overdueQuotes,
      overdueContacts,
      overdueServices,
      overdueQuotes,
      newQuotes,
      missingDetails,
      newContacts,
      newServices,
      categories,
      contactMonths,
      productMonths,
      gallery,
      faqs,
      brands,
      testimonials,
    });
  }),
);
export default router;
