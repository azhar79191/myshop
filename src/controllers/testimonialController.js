import Testimonial from '../models/Testimonial.js';
import { successResponse, errorResponse, paginateResponse } from '../utils/apiResponse.js';

/**
 * @desc    Submit testimonial/feedback
 * @route   POST /api/testimonials
 * @access  Public
 */
export const submitTestimonial = async (req, res, next) => {
  try {
    const { name, email, phone, location, rating, message, productUsed } = req.body;

    // Validation
    if (!name || !rating || !message) {
      return errorResponse(res, 'Please provide name, rating, and message', 400);
    }

    if (rating < 1 || rating > 5) {
      return errorResponse(res, 'Rating must be between 1 and 5', 400);
    }

    const testimonial = await Testimonial.create({
      name,
      email,
      phone,
      location,
      rating,
      message,
      productUsed,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    successResponse(res, testimonial, 'Thank you for your feedback! It will be reviewed by our team.', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get approved testimonials (public)
 * @route   GET /api/testimonials/approved
 * @access  Public
 */
export const getApprovedTestimonials = async (req, res, next) => {
  try {
    const { limit = 10, featured } = req.query;

    const filter = { isApproved: true };
    if (featured === 'true') filter.isFeatured = true;

    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10)));

    const testimonials = await Testimonial.find(filter)
      .sort({ isFeatured: -1, rating: -1, createdAt: -1 })
      .limit(limitNum)
      .select('-email -phone -ipAddress -approvedBy');

    successResponse(res, testimonials, 'Testimonials retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all testimonials (admin)
 * @route   GET /api/testimonials
 * @access  Private/Admin
 */
export const getAllTestimonials = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, isApproved, rating } = req.query;

    const filter = {};
    if (isApproved !== undefined) filter.isApproved = isApproved === 'true';
    if (rating) filter.rating = parseInt(rating, 10);

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [testimonials, total] = await Promise.all([
      Testimonial.find(filter).sort('-createdAt').skip(skip).limit(limitNum),
      Testimonial.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / limitNum);

    paginateResponse(res, testimonials, {
      page: pageNum,
      pages,
      total,
      limit: limitNum,
    }, 'Testimonials retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single testimonial
 * @route   GET /api/testimonials/:id
 * @access  Private/Admin
 */
export const getTestimonialById = async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);

    if (!testimonial) {
      return errorResponse(res, 'Testimonial not found', 404);
    }

    successResponse(res, testimonial, 'Testimonial retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve/reject testimonial
 * @route   PUT /api/testimonials/:id/approve
 * @access  Private/Admin
 */
export const approveTestimonial = async (req, res, next) => {
  try {
    const { isApproved, isFeatured } = req.body;

    const updateData = {
      isApproved: isApproved !== undefined ? isApproved : true,
    };

    if (isApproved) {
      updateData.approvedBy = req.user._id;
      updateData.approvedAt = new Date();
    }

    if (isFeatured !== undefined) {
      updateData.isFeatured = isFeatured;
    }

    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!testimonial) {
      return errorResponse(res, 'Testimonial not found', 404);
    }

    successResponse(res, testimonial, `Testimonial ${isApproved ? 'approved' : 'rejected'} successfully`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete testimonial
 * @route   DELETE /api/testimonials/:id
 * @access  Private/Admin
 */
export const deleteTestimonial = async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);

    if (!testimonial) {
      return errorResponse(res, 'Testimonial not found', 404);
    }

    await testimonial.deleteOne();

    successResponse(res, null, 'Testimonial deleted successfully');
  } catch (error) {
    next(error);
  }
};
