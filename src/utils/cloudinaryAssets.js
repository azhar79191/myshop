import cloudinary from '../config/cloudinary.js';

export const getCloudinaryPublicId = (value, cloudName = process.env.CLOUDINARY_CLOUD_NAME) => {
  try {
    const url = new URL(value);
    if (url.hostname !== 'res.cloudinary.com' || url.protocol !== 'https:') return null;
    const segments = url.pathname.split('/').filter(Boolean);
    if (!cloudName || segments[0] !== cloudName || segments[1] !== 'image' || segments[2] !== 'upload') return null;
    const versionIndex = segments.findIndex((segment, index) => index > 2 && /^v\d+$/.test(segment));
    const publicId = segments.slice(versionIndex >= 0 ? versionIndex + 1 : 3).join('/').replace(/\.[^/.]+$/, '');
    return publicId.startsWith('bismillah-spray-center/') ? publicId : null;
  } catch {
    return null;
  }
};

export const retireCloudinaryImages = async urls => {
  const publicIds = [...new Set(urls.map(url => getCloudinaryPublicId(url)).filter(Boolean))];
  for (const publicId of publicIds) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await cloudinary.uploader.destroy(publicId);
        if (!['ok', 'not found'].includes(result.result)) throw new Error(result.result || 'Asset deletion failed');
        break;
      } catch (error) {
        if (attempt === 3) console.error('Cloudinary cleanup failed after 3 attempts:', publicId, error.message);
      }
    }
  }
};
