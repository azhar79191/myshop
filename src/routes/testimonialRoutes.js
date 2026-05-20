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
import { cacheMiddleware, clearCacheMiddleware } from '../middleware/cacheMiddleware.js';

const router = express.Router();

// Public routes with caching
router.post('/', submitTestimonial);
router.get('/approved', cacheMiddleware(300), getApprovedTestimonials); // 5 minutes

// Protected routes (Admin only) - clear cache on mutations
router.get('/', protect, getAllTestimonials);
router.get('/:id', protect, getTestimonialById);
router.put('/:id/approve', protect, clearCacheMiddleware(['/api/testimonials']), approveTestimonial);
router.delete('/:id', protect, clearCacheMiddleware(['/api/testimonials']), deleteTestimonial);

export default router;
