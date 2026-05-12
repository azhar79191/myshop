import express from 'express';
import {
  submitTestimonial,
  getApprovedTestimonials,
  getAllTestimonials,
  getTestimonialById,
  approveTestimonial,
  deleteTestimonial,
} from '../controllers/testimonialController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/', submitTestimonial);
router.get('/approved', getApprovedTestimonials);

// Protected routes (Admin only)
router.get('/', protect, getAllTestimonials);
router.get('/:id', protect, getTestimonialById);
router.put('/:id/approve', protect, approveTestimonial);
router.delete('/:id', protect, deleteTestimonial);

export default router;
