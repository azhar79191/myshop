import express from 'express';
import { getSiteSettings, getSiteSettingsHistory, updateSiteSettings, uploadSiteLogo } from '../controllers/siteSettingsController.js';
import { protect } from '../middleware/authMiddleware.js';
import { handleUploadError, uploadSiteLogoImage } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/', getSiteSettings);
router.get('/history', protect, getSiteSettingsHistory);
router.put('/', protect, updateSiteSettings);
router.post('/logo', protect, uploadSiteLogoImage, handleUploadError, uploadSiteLogo);

export default router;
