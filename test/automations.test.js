import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { queueAutomationAlerts } from '../src/utils/automations.js';
import {
  incomingWhatsAppMessages,
  validWhatsAppSignature,
  drainWhatsAppReplies,
} from '../src/utils/whatsappAutomation.js';
import AutomationDelivery from '../src/models/AutomationDelivery.js';

test('automation alerts use persisted daily keys, correct completion filters and no customer payload', async () => {
  const filters = [],
    rows = new Map();
  const model = {
    find(filter) {
      filters.push(filter);
      return {
        select() {
          return this;
        },
        lean() {
          return this;
        },
        cursor() {
          return (async function* () {
            yield { _id: '507f1f77bcf86cd799439011' };
          })();
        },
      };
    },
  };
  const Queue = {
    async updateOne(filter, update) {
      rows.set(filter.eventKey, update.$setOnInsert);
    },
  };
  const opts = {
    now: new Date('2026-11-07T01:00:00Z'),
    models: { Product: model, Contact: model, ServiceRequest: model, Quote: model },
    Queue,
  };
  await queueAutomationAlerts(opts);
  await queueAutomationAlerts(opts);
  assert.equal(rows.size, 4);
  assert.deepEqual(filters[1].status.$nin, ['Replied', 'Archived']);
  assert.deepEqual(filters[2].status.$nin, ['Completed', 'Cancelled']);
  assert.equal(filters[3].status.$ne, 'Closed');
  for (const row of rows.values())
    assert.deepEqual(Object.keys(row).sort(), ['eventKey', 'kind', 'reference']);
  assert.equal(new AutomationDelivery([...rows.values()][0]).validateSync(), undefined);
});
test('WhatsApp requires an authentic raw-body signature and only queues recent inbound texts for our number', () => {
  const now = new Date('2026-11-07T01:00:00Z');
  const message = {
    id: 'wamid.test',
    from: '923001234567',
    timestamp: String(now.getTime() / 1000),
    type: 'text',
  };
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: { metadata: { phone_number_id: '123' }, messages: [message] },
          },
        ],
      },
    ],
  };
  const bytes = Buffer.from(JSON.stringify(payload));
  const signature = 'sha256=' + createHmac('sha256', 'test-secret').update(bytes).digest('hex');
  assert.equal(validWhatsAppSignature(bytes, signature, 'test-secret'), true);
  assert.equal(validWhatsAppSignature(Buffer.from('{}'), signature, 'test-secret'), false);
  assert.equal(validWhatsAppSignature(bytes, 'sha256=short', 'test-secret'), false);
  assert.equal(incomingWhatsAppMessages(payload, '123', now).length, 1);
  assert.equal(incomingWhatsAppMessages(payload, 'other', now).length, 0);
  assert.equal(
    incomingWhatsAppMessages(payload, '123', new Date(now.getTime() + 24 * 3600000)).length,
    0,
  );
  message.type = 'status';
  assert.equal(incomingWhatsAppMessages(payload, '123', now).length, 0);
});
test('WhatsApp reply delivery uses the connected number and never sends expired replies', async () => {
  const now = new Date('2026-11-07T01:00:00Z');
  const jobs = [
    { _id: '1', attempts: 1, recipient: '923001234567', receivedAt: now },
    { _id: '2', attempts: 1, receivedAt: new Date(0) },
  ];
  const updates = [],
    calls = [];
  const Model = {
    findOneAndUpdate() {
      return { lean: async () => jobs.shift() };
    },
    async updateOne(filter, update) {
      updates.push(update.$set);
    },
  };
  const env = Object.fromEntries(
    [
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_APP_SECRET',
      'WHATSAPP_VERIFY_TOKEN',
      'WHATSAPP_GRAPH_VERSION',
    ].map((k) => [k, 'test']),
  );
  env.WHATSAPP_GRAPH_VERSION = 'v26.0';
  await drainWhatsAppReplies({
    Model,
    env,
    now: () => now,
    Settings: {
      findOne() {
        return {
          lean: async () => ({ settings: { contact: { whatsappAutoReply: 'Thank you' } } }),
        };
      },
    },
    fetcher: async (url, options) => {
      calls.push(JSON.parse(options.body));
      return { ok: true };
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].text.body, 'Thank you');
  assert.equal(updates[0].status, 'Delivered');
  assert.equal(updates[1].status, 'Failed');
});
