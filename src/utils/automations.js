import Product from '../models/Product.js';
import Contact from '../models/Contact.js';
import ServiceRequest from '../models/ServiceRequest.js';
import Quote from '../models/Quote.js';
import AutomationDelivery from '../models/AutomationDelivery.js';
import { lowStockFilter } from './catalogAttention.js';
import { drainNotificationQueue } from './notifications.js';
import { integrationEnvironment, refreshIntegrations } from './integrationSettings.js';

// Daily, persisted deduplication survives restarts and multiple server instances.
export async function queueAutomationAlerts({
  now = new Date(),
  models = { Product, Contact, ServiceRequest, Quote },
  Queue = AutomationDelivery,
} = {}) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(now);
  const sources = [
    ['stock', models.Product, lowStockFilter],
    [
      'followup-contact',
      models.Contact,
      { followUpAt: { $lte: now }, status: { $nin: ['Replied', 'Archived'] } },
    ],
    [
      'followup-service',
      models.ServiceRequest,
      { followUpAt: { $lte: now }, status: { $nin: ['Completed', 'Cancelled'] } },
    ],
    ['followup-quote', models.Quote, { followUpAt: { $lte: now }, status: { $ne: 'Closed' } }],
  ];
  for (const [kind, Model, filter] of sources) {
    // Stream IDs in batches instead of loading the whole customer collection.
    for await (const row of Model.find(filter).select('_id').lean().cursor({ batchSize: 100 })) {
      const eventKey = `${kind}:${row._id}:${day}`;
      try {
        await Queue.updateOne(
          { eventKey },
          { $setOnInsert: { kind, reference: row._id, eventKey } },
          { upsert: true },
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
  }
}
export function startAutomationWorker() {
  let running = false,
    lastScan = 0;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await refreshIntegrations();
      if (!integrationEnvironment().LEAD_NOTIFICATION_WEBHOOK) return;
      if (Date.now() - lastScan > 15 * 60 * 1000) {
        await queueAutomationAlerts();
        lastScan = Date.now();
      }
      await drainNotificationQueue({ Model: AutomationDelivery });
    } catch {
      console.error('Automation delivery will retry.');
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(run, 30000);
  timer.unref();
  return () => clearInterval(timer);
}
