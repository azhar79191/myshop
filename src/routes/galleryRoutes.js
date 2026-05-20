import express from 'express';
import {
  getAllGalleryImages,
  getGalleryImageById,
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
} from '../controllers/galleryController.js';
import { protect } from '../middleware/authMiddleware.js';
import { cacheMiddleware, clearCacheMiddleware } from '../middleware/cacheMiddleware.js';

const router = express.Router();

// Public routes with caching
router.get('/', cacheMiddleware(300), getAllGalleryImages); // 5 minutes
router.get('/:id', cacheMiddleware(300), getGalleryImageById);

// Protected routes (Admin only) - clear cache on mutations
router.post('/', protect, clearCacheMiddleware(['/api/gallery']), createGalleryImage);
router.put('/:id', protect, clearCacheMiddleware(['/api/gallery']), updateGalleryImage);
router.delete('/:id', protect, clearCacheMiddleware(['/api/gallery']), deleteGalleryImage);

export default router;
