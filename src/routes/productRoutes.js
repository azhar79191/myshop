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
import { cacheMiddleware, clearCacheMiddleware } from '../middleware/cacheMiddleware.js';

const router = express.Router();

// Public routes with caching (5 minutes)
router.get('/', cacheMiddleware(300), getProducts);
router.get('/featured/list', cacheMiddleware(300), getFeaturedProducts);
router.get('/categories/all', cacheMiddleware(600), getCategories); // 10 minutes for categories
router.get('/brands/all', cacheMiddleware(600), getBrands); // 10 minutes for brands
router.get('/:id/related', cacheMiddleware(300), getRelatedProducts);
router.get('/:id', cacheMiddleware(300), getProductById);

// Admin routes (protected) - clear cache on mutations
router.post('/', protect, clearCacheMiddleware(['/api/products']), uploadSingle, handleUploadError, createProduct);
router.put('/:id', protect, clearCacheMiddleware(['/api/products']), uploadSingle, handleUploadError, updateProduct);
router.delete('/:id', protect, clearCacheMiddleware(['/api/products']), deleteProduct);

export default router;
