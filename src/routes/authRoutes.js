import express from 'express';
import {
  login,
  getMe,
  updatePassword,
  createAdmin,
  getAllAdmins,
  updateAdminStatus,
} from '../controllers/authController.js';
import { protect, superAdminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes
router.get('/me', protect, getMe);
router.put('/password', protect, updatePassword);

// Super admin only routes
router.post('/admin', protect, superAdminOnly, createAdmin);
router.get('/admins', protect, superAdminOnly, getAllAdmins);
router.put('/admin/:id/status', protect, superAdminOnly, updateAdminStatus);

export default router;
