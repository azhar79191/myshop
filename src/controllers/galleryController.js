import Gallery from '../models/Gallery.js';
import cloudinary from '../config/cloudinary.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { cleanupMediaUploads, removeLocalMedia } from '../middleware/mediaUploadMiddleware.js';
import { MEDIA_TYPES } from '../config/media.js';

const serialize = (item, req) => {
  const value = item.toObject ? item.toObject() : { ...item };
  const origin = (process.env.MEDIA_PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  for (const field of ['image', 'video', 'poster']) if (value[field]?.startsWith('/uploads/media/')) value[field] = `${origin}${value[field]}`;
  value.mediaType ||= 'image';
  delete value.storageKey;
  delete value.posterKey;
  return value;
};
const removeAssets = async item => {
  for (const key of [item.storageKey, item.posterKey]) if (key) await removeLocalMedia(key);
  // Existing Cloudinary images remain supported during migration.
  if (!item.storageKey && item.image?.startsWith('https://res.cloudinary.com/')) {
    const uploaded = item.image.split('/upload/')[1];
    if (uploaded) {
      const publicId = uploaded.replace(/^.*?v\d+\//, '').replace(/\.[^/.]+$/, '');
      await cloudinary.uploader.destroy(publicId);
    }
  }
};
const retireAssets = async item => { try { await removeAssets(item); } catch (error) { console.error('Could not retire media asset:', error.message); } };
const buildFields = (req, existing) => {
  const result = {};
  for (const key of ['title', 'description', 'category', 'order', 'isActive']) if (req.body[key] !== undefined) result[key] = req.body[key];
  if (result.isActive !== undefined) {
    if (![true, false, 'true', 'false'].includes(result.isActive)) throw new Error('Active must be true or false.');
    result.isActive = result.isActive === true || result.isActive === 'true';
  }
  const file = req.files?.file?.[0] || req.files?.image?.[0];
  const poster = req.files?.poster?.[0];
  const requestedType = req.body.mediaType || existing?.mediaType || 'image';
  if (!['image', 'video'].includes(requestedType)) throw new Error('Media type must be image or video.');
  if (file) {
    const type = MEDIA_TYPES[file.mimetype].kind;
    if (req.body.mediaType && requestedType !== type) throw new Error('Selected media type does not match the uploaded file.');
    Object.assign(result, { mediaType: type, storageKey: file.filename, mimeType: file.mimetype, fileSize: file.size, image: type === 'image' ? `/uploads/media/${file.filename}` : undefined, video: type === 'video' ? `/uploads/media/${file.filename}` : undefined });
    if (type === 'image') Object.assign(result, { poster: '', posterKey: '' });
  } else if (!existing) {
    // Preserve existing image API clients. Videos always require a server upload.
    if (requestedType === 'video') throw new Error('Choose a video file to upload to the server.');
    if (!req.body.image || !/^(https?:\/\/|data:image\/(jpeg|jpg|png|webp);base64,)/i.test(req.body.image)) throw new Error('Choose an image or video file.');
    Object.assign(result, { mediaType: 'image', image: req.body.image });
  } else if (requestedType !== (existing.mediaType || 'image')) throw new Error('Upload a new file to change the media type.');
  if (poster) {
    if ((result.mediaType || existing?.mediaType) !== 'video') throw new Error('Cover images are only available for videos.');
    Object.assign(result, { poster: `/uploads/media/${poster.filename}`, posterKey: poster.filename });
  }
  if (req.body.removePoster === 'true' && !poster) Object.assign(result, { poster: '', posterKey: '' });
  return result;
};
export const getAllGalleryImages = async (req, res, next) => {
  try {
    const filter = req.mediaAdmin ? {} : { isActive: true };
    if (req.query.category) filter.category = req.query.category;
    if (req.mediaAdmin && req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (['image', 'video'].includes(req.query.mediaType)) filter.mediaType = req.query.mediaType;
    const items = await Gallery.find(filter).select('-__v').sort({ order: 1, createdAt: -1 }).lean();
    successResponse(res, items.map(item => serialize(item, req)), 'Media retrieved successfully');
  } catch (error) { next(error); }
};
export const getGalleryImageById = async (req, res, next) => {
  try {
    const item = await Gallery.findById(req.params.id);
    if (!item || (!req.mediaAdmin && !item.isActive)) return errorResponse(res, 'Media item not found', 404);
    successResponse(res, serialize(item, req), 'Media retrieved successfully');
  } catch (error) { next(error); }
};
export const createGalleryImage = async (req, res, next) => {
  try {
    let fields;
    try { fields = buildFields(req); } catch (error) { await cleanupMediaUploads(req); return errorResponse(res, error.message, 400); }
    const item = await Gallery.create(fields);
    successResponse(res, serialize(item, req), 'Media created successfully', 201);
  } catch (error) { await cleanupMediaUploads(req); next(error); }
};
export const updateGalleryImage = async (req, res, next) => {
  try {
    const item = await Gallery.findById(req.params.id);
    if (!item) { await cleanupMediaUploads(req); return errorResponse(res, 'Media item not found', 404); }
    const previous = { image: item.image, storageKey: item.storageKey, posterKey: item.posterKey };
    let fields;
    try { fields = buildFields(req, item); } catch (error) { await cleanupMediaUploads(req); return errorResponse(res, error.message, 400); }
    Object.assign(item, fields);
    await item.save();
    const retired = {};
    if (fields.storageKey && fields.storageKey !== previous.storageKey) Object.assign(retired, { image: previous.image, storageKey: previous.storageKey });
    if (fields.posterKey !== undefined && fields.posterKey !== previous.posterKey) retired.posterKey = previous.posterKey;
    await retireAssets(retired);
    successResponse(res, serialize(item, req), 'Media updated successfully');
  } catch (error) { await cleanupMediaUploads(req); next(error); }
};
export const deleteGalleryImage = async (req, res, next) => {
  try {
    const item = await Gallery.findById(req.params.id);
    if (!item) return errorResponse(res, 'Media item not found', 404);
    await item.deleteOne();
    await retireAssets(item);
    successResponse(res, null, 'Media deleted successfully');
  } catch (error) { next(error); }
};
