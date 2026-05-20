import express from 'express';
import {
  getAllBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
} from '../controllers/brandController.js';
import { protect } from '../middleware/authMiddleware.js';
import { cacheMiddleware, clearCacheMiddleware } from '../middleware/cacheMiddleware.js';

const router = express.Router();

// Public routes with caching
router.get('/', cacheMiddleware(600), getAllBrands); // 10 minutes
router.get('/:id', cacheMiddleware(600), getBrandById);

// Protected routes (Admin only) - clear cache on mutations
router.post('/', protect, clearCacheMiddleware(['/api/brands']), createBrand);
router.put('/:id', protect, clearCacheMiddleware(['/api/brands']), updateBrand);
router.delete('/:id', protect, clearCacheMiddleware(['/api/brands']), deleteBrand);

export default router;
