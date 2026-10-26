import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import Product from '../src/models/Product.js';
import productRoutes from '../src/routes/productRoutes.js';
import { errorHandler } from '../src/middleware/errorMiddleware.js';

test('catalog API exposes later pages, full details, and related products by slug', async () => {
  const originals = { find: Product.find, countDocuments: Product.countDocuments, findById: Product.findById, findOne: Product.findOne };
  const records = Array.from({ length: 75 }, (_, index) => ({ _id: String(index + 1).padStart(24, '0'), slug: `product-${index + 1}`, name: `Product ${index + 1}`, category: 'Seeds', brand: 'Acme', usage: 'Full usage instructions', stockStatus: 'In Stock' }));
  const query = values => {
    let skip = 0;
    let limit = values.length;
    let list = false;
    return {
      select(fields) { list = fields.includes('-usage'); return this; },
      sort() { return this; },
      skip(value) { skip = value; return this; },
      limit(value) { limit = value; return this; },
      async lean() {
        return values.slice(skip, skip + limit).map(record => {
          const value = { ...record };
          if (list) delete value.usage;
          return value;
        });
      },
    };
  };
  Product.find = filter => query(records.filter(record => !filter._id || record._id !== filter._id.$ne));
  Product.countDocuments = async () => records.length;
  Product.findById = id => ({ lean: async () => records.find(record => record._id === id) });
  Product.findOne = filter => ({ select() { return this; }, lean: async () => records.find(record => record.slug === filter.slug) });
  const app = express();
  app.use('/api/products', productRoutes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/products`;
  try {
    const first = await (await fetch(`${base}?page=1&limit=50`)).json();
    const second = await (await fetch(`${base}?page=2&limit=50`)).json();
    assert.equal(first.pagination.totalItems, 75);
    assert.equal(second.data.length, 25);
    assert.equal(second.data[0].slug, 'product-51');
    assert.equal(first.data[0].usage, undefined);
    const detail = await (await fetch(`${base}/product-1`)).json();
    assert.equal(detail.data.usage, 'Full usage instructions');
    const related = await (await fetch(`${base}/product-1/related?limit=4`)).json();
    assert.equal(related.data.length, 4);
    assert.equal(related.data.some(record => record._id === detail.data._id), false);
    assert.equal((await fetch(`${base}?brand[$ne]=x`)).status, 400);
  } finally {
    Object.assign(Product, originals);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
