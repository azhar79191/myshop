import { lowStockFilter, missingProductFilter } from './catalogAttention.js';
import { productSearchClauses } from './productSearch.js';
export const productFields = body => Object.fromEntries(
  ['name', 'description', 'category', 'brand', 'image', 'images', 'sizes', 'stockStatus', 'usage', 'featured', 'crops', 'activeIngredient', 'formulation', 'targetProblems', 'labelUrl', 'translations', 'searchAliases']
    .filter(key => body[key] !== undefined).map(key => [key, body[key]])
);

const invalidQuery = message => {
  throw Object.assign(new Error(message), { statusCode: 400 });
};

export const buildProductQuery = query => {
  const filter = {};
  for (const key of ['crop', 'category', 'brand', 'search', 'stockStatus', 'sort', 'featured', 'available', 'minPrice', 'maxPrice', 'attention']) {
    if (query[key] !== undefined && typeof query[key] !== 'string') invalidQuery(`${key} must be a string`);
    if (query[key]?.length > 200) invalidQuery(`${key} is too long`);
  }
  if (query.crop) filter.crops = { $regex: `^${query.crop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };
  if (query.category) filter.category = query.category;
  if (query.brand) filter.brand = query.brand;
  if (query.search?.trim()) {
    const clauses = productSearchClauses(query.search);
    if (clauses.length === 1) filter.$or = clauses[0].$or;
    else filter.$and = clauses;
  }
  if (query.featured && !['true', 'false'].includes(query.featured)) invalidQuery('featured must be true or false');
  if (query.available && !['true', 'false'].includes(query.available)) invalidQuery('available must be true or false');
  if (query.featured) filter.featured = query.featured === 'true';
  if (query.stockStatus) {
    if (!['In Stock', 'Low Stock', 'Out of Stock'].includes(query.stockStatus)) invalidQuery('Invalid stock status');
    filter.stockStatus = query.stockStatus;
  } else if (query.available === 'true') filter.stockStatus = { $ne: 'Out of Stock' };
  const price = {};
  for (const [key, operator] of [['minPrice', '$gte'], ['maxPrice', '$lte']]) {
    if (query[key] !== undefined && query[key] !== '') {
      const value = Number(query[key]);
      if (!Number.isFinite(value) || value < 0) invalidQuery(`${key} must be a non-negative number`);
      price[operator] = value;
    }
  }
  if (price.$gte !== undefined && price.$lte !== undefined && price.$gte > price.$lte) invalidQuery('minPrice cannot exceed maxPrice');
  if (Object.keys(price).length) filter.sizes = { $elemMatch: { price } };
  if (query.attention) {
    if (!['low-stock', 'missing-details'].includes(query.attention)) invalidQuery('Invalid catalog attention filter');
    filter.$and = [...(filter.$and || []), query.attention === 'low-stock' ? lowStockFilter : missingProductFilter];
  }
  const sort = query.sort || '-createdAt';
  if (!['createdAt', '-createdAt', 'name', '-name', 'sizes.price', '-sizes.price'].includes(sort)) invalidQuery('Invalid product sort');
  return { filter, sort };
};
