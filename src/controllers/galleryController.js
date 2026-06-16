import Gallery from '../models/Gallery.js';
import cloudinary from '../config/cloudinary.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { fileToCloudinaryUrl } from '../middleware/uploadMiddleware.js';

/**
 * @desc    Get all gallery images
 * @route   GET /api/gallery
 * @access  Public
 */
export const getAllGalleryImages = async (req, res, next) => {
  try {
    const { category, isActive } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const images = await Gallery.find(filter).select('-__v').sort({ order: 1, createdAt: -1 }).lean();

    successResponse(res, images, 'Gallery images retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single gallery image
 * @route   GET /api/gallery/:id
 * @access  Public
 */
export const getGalleryImageById = async (req, res, next) => {
  try {
    const image = await Gallery.findById(req.params.id);

    if (!image) {
      return errorResponse(res, 'Gallery image not found', 404);
    }

    successResponse(res, image, 'Gallery image retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create gallery image
 * @route   POST /api/gallery
 * @access  Private/Admin
 */
export const createGalleryImage = async (req, res, next) => {
  try {
    const { title, description, category, order, isActive } = req.body;

    const image = fileToCloudinaryUrl(req.file) || req.body.image;

    if (!title || !image) {
      return errorResponse(res, 'Title and image are required', 400);
    }

    const newImage = await Gallery.create({ title, description, image, category, order, isActive });
    successResponse(res, newImage, 'Gallery image created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update gallery image
 * @route   PUT /api/gallery/:id
 * @access  Private/Admin
 */
export const updateGalleryImage = async (req, res, next) => {
  try {
    const { title, description, category, order, isActive } = req.body;

    const galleryImage = await Gallery.findById(req.params.id);
    if (!galleryImage) return errorResponse(res, 'Gallery image not found', 404);

    if (title !== undefined) galleryImage.title = title;
    if (description !== undefined) galleryImage.description = description;
    if (category !== undefined) galleryImage.category = category;
    if (order !== undefined) galleryImage.order = order;
    if (isActive !== undefined) galleryImage.isActive = isActive;

    // If new file uploaded, delete old from Cloudinary and set new URL
    if (req.file) {
      if (galleryImage.image && galleryImage.image.includes('cloudinary')) {
        const publicId = galleryImage.image.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      }
      galleryImage.image = fileToCloudinaryUrl(req.file);
    } else if (req.body.image) {
      galleryImage.image = req.body.image;
    }

    const updatedImage = await galleryImage.save();
    successResponse(res, updatedImage, 'Gallery image updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete gallery image
 * @route   DELETE /api/gallery/:id
 * @access  Private/Admin
 */
export const deleteGalleryImage = async (req, res, next) => {
  try {
    const image = await Gallery.findById(req.params.id);
    if (!image) return errorResponse(res, 'Gallery image not found', 404);

    // Delete from Cloudinary
    if (image.image && image.image.includes('cloudinary')) {
      const publicId = image.image.split('/').slice(-2).join('/').split('.')[0];
      await cloudinary.uploader.destroy(publicId);
    }

    await image.deleteOne();
    successResponse(res, null, 'Gallery image deleted successfully');
  } catch (error) {
    next(error);
  }
};
