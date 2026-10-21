import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';

const directory = await mkdtemp(path.join(os.tmpdir(), 'myshop-media-test-'));
process.env.MEDIA_UPLOAD_DIR = directory;
process.env.MEDIA_MAX_VIDEO_MB = '1';
process.env.JWT_SECRET = 'media-tests-only-secret';
const { default: router } = await import('../src/routes/galleryRoutes.js');
const { default: Gallery } = await import('../src/models/Gallery.js');
const { default: Admin } = await import('../src/models/Admin.js');
const { default: SiteSettings } = await import('../src/models/SiteSettings.js');
const { errorHandler } = await import('../src/middleware/errorMiddleware.js');
const { hasMediaSignature, removeLocalMedia } = await import('../src/middleware/mediaUploadMiddleware.js');
const { getCacheControl } = await import('../src/middleware/cachePolicyMiddleware.js');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFioAAAAASUVORK5CYII=', 'base64');
const mp4 = Buffer.concat([Buffer.from([0,0,0,24]), Buffer.from('ftypisom'), Buffer.alloc(24)]);

test('server-hosted Media API lifecycle and upload protections', async t => {
  const original = { create: Gallery.create, findById: Gallery.findById, find: Gallery.find, admin: Admin.findById, settings: SiteSettings.findOne };
  const items = new Map();
  let policy = { allowVideoUploads: true, maxVideoSizeMB: 1 };
  Admin.findById = () => ({ select: async () => ({ isActive: true }) });
  SiteSettings.findOne = () => ({ lean: async () => ({ settings: { media: policy } }) });
  Gallery.create = async fields => {
    const item = new Gallery(fields);
    await item.validate();
    item.save = async () => { await item.validate(); return item; };
    item.deleteOne = async () => items.delete(String(item._id));
    items.set(String(item._id), item);
    return item;
  };
  Gallery.findById = async id => items.get(id) || null;
  Gallery.find = filter => ({ select() { return this; }, sort() { return this; }, lean: async () => [...items.values()].filter(item => Object.entries(filter).every(([key, value]) => item[key] === value)).map(item => item.toObject()) });
  const app = express();
  app.use(express.json());
  app.use('/api/media', router);
  app.use('/uploads/media', express.static(directory, { acceptRanges: true, dotfiles: 'deny', index: false }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
  const auth = { Authorization: `Bearer ${token}` };
  const form = (bytes = mp4, type = 'video/mp4', fields = {}) => {
    const data = new FormData();
    data.append('title', 'Field visit');
    for (const [key, value] of Object.entries(fields)) data.append(key, value);
    if (bytes) data.append('file', new Blob([bytes], { type }), 'untrusted-filename.mp4');
    return data;
  };
  let video;
  try {
    await t.test('rejects uploads before writing files when authentication is missing', async () => {
      const response = await fetch(`${base}/api/media`, { method: 'POST', body: form() });
      assert.equal(response.status, 401);
      assert.deepEqual(await readdir(directory), []);
    });
    await t.test('uploads a local video and optional cover, then supports seeking', async () => {
      const body = form();
      body.append('poster', new Blob([png], { type: 'image/png' }), 'cover.png');
      const response = await fetch(`${base}/api/media`, { method: 'POST', headers: auth, body });
      assert.equal(response.status, 201, await response.clone().text());
      video = (await response.json()).data;
      assert.equal(video.mediaType, 'video');
      assert.ok(video.video.startsWith(`${base}/uploads/media/`));
      assert.ok(video.poster.endsWith('.png'));
      assert.equal(video.storageKey, undefined);
      const range = await fetch(video.video, { headers: { Range: 'bytes=0-11' } });
      assert.equal(range.status, 206);
      assert.equal(range.headers.get('content-range'), `bytes 0-11/${mp4.length}`);
      assert.deepEqual(Buffer.from(await range.arrayBuffer()), mp4.subarray(0, 12));
    });
    await t.test('rejects a forged video and cleans up the upload', async () => {
      const before = await readdir(directory);
      const response = await fetch(`${base}/api/media`, { method: 'POST', headers: auth, body: form(Buffer.from('<script>not video</script>')) });
      assert.equal(response.status, 400);
      assert.deepEqual(await readdir(directory), before);
    });
    await t.test('rejects videos over the configured maximum without leaving files', async () => {
      const before = await readdir(directory);
      const response = await fetch(`${base}/api/media`, { method: 'POST', headers: auth, body: form(Buffer.concat([mp4, Buffer.alloc(1024 * 1024)])) });
      assert.equal(response.status, 400);
      assert.deepEqual(await readdir(directory), before);
    });
    await t.test('cleans uploaded files when metadata validation fails', async () => {
      const before = await readdir(directory);
      const response = await fetch(`${base}/api/media`, { method: 'POST', headers: auth, body: form(mp4, 'video/mp4', { title: '' }) });
      assert.equal(response.status, 400);
      assert.deepEqual(await readdir(directory), before);
    });
    await t.test('supports metadata edits and hides inactive items from public APIs', async () => {
      const response = await fetch(`${base}/api/media/${video._id}`, { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Edited field visit', isActive: false }) });
      assert.equal(response.status, 200);
      const publicList = await (await fetch(`${base}/api/media?isActive=false`)).json();
      assert.equal(publicList.data.length, 0);
      assert.equal((await fetch(`${base}/api/media/${video._id}`)).status, 404);
      const adminList = await (await fetch(`${base}/api/media/admin`, { headers: auth })).json();
      assert.equal(adminList.data.length, 1);
      assert.equal(adminList.data[0].title, 'Edited field visit');
    });
    await t.test('enforces disabled video uploads but permits metadata changes', async () => {
      policy = { ...policy, allowVideoUploads: false };
      assert.equal((await fetch(`${base}/api/media`, { method: 'POST', headers: auth, body: form() })).status, 400);
      assert.equal((await fetch(`${base}/api/media/${video._id}`, { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: true }) })).status, 200);
      policy = { ...policy, allowVideoUploads: true };
    });
    await t.test('replaces video with an image and removes retired video and cover files', async () => {
      const response = await fetch(`${base}/api/media/${video._id}`, { method: 'PUT', headers: auth, body: form(png, 'image/png', { mediaType: 'image' }) });
      assert.equal(response.status, 200, await response.clone().text());
      const item = (await response.json()).data;
      assert.equal(item.mediaType, 'image');
      assert.equal(item.video, undefined);
      assert.equal(item.poster, '');
      assert.equal((await fetch(video.video)).status, 404);
      assert.equal((await fetch(video.poster)).status, 404);
      assert.equal((await fetch(item.image)).status, 200);
    });
    await t.test('deletes an item and its server file', async () => {
      const response = await fetch(`${base}/api/media/${video._id}`, { method: 'DELETE', headers: auth });
      assert.equal(response.status, 200);
      assert.deepEqual((await readdir(directory)).filter(name => name !== '.incoming'), []);
      assert.deepEqual(await readdir(path.join(directory, '.incoming')), []);
    });
    await t.test('ignores client paths for deletion and keeps administrative responses private', async () => {
      await removeLocalMedia('../outside.mp4');
      assert.equal(getCacheControl('/api/media/admin'), 'no-store');
      assert.equal(getCacheControl('/api/media/upload-policy'), 'no-store');
      assert.equal(getCacheControl('/api/media'), getCacheControl('/api/gallery'));
    });
    await t.test('recognizes supported containers without trusting MIME alone', () => {
      assert.equal(hasMediaSignature(png, 'image/png'), true);
      assert.equal(hasMediaSignature(mp4, 'video/mp4'), true);
      assert.equal(hasMediaSignature(png, 'video/mp4'), false);
    });
  } finally {
    Gallery.create = original.create; Gallery.findById = original.findById; Gallery.find = original.find;
    Admin.findById = original.admin; SiteSettings.findOne = original.settings;
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
