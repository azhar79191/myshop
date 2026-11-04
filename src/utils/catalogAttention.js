export const lowStockFilter = { $or: [{ stockStatus: 'Low Stock' }, { 'sizes.stockStatus': 'Low Stock' }] };
export const missingProductFilter = { $or: [
  ...['description', 'brand', 'category', 'image'].map(field => ({ [field]: { $in: ['', null] } })),
  { 'sizes.0': { $exists: false } }, { 'crops.0': { $exists: false } },
] };
