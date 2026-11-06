import express from 'express';
import multer from 'multer';
import { VoiceEnquiry, VoicePrompt } from '../models/VoiceEnquiry.js';
import { protect, superAdminOnly } from '../middleware/authMiddleware.js';
import { submissionRateLimit } from '../middleware/rateLimitMiddleware.js';
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 3, parts: 4 },
}).single('audio');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
export function validAudio(file) {
  if (!file?.buffer || !['audio/webm', 'audio/ogg', 'audio/mp4'].includes(file.mimetype))
    return false;
  const b = file.buffer;
  if (b.length < 12) return false;
  if (file.mimetype === 'audio/webm')
    return b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (file.mimetype === 'audio/ogg') return b.toString('ascii', 0, 4) === 'OggS';
  return b.toString('ascii', 4, 8) === 'ftyp';
}
const audioValue = (file) => ({ bytes: file.buffer, mime: file.mimetype });
const sendAudio = (res, audio) =>
  res
    .set({
      'Content-Type': audio.mime,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    .send(audio.bytes);
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.get(
  '/prompts/:key',
  wrap(async (req, res) => {
    if (!['welcome', 'received'].includes(req.params.key)) return res.sendStatus(404);
    const prompt = await VoicePrompt.findOne({ key: req.params.key });
    if (!prompt)
      return res.status(404).json({ message: 'Voice prompt has not been recorded yet.' });
    sendAudio(res, prompt.audio);
  }),
);
router.post(
  '/',
  submissionRateLimit,
  upload,
  wrap(async (req, res) => {
    const phone = String(req.body.phone || '').replace(/[\s()-]/g, '');
    if (
      !/^(?:\+92|0092|0)3\d{9}$/.test(phone) ||
      !['crop', 'product', 'service'].includes(req.body.category) ||
      !validAudio(req.file)
    )
      return res
        .status(400)
        .json({
          message: 'Provide a Pakistani mobile number, category and valid voice recording.',
        });
    const enquiry = await VoiceEnquiry.create({
      phone,
      category: req.body.category,
      audio: audioValue(req.file),
    });
    res.status(201).json({ success: true, data: { id: enquiry.id } });
  }),
);
router.put(
  '/prompts/:key',
  protect,
  superAdminOnly,
  upload,
  wrap(async (req, res) => {
    if (!['welcome', 'received'].includes(req.params.key) || !validAudio(req.file))
      return res.sendStatus(400);
    await VoicePrompt.findOneAndUpdate(
      { key: req.params.key },
      { audio: audioValue(req.file) },
      { upsert: true, runValidators: true },
    );
    res.json({ success: true });
  }),
);
router.get(
  '/',
  protect,
  wrap(async (_req, res) => {
    const data = await VoiceEnquiry.find().select('-audio').sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data });
  }),
);
router.get(
  '/:id/audio',
  protect,
  wrap(async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.sendStatus(400);
    const row = await VoiceEnquiry.findById(req.params.id);
    if (!row) return res.sendStatus(404);
    sendAudio(res, row.audio);
  }),
);
router.put(
  '/:id',
  protect,
  wrap(async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id) || !['New', 'Replied'].includes(req.body.status))
      return res.sendStatus(400);
    const row = await VoiceEnquiry.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true },
    );
    if (!row) return res.sendStatus(404);
    res.json({ success: true });
  }),
);
router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError)
    return res
      .status(400)
      .json({ message: 'Recording must be under 3 MB. Please record a shorter message.' });
  next(err);
});
export default router;
