import Contact from '../models/Contact.js';
import { successResponse, errorResponse, paginateResponse, asyncHandler } from '../utils/apiResponse.js';

/**
 * @desc    Submit contact form
 * @route   POST /api/contact
 * @access  Public
 */
export const submitContact = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  // Basic validation
  if (!name || !email || !subject || !message) {
    return errorResponse(res, 'Please provide all required fields', 400);
  }

  const contact = await Contact.create({
    name,
    email,
    phone,
    subject,
    message,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
  });

  return successResponse(res, contact, 'Message sent successfully. We will get back to you soon!', 201);
});

/**
 * @desc    Get all contact submissions
 * @route   GET /api/contact
 * @access  Admin
 */
export const getContacts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  const filter = {};
  if (status) filter.status = status;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [contacts, total] = await Promise.all([
    Contact.find(filter).sort('-createdAt').skip(skip).limit(limitNum).lean(),
    Contact.countDocuments(filter),
  ]);

  const pages = Math.ceil(total / limitNum);

  return paginateResponse(res, contacts, {
    page: pageNum,
    pages,
    total,
    limit: limitNum,
  }, 'Contacts retrieved successfully');
});

/**
 * @desc    Get single contact by ID
 * @route   GET /api/contact/:id
 * @access  Admin
 */
export const getContactById = asyncHandler(async (req, res) => {
  const contact = await Contact.findById(req.params.id).lean();
  if (!contact) {
    return errorResponse(res, 'Contact not found', 404);
  }
  return successResponse(res, contact, 'Contact retrieved successfully');
});

/**
 * @desc    Update contact status
 * @route   PUT /api/contact/:id
 * @access  Admin
 */
export const updateContactStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const contact = await Contact.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  );

  if (!contact) {
    return errorResponse(res, 'Contact not found', 404);
  }

  return successResponse(res, contact, 'Contact status updated successfully');
});

/**
 * @desc    Delete contact
 * @route   DELETE /api/contact/:id
 * @access  Admin
 */
export const deleteContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findByIdAndDelete(req.params.id);
  if (!contact) {
    return errorResponse(res, 'Contact not found', 404);
  }
  return successResponse(res, null, 'Contact deleted successfully');
});
