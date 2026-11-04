import assert from 'node:assert/strict';
import test from 'node:test';
import defaults from '../src/config/defaultSiteSettings.js';
import { validateContentSettings, stampPolicyRevisions } from '../src/utils/contentSettings.js';
import { mergeSettings } from '../src/utils/mergeSettings.js';
import { configurationStatus } from '../src/utils/configurationStatus.js';
import SiteSettings from '../src/models/SiteSettings.js';
import { updateSiteSettings } from '../src/controllers/siteSettingsController.js';
const invoke = (req) =>
  new Promise((resolve, reject) =>
    updateSiteSettings(
      req,
      {
        status(code) {
          this.code = code;
          return this;
        },
        json(value) {
          resolve({ code: this.code, ...value });
          return this;
        },
        set() {},
      },
      reject,
    ),
  );

test('content settings validate image URLs, bilingual text, map coordinates and section ordering', () => {
  assert.equal(validateContentSettings(defaults), null);
  assert.ok(
    validateContentSettings({
      pageImages: { about: { src: 'javascript:alert(1)', alt: { en: '', ur: '' } } },
    }),
  );
  assert.ok(validateContentSettings({ contact: { latitude: 91 } }));
  assert.ok(validateContentSettings({ contact: { googleMapsEmbed: 'https://example.com/embed' } }));
  assert.ok(
    validateContentSettings({ homepageSections: [...defaults.homepageSections].reverse() }),
  );
  assert.ok(
    validateContentSettings({
      homepageSections: defaults.homepageSections.map((row) => ({ ...row, enabled: false })),
    }),
  );
  assert.ok(validateContentSettings({ policies: { privacy: { sections: [] } } }));
  assert.ok(
    validateContentSettings({
      seoPages: {
        '/admin': { title: { en: '', ur: '' }, description: { en: '', ur: '' }, image: '' },
      },
    }),
  );
});

test('policy revision dates ignore client dates and change only with policy text', () => {
  const previous = structuredClone(defaults);
  const now = new Date('2026-11-04T12:00:00Z');
  let next = mergeSettings(previous, {
    siteName: 'Renamed',
    policies: { privacy: { updatedAt: 'forged' } },
  });
  stampPolicyRevisions(next, previous, now);
  assert.equal(next.policies.privacy.updatedAt, null);
  next.policies.privacy.sections[0].body.en = 'Changed policy text';
  stampPolicyRevisions(next, previous, now);
  assert.equal(next.policies.privacy.updatedAt, now.toISOString());
  assert.equal(next.policies.terms.updatedAt, null);
  const unchanged = structuredClone(next);
  stampPolicyRevisions(unchanged, next, new Date('2026-11-05'));
  assert.equal(unchanged.policies.privacy.updatedAt, now.toISOString());
});

test('partial saves preserve existing business content and stamp revisions on the server', async () => {
  const originalFind = SiteSettings.findOne,
    originalUpdate = SiteSettings.findOneAndUpdate;
  let revision = 0;
  let stored = mergeSettings(defaults, {
    aboutContent: { mission: { en: 'Saved mission', ur: 'مقصد' } },
  });
  SiteSettings.findOne = () => ({ lean: async () => ({ settings: stored, revision }) });
  SiteSettings.findOneAndUpdate = (_filter, change) => ({
    lean: async () => {
      stored = change.$set.settings;
      return { settings: stored, revision: ++revision };
    },
  });
  try {
    const admin = { _id: '507f1f77bcf86cd799439011', fullName: 'Admin' };
    const renamed = await invoke({ admin, body: { _revision: revision, siteName: 'Updated' } });
    assert.equal(renamed.data.aboutContent.mission.en, 'Saved mission');
    const sections = structuredClone(stored.policies.terms.sections);
    sections[0].body.en = 'Edited text';
    const saved = await invoke({
      admin,
      body: { _revision: revision, policies: { terms: { sections, updatedAt: '1900-01-01' } } },
    });
    assert.ok(Number.isFinite(new Date(saved.data.policies.terms.updatedAt).getTime()));
    assert.notEqual(saved.data.policies.terms.updatedAt, '1900-01-01');
    assert.equal(saved.data.policies.privacy.updatedAt, null);
  } finally {
    SiteSettings.findOne = originalFind;
    SiteSettings.findOneAndUpdate = originalUpdate;
  }
});

test('configuration checks expose only booleans and merging rejects prototype properties', () => {
  const status = configurationStatus({
    CLOUDINARY_CLOUD_NAME: 'private-name',
    CLOUDINARY_API_KEY: 'private-key',
    CLOUDINARY_API_SECRET: 'private-secret',
  });
  assert.equal(status.cloudUploads, true);
  assert.ok(Object.values(status).every((value) => typeof value === 'boolean'));
  assert.ok(!JSON.stringify(status).includes('private'));
  const merged = mergeSettings(
    {},
    JSON.parse('{"__proto__":{"polluted":true},"constructor":{"polluted":true}}'),
  );
  assert.equal({}.polluted, undefined);
  assert.equal(merged.polluted, undefined);
});
