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

  return null;
};

export const getSiteSettings = asyncHandler(async (req, res) => {
  const record = await SiteSettings.findOne({ key: 'global' }).lean();
  const settings = { ...defaultSiteSettings, ...(record?.settings || {}) };
  return successResponse(res, settings, 'Site settings retrieved successfully');
});

export const updateSiteSettings = asyncHandler(async (req, res) => {
  const validationError = validateSettings(req.body);
  if (validationError) return errorResponse(res, validationError, 400);
  const suppliedSettings = Object.fromEntries(Object.keys(defaultSiteSettings)
    .filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]));

  const settings = {
    ...defaultSiteSettings,
    ...suppliedSettings,
    contact: { ...defaultSiteSettings.contact, ...req.body.contact },
    social: { ...defaultSiteSettings.social, ...req.body.social },
    theme: { ...defaultSiteSettings.theme, ...req.body.theme },
    categories: { ...defaultSiteSettings.categories, ...req.body.categories },
    homeContent: { ...defaultSiteSettings.homeContent, ...req.body.homeContent },
    media: { ...defaultSiteSettings.media, ...req.body.media },
  };
  const record = await SiteSettings.findOneAndUpdate(
    { key: 'global' },
    { $set: { settings }, $push: { history: { $each: [historyEntry(req, 'settings')], $slice: -20 } } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();

  return successResponse(res, record.settings, 'Site settings updated successfully');
});

export const uploadSiteLogo = asyncHandler(async (req, res) => {
  if (!req.file) return errorResponse(res, 'Please provide a website logo image', 400);

  const record = await SiteSettings.findOne({ key: 'global' });
  const settings = {
    ...defaultSiteSettings,
    ...(record?.settings || {}),
    siteLogo: req.file.path,
  };
  const updatedRecord = await SiteSettings.findOneAndUpdate(
    { key: 'global' },
    { $set: { settings }, $push: { history: { $each: [historyEntry(req, 'logo')], $slice: -20 } } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();

  return successResponse(res, updatedRecord.settings, 'Website logo uploaded successfully');
});
