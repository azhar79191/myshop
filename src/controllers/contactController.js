import Contact from '../models/Contact.js';
import { leadFields, leadFilter } from '../utils/leadFields.js';
import { notifyNewLead } from '../utils/notifications.js';
import { successResponse, errorResponse, paginateResponse, asyncHandler } from '../utils/apiResponse.js';
import { getPagination } from '../utils/pagination.js';

/**
 * @desc    Submit contact form
 * @route   POST /api/contact
 * @access  Public
 */
export const submitContact = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  if ([name, email, phone, subject, message].some(value => value !== undefined && typeof value !== 'string')) return errorResponse(res, 'Contact fields must be text', 400);
  if (phone && !/^\+?[0-9]{7,15}$/.test(phone.replace(/[\s()-]/g, ''))) return errorResponse(res, 'Provide a valid phone number', 400);

  // Basic validation
  if (!name || !(email?.trim() || phone?.trim()) || !subject || !message) {
    return errorResponse(res, 'Please provide all required fields', 400);
  }

  const channel = req.body.preferredContact || (phone?.trim() ? 'phone' : 'email');
  if (!['phone', 'whatsapp', 'email'].includes(channel) || (channel === 'email' ? !email?.trim() : !phone?.trim())) return errorResponse(res, 'Provide contact details for your chosen reply method', 400);
  const contact = await Contact.create({
    preferredContact: channel,
    name,
    email,
    phone,
    subject,
    message,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
  });

  void notifyNewLead('contact', contact._id);
  return successResponse(res, { reference: String(contact._id) }, 'Message sent successfully. We will get back to you soon!', 201);
});

/**
 * @desc    Get all contact submissions
 * @route   GET /api/contact
 * @access  Admin
 */
export const getContacts = asyncHandler(async (req, res) => {
  const filter = leadFilter(req.query, ['Replied', 'Archived']);

  const { page: pageNum, limit: limitNum, skip } = getPagination(req.query.page, req.query.limit);

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
  const fields = await leadFields(req.body);
  const contact = await Contact.findByIdAndUpdate(
    req.params.id,
    fields,
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
