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

const router = express.Router();

router.get('/', getAllGalleryImages);
router.get('/:id', getGalleryImageById);

router.post('/', protect, uploadSingle, handleUploadError, createGalleryImage);
router.put('/:id', protect, uploadSingle, handleUploadError, updateGalleryImage);
router.delete('/:id', protect, deleteGalleryImage);

export default router;
