import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import SiteSettings from '../src/models/SiteSettings.js';
import { getSiteSettings, getSiteSettingsHistory, updateSiteSettings, uploadSiteLogo } from '../src/controllers/siteSettingsController.js';
import siteSettingsRoutes from '../src/routes/siteSettingsRoutes.js';

const invoke = (controller, request) => new Promise((resolve, reject) => {
  const response = { status() { return this; }, json: resolve, set() { return this; } };
  controller(request, response, reject);
});

test('settings and logo saves record authenticated actors, bound history, and keep it private', async () => {
  const originals = { findOne: SiteSettings.findOne, findOneAndUpdate: SiteSettings.findOneAndUpdate };
  let update;
  const history = [{ savedAt: new Date('2026-01-01T00:00:00Z'), name: 'Earlier admin', action: 'settings' }];
  SiteSettings.findOne = () => ({ select() { return this; }, lean: async () => ({ settings: { siteName: 'Shop' }, history }), then(resolve) { return Promise.resolve({ settings: { siteName: 'Shop' } }).then(resolve); } });
  SiteSettings.findOneAndUpdate = (filter, change) => {
    update = change;
    return { lean: async () => ({ settings: change.$set.settings }) };
  };
  const admin = { _id: '507f1f77bcf86cd799439011', fullName: 'Verified Admin' };
  try {
    const result = await invoke(updateSiteSettings, { admin, body: { siteName: 'Updated Shop', savedBy: 'forged', history: [] } });
    assert.equal(result.data.siteName, 'Updated Shop');
    assert.equal(result.data.savedBy, undefined);
    assert.equal(result.data.history, undefined);
    const entry = update.$push.history.$each[0];
    assert.equal(entry.savedBy, admin._id);
    assert.equal(entry.name, 'Verified Admin');
    assert.equal(entry.action, 'settings');
    assert.ok(entry.savedAt instanceof Date);
    assert.equal(update.$push.history.$slice, -20);
    await invoke(uploadSiteLogo, { admin, file: { path: 'https://example.com/logo.png' } });
    assert.equal(update.$push.history.$each[0].action, 'logo');
    const publicResult = await invoke(getSiteSettings, {});
    assert.equal(publicResult.history, undefined);
    assert.equal(publicResult.data.history, undefined);
    const privateResult = await invoke(getSiteSettingsHistory, { admin });
    assert.equal(privateResult.data[0].name, 'Earlier admin');
  } finally {
    Object.assign(SiteSettings, originals);
  }
});

test('save history endpoint requires authentication', async () => {
  const app = express();
  app.use('/api/site-settings', siteSettingsRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/site-settings/history`);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
