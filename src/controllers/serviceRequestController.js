import ServiceRequest from '../models/ServiceRequest.js';
import { successResponse, errorResponse, paginateResponse } from '../utils/apiResponse.js';

/**
 * @desc    Submit service request
 * @route   POST /api/service-requests
 * @access  Public
 */
export const submitServiceRequest = async (req, res, next) => {
  try {
    const { serviceType, name, phone, email, message } = req.body;

    // Validation
    if (!serviceType || !name || !phone || !message) {
      return errorResponse(res, 'Please provide all required fields', 400);
    }

    const serviceRequest = await ServiceRequest.create({
      serviceType,
      name,
      phone,
      email,
      message,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    successResponse(res, serviceRequest, 'Service request submitted successfully! We will contact you soon.', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all service requests
 * @route   GET /api/service-requests
 * @access  Private/Admin
 */
export const getAllServiceRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [requests, total] = await Promise.all([
      ServiceRequest.find(filter).sort('-createdAt').skip(skip).limit(limitNum),
      ServiceRequest.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / limitNum);

    paginateResponse(res, requests, {
      page: pageNum,
      pages,
      total,
      limit: limitNum,
    }, 'Service requests retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single service request
 * @route   GET /api/service-requests/:id
 * @access  Private/Admin
 */
export const getServiceRequestById = async (req, res, next) => {
  try {
    const request = await ServiceRequest.findById(req.params.id);

    if (!request) {
      return errorResponse(res, 'Service request not found', 404);
    }

    successResponse(res, request, 'Service request retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update service request status
 * @route   PUT /api/service-requests/:id
 * @access  Private/Admin
 */
export const updateServiceRequestStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const request = await ServiceRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!request) {
      return errorResponse(res, 'Service request not found', 404);
    }

    successResponse(res, request, 'Service request status updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete service request
 * @route   DELETE /api/service-requests/:id
 * @access  Private/Admin
 */
export const deleteServiceRequest = async (req, res, next) => {
  try {
    const request = await ServiceRequest.findById(req.params.id);

    if (!request) {
      return errorResponse(res, 'Service request not found', 404);
    }

    await request.deleteOne();

    successResponse(res, null, 'Service request deleted successfully');
  } catch (error) {
    next(error);
  }
};
