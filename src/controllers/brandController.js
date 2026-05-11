import Brand from '../models/Brand.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * @desc    Get all brands
 * @route   GET /api/brands
 * @access  Public
 */
export const getAllBrands = async (req, res, next) => {
  try {
    const { isActive } = req.query;

    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const brands = await Brand.find(filter).sort({ order: 1, createdAt: -1 });

    successResponse(res, brands, 'Brands retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single brand
 * @route   GET /api/brands/:id
 * @access  Public
 */
export const getBrandById = async (req, res, next) => {
  try {
    const brand = await Brand.findById(req.params.id);

    if (!brand) {
      return errorResponse(res, 'Brand not found', 404);
    }

    successResponse(res, brand, 'Brand retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create brand
 * @route   POST /api/brands
 * @access  Private/Admin
 */
export const createBrand = async (req, res, next) => {
  try {
    const { name, description, logo, website, country, order, isActive } = req.body;

    // Validate required fields
    if (!name || !logo) {
      return errorResponse(res, 'Name and logo are required', 400);
    }

    const newBrand = await Brand.create({
      name,
      description,
      logo,
      website,
      country,
      order,
      isActive,
    });

    successResponse(res, newBrand, 'Brand created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update brand
 * @route   PUT /api/brands/:id
 * @access  Private/Admin
 */
export const updateBrand = async (req, res, next) => {
  try {
    const { name, description, logo, website, country, order, isActive } = req.body;

    const brand = await Brand.findById(req.params.id);

    if (!brand) {
      return errorResponse(res, 'Brand not found', 404);
    }

    // Update fields
    if (name !== undefined) brand.name = name;
    if (description !== undefined) brand.description = description;
    if (logo !== undefined) brand.logo = logo;
    if (website !== undefined) brand.website = website;
    if (country !== undefined) brand.country = country;
    if (order !== undefined) brand.order = order;
    if (isActive !== undefined) brand.isActive = isActive;

    const updatedBrand = await brand.save();

    successResponse(res, updatedBrand, 'Brand updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete brand
 * @route   DELETE /api/brands/:id
 * @access  Private/Admin
 */
export const deleteBrand = async (req, res, next) => {
  try {
    const brand = await Brand.findById(req.params.id);

    if (!brand) {
      return errorResponse(res, 'Brand not found', 404);
    }

    await brand.deleteOne();

    successResponse(res, null, 'Brand deleted successfully');
  } catch (error) {
    next(error);
  }
};
