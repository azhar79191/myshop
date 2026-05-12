import express from 'express';
import {
  submitServiceRequest,
  getAllServiceRequests,
  getServiceRequestById,
  updateServiceRequestStatus,
  deleteServiceRequest,
} from '../controllers/serviceRequestController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/', submitServiceRequest);

// Protected routes (Admin only)
router.get('/', protect, getAllServiceRequests);
router.get('/:id', protect, getServiceRequestById);
router.put('/:id', protect, updateServiceRequestStatus);
router.delete('/:id', protect, deleteServiceRequest);

export default router;
