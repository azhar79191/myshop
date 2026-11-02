import cloudinary from '../config/cloudinary.js';
import { hasMediaSignature } from '../middleware/mediaUploadMiddleware.js';
const invalid = message => Object.assign(new Error(message), { statusCode: 400 });
export const uploadFieldPhotos = async values => {
  if (values === undefined) return [];
  if (!Array.isArray(values) || values.length > 3) throw invalid('Choose up to three field photos');
  // Validate every file before making external uploads.
  for (const value of values) {
    if (typeof value !== 'string') throw invalid('Invalid field photo');
    const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match || match[2].length > 2800000) throw invalid('Field photos must be JPEG, PNG or WebP, up to 2MB each');
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > 2 * 1024 * 1024 || !hasMediaSignature(bytes, match[1])) throw invalid('Field photo content does not match its image type');
  }
  if (values.length && !['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every(key => process.env[key])) throw Object.assign(new Error('Field photos are unavailable. Submit without photos or contact us on WhatsApp.'), { statusCode: 503 });
  const uploaded = [];
  try {
    for (const value of values) uploaded.push(await cloudinary.uploader.upload(value, { folder: 'bismillah-spray-center/field-photos', resource_type: 'image' }));
    return uploaded;
  } catch (error) { await retireFieldPhotos(uploaded); throw error; }
};
export const retireFieldPhotos = async photos => {
  for (const photo of photos) { try { await cloudinary.uploader.destroy(photo.public_id); } catch { console.error('Could not remove field photo:', photo.public_id); } }
};
