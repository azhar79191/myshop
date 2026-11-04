import express from 'express';
import {
  getSiteSettings,
  checkLogoRevision,
  getSiteSettingsHistory,
  updateSiteSettings,
  uploadSiteLogo,
} from '../controllers/siteSettingsController.js';
import { successResponse } from '../utils/apiResponse.js';
import { configurationStatus } from '../utils/configurationStatus.js';
import { protect } from '../middleware/authMiddleware.js';
import { handleUploadError, uploadSiteLogoImage } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/', getSiteSettings);
router.get('/configuration', protect, (_req, res) => successResponse(res, configurationStatus()));
router.post(
  '/images',
  protect,
  (_req, res, next) => {
    if (!configurationStatus().cloudUploads)
      return res.status(503).json({
        success: false,
        message:
          'Image uploads are not configured. Choose an existing media image or enter an HTTPS URL.',
      });
    next();
  },
  uploadSiteLogoImage,
  handleUploadError,
  (req, res) =>
    req.file
      ? successResponse(res, { src: req.file.path }, 'Image uploaded')
      : res.status(400).json({ success: false, message: 'Choose an image' }),
);
router.get('/history', protect, getSiteSettingsHistory);
router.put('/', protect, updateSiteSettings);
router.post(
  '/logo',
  protect,
  checkLogoRevision,
  uploadSiteLogoImage,
  handleUploadError,
  uploadSiteLogo,
);

export default router;
