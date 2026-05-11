import FAQ from '../models/FAQ.js';
import { successResponse, errorResponse, asyncHandler } from '../utils/apiResponse.js';

/**
 * @desc    Get all FAQs
 * @route   GET /api/faqs
 * @access  Public
 */
export const getFAQs = asyncHandler(async (req, res) => {
  const { category } = req.query;

  const filter = { isActive: true };
  if (category) filter.category = category;

  const faqs = await FAQ.find(filter).sort({ order: 1, createdAt: 1 }).lean();
  return successResponse(res, faqs, 'FAQs retrieved successfully');
});

/**
 * @desc    Get single FAQ by ID
 * @route   GET /api/faqs/:id
 * @access  Public
 */
export const getFAQById = asyncHandler(async (req, res) => {
  const faq = await FAQ.findById(req.params.id).lean();
  if (!faq) {
    return errorResponse(res, 'FAQ not found', 404);
  }
  return successResponse(res, faq, 'FAQ retrieved successfully');
});

/**
 * @desc    Create new FAQ
 * @route   POST /api/faqs
 * @access  Admin
 */
export const createFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.create(req.body);
  return successResponse(res, faq, 'FAQ created successfully', 201);
});

/**
 * @desc    Update FAQ
 * @route   PUT /api/faqs/:id
 * @access  Admin
 */
export const updateFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!faq) {
    return errorResponse(res, 'FAQ not found', 404);
  }

  return successResponse(res, faq, 'FAQ updated successfully');
});

/**
 * @desc    Delete FAQ
 * @route   DELETE /api/faqs/:id
 * @access  Admin
 */
export const deleteFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.findByIdAndDelete(req.params.id);
  if (!faq) {
    return errorResponse(res, 'FAQ not found', 404);
  }
  return successResponse(res, null, 'FAQ deleted successfully');
});

/**
 * @desc    Get FAQ categories
 * @route   GET /api/faqs/categories/all
 * @access  Public
 */
export const getFAQCcategories = asyncHandler(async (req, res) => {
  const categories = await FAQ.distinct('category', { isActive: true });
  return successResponse(res, categories, 'FAQ categories retrieved successfully');
});
