import express from 'express';
import { submitQuote, listQuotes, updateQuote } from '../controllers/quoteController.js';
import { protect } from '../middleware/authMiddleware.js';
import { submissionRateLimit } from '../middleware/rateLimitMiddleware.js';
const router = express.Router();
router.post('/', submissionRateLimit, submitQuote);
router.get('/', protect, listQuotes);
router.put('/:id', protect, updateQuote);
export default router;
