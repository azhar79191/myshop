import express from 'express';
import {
  getFAQs,
  getFAQById,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  getFAQCcategories,
} from '../controllers/faqController.js';
import { protect } from '../middleware/authMiddleware.js';
import { cacheMiddleware, clearCacheMiddleware } from '../middleware/cacheMiddleware.js';

const router = express.Router();

// Public routes with caching
router.get('/', cacheMiddleware(600), getFAQs); // 10 minutes
router.get('/categories/all', cacheMiddleware(600), getFAQCcategories);
router.get('/:id', cacheMiddleware(600), getFAQById);

// Admin routes (protected) - clear cache on mutations
router.post('/', protect, clearCacheMiddleware(['/api/faqs']), createFAQ);
router.put('/:id', protect, clearCacheMiddleware(['/api/faqs']), updateFAQ);
router.delete('/:id', protect, clearCacheMiddleware(['/api/faqs']), deleteFAQ);

export default router;
