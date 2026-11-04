import assert from 'node:assert/strict';
import test from 'node:test';
import SiteSettings from '../src/models/SiteSettings.js';
import { updateSiteSettings, getSiteSettings } from '../src/controllers/siteSettingsController.js';

const invoke = (controller, request) => new Promise((resolve, reject) => {
  let status;
  controller(request, { status(value) { status = value; return this; }, set() { return this; }, json(body) { resolve({ status, ...body }); } }, reject);
});

test('favicon saves, loads and removes independently of the logo with revision protection', async () => {
  const originals = { findOne: SiteSettings.findOne, findOneAndUpdate: SiteSettings.findOneAndUpdate };
  let settings = { siteLogo: 'https://example.com/logo.png' };
  let revision = 3;
  SiteSettings.findOne = () => ({ lean: async () => ({ settings, revision }) });
  SiteSettings.findOneAndUpdate = (filter, change) => {
    assert.equal(filter.revision, revision);
    settings = change.$set.settings;
    return { lean: async () => ({ settings, revision: ++revision }) };
  };
  const admin = { _id: '507f1f77bcf86cd799439011', username: 'Admin' };
  try {
    const saved = await invoke(updateSiteSettings, { admin, body: { _revision: 3, siteFavicon: 'https://example.com/tab.png' } });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.siteLogo, 'https://example.com/logo.png');
    const loaded = await invoke(getSiteSettings, {});
    assert.equal(loaded.data.siteFavicon, 'https://example.com/tab.png');
    const stale = await invoke(updateSiteSettings, { admin, body: { _revision: 3, siteFavicon: '' } });
    assert.equal(stale.status, 409);
    assert.equal(settings.siteFavicon, 'https://example.com/tab.png');
    const removed = await invoke(updateSiteSettings, { admin, body: { _revision: 4, siteFavicon: '' } });
    assert.equal(removed.data.siteFavicon, '');
    assert.equal(removed.data.siteLogo, 'https://example.com/logo.png');
    for (const value of ['javascript:alert(1)', 'http://example.com/tab.png', {}, 'x'.repeat(2001)]) {
      const invalid = await invoke(updateSiteSettings, { admin, body: { _revision: 5, siteFavicon: value } });
      assert.equal(invalid.status, 400);
    }
  } finally { Object.assign(SiteSettings, originals); }
});
