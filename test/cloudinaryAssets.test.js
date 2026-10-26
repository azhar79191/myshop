import assert from 'node:assert/strict';
import test from 'node:test';
import cloudinary from '../src/config/cloudinary.js';
import Brand from '../src/models/Brand.js';
import { updateBrand } from '../src/controllers/brandController.js';
import { getCloudinaryPublicId, retireCloudinaryImages } from '../src/utils/cloudinaryAssets.js';

test('asset parsing preserves nested folders and rejects unrelated clouds and hosts', () => {
  assert.equal(getCloudinaryPublicId('https://res.cloudinary.com/shop/image/upload/v123/bismillah-spray-center/products/nested/photo.webp', 'shop'), 'bismillah-spray-center/products/nested/photo');
  for (const url of ['https://res.cloudinary.com/other/image/upload/v1/bismillah-spray-center/photo.png', 'https://example.com/shop/image/upload/v1/bismillah-spray-center/photo.png', 'https://res.cloudinary.com/shop/image/upload/v1/unrelated/photo.png']) {
    assert.equal(getCloudinaryPublicId(url, 'shop'), null);
  }
});

test('brand replacement keeps the old image until saving succeeds and cleans failed uploads', async () => {
  const originalFind = Brand.findById;
  const originalDestroy = cloudinary.uploader.destroy;
  const originalCloud = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = 'shop';
  const oldUrl = 'https://res.cloudinary.com/shop/image/upload/v1/bismillah-spray-center/products/old.png';
  const newUrl = 'https://res.cloudinary.com/shop/image/upload/v2/bismillah-spray-center/products/new.png';
  const events = [];
  cloudinary.uploader.destroy = async publicId => { events.push(publicId); return { result: 'ok' }; };
  const response = { status() { return this; }, json() {} };
  try {
    Brand.findById = async () => ({ logo: oldUrl, async save() { events.push('save-failed'); throw new Error('Validation failed'); } });
    let failure;
    await updateBrand({ params: { id: 'brand' }, body: {}, file: { path: newUrl } }, response, error => { failure = error; });
    assert.equal(failure.message, 'Validation failed');
    assert.deepEqual(events, ['save-failed', 'bismillah-spray-center/products/new']);
    events.length = 0;
    Brand.findById = async () => ({ logo: oldUrl, async save() { events.push('saved'); return this; } });
    await updateBrand({ params: { id: 'brand' }, body: {}, file: { path: newUrl } }, response, error => { throw error; });
    assert.deepEqual(events, ['saved', 'bismillah-spray-center/products/old']);
  } finally {
    Brand.findById = originalFind;
    cloudinary.uploader.destroy = originalDestroy;
    if (originalCloud === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = originalCloud;
  }
});

test('asset cleanup retries transient failures and deduplicates assets', async () => {
  const originalDestroy = cloudinary.uploader.destroy;
  const originalCloud = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = 'shop';
  let attempts = 0;
  cloudinary.uploader.destroy = async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('Temporary failure');
    return { result: 'ok' };
  };
  try {
    const url = 'https://res.cloudinary.com/shop/image/upload/v1/bismillah-spray-center/products/photo.png';
    await retireCloudinaryImages([url, url]);
    assert.equal(attempts, 3);
  } finally {
    cloudinary.uploader.destroy = originalDestroy;
    if (originalCloud === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = originalCloud;
  }
});
