import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'node:events';
import app from '../src/app.js';
import Admin from '../src/models/Admin.js';
import IntegrationSettings from '../src/models/IntegrationSettings.js';
import {
  sealIntegrations,
  openIntegrations,
  integrationSummary,
  publishIntegrations,
  integrationEnvironment,
} from '../src/utils/integrationSettings.js';
import { integrationFields } from '../src/config/integrationFields.js';
import {
  approvedWebhookUrl,
  isPublicAddress,
  webhookAddress,
  safeWebhookFetch,
} from '../src/utils/safeWebhook.js';
import { validateIntegrationChanges } from '../src/controllers/integrationController.js';
import { validateContentSettings } from '../src/utils/contentSettings.js';

test('integration encryption authenticates records and API summaries never return secret values', () => {
  const env = {
    CONFIG_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    WHATSAPP_ACCESS_TOKEN: 'hosting-secret-123',
  };
  const values = {
    WHATSAPP_ACCESS_TOKEN: 'stored-secret-456',
    LEAD_NOTIFICATION_WEBHOOK: 'https://hooks.example.com/private/path?token=sensitive',
  };
  const sealed = sealIntegrations(values, env);
  assert.notEqual(sealed, sealIntegrations(values, env));
  assert.equal(sealed.includes(values.WHATSAPP_ACCESS_TOKEN), false);
  assert.deepEqual(openIntegrations(sealed, env), values);
  const parts = sealed.split('.');
  const bytes = Buffer.from(parts[3], 'base64');
  bytes[0] ^= 1;
  parts[3] = bytes.toString('base64');
  assert.throws(() => openIntegrations(parts.join('.'), env));
  assert.throws(() =>
    openIntegrations(sealed, { CONFIG_ENCRYPTION_KEY: randomBytes(32).toString('base64') }),
  );
  assert.throws(() => sealIntegrations(values, {}));
  const summary = integrationSummary({ revision: 1, history: [] }, values, env);
  for (const field of summary.fields.filter((field) => field.secret))
    assert.equal(Object.hasOwn(field, 'value'), false);
  assert.equal(JSON.stringify(summary).includes('stored-secret-456'), false);
  assert.equal(JSON.stringify(summary).includes('sensitive'), false);
  assert.equal(IntegrationSettings.schema.path('encrypted').options.select, false);
});

test('webhook destinations reject SSRF tricks and pin validated public DNS with no redirects', async () => {
  const env = { CONFIG_ALLOWED_WEBHOOK_HOSTS: 'hooks.example.com' };
  for (const value of [
    'http://hooks.example.com',
    'https://127.0.0.1',
    'https://[::1]',
    'https://hooks.example.com.evil.test',
    'https://user@hooks.example.com',
    'https://hooks.example.com:8443',
    'https://hooks.example.com/#fragment',
  ])
    assert.throws(() => approvedWebhookUrl(value, env));
  const url = approvedWebhookUrl('https://hooks.example.com/events', env);
  for (const address of [
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.0.1',
    '224.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'fd00::1',
    'fe80::1',
    '64:ff9b::a00:1',
    '2001:db8::1',
    '2002:7f00:1::',
  ])
    assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2001:4860:4860::8888'), true);
  await assert.rejects(webhookAddress(url, async () => [{ address: '127.0.0.1', family: 4 }]));
  await assert.rejects(
    webhookAddress(url, async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]),
  );
  let lookups = 0,
    requests = 0;
  const result = await safeWebhookFetch(
    url,
    { body: '{}' },
    {
      env,
      resolver: async () => {
        lookups++;
        return [{ address: '8.8.8.8', family: 4 }];
      },
      request: (target, options, callback) => {
        requests++;
        assert.equal(options.agent, false);
        assert.equal(target.hostname, 'hooks.example.com');
        options.lookup('hooks.example.com', {}, (_err, address) =>
          assert.equal(address, '8.8.8.8'),
        );
        const req = new EventEmitter();
        req.end = () => callback({ statusCode: 302, destroy() {} });
        return req;
      },
    },
  );
  assert.equal(result.ok, false);
  assert.equal(result.status, 302);
  assert.equal(lookups, 1);
  assert.equal(requests, 1);
});

test('integration input is allowlisted and credentials cannot be smuggled into public contact settings', async () => {
  for (const changes of [
    { JWT_SECRET: 'attempt' },
    { WHATSAPP_ACCESS_TOKEN: { $ne: '' } },
    { WHATSAPP_GRAPH_VERSION: '../../other' },
    { WHATSAPP_PHONE_NUMBER_ID: '1/path' },
    JSON.parse('{"__proto__":{"polluted":true}}'),
  ])
    await assert.rejects(validateIntegrationChanges(changes));
  await validateIntegrationChanges({
    WHATSAPP_GRAPH_VERSION: 'v26.0',
    WHATSAPP_PHONE_NUMBER_ID: '1234',
  });
  assert.equal(
    validateContentSettings({ contact: { WHATSAPP_ACCESS_TOKEN: 'private' } }),
    'Unsupported public contact field',
  );
  assert.equal(Object.hasOwn(integrationFields, 'CONFIG_ENCRYPTION_KEY'), false);
  assert.equal(Object.hasOwn(integrationFields, 'MONGODB_URI'), false);
  assert.equal(Object.hasOwn(integrationFields, 'CONFIG_ALLOWED_WEBHOOK_HOSTS'), false);
});

test('login and public submission throttling cannot be bypassed with repeated slashes', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route) =>
    fetch(base + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  try {
    for (let i = 0; i < 10; i++)
      assert.equal((await post(i % 2 ? '/api/auth//login' : '/api/auth/login')).status, 400);
    for (const route of [
      '/api/auth/login',
      '/api/auth//login',
      '/api/auth//forgot-password',
      '/api/auth//reset-password',
    ])
      assert.equal((await post(route)).status, 429, route);
    for (let i = 0; i < 20; i++)
      assert.equal((await post(i % 2 ? '/api/contact/' : '/api/contact')).status, 400);
    for (const route of [
      '/api/contact',
      '/api/contact/',
      '/api/quotes/',
      '/api/service-requests/',
      '/api/testimonials/',
    ])
      assert.equal((await post(route)).status, 429, route);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('integration API enforces roles, password reauthentication, CAS, redaction, disabled fallback and account rate limits', async () => {
  const oldEnv = Object.fromEntries(
    ['CONFIG_ENCRYPTION_KEY', 'JWT_SECRET', 'WHATSAPP_ACCESS_TOKEN'].map((key) => [
      key,
      process.env[key],
    ]),
  );
  process.env.CONFIG_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  process.env.JWT_SECRET = 'integration-test-jwt';
  process.env.WHATSAPP_ACCESS_TOKEN = 'hosting-token';
  const originals = {
    admin: Admin.findById,
    find: IntegrationSettings.findOne,
    create: IntegrationSettings.create,
    update: IntegrationSettings.findOneAndUpdate,
  };
  let record = null;
  Admin.findById = (id) => ({
    select: async () => ({
      _id: id,
      isActive: true,
      role: id.endsWith('01') ? 'admin' : 'superadmin',
      tokenVersion: 0,
      comparePassword: async (value) => value === 'correct-password',
    }),
  });
  IntegrationSettings.findOne = () => ({
    select() {
      return this;
    },
    lean: async () => (record ? structuredClone(record) : null),
  });
  IntegrationSettings.create = async (value) => {
    record = structuredClone(value);
    return record;
  };
  IntegrationSettings.findOneAndUpdate = (filter, update) => ({
    lean: async () => {
      if (filter.revision !== record.revision) return null;
      record = {
        ...record,
        encrypted: update.$set.encrypted,
        revision: record.revision + 1,
        history: [...record.history, ...update.$push.history.$each],
      };
      return structuredClone(record);
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/integrations`;
  const headers = (actor = 2) => ({
    Authorization:
      'Bearer ' +
      jwt.sign({ id: actor.toString(16).padStart(24, '0'), version: 0 }, process.env.JWT_SECRET),
    'Content-Type': 'application/json',
  });
  const put = (body, actor = 2) =>
    fetch(url, { method: 'PUT', headers: headers(actor), body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: headers(1) })).status, 403);
    const initial = await fetch(url, { headers: headers() });
    assert.equal(initial.headers.get('cache-control'), 'no-store');
    assert.equal(JSON.stringify(await initial.json()).includes('hosting-token'), false);
    assert.equal(
      (
        await put(
          { revision: 0, currentPassword: 'wrong', changes: { WHATSAPP_ACCESS_TOKEN: 'stolen' } },
          3,
        )
      ).status,
      403,
    );
    assert.equal(record, null);
    assert.equal(
      (
        await put(
          { revision: 0, currentPassword: 'correct-password', changes: { JWT_SECRET: 'bad' } },
          4,
        )
      ).status,
      400,
    );
    const saved = await put(
      {
        revision: 0,
        currentPassword: 'correct-password',
        changes: { WHATSAPP_ACCESS_TOKEN: 'new-private-token' },
      },
      5,
    );
    assert.equal(saved.status, 200);
    assert.equal(JSON.stringify(await saved.json()).includes('new-private-token'), false);
    assert.equal(record.encrypted.includes('new-private-token'), false);
    assert.deepEqual(record.history[0].fields, ['WHATSAPP_ACCESS_TOKEN']);
    assert.equal(JSON.stringify(record.history).includes('correct-password'), false);
    assert.equal(integrationEnvironment().WHATSAPP_ACCESS_TOKEN, 'new-private-token');
    assert.equal(
      (
        await put(
          {
            revision: 0,
            currentPassword: 'correct-password',
            changes: { WHATSAPP_ACCESS_TOKEN: 'stale' },
          },
          6,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await put(
          {
            revision: 1,
            currentPassword: 'correct-password',
            changes: { WHATSAPP_ACCESS_TOKEN: '' },
          },
          7,
        )
      ).status,
      200,
    );
    assert.equal(integrationEnvironment().WHATSAPP_ACCESS_TOKEN, '');
    assert.equal(
      (
        await put(
          {
            revision: 2,
            currentPassword: 'correct-password',
            changes: { WHATSAPP_ACCESS_TOKEN: null },
          },
          8,
        )
      ).status,
      200,
    );
    assert.equal(integrationEnvironment().WHATSAPP_ACCESS_TOKEN, 'hosting-token');
    const oversized = await fetch(url, {
      method: 'PUT',
      headers: headers(9),
      body: JSON.stringify({ changes: { WHATSAPP_ACCESS_TOKEN: 'x'.repeat(25000) } }),
    });
    assert.equal(oversized.status, 400);
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await put(
            { revision: 3, currentPassword: 'wrong', changes: { WHATSAPP_ACCESS_TOKEN: 'x' } },
            10,
          )
        ).status,
        403,
      );
    assert.equal(
      (
        await put(
          {
            revision: 3,
            currentPassword: 'correct-password',
            changes: { WHATSAPP_ACCESS_TOKEN: 'x' },
          },
          10,
        )
      ).status,
      429,
    );
    assert.equal(
      JSON.stringify(await (await fetch(url, { headers: headers() })).json()).includes(
        'new-private-token',
      ),
      false,
    );
  } finally {
    Admin.findById = originals.admin;
    IntegrationSettings.findOne = originals.find;
    IntegrationSettings.create = originals.create;
    IntegrationSettings.findOneAndUpdate = originals.update;
    publishIntegrations({});
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
