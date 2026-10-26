import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import Admin from '../src/models/Admin.js';
import Testimonial from '../src/models/Testimonial.js';
import { protect, generateToken } from '../src/middleware/authMiddleware.js';
import { approveTestimonial, getApprovedTestimonials, getAllTestimonials } from '../src/controllers/testimonialController.js';

const responseRecorder = () => ({
  statusCode: 200,
  set() { return this; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('authentication rejects revoked tokens and accepts the current session version', async () => {
  const originalFind = Admin.findById;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'authentication-test-secret';
  Admin.findById = () => ({ select: async () => ({ _id: 'admin', isActive: true, tokenVersion: 2 }) });
  try {
    for (const [version, expected] of [[1, 401], [2, 200]]) {
      const response = responseRecorder();
      let passed = false;
      await protect({ headers: { authorization: `Bearer ${generateToken('admin', version)}` } }, response, error => {
        assert.equal(error, undefined);
        passed = true;
      });
      assert.equal(response.statusCode, expected);
      assert.equal(passed, expected === 200);
    }
    assert.equal(jwt.decode(generateToken('admin', 2)).version, 2);
  } finally {
    Admin.findById = originalFind;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test('password saves increment session version and hide it from public admin objects', async () => {
  const originalUpdate = Admin.collection.updateOne;
  Admin.collection.updateOne = async () => ({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });
  try {
    const admin = Admin.hydrate({ _id: '507f1f77bcf86cd799439011', username: 'admin', email: 'admin@example.com', fullName: 'Admin', password: 'old-hash', tokenVersion: 4 });
    admin.password = 'new-secure-password';
    await admin.save();
    assert.equal(admin.tokenVersion, 5);
    assert.equal(await admin.comparePassword('new-secure-password'), true);
    assert.equal(admin.toSafeObject().password, undefined);
    assert.equal(admin.toSafeObject().tokenVersion, undefined);
  } finally {
    Admin.collection.updateOne = originalUpdate;
  }
});

test('testimonial approval records the authenticated admin and reports the resolved action', async () => {
  const original = Testimonial.findByIdAndUpdate;
  let update;
  Testimonial.findByIdAndUpdate = async (id, fields) => { update = fields; return { _id: id, ...fields }; };
  try {
    const response = responseRecorder();
    await approveTestimonial({ params: { id: 'testimonial' }, body: {}, admin: { _id: 'reviewer' } }, response, error => { throw error; });
    assert.equal(update.isApproved, true);
    assert.equal(update.approvedBy, 'reviewer');
    assert.ok(update.approvedAt instanceof Date);
    assert.match(response.body.message, /approved successfully/);
    await approveTestimonial({ params: { id: 'testimonial' }, body: { isApproved: false, isFeatured: true }, admin: { _id: 'reviewer' } }, response, error => { throw error; });
    assert.equal(update.approvedBy, null);
    assert.equal(update.isFeatured, false);
    assert.match(response.body.message, /rejected successfully/);
    const invalid = responseRecorder();
    await approveTestimonial({ body: { isApproved: 'false' } }, invalid, error => { throw error; });
    assert.equal(invalid.statusCode, 400);
  } finally {
    Testimonial.findByIdAndUpdate = original;
  }
});

test('testimonial lists safely normalize malformed pagination', async () => {
  const originalFind = Testimonial.find;
  const originalCount = Testimonial.countDocuments;
  const limits = [];
  const skips = [];
  Testimonial.find = () => ({ sort() { return this; }, skip(value) { skips.push(value); return this; }, limit(value) { limits.push(value); return this; }, select: async () => [], then(resolve) { return Promise.resolve([]).then(resolve); } });
  Testimonial.countDocuments = async () => 0;
  try {
    const next = error => { throw error; };
    await getApprovedTestimonials({ query: { limit: 'bad' } }, responseRecorder(), next);
    await getAllTestimonials({ query: { page: 'bad', limit: '-1' } }, responseRecorder(), next);
    assert.deepEqual(limits, [10, 20]);
    assert.deepEqual(skips, [0]);
  } finally {
    Testimonial.find = originalFind;
    Testimonial.countDocuments = originalCount;
  }
});
