import { quoteAuditEntry } from '../utils/quoteAudit.js';
import mongoose from 'mongoose';
import Quote from '../models/Quote.js';
import Product from '../models/Product.js';
import {
  quoteSubmission,
  submissionHash,
  snapshotQuoteItems,
  quotePricing,
  quoteStatuses,
} from '../utils/quotes.js';
import { leadFields, leadFilter } from '../utils/leadFields.js';
import { notifyNewLead } from '../utils/notifications.js';
import {
  asyncHandler,
  successResponse,
  errorResponse,
  paginateResponse,
} from '../utils/apiResponse.js';
import { getPagination } from '../utils/pagination.js';

export const submitQuote = asyncHandler(async (req, res) => {
  const payload = quoteSubmission(req.body);
  const hash = submissionHash(payload);
  const existing = await Quote.findOne({ requestId: payload.requestId })
    .select('+requestHash')
    .lean();
  const respond = (quote) =>
    quote.requestHash !== hash
      ? errorResponse(res, 'This request identifier was already used for another quote', 409)
      : successResponse(
          res,
          { reference: String(quote._id), status: quote.status },
          'Quote request saved',
          201,
        );
  if (existing) return respond(existing);
  const products = await Product.find({ _id: { $in: payload.items.map((item) => item.productId) } })
    .select('name sizes stockStatus')
    .lean();
  const items = snapshotQuoteItems(payload.items, products);
  let quote;
  try {
    quote = await Quote.create({
      ...payload,
      items,
      requestHash: hash,
      history: [{ status: 'New', at: new Date() }],
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const duplicate = await Quote.findOne({ requestId: payload.requestId })
      .select('+requestHash')
      .lean();
    if (!duplicate) throw error;
    return respond(duplicate);
  }
  void notifyNewLead('quote', quote._id);
  return successResponse(
    res,
    { reference: String(quote._id), status: quote.status },
    'Quote request saved',
    201,
  );
});
export const listQuotes = asyncHandler(async (req, res) => {
  if (req.query.status && !quoteStatuses.includes(req.query.status))
    return errorResponse(res, 'Invalid quote status', 400);
  const filter = leadFilter(req.query, ['Closed']);
  if (req.query.reference) {
    if (typeof req.query.reference !== 'string' || !/^[a-f0-9]{24}$/i.test(req.query.reference))
      return errorResponse(res, 'Invalid quote reference', 400);
    filter._id = req.query.reference;
  }
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
  const [quotes, total] = await Promise.all([
    Quote.find(filter).sort('-createdAt').skip(skip).limit(limit).lean(),
    Quote.countDocuments(filter),
  ]);
  return paginateResponse(res, quotes, { page, pages: Math.ceil(total / limit), total, limit });
});
export const updateQuote = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return errorResponse(res, 'Invalid quote reference', 400);
  const quote = await Quote.findById(req.params.id).lean();
  if (!quote) return errorResponse(res, 'Quote not found', 404);
  if (!Number.isInteger(req.body.version) || req.body.version !== quote.__v)
    return errorResponse(res, 'This quote changed. Refresh before saving.', 409);
  const fields = await leadFields(req.body);
  const pricing = quotePricing(quote, req.body);
  const change = { $set: { ...fields, ...pricing }, $inc: { __v: 1 } };
  const audit = quoteAuditEntry(quote, pricing, req.admin);
  if (audit) change.$push = { history: { $each: [audit], $slice: -100 } };
  const saved = await Quote.findOneAndUpdate({ _id: quote._id, __v: req.body.version }, change, {
    new: true,
    runValidators: true,
  }).lean();
  if (!saved) return errorResponse(res, 'This quote changed. Refresh before saving.', 409);
  return successResponse(res, saved, 'Quote updated');
});
