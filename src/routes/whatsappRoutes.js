import express from 'express';
import WhatsAppReply from '../models/WhatsAppReply.js';
import { integrationEnvironment } from '../utils/integrationSettings.js';
import {
  validWhatsAppSignature,
  incomingWhatsAppMessages,
  whatsappConfigured,
} from '../utils/whatsappAutomation.js';
const router = express.Router();
router.get('/', (req, res) => {
  const env = integrationEnvironment();
  if (
    env.WHATSAPP_VERIFY_TOKEN &&
    req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === env.WHATSAPP_VERIFY_TOKEN &&
    typeof req.query['hub.challenge'] === 'string'
  )
    return res.status(200).type('text/plain').send(req.query['hub.challenge']);
  return res.sendStatus(403);
});
router.post(
  '/',
  express.raw({ type: 'application/json', limit: '256kb' }),
  async (req, res, next) => {
    if (!whatsappConfigured()) return res.sendStatus(503);
    if (
      !validWhatsAppSignature(
        req.body,
        req.get('x-hub-signature-256'),
        integrationEnvironment().WHATSAPP_APP_SECRET,
      )
    )
      return res.sendStatus(401);
    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.sendStatus(400);
    }
    try {
      for (const message of incomingWhatsAppMessages(
        payload,
        integrationEnvironment().WHATSAPP_PHONE_NUMBER_ID,
      )) {
        try {
          await WhatsAppReply.updateOne(
            { messageId: message.messageId },
            { $setOnInsert: message },
            { upsert: true },
          );
        } catch (error) {
          if (error.code !== 11000) throw error;
        }
      }
      return res.sendStatus(200);
    } catch (error) {
      return next(error);
    }
  },
);
export default router;
