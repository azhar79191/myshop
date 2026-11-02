import express from 'express';
import {
  login,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  updatePassword,
  createAdmin,
  getAllAdmins,
  updateAdminStatus,
} from '../controllers/authController.js';
import { protect, superAdminOnly } from '../middleware/authMiddleware.js';
import { uploadProfileImage, handleUploadError } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Public routes
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', protect, getMe);
router.get('/staff', protect, async (req, res, next) => { try { const { default: Admin } = await import('../models/Admin.js'); res.json({ success: true, data: await Admin.find({ isActive: true }).select('fullName').sort('fullName') }); } catch (error) { next(error); } });
router.put('/profile', protect, uploadProfileImage, handleUploadError, updateProfile);
router.put('/password', protect, updatePassword);

// Super admin only routes
router.post('/admin', protect, superAdminOnly, createAdmin);
router.get('/admins', protect, superAdminOnly, getAllAdmins);
router.put('/admin/:id/status', protect, superAdminOnly, updateAdminStatus);

export default router;
