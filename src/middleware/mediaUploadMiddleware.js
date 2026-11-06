import { open, unlink, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import SiteSettings from '../models/SiteSettings.js';
import { integrationEnvironment } from '../utils/integrationSettings.js';
import { MEDIA_UPLOAD_DIR, MEDIA_TYPES, IMAGE_MAX_BYTES, getMediaPolicy } from '../config/media.js';

export const removeLocalMedia = async (filename) => {
  // Only server-generated names can be deleted, never arbitrary client paths.
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm|ogv)$/.test(filename || '')) return;
  try {
    await unlink(path.join(MEDIA_UPLOAD_DIR, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};
export const cleanupMediaUploads = async (req) => {
  for (const file of Object.values(req.files || {}).flat()) {
    try {
      if (file.cloudinaryId)
        await cloudinary.uploader.destroy(file.cloudinaryId, { resource_type: file.resourceType });
      await unlink(file.path);
    } catch (error) {
      if (error.code !== 'ENOENT')
        console.error('Could not remove failed media upload:', error.message);
    }
  }
};
export const hasMediaSignature = (bytes, mime) => {
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png')
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/webp')
    return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (mime === 'video/mp4') return bytes.toString('ascii', 4, 8) === 'ftyp';
  if (mime === 'video/webm')
    return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (mime === 'video/ogg') return bytes.toString('ascii', 0, 4) === 'OggS';
  return false;
};
export const loadMediaPolicy = async (req, res, next) => {
  try {
    const record = await SiteSettings.findOne({ key: 'global' }).lean();
    req.mediaPolicy = getMediaPolicy(record?.settings?.media);
    next();
  } catch (error) {
    next(error);
  }
};
const storage = multer.diskStorage({
  destination: async (req, file, callback) => {
    try {
      const incoming = path.join(MEDIA_UPLOAD_DIR, '.incoming');
      await mkdir(incoming, { recursive: true });
      callback(null, incoming);
    } catch (error) {
      callback(error);
    }
  },
  filename: (req, file, callback) =>
    callback(null, `${randomUUID()}${MEDIA_TYPES[file.mimetype].extension}`),
});
export const uploadMedia = (req, res, next) => {
  const policy = req.mediaPolicy;
  // JSON metadata edits do not need an upload provider.
  if (!req.is('multipart/form-data')) return next();
  const provider =
    process.env.MEDIA_STORAGE || (process.env.NODE_ENV === 'production' ? 'cloudinary' : 'local');
  if (!['cloudinary', 'local'].includes(provider))
    return res.status(503).json({ success: false, message: 'Media storage is not configured.' });
  if (
    provider === 'cloudinary' &&
    !['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every(
      (key) => integrationEnvironment()[key],
    )
  )
    return res
      .status(503)
      .json({ success: false, message: 'Media uploads require configured cloud storage.' });
  if (
    provider === 'local' &&
    process.env.NODE_ENV === 'production' &&
    process.env.MEDIA_DURABLE_DISK !== 'true'
  )
    return res
      .status(503)
      .json({ success: false, message: 'Local production uploads require a durable media disk.' });
  const upload = multer({
    storage,
    limits: {
      fileSize: Math.max(IMAGE_MAX_BYTES, policy.maxVideoSizeMB * 1024 * 1024),
      files: 2,
      fields: 12,
      fieldSize: 7 * 1024 * 1024,
      parts: 14,
    },
    fileFilter: (request, file, callback) => {
      const type = MEDIA_TYPES[file.mimetype];
      if (
        !type ||
        ((file.fieldname === 'poster' || file.fieldname === 'image') && type.kind !== 'image')
      )
        return callback(
          new Error(
            'Choose a JPEG, PNG, WebP image or an MP4, WebM, Ogg video. Covers must be images.',
          ),
        );
      if (type.kind === 'video' && !policy.allowVideoUploads)
        return callback(new Error('Video uploads are disabled in Media settings.'));
      callback(null, true);
    },
  }).fields([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'poster', maxCount: 1 },
  ]);
  upload(req, res, async (error) => {
    try {
      if (error) throw error;
      if (req.files?.file && req.files?.image)
        throw new Error('Upload only one primary media file.');
      for (const file of Object.values(req.files || {}).flat()) {
        const kind = MEDIA_TYPES[file.mimetype].kind;
        const limit = kind === 'image' ? IMAGE_MAX_BYTES : policy.maxVideoSizeMB * 1024 * 1024;
        if (file.size > limit)
          throw new Error(
            `${kind === 'image' ? 'Image' : 'Video'} exceeds the ${Math.round(limit / 1024 / 1024)}MB limit.`,
          );
        const handle = await open(file.path, 'r');
        const bytes = Buffer.alloc(16);
        try {
          await handle.read(bytes, 0, 16, 0);
        } finally {
          await handle.close();
        }
        if (!hasMediaSignature(bytes, file.mimetype))
          throw new Error('The uploaded file content does not match its media type.');
      }
      for (const file of Object.values(req.files || {}).flat()) {
        if (provider === 'cloudinary') {
          file.resourceType = MEDIA_TYPES[file.mimetype].kind;
          const uploaded = await cloudinary.uploader.upload(file.path, {
            resource_type: file.resourceType,
            folder: 'bismillah-spray-center/media',
            public_id: path.parse(file.filename).name,
          });
          file.cloudinaryId = uploaded.public_id;
          file.url = uploaded.secure_url;
          await unlink(file.path);
        } else {
          const finalPath = path.join(MEDIA_UPLOAD_DIR, file.filename);
          await rename(file.path, finalPath);
          file.path = finalPath;
        }
      }
      next();
    } catch (failure) {
      await cleanupMediaUploads(req);
      const message =
        failure.code === 'LIMIT_FILE_SIZE'
          ? `File too large. Videos: ${policy.maxVideoSizeMB}MB maximum; images: 5MB maximum.`
          : failure.message;
      res.status(400).json({ success: false, message });
    }
  });
};
