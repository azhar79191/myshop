import express from 'express';
import { protect, superAdminOnly } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../middleware/rateLimitMiddleware.js';
import { getIntegrations, saveIntegrations } from '../controllers/integrationController.js';
const router = express.Router();
const readLimit = createRateLimiter({ limit: 60, windowMs: 60000 });
const writeLimit = createRateLimiter({
  limit: 5,
  windowMs: 15 * 60000,
  keyGenerator: (req) => String(req.admin._id),
});
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(readLimit, protect, superAdminOnly);
router.get('/', getIntegrations);
router.put('/', writeLimit, express.json({ limit: '24kb', strict: true }), saveIntegrations);
router.use((_err, _req, res, _next) =>
  res.status(400).json({ success: false, message: 'Invalid integration request' }),
);
export default router;
