import test from 'node:test';
import assert from 'node:assert/strict';
import { publishIntegrations, integrationEnvironment } from '../src/utils/integrationSettings.js';
import { configurationStatus } from '../src/utils/configurationStatus.js';
import cloudinary from '../src/config/cloudinary.js';
test('integration snapshots update providers and reject an older in-flight refresh', () => {
  publishIntegrations(
    {
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: '123',
      CLOUDINARY_API_SECRET: 'test-secret',
    },
    100,
  );
  assert.equal(configurationStatus().cloudUploads, true);
  assert.equal(cloudinary.config().api_secret, 'test-secret');
  publishIntegrations({ CLOUDINARY_API_SECRET: '' }, 101);
  publishIntegrations({ CLOUDINARY_API_SECRET: 'stale-secret' }, 100);
  assert.equal(integrationEnvironment().CLOUDINARY_API_SECRET, '');
  assert.equal(cloudinary.config().api_secret, '');
  publishIntegrations({});
});
