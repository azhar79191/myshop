import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

/**
 * Configure Cloudinary for image uploads
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Multer storage configuration for Cloudinary
 * Organizes uploads into 'bismillah-spray-center/products' folder
 */
export const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'bismillah-spray-center/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }],
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

export default cloudinary;
