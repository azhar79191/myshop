import express from 'express';
import { getSiteSettings, updateSiteSettings, uploadSiteLogo } from '../controllers/siteSettingsController.js';
import { protect } from '../middleware/authMiddleware.js';
import { cacheMiddleware, clearCacheMiddleware } from '../middleware/cacheMiddleware.js';
import { handleUploadError, uploadSiteLogoImage } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/', cacheMiddleware(300), getSiteSettings);
router.put('/', protect, clearCacheMiddleware(['/api/site-settings']), updateSiteSettings);
router.post('/logo', protect, uploadSiteLogoImage, handleUploadError, clearCacheMiddleware(['/api/site-settings']), uploadSiteLogo);

export default router;
