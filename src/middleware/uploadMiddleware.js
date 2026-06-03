import multer from 'multer';
import { storage as cloudinaryStorage } from '../config/cloudinary.js';

// File filter for images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

// Multer using Cloudinary storage
const upload = multer({
  storage: cloudinaryStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadSingle = upload.single('image');
export const uploadMultiple = upload.array('images', 5);

export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(400).json({ success: false, message: 'File size too large. Maximum size is 5MB.' });
    if (err.code === 'LIMIT_FILE_COUNT')
      return res.status(400).json({ success: false, message: 'Too many files. Maximum is 5 images.' });
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) return res.status(400).json({ success: false, message: err.message });
  next();
};

// Returns Cloudinary URL from uploaded file
export const fileToCloudinaryUrl = (file) => {
  if (!file) return null;
  return file.path; // Cloudinary storage sets file.path as the URL
};

export const filesToCloudinaryUrls = (files) => {
  if (!files || files.length === 0) return [];
  return files.map(file => file.path);
};

// Keep for backward compatibility with base64 check on existing data
export const isValidBase64Image = (str) => {
  if (!str || typeof str !== 'string') return false;
  return /^data:image\/(jpeg|jpg|png|webp);base64,/.test(str);
};
