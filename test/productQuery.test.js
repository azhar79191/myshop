import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProductQuery, productFields } from '../src/utils/productQuery.js';

test('price bounds apply to one size and permit zero', () => {
  assert.deepEqual(buildProductQuery({ minPrice: '400', maxPrice: '600' }).filter.sizes, { $elemMatch: { price: { $gte: 400, $lte: 600 } } });
  assert.deepEqual(buildProductQuery({ minPrice: '0' }).filter.sizes, { $elemMatch: { price: { $gte: 0 } } });
});

test('search is literal and brand filtering is exact', () => {
  const { filter } = buildProductQuery({ search: 'a.*(b)', brand: 'A+B', available: 'true' });
  assert.equal(filter.brand, 'A+B');
  assert.equal(new RegExp(filter.$or[0].name.$regex, 'i').test('a.*(b)'), true);
  assert.equal(new RegExp(filter.$or[0].name.$regex, 'i').test('anythingb'), false);
  assert.deepEqual(filter.stockStatus, { $ne: 'Out of Stock' });
});

test('malformed filters cannot inject operators or invalid ranges', () => {
  for (const query of [{ brand: { $ne: '' } }, { search: ['x'] }, { minPrice: 'NaN' }, { minPrice: '-1' }, { minPrice: '9', maxPrice: '2' }, { sort: '$where' }, { stockStatus: 'invalid' }]) {
    assert.throws(() => buildProductQuery(query), { statusCode: 400 });
  }
});

test('product updates allow only editable fields', () => {
  assert.deepEqual(productFields({ name: 'New name', $unset: { sizes: 1 }, slug: 'override', ratings: { average: 5 }, _id: 'override' }), { name: 'New name' });
});
