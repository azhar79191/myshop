import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Product from '../src/models/Product.js';
import Testimonial from '../src/models/Testimonial.js';
import Contact from '../src/models/Contact.js';
import ServiceRequest from '../src/models/ServiceRequest.js';
import Admin from '../src/models/Admin.js';
import { buildProductQuery } from '../src/utils/productQuery.js';
import { withRatings } from '../src/utils/productRatings.js';
import {
  submitTestimonial,
  getApprovedTestimonials,
} from '../src/controllers/testimonialController.js';
import { submitContact } from '../src/controllers/contactController.js';
import { submitServiceRequest } from '../src/controllers/serviceRequestController.js';
import { leadFields, leadFilter } from '../src/utils/leadFields.js';
import { uploadFieldPhotos } from '../src/utils/fieldPhotos.js';
import {
  resetPassword,
  forgotPassword,
  updateAdminStatus,
} from '../src/controllers/authController.js';
import bcrypt from 'bcryptjs';
const id = '507f1f77bcf86cd799439011';
const response = () => ({
  set() {
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
const next = (error) => {
  throw error;
};
const asyncController = (controller, req, res) =>
  new Promise((resolve, reject) => {
    res.json = (body) => {
      res.body = body;
      resolve(res);
      return res;
    };
    controller(req, res, reject);
  });

test('crop matching is exact, case insensitive, escaped and rejects query operators', () => {
  const filter = buildProductQuery({ crop: 'Cotton (BT)' }).filter;
  const regex = new RegExp(filter.crops.$regex, filter.crops.$options);
  assert.equal(regex.test('cotton (bt)'), true);
  assert.equal(regex.test('cotton (bt) extra'), false);
  assert.throws(() => buildProductQuery({ crop: { $ne: '' } }), /must be a string/);
});
test('per-pack stock determines product availability and invalid label URLs fail validation', async () => {
  const product = new Product({
    name: 'Test',
    description: 'Description',
    category: 'Seeds',
    brand: 'Test',
    image: 'https://example.com/image.png',
    sizes: [
      { size: '1kg', price: 0, stockStatus: 'Out of Stock' },
      { size: '5kg', price: 100, stockStatus: 'Low Stock' },
    ],
  });
  await product.validate();
  assert.equal(product.stockStatus, 'Low Stock');
  product.sizes[1].stockStatus = 'Out of Stock';
  await product.validate();
  assert.equal(product.stockStatus, 'Out of Stock');
  product.labelUrl = 'javascript:alert(1)';
  await assert.rejects(product.validate());
});
test('ratings use approved, product-linked reviews and never stale stored counters', async () => {
  const original = Testimonial.aggregate;
  let pipeline;
  Testimonial.aggregate = async (value) => {
    pipeline = value;
    return [{ _id: new mongoose.Types.ObjectId(id), average: 4.5, count: 2 }];
  };
  try {
    const [product, other] = await withRatings([
      { _id: id, ratings: { count: 999 } },
      { _id: '507f1f77bcf86cd799439012' },
    ]);
    assert.equal(pipeline[0].$match.isApproved, true);
    assert.equal(pipeline[0].$match.productId.$in.length, 2);
    assert.deepEqual(product.ratings, { average: 4.5, count: 2 });
    assert.equal(other.ratings.count, 0);
  } finally {
    Testimonial.aggregate = original;
  }
});
test('review submission saves validated product identity and public review queries isolate that product', async () => {
  const originals = {
    product: Product.findById,
    create: Testimonial.create,
    find: Testimonial.find,
  };
  Product.findById = () => ({ select: async () => ({ _id: id, name: 'Verified product' }) });
  let created, filter, fields;
  Testimonial.create = async (value) => {
    created = value;
    return { _id: id };
  };
  Testimonial.find = (value) => {
    filter = value;
    return {
      sort() {
        return this;
      },
      limit() {
        return this;
      },
      select: async (value) => {
        fields = value;
        return [];
      },
    };
  };
  try {
    await submitTestimonial(
      {
        body: {
          productId: id,
          productUsed: 'Forged name',
          name: 'Farmer',
          rating: 5,
          message: 'A useful product',
        },
        ip: '127.0.0.1',
      },
      response(),
      next,
    );
    assert.equal(created.productId, id);
    assert.equal(created.productUsed, 'Verified product');
    await getApprovedTestimonials({ query: { productId: id } }, response(), next);
    assert.deepEqual(filter, { isApproved: true, productId: id });
    assert.match(fields, /-email/);
    assert.match(fields, /-phone/);
  } finally {
    Product.findById = originals.product;
    Testimonial.create = originals.create;
    Testimonial.find = originals.find;
  }
});
test('phone-only contacts succeed and public confirmations contain only a reference', async () => {
  const original = Contact.create;
  let saved;
  Contact.create = async (value) => {
    saved = value;
    return { _id: id, ...value };
  };
  try {
    const res = await asyncController(
      submitContact,
      {
        body: {
          name: 'Farmer',
          phone: '03001234567',
          subject: 'Product quote',
          message: 'Please confirm stock',
          preferredContact: 'whatsapp',
        },
        ip: '127.0.0.1',
      },
      response(),
    );
    assert.equal(saved.preferredContact, 'whatsapp');
    assert.deepEqual(res.body.data, { reference: id });
    const invalid = await asyncController(
      submitContact,
      { body: { name: 'Farmer', subject: 'Question', message: 'Please help' } },
      response(),
    );
    assert.equal(invalid.statusCode, 400);
  } finally {
    Contact.create = original;
  }
});
test('booking saves field details but never trusts internal notes or assignment from public callers', async () => {
  const original = ServiceRequest.create;
  let saved;
  ServiceRequest.create = async (value) => {
    saved = value;
    return { _id: id };
  };
  try {
    const res = response();
    await submitServiceRequest(
      {
        body: {
          serviceType: 'Soil Testing',
          name: 'Farmer',
          phone: '03001234567',
          message: 'Please test soil',
          village: 'Village',
          crop: 'Wheat',
          acreage: 2.5,
          preferredDate: '2099-01-01',
          assignedTo: id,
          internalNotes: 'injected',
          status: 'Completed',
        },
        ip: '127.0.0.1',
      },
      res,
      next,
    );
    assert.equal(saved.acreage, 2.5);
    assert.equal(saved.village, 'Village');
    assert.equal(saved.assignedTo, undefined);
    assert.equal(saved.internalNotes, undefined);
    assert.equal(saved.status, undefined);
    assert.deepEqual(res.body.data, { reference: id });
  } finally {
    ServiceRequest.create = original;
  }
});
test('field photos reject forged data, oversized data and client remote URLs before upload', async () => {
  await assert.rejects(uploadFieldPhotos(['https://example.com/photo.jpg']), /JPEG/);
  await assert.rejects(uploadFieldPhotos(['data:image/png;base64,PHNjcmlwdD4=']), /does not match/);
  await assert.rejects(uploadFieldPhotos(Array(4).fill('data:image/png;base64,YQ==')), /three/);
});
test('follow-up edits are allowlisted, dates validated, and overdue queues exclude completed work', async () => {
  const original = Admin.exists;
  Admin.exists = async () => true;
  try {
    const fields = await leadFields({
      assignedTo: id,
      followUpAt: '2099-01-01',
      internalNotes: 'Call farmer',
      isActive: false,
    });
    assert.equal(fields.isActive, undefined);
    assert.equal(fields.assignedTo, id);
    await assert.rejects(leadFields({ followUpAt: 'bad' }), /Invalid/);
    const filter = leadFilter({ overdue: 'true' }, ['Completed']);
    assert.deepEqual(filter.status, { $nin: ['Completed'] });
    assert.ok(filter.followUpAt.$lt instanceof Date);
  } finally {
    Admin.exists = original;
  }
});
test('password reset consumes only a live token atomically and revokes previous sessions', async () => {
  const original = Admin.findOneAndUpdate;
  let filter, update;
  Admin.findOneAndUpdate = async (where, fields) => {
    filter = where;
    update = fields;
    return { _id: id };
  };
  try {
    const res = response();
    await resetPassword(
      { body: { token: 'a'.repeat(64), password: 'new-long-password' } },
      res,
      next,
    );
    assert.equal(filter.resetTokenHash.length, 64);
    assert.notEqual(filter.resetTokenHash, 'a'.repeat(64));
    assert.ok(filter.resetTokenExpires.$gt instanceof Date);
    assert.equal(update.$inc.tokenVersion, 1);
    assert.equal(await bcrypt.compare('new-long-password', update.$set.password), true);
    assert.deepEqual(update.$unset, { resetTokenHash: '', resetTokenExpires: '' });
    assert.equal(res.body.data, null);
    Admin.findOneAndUpdate = async () => null;
    const expired = response();
    await resetPassword(
      { body: { token: 'a'.repeat(64), password: 'new-long-password' } },
      expired,
      next,
    );
    assert.equal(expired.statusCode, 400);
  } finally {
    Admin.findOneAndUpdate = original;
  }
});
test('recovery refuses unconfigured delivery and admin status cannot deactivate the caller', async () => {
  const key = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  const original = Admin.findById;
  try {
    const res = response();
    await forgotPassword({ body: { email: 'admin@example.com' } }, res, next);
    assert.equal(res.statusCode, 503);
    Admin.findById = async () => ({ _id: id, role: 'superadmin' });
    const own = response();
    await updateAdminStatus({ params: { id }, body: { isActive: false }, admin: { _id: id } }, own);
    assert.equal(own.statusCode, 400);
  } finally {
    Admin.findById = original;
    if (key !== undefined) process.env.RESEND_API_KEY = key;
  }
});

test('recovery delivery stores a hashed expiring token and never returns the reset link', async () => {
  const originalFind = Admin.findOne,
    originalFetch = globalThis.fetch;
  const keys = ['RESEND_API_KEY', 'RECOVERY_FROM_EMAIL', 'RECOVERY_SITE_URL'];
  const environment = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    RESEND_API_KEY: 'test-only',
    RECOVERY_FROM_EMAIL: 'test@example.com',
    RECOVERY_SITE_URL: 'https://example.com',
  });
  const account = { email: 'admin@example.com', async save() {} };
  let delivery;
  Admin.findOne = async () => account;
  globalThis.fetch = async (url, options) => {
    delivery = JSON.parse(options.body);
    return { ok: true };
  };
  try {
    const res = response();
    await forgotPassword({ body: { email: account.email } }, res, next);
    assert.equal(res.body.data, null);
    assert.equal(account.resetTokenHash.length, 64);
    assert.ok(account.resetTokenExpires > new Date());
    assert.match(delivery.text, /https:\/\/example.com\/admin\/reset-password#[a-f0-9]{64}/);
    assert.equal(JSON.stringify(res.body).includes('reset-password#'), false);
    Admin.findOne = async () => null;
    const unknown = response();
    await forgotPassword({ body: { email: 'unknown@example.com' } }, unknown, next);
    assert.equal(unknown.body.message, res.body.message);
  } finally {
    Admin.findOne = originalFind;
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (environment[key] === undefined) delete process.env[key];
      else process.env[key] = environment[key];
    }
  }
});
