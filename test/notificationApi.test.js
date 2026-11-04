import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import notificationRoutes from '../src/routes/notificationRoutes.js';
import NotificationDelivery from '../src/models/NotificationDelivery.js';
import Admin from '../src/models/Admin.js';
import { errorHandler } from '../src/middleware/errorMiddleware.js';

test('notification status is protected and only failed deliveries can be requeued', async () => {
  const originals = { find: NotificationDelivery.find, countDocuments: NotificationDelivery.countDocuments, findOneAndUpdate: NotificationDelivery.findOneAndUpdate }, adminFind = Admin.findById;
  const secret = process.env.JWT_SECRET, webhook = process.env.LEAD_NOTIFICATION_WEBHOOK;
  process.env.JWT_SECRET = 'notifications-test-secret'; process.env.LEAD_NOTIFICATION_WEBHOOK = 'https://example.com/hook';
  const id = '507f1f77bcf86cd799439011';
  let row = { _id: id, kind: 'quote', reference: id, status: 'Failed', attempts: 3 };
  NotificationDelivery.find = () => ({ select(fields) { assert.equal(fields, '-claimToken'); return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => [row] });
  NotificationDelivery.countDocuments = async () => 1;
  NotificationDelivery.findOneAndUpdate = (filter, update) => ({ select() { return this; }, lean: async () => { if (!filter.status.$in.includes(row.status)) return null; row = { ...row, ...update.$set }; return row; } });
  Admin.findById = () => ({ select: async () => ({ _id: id, isActive: true, tokenVersion: 0 }) });
  const app = express(); app.use(express.json()); app.use('/api/notifications', notificationRoutes); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/notifications`, token = jwt.sign({ id, version: 0 }, process.env.JWT_SECRET), headers = { Authorization: `Bearer ${token}` };
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(`${url}/${id}/retry`, { method: 'POST' })).status, 401);
    const list = await (await fetch(url, { headers })).json(); assert.equal(list.data[0].status, 'Failed'); assert.equal(list.configured, true);
    assert.equal((await fetch(`${url}/${id}/retry`, { method: 'POST', headers })).status, 200);
    assert.equal(row.attempts, 0); assert.equal(row.status, 'Pending');
    assert.equal((await fetch(`${url}/${id}/retry`, { method: 'POST', headers })).status, 409);
    delete process.env.LEAD_NOTIFICATION_WEBHOOK;
    assert.equal((await fetch(`${url}/${id}/retry`, { method: 'POST', headers })).status, 503);
  } finally {
    Object.assign(NotificationDelivery, originals); Admin.findById = adminFind;
    if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret;
    if (webhook === undefined) delete process.env.LEAD_NOTIFICATION_WEBHOOK; else process.env.LEAD_NOTIFICATION_WEBHOOK = webhook;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
