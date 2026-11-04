import { normalizeBusinessSettings } from '../utils/businessStatistics.js';
import { mergeSettings } from '../utils/mergeSettings.js';
import { validateContentSettings, stampPolicyRevisions } from '../utils/contentSettings.js';
import { MEDIA_MAX_VIDEO_MB } from '../config/media.js';
import SiteSettings from '../models/SiteSettings.js';
import defaultSiteSettings from '../config/defaultSiteSettings.js';
import { successResponse, errorResponse, asyncHandler } from '../utils/apiResponse.js';

const isHexColor = (value) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

const historyEntry = (req, action) => ({
  savedAt: new Date(),
  savedBy: req.admin._id,
  name: req.admin.fullName || req.admin.username,
  action,
});

export const getSiteSettingsHistory = asyncHandler(async (req, res) => {
  const record = await SiteSettings.findOne({ key: 'global' }).select('history').lean();
  return successResponse(res, [...(record?.history || [])].reverse(), 'Settings history retrieved successfully');
});

const validateSettings = (settings) => {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return 'Settings payload must be an object';
  }

  if (settings.siteFavicon !== undefined) {
    if (typeof settings.siteFavicon !== 'string' || settings.siteFavicon.length > 2000) return 'Favicon must be an HTTPS image URL';
    if (settings.siteFavicon) {
      try { if (new URL(settings.siteFavicon).protocol !== 'https:') return 'Favicon must be an HTTPS image URL'; }
      catch { return 'Favicon must be an HTTPS image URL'; }
    }
  }

  if (settings.theme && (
    !isHexColor(settings.theme.primary) ||
    !isHexColor(settings.theme.accent)
  )) {
    return 'Theme colors must be six-digit hex colors';
  }

  if (settings.media !== undefined && (
    typeof settings.media !== 'object' || settings.media === null ||
    typeof settings.media.allowVideoUploads !== 'boolean' ||
    !Number.isInteger(settings.media.maxVideoSizeMB) ||
    settings.media.maxVideoSizeMB < 1 || settings.media.maxVideoSizeMB > MEDIA_MAX_VIDEO_MB
  )) return `Media settings require a video limit from 1 to ${MEDIA_MAX_VIDEO_MB}MB and a video upload toggle`;

  if (settings.heroImage && (typeof settings.heroImage !== 'string' || settings.heroImage.length > 2000 || !/^https:\/\//i.test(settings.heroImage))) return 'Hero image must use an HTTPS URL';
  for (const key of ['responseMessage', 'heroImageAltUr', 'heroImageAlt', 'deliveryAreas', 'deliveryDetails', 'collectionDetails']) if (settings[key] !== undefined && (typeof settings[key] !== 'string' || settings[key].length > 500)) return `${key} must be no more than 500 characters`;
  if (settings.urduTranslations !== undefined && (!Array.isArray(settings.urduTranslations) || settings.urduTranslations.length > 200 || settings.urduTranslations.some(item => !item || typeof item.original !== 'string' || typeof item.translation !== 'string' || item.original.length > 5000 || item.translation.length > 5000))) return 'Provide up to 200 English and Urdu text pairs';
  const arrays = [
    ['businessHours', 14],
    ['services', 30],
    ['aboutStats', 12],
    ['milestones', 30],
    ['cropSolutions', 20],
  ];
  for (const [key, limit] of arrays) {
    if (settings[key] !== undefined && (!Array.isArray(settings[key]) || settings[key].length > limit)) {
      return `${key} must be an array with no more than ${limit} items`;
    }
  }

  if (settings.categories !== undefined) {
    for (const key of ['products', 'faqs', 'gallery']) {
      if (!Array.isArray(settings.categories?.[key]) || settings.categories[key].length > 50) {
        return `categories.${key} must be an array with no more than 50 items`;
      }
    }
  }

  return validateContentSettings(settings);
};

export const getSiteSettings = asyncHandler(async (req, res) => {
  const record = await SiteSettings.findOne({ key: 'global' }).lean();
  const settings = normalizeBusinessSettings(mergeSettings(defaultSiteSettings, record?.settings));
  return successResponse(res, { ...settings, _revision: record?.revision || 0 }, 'Site settings retrieved successfully');
});

export const updateSiteSettings = asyncHandler(async (req, res) => {
  if (!Number.isSafeInteger(req.body?._revision) || req.body._revision < 0) return errorResponse(res, 'Reload site settings before saving', 400);
  const validationError = validateSettings(req.body);
  if (validationError) return errorResponse(res, validationError, 400);
  const suppliedSettings = Object.fromEntries(Object.keys(defaultSiteSettings)
    .filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]));

  const previousRecord = await SiteSettings.findOne({ key: 'global' }).lean();
  if (req.body._revision !== (previousRecord?.revision || 0)) return errorResponse(res, 'Site settings changed. Your draft is preserved. Reload saved settings and review before saving.', 409);
  const previous = normalizeBusinessSettings(mergeSettings(defaultSiteSettings, previousRecord?.settings));
  const settings = stampPolicyRevisions(normalizeBusinessSettings(mergeSettings(previous, suppliedSettings)), previous);
  const record = await writeSettings(req, previousRecord, settings, req.body._revision, 'settings');
  if (!record) return errorResponse(res, 'Site settings changed. Your draft is preserved. Reload saved settings and review before saving.', 409);
  return successResponse(res, { ...record.settings, _revision: record.revision }, 'Site settings updated successfully');
});

export const checkLogoRevision = asyncHandler(async (req, res, next) => {
  const raw = req.headers?.['if-match'];
  if (typeof raw !== 'string' || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) return errorResponse(res, 'Reload site settings before saving', 400);
  const previous = await SiteSettings.findOne({ key: 'global' }).lean();
  if (Number(raw) !== (previous?.revision || 0)) return errorResponse(res, 'Site settings changed. Your draft is preserved. Reload saved settings and review before saving.', 409);
  return next();
});

export const uploadSiteLogo = asyncHandler(async (req, res) => {
  if (!req.file) return errorResponse(res, 'Please provide a website logo image', 400);
  const rawVersion = req.headers?.['if-match'];
  if (typeof rawVersion !== 'string' || !/^\d+$/.test(rawVersion)) return errorResponse(res, 'Reload site settings before saving', 400);
  const revision = Number(rawVersion);
  const previous = await SiteSettings.findOne({ key: 'global' }).lean();
  if (revision !== (previous?.revision || 0)) return errorResponse(res, 'Site settings changed. Your draft is preserved. Reload saved settings and review before saving.', 409);
  const settings = normalizeBusinessSettings(mergeSettings(defaultSiteSettings, previous?.settings, { siteLogo: req.file.path }));
  const saved = await writeSettings(req, previous, settings, revision, 'logo');
  if (!saved) return errorResponse(res, 'Site settings changed. Your draft is preserved. Reload saved settings and review before saving.', 409);
  return successResponse(res, { ...saved.settings, _revision: saved.revision }, 'Website logo uploaded successfully');
});

async function writeSettings(req, previous, settings, revision, action) {
  if (!previous) {
    try { return await SiteSettings.create({ key: 'global', settings, revision: 1, history: [historyEntry(req, action)] }); }
    catch (error) { if (error.code === 11000) return null; throw error; }
  }
  const filter = { key: 'global', ...(revision === 0 ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision }) };
  return SiteSettings.findOneAndUpdate(filter, { $set: { settings }, $inc: { revision: 1 }, $push: { history: { $each: [historyEntry(req, action)], $slice: -20 } } }, { new: true, runValidators: true }).lean();
}
