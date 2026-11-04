import assert from 'node:assert/strict';
import test from 'node:test';
import { getProducts } from '../src/controllers/productController.js';
import Product from '../src/models/Product.js';
import Testimonial from '../src/models/Testimonial.js';
const invoke = (handler, req) => new Promise((resolve, reject) => { const res = { set() {}, status(code) { this.statusCode = code; return this }, json(body) { resolve({ code: this.statusCode, body }); return this } }; handler(req, res, reject); });
test('empty catalog searches return bounded suggestions and attention filters stay admin-only', async () => {
  const originals = { find: Product.find, countDocuments: Product.countDocuments }, ratings = Testimonial.aggregate;
  const filters = [];
  Product.countDocuments = async () => 0;
  Testimonial.aggregate = async () => [];
  Product.find = filter => {
    filters.push(filter);
    let candidate = false;
    return { select(fields) { candidate = fields.includes('searchAliases'); return this }, sort() { return this }, skip() { return this }, limit() { return this }, async lean() { return candidate ? [{ name: 'Wheat seed', crops: ['Wheat'] }] : [] } };
  };
  try {
    const result = await invoke(getProducts, { query: { search: 'whaet', available: 'true' } });
    assert.equal(result.body.pagination.totalItems, 0);
    assert.ok(result.body.suggestions.includes('wheat'));
    assert.equal(filters[1].$or, undefined);
    assert.deepEqual(filters[1].stockStatus, { $ne: 'Out of Stock' });
    assert.equal((await invoke(getProducts, { query: { attention: 'missing-details' } })).code, 403);
    await invoke(getProducts, { admin: { _id: 'admin' }, query: { attention: 'low-stock' } });
    assert.ok(filters.at(-1).$and[0].$or.some(clause => clause['sizes.stockStatus'] === 'Low Stock'));
    await invoke(getProducts, { admin: { _id: 'admin' }, query: { attention: 'missing-details' } });
    assert.ok(filters.at(-1).$and[0].$or.some(clause => clause['crops.0']));
  } finally { Object.assign(Product, originals); Testimonial.aggregate = ratings; }
});
