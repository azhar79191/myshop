import express from 'express';
import {
  submitContact,
  getContacts,
  getContactById,
  updateContactStatus,
  deleteContact,
} from '../controllers/contactController.js';
import { protect } from '../middleware/authMiddleware.js';
import { submissionRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

// Public route
router.post('/', submissionRateLimit, submitContact);

// Admin routes (protected)
router.get('/', protect, getContacts);
router.get('/:id', protect, getContactById);
router.put('/:id', protect, updateContactStatus);
router.delete('/:id', protect, deleteContact);

export default router;
