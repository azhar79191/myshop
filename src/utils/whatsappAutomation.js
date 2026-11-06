import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import WhatsAppReply from '../models/WhatsAppReply.js';
import SiteSettings from '../models/SiteSettings.js';
import { integrationEnvironment } from './integrationSettings.js';

export function validWhatsAppSignature(body, signature, secret) {
  if (!secret || !Buffer.isBuffer(body) || !/^sha256=[a-f0-9]{64}$/.test(signature || ''))
    return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}
export function incomingWhatsAppMessages(payload, phoneNumberId, now = new Date()) {
  if (payload?.object !== 'whatsapp_business_account') return [];
  return (payload.entry || []).flatMap((entry) =>
    (entry.changes || []).flatMap((change) => {
      const value = change.value;
      if (change.field !== 'messages' || value?.metadata?.phone_number_id !== phoneNumberId)
        return [];
      return (value.messages || [])
        .filter(
          (message) =>
            message.type === 'text' &&
            typeof message.id === 'string' &&
            message.id.length <= 300 &&
            /^\d{7,15}$/.test(message.from || '') &&
            Number.isFinite(Number(message.timestamp)) &&
            now.getTime() - Number(message.timestamp) * 1000 < 23 * 3600000 &&
            Number(message.timestamp) * 1000 <= now.getTime() + 60000,
        )
        .map((message) => ({
          messageId: message.id,
          recipient: message.from,
          receivedAt: new Date(Number(message.timestamp) * 1000),
        }));
    }),
  );
}
export const whatsappConfigured = (env = integrationEnvironment()) =>
  [
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_APP_SECRET',
    'WHATSAPP_VERIFY_TOKEN',
    'WHATSAPP_GRAPH_VERSION',
  ].every((key) => Boolean(env[key]?.trim()));

export async function drainWhatsAppReplies({
  Model = WhatsAppReply,
  Settings = SiteSettings,
  fetcher = fetch,
  env = integrationEnvironment(),
  now = () => new Date(),
} = {}) {
  if (!whatsappConfigured(env) || !/^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_VERSION)) return;
  await Model.updateMany?.(
    { status: 'Delivering', attempts: { $gte: 3 }, leaseUntil: { $lte: now() } },
    { $set: { status: 'Failed', claimToken: null, leaseUntil: null } },
  );
  for (let i = 0; i < 10; i++) {
    const at = now(),
      token = randomUUID();
    const job = await Model.findOneAndUpdate(
      {
        attempts: { $lt: 3 },
        $or: [
          { status: 'Pending', nextAttemptAt: { $lte: at } },
          { status: 'Delivering', leaseUntil: { $lte: at } },
        ],
      },
      {
        $set: {
          status: 'Delivering',
          leaseUntil: new Date(at.getTime() + 90000),
          claimToken: token,
        },
        $inc: { attempts: 1 },
      },
      { new: true },
    ).lean();
    if (!job) return;
    let status = 'Failed';
    if (at.getTime() - new Date(job.receivedAt).getTime() < 23 * 3600000) {
      try {
        const record = await Settings.findOne({ key: 'global' }).lean();
        const text =
          record?.settings?.contact?.whatsappAutoReply ||
          'Thank you for contacting us. Our team will reply during business hours. Please share the product or service you need. / رابطے کا شکریہ۔ ہماری ٹیم کاروباری اوقات میں جواب دے گی۔';
        const response = await fetcher(
          `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)}/messages`,
          {
            method: 'POST',
            signal: AbortSignal.timeout(10000),
            headers: {
              Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: job.recipient,
              type: 'text',
              text: { body: text.slice(0, 1500) },
            }),
          },
        );
        status = response.ok ? 'Delivered' : job.attempts < 3 ? 'Pending' : 'Failed';
      } catch {
        status = job.attempts < 3 ? 'Pending' : 'Failed';
      }
    }
    await Model.updateOne(
      { _id: job._id, claimToken: token },
      {
        $set: {
          status,
          claimToken: null,
          leaseUntil: null,
          nextAttemptAt: new Date(at.getTime() + 60000 * job.attempts),
        },
      },
    );
  }
}
