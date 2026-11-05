import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { get } from 'node:http';
import app from '../src/app.js';
import { CloudinaryStorage } from '../src/utils/cloudinaryStorage.js';
import { validateEnvironment } from '../src/config/environment.js';
import { validateContentSettings } from '../src/utils/contentSettings.js';
import { productSlug } from '../src/utils/productSlug.js';
import {
  createAdmin,
  login,
  resetPassword,
  updatePassword,
} from '../src/controllers/authController.js';

test('API responses include security headers even on missing routes', async () => {
  const server = app.listen(0);
  try {
    const headers = await new Promise((resolve, reject) => {
      get(`http://127.0.0.1:${server.address().port}/missing`, (response) => {
        response.resume();
        resolve(response.headers);
      }).on('error', reject);
    });
    assert.equal(headers['x-content-type-options'], 'nosniff');
    assert.equal(headers['x-frame-options'], 'DENY');
    assert.match(headers['content-security-policy'], /default-src 'none'/);
    assert.equal(headers['x-powered-by'], undefined);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('production refuses short or placeholder signing secrets', () => {
  const base = { NODE_ENV: 'production', MONGODB_URI: 'mongodb://localhost/test' };
  for (const secret of ['short', 'change-me-even-when-the-length-exceeds-thirty-two'])
    assert.throws(() => validateEnvironment({ ...base, JWT_SECRET: secret }), /JWT_SECRET/);
  assert.doesNotThrow(() =>
    validateEnvironment({ ...base, JWT_SECRET: 'af93bcd7510e648b2a71c4bf9ab5648d' }),
  );
});

test('saved public links reject executable URLs and invalid contact data', () => {
  for (const settings of [
    { social: { facebook: 'javascript:alert(1)' } },
    { social: { youtube: 'data:text/html,hello' } },
    { siteLogo: 'javascript:alert(1)' },
    { contact: { googleMaps: 'javascript:alert(1)' } },
    { contact: { email: { $ne: '' } } },
  ])
    assert.ok(validateContentSettings(settings));
  assert.equal(
    validateContentSettings({
      social: { facebook: 'https://www.facebook.com/example', youtube: '' },
      contact: { phone: '+923001234567' },
    }),
    null,
  );
});

test('new product URLs retain Urdu names and use a unique product identity', () => {
  assert.equal(productSlug('گندم کا بیج', 'abc123'), 'گندم-کا-بیج-abc123');
  assert.equal(productSlug('Wheat  Seed!', 'abc123'), 'wheat-seed-abc123');
  assert.notEqual(productSlug('Same name', 'one'), productSlug('Same name', 'two'));
  assert.equal(productSlug('!!!', 'abc123'), 'product-abc123');
});

test('auth rejects object injection and passwords exceeding bcrypt input bounds before querying', async () => {
  const response = () => ({
    set() {
      return this;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  });
  const attempts = [
    [
      createAdmin,
      {
        username: { $ne: '' },
        email: 'a@example.com',
        password: 'long-password-value',
        fullName: 'Admin',
      },
    ],
    [
      createAdmin,
      { username: 'admin', email: 'a@example.com', password: 'a'.repeat(73), fullName: 'Admin' },
    ],
    [login, { username: { $ne: '' }, password: 'password' }],
    [updatePassword, { currentPassword: 'old', newPassword: 'a'.repeat(73) }],
    [resetPassword, { token: 'a'.repeat(64), password: 'ا'.repeat(37) }],
  ];
  for (const [handler, body] of attempts) {
    const res = response();
    await handler({ body }, res, (error) => {
      throw error;
    });
    assert.equal(res.code, 400);
  }
});

test('upload storage validates image bytes, preserves cloud metadata, and supports cleanup', async () => {
  let uploaded = Buffer.alloc(0);
  let destroyed;
  const cloudinary = {
    uploader: {
      upload_stream(options, callback) {
        assert.equal(options.resource_type, 'image');
        return new Writable({
          write(chunk, encoding, done) {
            uploaded = Buffer.concat([uploaded, chunk]);
            done();
          },
          final(done) {
            callback(null, {
              secure_url: 'https://example.com/image.png',
              public_id: 'images/one',
              bytes: uploaded.length,
            });
            done();
          },
        });
      },
      destroy(id, options, callback) {
        destroyed = id;
        callback(null, { result: 'ok' });
      },
    },
  };
  const storage = new CloudinaryStorage({ cloudinary, params: { folder: 'images' } });
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const valid = await new Promise((resolve, reject) =>
    storage._handleFile(
      {},
      {
        mimetype: 'image/png',
        stream: Readable.from([bytes.subarray(0, 5), bytes.subarray(5)]),
      },
      (error, value) => (error ? reject(error) : resolve(value)),
    ),
  );
  assert.equal(valid.filename, 'images/one');
  assert.deepEqual(uploaded, bytes);
  await new Promise((resolve, reject) =>
    storage._removeFile({}, valid, (error) => (error ? reject(error) : resolve())),
  );
  assert.equal(destroyed, 'images/one');
  uploaded = Buffer.alloc(0);
  await assert.rejects(
    new Promise((resolve, reject) =>
      storage._handleFile(
        {},
        {
          mimetype: 'image/png',
          stream: Readable.from([Buffer.from('<script>fake image</script>')]),
        },
        (error, value) => (error ? reject(error) : resolve(value)),
      ),
    ),
    /does not match/,
  );
  assert.equal(uploaded.length, 0);
});
