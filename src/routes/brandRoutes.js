import express from 'express';
import {
  getAllBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
} from '../controllers/brandController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadSingle, handleUploadError } from '../middleware/uploadMiddleware.js';
import { cacheMiddleware, clearCacheMiddleware } from '../middleware/cacheMiddleware.js';

const router = express.Router();

router.get('/', cacheMiddleware(600), getAllBrands);
router.get('/:id', cacheMiddleware(600), getBrandById);

router.post('/', protect, clearCacheMiddleware(['/api/brands']), uploadSingle, handleUploadError, createBrand);
router.put('/:id', protect, clearCacheMiddleware(['/api/brands']), uploadSingle, handleUploadError, updateBrand);
router.delete('/:id', protect, clearCacheMiddleware(['/api/brands']), deleteBrand);

export default router;
