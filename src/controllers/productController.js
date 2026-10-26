import Product from '../models/Product.js';
import { successResponse, errorResponse, paginateResponse, asyncHandler } from '../utils/apiResponse.js';
import { fileToCloudinaryUrl, filesToCloudinaryUrls } from '../middleware/uploadMiddleware.js';
import { getPagination } from '../utils/pagination.js';
import { buildProductQuery, productFields } from '../utils/productQuery.js';
import { retireCloudinaryImages } from '../utils/cloudinaryAssets.js';

/**
 * @desc    Get all products with filtering, sorting, and pagination
 * @route   GET /api/products
 * @access  Public
 */
export const getProducts = asyncHandler(async (req, res) => {
  const { filter, sort } = buildProductQuery(req.query);

  const { page: pageNum, limit: limitNum, skip } = getPagination(req.query.page, req.query.limit, 12);

  // Execute query with field selection to reduce payload size
  const [products, total] = await Promise.all([
    Product.find(filter)
      .select('-usage -__v') // Exclude large fields not needed in list view
      .sort(`${sort} _id`)
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
  const limit = Math.min(10, getPagination(1, req.query.limit, 6).limit);

  const products = await Product.find({ featured: true, stockStatus: { $ne: 'Out of Stock' } })
    .select('-usage -__v') // Exclude large fields
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
  const productData = productFields(req.body);

  // Parse sizes if it's a string
  if (typeof productData.sizes === 'string') {
    try {
      productData.sizes = JSON.parse(productData.sizes);
    } catch (error) {
      if (req.file) await retireCloudinaryImages([req.file.path]);
      return errorResponse(res, 'Invalid sizes format', 400);
    }
  }

  if (req.file) {
    productData.image = fileToCloudinaryUrl(req.file);
  }

  if (req.files && req.files.length > 0) {
    productData.images = filesToCloudinaryUrls(req.files);
    if (!productData.image) productData.image = productData.images[0];
  }

  // Validate required image
  if (!productData.image) {
    return errorResponse(res, 'Product image is required', 400);
  }

  let product;
  try {
    product = await Product.create(productData);
  } catch (error) {
    if (req.file) await retireCloudinaryImages([req.file.path]);
    throw error;
  }
  return successResponse(res, product, 'Product created successfully', 201);
});

/**
 * @desc    Update product
 * @route   PUT /api/products/:id
 * @access  Admin
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = productFields(req.body);

  // Parse sizes if it's a string
  if (typeof updateData.sizes === 'string') {
    try {
      updateData.sizes = JSON.parse(updateData.sizes);
    } catch (error) {
      if (req.file) await retireCloudinaryImages([req.file.path]);
      return errorResponse(res, 'Invalid sizes format', 400);
    }
  }

  if (req.file) {
    updateData.image = fileToCloudinaryUrl(req.file);
  }

  if (req.files && req.files.length > 0) {
    updateData.images = filesToCloudinaryUrls(req.files);
  }

  const product = await Product.findById(id);
  if (!product) {
    if (req.file) await retireCloudinaryImages([req.file.path]);
    return errorResponse(res, 'Product not found', 404);
  }

  const oldImages = [product.image, ...product.images];
  Object.assign(product, updateData);
  try {
    await product.save();
  } catch (error) {
    if (req.file) await retireCloudinaryImages([req.file.path]);
    throw error;
  }
  const retainedImages = new Set([product.image, ...product.images]);
  await retireCloudinaryImages(oldImages.filter(url => !retainedImages.has(url)));
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

  await retireCloudinaryImages([product.image, ...product.images]);
  return successResponse(res, null, 'Product deleted successfully');
});

/**
 * @desc    Get related products
 * @route   GET /api/products/:id/related
 * @access  Public
 */
export const getRelatedProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(8, getPagination(1, req.query.limit, 4).limit);

  let product = /^[0-9a-fA-F]{24}$/.test(id) ? await Product.findById(id).select('category brand').lean() : null;
  if (!product) product = await Product.findOne({ slug: id }).select('category brand').lean();
  if (!product) {
    return errorResponse(res, 'Product not found', 404);
  }

  const related = await Product.find({
    _id: { $ne: product._id },
    stockStatus: { $ne: 'Out of Stock' },
    $or: [{ category: product.category }, { brand: product.brand }],
  })
    .select('-usage -__v') // Exclude large fields
    .limit(limit)
    .lean();

  return successResponse(res, related, 'Related products retrieved successfully');
});
