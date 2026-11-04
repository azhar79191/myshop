import express from 'express';
import mongoose from 'mongoose';
import NotificationDelivery from '../models/NotificationDelivery.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler, paginateResponse, successResponse, errorResponse } from '../utils/apiResponse.js';
import { getPagination } from '../utils/pagination.js';
const router = express.Router();
router.use(protect);
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
  const [rows, total] = await Promise.all([NotificationDelivery.find().select('-claimToken').sort('-createdAt').skip(skip).limit(limit).lean(), NotificationDelivery.countDocuments()]);
  return paginateResponse(res, rows, { page, pages: Math.ceil(total / limit), total, limit }, 'Notification deliveries', { configured: Boolean(process.env.LEAD_NOTIFICATION_WEBHOOK) });
}));
router.post('/:id/retry', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, 'Invalid notification reference', 400);
  if (!process.env.LEAD_NOTIFICATION_WEBHOOK) return errorResponse(res, 'Configure the notification webhook before retrying.', 503);
  const row = await NotificationDelivery.findOneAndUpdate({ _id: req.params.id, status: { $in: ['Failed', 'Disabled'] } }, { $set: { status: 'Pending', attempts: 0, nextAttemptAt: new Date(), lastError: '', leaseUntil: null, claimToken: null } }, { new: true }).select('-claimToken').lean();
  return row ? successResponse(res, row, 'Notification queued for retry') : errorResponse(res, 'This notification is already pending or delivered. Refresh the list.', 409);
}));
export default router;
