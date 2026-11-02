import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import dashboardRoutes from '../src/routes/dashboardRoutes.js';
import Admin from '../src/models/Admin.js';
import Product from '../src/models/Product.js';
import Contact from '../src/models/Contact.js';
import ServiceRequest from '../src/models/ServiceRequest.js';
import Testimonial from '../src/models/Testimonial.js';
import Gallery from '../src/models/Gallery.js';
import FAQ from '../src/models/FAQ.js';
import Brand from '../src/models/Brand.js';
import { errorHandler } from '../src/middleware/errorMiddleware.js';
test('dashboard requires authentication and aggregates all records independently of pagination', async () => {
  const models = [Product, Contact, ServiceRequest, Testimonial, Gallery, FAQ, Brand];
  const originals = models.map(Model => ({ countDocuments: Model.countDocuments, aggregate: Model.aggregate }));
  const findAdmin = Admin.findById, secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'dashboard-test-secret';
  Admin.findById = () => ({ select: async () => ({ _id: '507f1f77bcf86cd799439011', isActive: true, tokenVersion: 0 }) });
  const pipelines = [];
  for (const Model of models) { Model.countDocuments = async () => 1200; Model.aggregate = async pipeline => { pipelines.push(pipeline); return pipeline[0].$group ? [{ _id: 'Seeds', count: 1200 }] : []; }; }
  const app = express(); app.use('/api/dashboard', dashboardRoutes); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/dashboard`;
  try {
    assert.equal((await fetch(url)).status, 401);
    const token = jwt.sign({ id: '507f1f77bcf86cd799439011', version: 0 }, process.env.JWT_SECRET);
    const result = await (await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).json();
    assert.equal(result.data.products, 1200); assert.equal(result.data.contacts, 1200); assert.equal(result.data.categories[0].count, 1200);
    assert.equal(result.data.overdue, 2400); assert.equal(result.data.months.length, 6);
    const monthly = pipelines.find(pipeline => pipeline[0].$match);
    assert.equal(monthly[1].$group._id.$dateToString.timezone, 'Asia/Karachi');
    assert.equal(monthly[0].$match.createdAt.$gte.getUTCHours(), 19);
  } finally {
    models.forEach((Model, index) => Object.assign(Model, originals[index])); Admin.findById = findAdmin;
    if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
