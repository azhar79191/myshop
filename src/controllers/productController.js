import Product from '../models/Product.js';
import { successResponse, errorResponse, paginateResponse, asyncHandler } from '../utils/apiResponse.js';
import { fileToBase64, filesToBase64, isValidBase64Image } from '../middleware/uploadMiddleware.js';

/**
 * @desc    Get all products with filtering, sorting, and pagination
 * @route   GET /api/products
 * @access  Public
 */
export const getProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    sort = '-createdAt',
    category,
    brand,
    search,
    minPrice,
    maxPrice,
    featured,
    stockStatus,
  } = req.query;

  // Build filter object
  const filter = {};

  if (category) {
    filter.category = category;
  }

  if (brand) {
    filter.brand = { $regex: brand, $options: 'i' };
  }

  if (search) {
    filter.$text = { $search: search };
  }

  if (featured === 'true') {
    filter.featured = true;
  }

  if (stockStatus) {
    filter.stockStatus = stockStatus;
  }

  if (minPrice || maxPrice) {
    filter['sizes.price'] = {};
    if (minPrice) filter['sizes.price'].$gte = Number(minPrice);
    if (maxPrice) filter['sizes.price'].$lte = Number(maxPrice);
  }

  // Pagination
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  // Execute query
  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(filter),
  ]);

  const pages = Math.ceil(total / limitNum);

  return paginateResponse(res, products, {
    page: pageNum,
    pages,
    total,
    limit: limitNum,
  }, 'Products retrieved successfully');
});

/**
 * @desc    Get single product by ID or slug
 * @route   GET /api/products/:id
 * @access  Public
 */
export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let product;
  // Try to find by MongoDB ObjectId first
  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    product = await Product.findById(id).lean();
  }
  // If not found, try by slug
  if (!product) {
    product = await Product.findOne({ slug: id }).lean();
  }

  if (!product) {
    return errorResponse(res, 'Product not found', 404);
  }

  return successResponse(res, product, 'Product retrieved successfully');
});

/**
 * @desc    Get featured products
 * @route   GET /api/products/featured/list
 * @access  Public
 */
export const getFeaturedProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(10, parseInt(req.query.limit, 10) || 6);

  const products = await Product.find({ featured: true, stockStatus: { $ne: 'Out of Stock' } })
    .sort('-createdAt')
    .limit(limit)
    .lean();

  return successResponse(res, products, 'Featured products retrieved successfully');
});

/**
 * @desc    Get all unique categories
 * @route   GET /api/products/categories/all
 * @access  Public
 */
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Product.distinct('category');
  return successResponse(res, categories, 'Categories retrieved successfully');
});

/**
 * @desc    Get all unique brands
 * @route   GET /api/products/brands/all
 * @access  Public
 */
export const getBrands = asyncHandler(async (req, res) => {
  const brands = await Product.distinct('brand');
  return successResponse(res, brands, 'Brands retrieved successfully');
});

/**
 * @desc    Create new product
 * @route   POST /api/products
 * @access  Admin
 */
export const createProduct = asyncHandler(async (req, res) => {
  const productData = req.body;

  // Parse sizes if it's a string
  if (typeof productData.sizes === 'string') {
    try {
      productData.sizes = JSON.parse(productData.sizes);
    } catch (error) {
      return errorResponse(res, 'Invalid sizes format', 400);
    }
  }

  // Handle file upload (convert to base64)
  if (req.file) {
    productData.image = fileToBase64(req.file);
  }

  // Handle multiple files
  if (req.files && req.files.length > 0) {
    productData.images = filesToBase64(req.files);
    if (!productData.image) {
      productData.image = productData.images[0];
    }
  }

  // Handle base64 image from request body (for direct base64 upload)
  if (productData.imageBase64 && isValidBase64Image(productData.imageBase64)) {
    productData.image = productData.imageBase64;
    delete productData.imageBase64;
  }

  // Validate required image
  if (!productData.image) {
    return errorResponse(res, 'Product image is required', 400);
  }

  const product = await Product.create(productData);
  return successResponse(res, product, 'Product created successfully', 201);
});

/**
 * @desc    Update product
 * @route   PUT /api/products/:id
 * @access  Admin
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Parse sizes if it's a string
  if (typeof updateData.sizes === 'string') {
    try {
      updateData.sizes = JSON.parse(updateData.sizes);
    } catch (error) {
      return errorResponse(res, 'Invalid sizes format', 400);
    }
  }

  // Handle file upload (convert to base64)
  if (req.file) {
    updateData.image = fileToBase64(req.file);
  }

  // Handle multiple files
  if (req.files && req.files.length > 0) {
    updateData.images = filesToBase64(req.files);
  }

  // Handle base64 image from request body
  if (updateData.imageBase64 && isValidBase64Image(updateData.imageBase64)) {
    updateData.image = updateData.imageBase64;
    delete updateData.imageBase64;
  }

  const product = await Product.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    return errorResponse(res, 'Product not found', 404);
  }

  return successResponse(res, product, 'Product updated successfully');
});

/**
 * @desc    Delete product
 * @route   DELETE /api/products/:id
 * @access  Admin
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findByIdAndDelete(id);

  if (!product) {
    return errorResponse(res, 'Product not found', 404);
  }

  return successResponse(res, null, 'Product deleted successfully');
});

/**
 * @desc    Get related products
 * @route   GET /api/products/:id/related
 * @access  Public
 */
export const getRelatedProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(8, parseInt(req.query.limit, 10) || 4);

  const product = await Product.findById(id).lean();
  if (!product) {
    return errorResponse(res, 'Product not found', 404);
  }

  const related = await Product.find({
    _id: { $ne: id },
    $or: [{ category: product.category }, { brand: product.brand }],
  })
    .limit(limit)
    .lean();

  return successResponse(res, related, 'Related products retrieved successfully');
});
