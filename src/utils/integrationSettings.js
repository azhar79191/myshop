import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import IntegrationSettings from '../models/IntegrationSettings.js';
import { integrationFields } from '../config/integrationFields.js';

const aad = Buffer.from('bismillah:integration-settings:v1');
const subscribers = new Set();
let overrides = {},
  refreshedAt = 0,
  pending,
  publishedRevision = -1;
export const integrationEnvironment = () => ({ ...process.env, ...overrides });
export const onIntegrationChange = (callback) => {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
};
export function encryptionKey(env = process.env) {
  const value = env.CONFIG_ENCRYPTION_KEY || '';
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value))
    throw new Error('Integration encryption is not configured');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('Integration encryption is not configured');
  return key;
}
export function sealIntegrations(values, env = process.env) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(env), iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(values), 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}
export function openIntegrations(encrypted, env = process.env) {
  try {
    const [version, nonce, tag, data, extra] = encrypted.split('.');
    if (
      version !== 'v1' ||
      extra ||
      !data ||
      Buffer.from(nonce, 'base64').length !== 12 ||
      Buffer.from(tag, 'base64').length !== 16
    )
      throw new Error();
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(env),
      Buffer.from(nonce, 'base64'),
      { authTagLength: 16 },
    );
    decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const values = JSON.parse(
      Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString(
        'utf8',
      ),
    );
    if (
      !values ||
      typeof values !== 'object' ||
      Array.isArray(values) ||
      Object.entries(values).some(
        ([key, value]) => !Object.hasOwn(integrationFields, key) || typeof value !== 'string',
      )
    )
      throw new Error();
    return values;
  } catch {
    throw new Error('Integration settings could not be decrypted');
  }
}
export function publishIntegrations(values, revision = publishedRevision) {
  if (revision < publishedRevision) return;
  publishedRevision = revision;
  overrides = { ...values };
  refreshedAt = Date.now();
  for (const callback of subscribers) callback(integrationEnvironment());
}
export async function refreshIntegrations(force = false) {
  if (!force && Date.now() - refreshedAt < 15000) return;
  if (pending) return pending;
  pending = (async () => {
    const record = await IntegrationSettings.findOne({ key: 'global' }).select('+encrypted').lean();
    publishIntegrations(record ? openIntegrations(record.encrypted) : {}, record?.revision || 0);
  })();
  try {
    await pending;
  } finally {
    pending = null;
  }
}
export function integrationSummary(record, values, env = process.env) {
  let encryptionReady = true;
  try {
    encryptionKey(env);
  } catch {
    encryptionReady = false;
  }
  return {
    revision: record?.revision || 0,
    encryptionReady,
    fields: Object.entries(integrationFields).map(([key, spec]) => {
      const saved = Object.hasOwn(values, key),
        value = saved ? values[key] : env[key] || '';
      return {
        key,
        ...spec,
        configured: Boolean(value),
        source: saved ? (value ? 'saved' : 'disabled') : value ? 'hosting' : 'unset',
        ...(!spec.secret ? { value } : {}),
      };
    }),
    history: (record?.history || []).map((row) => ({
      savedAt: row.savedAt,
      savedBy: row.savedBy,
      fields: row.fields,
    })),
  };
}
