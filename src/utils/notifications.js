import { randomUUID } from 'node:crypto';
import NotificationDelivery from '../models/NotificationDelivery.js';
import { integrationEnvironment, refreshIntegrations } from './integrationSettings.js';
import { safeWebhookFetch } from './safeWebhook.js';
const MAX_ATTEMPTS = 3;
export async function notifyNewLead(kind, reference) {
  if (!integrationEnvironment().LEAD_NOTIFICATION_WEBHOOK) return;
  try {
    await NotificationDelivery.create({ kind, reference });
  } catch (error) {
    if (error.code !== 11000)
      console.error('Could not queue an inquiry notification. Review the inquiry queue.');
  }
}
export async function drainNotificationQueue({
  Model = NotificationDelivery,
  fetcher = safeWebhookFetch,
  environment = integrationEnvironment(),
  now = () => new Date(),
  batchSize = 10,
} = {}) {
  await Model.updateMany(
    { status: 'Delivering', leaseUntil: { $lte: now() }, attempts: { $gte: MAX_ATTEMPTS } },
    {
      $set: {
        status: 'Failed',
        lastError: 'Delivery was interrupted. Review and retry.',
        claimToken: null,
        leaseUntil: null,
      },
    },
  );
  for (let index = 0; index < Math.min(batchSize, 10); index++) {
    const at = now(),
      token = randomUUID();
    const job = await Model.findOneAndUpdate(
      {
        attempts: { $lt: MAX_ATTEMPTS },
        $or: [
          { status: 'Pending', nextAttemptAt: { $lte: at } },
          { status: 'Delivering', leaseUntil: { $lte: at } },
        ],
      },
      {
        $set: {
          status: 'Delivering',
          claimToken: token,
          leaseUntil: new Date(at.getTime() + 90000),
          lastAttemptAt: at,
        },
        $inc: { attempts: 1 },
      },
      { new: true, sort: { nextAttemptAt: 1 } },
    ).lean();
    if (!job) return;
    let url;
    try {
      url = new URL(environment.LEAD_NOTIFICATION_WEBHOOK);
      if (url.protocol !== 'https:' || url.username || url.password) url = null;
    } catch {
      url = null;
    }
    let state;
    if (!url) state = { status: 'Disabled', lastError: 'Notification webhook is not configured.' };
    else {
      try {
        const response = await fetcher(url, {
          method: 'POST',
          signal: AbortSignal.timeout(5000),
          headers: {
            'Content-Type': 'application/json',
            'X-Notification-Id': String(job._id),
            ...(environment.LEAD_NOTIFICATION_SECRET
              ? { Authorization: `Bearer ${environment.LEAD_NOTIFICATION_SECRET}` }
              : {}),
          },
          body: JSON.stringify({
            event:
              job.kind === 'stock'
                ? 'low_stock'
                : job.kind.startsWith('followup-')
                  ? 'followup_due'
                  : 'new_lead',
            kind: job.kind,
            reference: String(job.reference),
          }),
        });
        if (!response.ok)
          throw Object.assign(new Error('Webhook rejected delivery'), {
            safeMessage: `Webhook returned ${response.status}`,
          });
        state = { status: 'Delivered', deliveredAt: now(), lastError: '' };
      } catch (error) {
        state = {
          status: job.attempts >= MAX_ATTEMPTS ? 'Failed' : 'Pending',
          lastError: error.safeMessage || 'Notification delivery failed',
          nextAttemptAt: new Date(now().getTime() + 30000 * 2 ** Math.max(0, job.attempts - 1)),
        };
      }
    }
    await Model.updateOne(
      { _id: job._id, claimToken: token },
      { $set: { ...state, claimToken: null, leaseUntil: null } },
    );
  }
}
export function startNotificationWorker() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await refreshIntegrations();
      await drainNotificationQueue();
    } catch {
      console.error('Notification queue check failed; it will retry.');
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(run, 30000);
  timer.unref();
  return () => clearInterval(timer);
}
