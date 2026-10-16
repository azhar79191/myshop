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

const router = express.Router();

router.get('/', getAllBrands);
router.get('/:id', getBrandById);

router.post('/', protect, uploadSingle, handleUploadError, createBrand);
router.put('/:id', protect, uploadSingle, handleUploadError, updateBrand);
router.delete('/:id', protect, deleteBrand);

export default router;
