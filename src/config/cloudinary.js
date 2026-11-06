import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from '../utils/cloudinaryStorage.js';
import { integrationEnvironment, onIntegrationChange } from '../utils/integrationSettings.js';

/**
 * Configure Cloudinary for image uploads
 */
const configure = (env) =>
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME || '',
    api_key: env.CLOUDINARY_API_KEY || '',
    api_secret: env.CLOUDINARY_API_SECRET || '',
    secure: true,
  });
configure(integrationEnvironment());
onIntegrationChange(configure);

/**
 * Multer storage configuration for Cloudinary
 * Organizes uploads into 'bismillah-spray-center/products' folder
 */
export const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'bismillah-spray-center/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    // Preserve enough source detail for high-density product views. Delivery
    // renditions are resized separately by the frontend image helpers.
    transformation: [{ width: 2400, height: 2400, crop: 'limit' }],
  },
});

export const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'bismillah-spray-center/admin-profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }],
  },
});

export const siteLogoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'bismillah-spray-center/site-branding',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 2400, height: 2400, crop: 'limit' }],
  },
});

export default cloudinary;
