import 'dotenv/config';
import mongoose from 'mongoose';
import path from 'node:path';
import Gallery from '../models/Gallery.js';
import cloudinary from '../config/cloudinary.js';
import { MEDIA_UPLOAD_DIR } from '../config/media.js';
const safeKey = (value) => /^[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm|ogv)$/.test(value || '');
if (
  !process.env.MONGODB_URI ||
  !['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every(
    (key) => process.env[key],
  )
)
  throw new Error('Configure MongoDB and Cloudinary before migration');
try {
  await mongoose.connect(process.env.MONGODB_URI);
  for await (const item of Gallery.find({
    $or: [
      { storageKey: { $exists: true, $nin: ['', null] } },
      { posterKey: { $exists: true, $nin: ['', null] } },
    ],
  }).cursor()) {
    const uploaded = [];
    try {
      if (safeKey(item.storageKey)) {
        const file = await cloudinary.uploader.upload(
          path.join(MEDIA_UPLOAD_DIR, item.storageKey),
          { resource_type: item.mediaType || 'image', folder: 'bismillah-spray-center/media' },
        );
        uploaded.push({ id: file.public_id, type: item.mediaType || 'image' });
        item.cloudinaryId = file.public_id;
        if (item.mediaType === 'video') item.video = file.secure_url;
        else item.image = file.secure_url;
        item.storageKey = '';
      }
      if (safeKey(item.posterKey)) {
        const file = await cloudinary.uploader.upload(path.join(MEDIA_UPLOAD_DIR, item.posterKey), {
          resource_type: 'image',
          folder: 'bismillah-spray-center/media',
        });
        uploaded.push({ id: file.public_id, type: 'image' });
        item.posterCloudinaryId = file.public_id;
        item.poster = file.secure_url;
        item.posterKey = '';
      }
      await item.save();
      console.log('Migrated media record:', String(item._id));
    } catch (error) {
      for (const file of uploaded) {
        try {
          await cloudinary.uploader.destroy(file.id, { resource_type: file.type });
        } catch {
          console.error('Cloud cleanup needed:', file.id);
        }
      }
      throw error;
    }
  }
} finally {
  await mongoose.disconnect();
}
// Original files are deliberately retained so a verified backup can be kept.
