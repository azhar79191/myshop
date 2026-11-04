import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import Quote from '../src/models/Quote.js';
import Product from '../src/models/Product.js';
import Admin from '../src/models/Admin.js';
import quoteRoutes from '../src/routes/quoteRoutes.js';
import { cachePolicyMiddleware } from '../src/middleware/cachePolicyMiddleware.js';
import { errorHandler } from '../src/middleware/errorMiddleware.js';

const productId = '507f1f77bcf86cd799439011', quoteId = '507f1f77bcf86cd799439012';
const payload = { requestId: '947e6299-e592-4aae-b867-1bf5b8de593a', name: 'Farmer', phone: '03001234567', items: [{ productId, size: '1kg', quantity: 2, name: 'Forged name', unitPrice: 1 }], status: 'Confirmed', total: 1 };
test('quote API protects customer records, deduplicates submissions and detects conflicting staff updates', async () => {
  const originals = { findOne: Quote.findOne, create: Quote.create, findById: Quote.findById, findOneAndUpdate: Quote.findOneAndUpdate, find: Quote.find, countDocuments: Quote.countDocuments };
  const productFind = Product.find, adminFind = Admin.findById;
  const secret = process.env.JWT_SECRET, webhook = process.env.LEAD_NOTIFICATION_WEBHOOK;
  process.env.JWT_SECRET = 'quote-api-test-secret'; delete process.env.LEAD_NOTIFICATION_WEBHOOK;
  let saved, inserts = 0, forceConflict = false, unavailable = false;
  Quote.findOne = () => ({ select() { return this; }, lean: async () => saved });
  Quote.create = async record => { inserts++; saved = { ...record, _id: quoteId, __v: 0, status: 'New', deliveryCharge: null, total: null }; return saved; };
  Product.find = () => ({ select() { return this; }, lean: async () => [{ _id: productId, name: 'Server seed', sizes: [{ size: '1kg', stockStatus: unavailable ? 'Out of Stock' : 'In Stock' }] }] });
  Quote.findById = () => ({ lean: async () => saved });
  Quote.findOneAndUpdate = (filter, update) => ({ lean: async () => {
    if (forceConflict || filter.__v !== saved.__v) return null;
    saved = { ...saved, ...update.$set, __v: saved.__v + 1 };
    return saved;
  } });
  Admin.findById = () => ({ select: async () => ({ _id: productId, isActive: true, tokenVersion: 0 }) });
  const app = express(); app.use(express.json()); app.use(cachePolicyMiddleware); app.use('/api/quotes', quoteRoutes); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/quotes`;
  const post = body => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const token = jwt.sign({ id: productId, version: 0 }, process.env.JWT_SECRET);
  const put = body => fetch(`${url}/${quoteId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(url)).status, 401);
    const response = await post(payload);
    assert.equal(response.status, 201); assert.equal(response.headers.get('cache-control'), 'no-store');
    const publicResult = await response.json();
    assert.deepEqual(Object.keys(publicResult.data).sort(), ['reference', 'status']);
    assert.equal(saved.status, 'New'); assert.equal(saved.items[0].name, 'Server seed'); assert.equal(saved.items[0].unitPrice, null);
    assert.equal((await post(payload)).status, 201); assert.equal(inserts, 1);
    assert.equal((await post({ ...payload, phone: '03007654321' })).status, 409);
    assert.equal((await put({ version: 0, status: 'Quoted' })).status, 400);
    const quoted = await put({ version: 0, status: 'Quoted', unitPrices: [100.1], deliveryCharge: 20.2 });
    assert.equal(quoted.status, 200); assert.equal((await quoted.json()).data.total, 220.4);
    assert.equal((await put({ version: 0, status: 'Confirmed' })).status, 409);
    forceConflict = true;
    assert.equal((await put({ version: 1, status: 'Confirmed' })).status, 409);
    forceConflict = false;
    assert.equal((await put({ version: 1, status: 'Confirmed' })).status, 200);
    saved = null; unavailable = true;
    assert.equal((await post(payload)).status, 400); assert.equal(inserts, 1);
  } finally {
    Object.assign(Quote, originals); Product.find = productFind; Admin.findById = adminFind;
    if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret;
    if (webhook === undefined) delete process.env.LEAD_NOTIFICATION_WEBHOOK; else process.env.LEAD_NOTIFICATION_WEBHOOK = webhook;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
