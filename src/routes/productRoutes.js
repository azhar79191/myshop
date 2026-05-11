import express from 'express';
import {
  getProducts,
  getProductById,
  getFeaturedProducts,
  getCategories,
  getBrands,
  createProduct,
  updateProduct,
  deleteProduct,
  getRelatedProducts,
} from '../controllers/productController.js';
import { uploadSingle, uploadMultiple, handleUploadError } from '../middleware/uploadMiddleware.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/featured/list', getFeaturedProducts);
router.get('/categories/all', getCategories);
router.get('/brands/all', getBrands);
router.get('/:id/related', getRelatedProducts);
router.get('/:id', getProductById);

// Admin routes (protected)
router.post('/', protect, uploadSingle, handleUploadError, createProduct);
router.put('/:id', protect, uploadSingle, handleUploadError, updateProduct);
router.delete('/:id', protect, deleteProduct);

export default router;
