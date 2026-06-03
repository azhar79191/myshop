import express from 'express';
import {
  getAllGalleryImages,
  getGalleryImageById,
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
} from '../controllers/galleryController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadSingle, handleUploadError } from '../middleware/uploadMiddleware.js';
import { cacheMiddleware, clearCacheMiddleware } from '../middleware/cacheMiddleware.js';

const router = express.Router();

router.get('/', cacheMiddleware(300), getAllGalleryImages);
router.get('/:id', cacheMiddleware(300), getGalleryImageById);

router.post('/', protect, clearCacheMiddleware(['/api/gallery']), uploadSingle, handleUploadError, createGalleryImage);
router.put('/:id', protect, clearCacheMiddleware(['/api/gallery']), uploadSingle, handleUploadError, updateGalleryImage);
router.delete('/:id', protect, clearCacheMiddleware(['/api/gallery']), deleteGalleryImage);

export default router;
