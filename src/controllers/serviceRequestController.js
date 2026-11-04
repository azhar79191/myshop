import { uploadFieldPhotos, retireFieldPhotos } from '../utils/fieldPhotos.js';
import ServiceRequest from '../models/ServiceRequest.js';
import { leadFields, leadFilter } from '../utils/leadFields.js';
import { notifyNewLead } from '../utils/notifications.js';
import { successResponse, errorResponse, paginateResponse } from '../utils/apiResponse.js';
import { getPagination } from '../utils/pagination.js';

/**
 * @desc    Submit service request
 * @route   POST /api/service-requests
 * @access  Public
 */
export const submitServiceRequest = async (req, res, next) => {
  let photos = [];
  try {
    const { serviceType, name, phone, email, message } = req.body;

    if (
      [serviceType, name, phone, email, message].some(
        (value) => value !== undefined && typeof value !== 'string',
      )
    )
      return errorResponse(res, 'Contact fields must be text', 400);
    if (phone && !/^\+?[0-9]{7,15}$/.test(phone.replace(/[\s()-]/g, '')))
      return errorResponse(res, 'Provide a valid phone number', 400);

    // Validation
    if (!serviceType || !name || !phone || !message) {
      return errorResponse(res, 'Please provide all required fields', 400);
    }

    const dateParts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .formatToParts(new Date())
        .map((part) => [part.type, part.value]),
    );
    const businessToday = new Date(
      `${dateParts.year}-${dateParts.month}-${dateParts.day}T00:00:00Z`,
    );
    if (
      req.body.preferredDate &&
      (!Number.isFinite(new Date(req.body.preferredDate).getTime()) ||
        new Date(req.body.preferredDate) < businessToday)
    )
      return errorResponse(res, 'Choose today or a future service date', 400);
    const draft = new ServiceRequest({
      serviceType,
      name,
      phone,
      email,
      message,
      ...Object.fromEntries(
        ['village', 'crop', 'acreage', 'preferredDate']
          .filter((k) => req.body[k] !== undefined && req.body[k] !== '')
          .map((k) => [k, req.body[k]]),
      ),
    });
    await draft.validate();
    photos = await uploadFieldPhotos(req.body.fieldPhotos);
    const serviceRequest = await ServiceRequest.create({
      fieldPhotos: photos.map((photo) => photo.secure_url),
      fieldPhotoIds: photos.map((photo) => photo.public_id),
      ...Object.fromEntries(
        ['village', 'crop', 'acreage', 'preferredDate']
          .filter((k) => req.body[k] !== undefined && req.body[k] !== '')
          .map((k) => [k, req.body[k]]),
      ),
      serviceType,
      name,
      phone,
      email,
      message,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    void notifyNewLead('service', serviceRequest._id);
    successResponse(
      res,
      { reference: String(serviceRequest._id) },
      'Service request submitted successfully! We will contact you soon.',
      201,
    );
  } catch (error) {
    await retireFieldPhotos(photos);
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
    const filter = leadFilter(req.query, ['Completed', 'Cancelled']);

    const { page: pageNum, limit: limitNum, skip } = getPagination(req.query.page, req.query.limit);

    const [requests, total] = await Promise.all([
      ServiceRequest.find(filter).sort('-createdAt').skip(skip).limit(limitNum),
      ServiceRequest.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / limitNum);

    paginateResponse(
      res,
      requests,
      {
        page: pageNum,
        pages,
        total,
        limit: limitNum,
      },
      'Service requests retrieved successfully',
    );
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
    const fields = await leadFields(req.body);

    const request = await ServiceRequest.findByIdAndUpdate(req.params.id, fields, {
      new: true,
      runValidators: true,
    });

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
    const request = await ServiceRequest.findById(req.params.id).select('+fieldPhotoIds');

    if (!request) {
      return errorResponse(res, 'Service request not found', 404);
    }

    await request.deleteOne();
    await retireFieldPhotos((request.fieldPhotoIds || []).map((public_id) => ({ public_id })));

    successResponse(res, null, 'Service request deleted successfully');
  } catch (error) {
    next(error);
  }
};
