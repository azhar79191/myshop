import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEnvironment } from '../src/config/environment.js';

test('requires the database URI and JWT secret', () => {
  assert.throws(
    () => validateEnvironment({ MONGODB_URI: ' ', JWT_SECRET: '' }),
    /MONGODB_URI, JWT_SECRET/
  );
});

test('validates and normalizes the configured port', () => {
  const configuration = validateEnvironment({
    MONGODB_URI: ' mongodb://localhost/test ',
    JWT_SECRET: 'test-secret',
    PORT: '5050',
  });

  assert.equal(configuration.mongoUri, 'mongodb://localhost/test');
  assert.equal(configuration.port, 5050);
});

test('rejects an invalid port', () => {
  assert.throws(
    () => validateEnvironment({
      MONGODB_URI: 'mongodb://localhost/test',
      JWT_SECRET: 'test-secret',
      PORT: '70000',
    }),
    /PORT must be an integer/
  );
});
