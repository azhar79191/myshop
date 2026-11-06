import Admin from '../models/Admin.js';
import IntegrationSettings from '../models/IntegrationSettings.js';
import { integrationFields } from '../config/integrationFields.js';
import {
  encryptionKey,
  sealIntegrations,
  openIntegrations,
  integrationSummary,
  publishIntegrations,
} from '../utils/integrationSettings.js';
import { approvedWebhookUrl, webhookAddress } from '../utils/safeWebhook.js';
import { errorResponse, successResponse } from '../utils/apiResponse.js';

export async function validateIntegrationChanges(changes) {
  if (
    !changes ||
    typeof changes !== 'object' ||
    Array.isArray(changes) ||
    !Object.keys(changes).length ||
    Object.keys(changes).length > Object.keys(integrationFields).length
  )
    throw new Error('Provide supported integration fields');
  for (const [key, value] of Object.entries(changes)) {
    if (!Object.hasOwn(integrationFields, key)) throw new Error('Unsupported integration field');
    if (value === null || value === '') continue; // null uses hosting; empty explicitly disables.
    const spec = integrationFields[key];
    if (typeof value !== 'string' || value.length > spec.max || /[\x00-\x20\x7f]/.test(value))
      throw new Error('Integration values must be bounded text without whitespace');
    if (spec.type === 'digits' && !/^\d+$/.test(value))
      throw new Error('Use digits for provider identifiers');
    if (spec.type === 'version' && !/^v\d{1,3}\.\d{1,2}$/.test(value))
      throw new Error('Use a Meta API version such as v26.0');
    if (spec.type === 'cloud' && !/^[a-zA-Z0-9_-]+$/.test(value))
      throw new Error('Invalid cloud name');
    if (spec.type === 'email' && !/^[^<>@]+@[^<>@]+\.[^<>@]+$/.test(value))
      throw new Error('Use a sender email address');
    if (spec.type === 'webhook') await webhookAddress(approvedWebhookUrl(value));
    if (spec.type === 'origin') {
      const url = new URL(value);
      const allowed = (process.env.FRONTEND_URL || 'https://bismillahspraycenter.vercel.app')
        .split(',')
        .map((v) => v.trim());
      if (url.protocol !== 'https:' || url.origin !== value || !allowed.includes(url.origin))
        throw new Error('Use an approved frontend HTTPS origin');
    }
  }
}
export const getIntegrations = async (_req, res) => {
  try {
    const record = await IntegrationSettings.findOne({ key: 'global' }).select('+encrypted').lean();
    return successResponse(
      res,
      integrationSummary(record, record ? openIntegrations(record.encrypted) : {}),
    );
  } catch {
    return errorResponse(
      res,
      'Integration settings are unavailable. Check server encryption configuration.',
      503,
    );
  }
};
export const saveIntegrations = async (req, res) => {
  try {
    if (
      !req.body ||
      Object.keys(req.body).some(
        (key) => !['revision', 'currentPassword', 'changes'].includes(key),
      ) ||
      !Number.isSafeInteger(req.body.revision) ||
      req.body.revision < 0
    )
      return errorResponse(res, 'Reload integrations before saving', 400);
    const { currentPassword, changes, revision } = req.body;
    if (
      typeof currentPassword !== 'string' ||
      !currentPassword ||
      Buffer.byteLength(currentPassword, 'utf8') > 72
    )
      return errorResponse(res, 'Confirm your current password', 400);
    const admin = await Admin.findById(req.admin._id).select('+password');
    if (
      !admin?.isActive ||
      admin.role !== 'superadmin' ||
      !(await admin.comparePassword(currentPassword))
    )
      return errorResponse(res, 'Password confirmation failed', 403);
    try {
      encryptionKey();
    } catch {
      return errorResponse(
        res,
        'Set CONFIG_ENCRYPTION_KEY in backend hosting before saving credentials',
        503,
      );
    }
    try {
      await validateIntegrationChanges(changes);
    } catch {
      return errorResponse(
        res,
        'Invalid integration fields or unapproved destination. Check the field format and hosting allowlist.',
        400,
      );
    }
    const previous = await IntegrationSettings.findOne({ key: 'global' })
      .select('+encrypted')
      .lean();
    if ((previous?.revision || 0) !== revision)
      return errorResponse(res, 'Integrations changed. Reload and review before saving.', 409);
    const values = previous ? openIntegrations(previous.encrypted) : {};
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) delete values[key];
      else values[key] = value;
    }
    const encrypted = sealIntegrations(values);
    const entry = { savedAt: new Date(), savedBy: req.admin._id, fields: Object.keys(changes) };
    let saved;
    if (!previous)
      saved = await IntegrationSettings.create({
        key: 'global',
        revision: 1,
        encrypted,
        history: [entry],
      });
    else
      saved = await IntegrationSettings.findOneAndUpdate(
        { key: 'global', revision },
        {
          $set: { encrypted },
          $inc: { revision: 1 },
          $push: { history: { $each: [entry], $slice: -50 } },
        },
        { new: true, runValidators: true },
      ).lean();
    if (!saved)
      return errorResponse(res, 'Integrations changed. Reload and review before saving.', 409);
    publishIntegrations(values, saved.revision);
    return successResponse(res, integrationSummary(saved, values), 'Integration settings saved');
  } catch (error) {
    if (error.code === 11000)
      return errorResponse(res, 'Integrations changed. Reload and review before saving.', 409);
    // Never forward database, crypto or provider errors: they can contain submitted secrets.
    return errorResponse(res, 'Could not save integration settings', 503);
  }
};
