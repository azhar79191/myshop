import assert from 'node:assert/strict';
import test from 'node:test';
import Product from '../src/models/Product.js';
import { buildProductQuery, productFields } from '../src/utils/productQuery.js';
import { productSearchPattern } from '../src/utils/productSearch.js';

test('English, Urdu and Roman Urdu crop searches match each other and translated product fields', () => {
  for (const query of ['wheat', 'گندم', 'gandum', 'GANDAM']) {
    const pattern = new RegExp(productSearchPattern(query), 'i');
    assert.ok(pattern.test('Wheat Seed'));
    assert.ok(pattern.test('گندم کا بیج'));
    assert.ok(pattern.test('gandum'));
    const filter = buildProductQuery({ search: query }).filter;
    assert.ok(filter.$or.some(field => field['translations.ur.name']));
    assert.ok(filter.$or.some(field => field.searchAliases));
    assert.ok(filter.$or.some(field => field.crops));
  }
  assert.ok(new RegExp(productSearchPattern('مكئي'), 'i').test('مکئی'));
});
test('custom alias searches remain literal and cannot inject regex operators', () => {
  const pattern = new RegExp(productSearchPattern('A+B.*(seed)'), 'i');
  assert.ok(pattern.test('A+B.*(seed)'));
  assert.equal(pattern.test('ABanythingseed'), false);
  assert.deepEqual(productFields({ searchAliases: ['بیج', 'beej'], slug: 'forbidden' }), { searchAliases: ['بیج', 'beej'] });
});
test('mixed-language search terms can match across crop, brand and translated fields', () => {
  const { filter } = buildProductQuery({ search: 'gandum beej', brand: 'Example' });
  assert.equal(filter.brand, 'Example');
  assert.equal(filter.$and.length, 2);
  assert.ok(new RegExp(filter.$and[0].$or[0].name.$regex, 'i').test('Wheat'));
  assert.ok(new RegExp(filter.$and[1].$or[0].name.$regex, 'i').test('Seed'));
  assert.ok(buildProductQuery({ search: 'keere mar' }).filter.$or);
});
test('product aliases enforce bounded values without changing existing products', () => {
  const valid = new Product({ searchAliases: ['  gandum ', 'گندم'] });
  assert.deepEqual([...valid.searchAliases], ['gandum', 'گندم']);
  assert.equal(valid.validateSync()?.errors.searchAliases, undefined);
  const tooMany = new Product({ searchAliases: Array.from({ length: 31 }, (_, i) => String(i)) });
  assert.ok(tooMany.validateSync().errors.searchAliases);
});
