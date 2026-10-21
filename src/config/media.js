import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const configuredLimit = Number(process.env.MEDIA_MAX_VIDEO_MB || 100);
export const MEDIA_MAX_VIDEO_MB = Number.isInteger(configuredLimit) && configuredLimit >= 1 && configuredLimit <= 2048 ? configuredLimit : 100;
export const MEDIA_UPLOAD_DIR = path.resolve(process.env.MEDIA_UPLOAD_DIR || path.join(projectRoot, 'uploads/media'));
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const MEDIA_TYPES = {
  'image/jpeg': { extension: '.jpg', kind: 'image' },
  'image/png': { extension: '.png', kind: 'image' },
  'image/webp': { extension: '.webp', kind: 'image' },
  'video/mp4': { extension: '.mp4', kind: 'video' },
  'video/webm': { extension: '.webm', kind: 'video' },
  'video/ogg': { extension: '.ogv', kind: 'video' },
};
export const getMediaPolicy = (settings = {}) => ({
  allowVideoUploads: settings.allowVideoUploads !== false,
  maxVideoSizeMB: Math.min(MEDIA_MAX_VIDEO_MB, Number.isInteger(settings.maxVideoSizeMB) && settings.maxVideoSizeMB > 0 ? settings.maxVideoSizeMB : MEDIA_MAX_VIDEO_MB),
  serverMaxVideoSizeMB: MEDIA_MAX_VIDEO_MB,
  maxImageSizeMB: 5,
});
