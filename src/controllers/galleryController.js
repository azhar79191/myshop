import Gallery from '../models/Gallery.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

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

    const images = await Gallery.find(filter).sort({ order: 1, createdAt: -1 });

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
    const { title, description, image, category, order, isActive } = req.body;

    // Validate required fields
    if (!title || !image) {
      return errorResponse(res, 'Title and image are required', 400);
    }

    const newImage = await Gallery.create({
      title,
      description,
      image,
      category,
      order,
      isActive,
    });

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
    const { title, description, image, category, order, isActive } = req.body;

    const galleryImage = await Gallery.findById(req.params.id);

    if (!galleryImage) {
      return errorResponse(res, 'Gallery image not found', 404);
    }

    // Update fields
    if (title !== undefined) galleryImage.title = title;
    if (description !== undefined) galleryImage.description = description;
    if (image !== undefined) galleryImage.image = image;
    if (category !== undefined) galleryImage.category = category;
    if (order !== undefined) galleryImage.order = order;
    if (isActive !== undefined) galleryImage.isActive = isActive;

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

    if (!image) {
      return errorResponse(res, 'Gallery image not found', 404);
    }

    await image.deleteOne();

    successResponse(res, null, 'Gallery image deleted successfully');
  } catch (error) {
    next(error);
  }
};
