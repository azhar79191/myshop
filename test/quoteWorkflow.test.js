import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteSubmission, snapshotQuoteItems, quotePricing, submissionHash } from '../src/utils/quotes.js';
import { searchSuggestions } from '../src/utils/searchSuggestions.js';
import { buildProductQuery } from '../src/utils/productQuery.js';
import { getCacheControl } from '../src/middleware/cachePolicyMiddleware.js';
const id = '507f1f77bcf86cd799439011';
const payload = { requestId: '947e6299-e592-4aae-b867-1bf5b8de593a', name: 'Farmer', phone: '03001234567', items: [{ productId: id, size: '1kg', quantity: 2 }] };
test('quotes accept only bounded structured items and validate delivery details', () => {
  assert.equal(quoteSubmission(payload).fulfillment, 'undecided');
  for (const body of [null, { ...payload, items: [] }, { ...payload, items: [payload.items[0], payload.items[0]] }, { ...payload, items: [{ ...payload.items[0], quantity: 1.5 }] }, { ...payload, fulfillment: 'delivery' }, { ...payload, requestId: 'invalid' }]) assert.throws(() => quoteSubmission(body), error => error.statusCode === 400);
  const valid = quoteSubmission({ ...payload, fulfillment: 'delivery', location: ' Village ' });
  assert.equal(valid.location, 'Village');
  assert.equal(submissionHash(valid), submissionHash(quoteSubmission({ ...payload, fulfillment: 'delivery', location: 'Village' })));
});
test('quote snapshots trust server catalog details and reject unavailable packs', () => {
  const items = [{ ...payload.items[0], name: 'Forged', unitPrice: 1 }];
  const products = [{ _id: id, name: 'Genuine seed', stockStatus: 'In Stock', sizes: [{ size: '1kg', price: 500 }] }];
  assert.deepEqual(snapshotQuoteItems(items, products)[0], { productId: id, name: 'Genuine seed', size: '1kg', quantity: 2, unitPrice: null });
  assert.throws(() => snapshotQuoteItems(items, [{ ...products[0], stockStatus: 'Out of Stock' }]));
  assert.throws(() => snapshotQuoteItems(items, []));
});
test('staff quotes require complete prices and compute totals in cents', () => {
  const quote = { status: 'New', items: [{ quantity: 3, unitPrice: null }], deliveryCharge: null };
  assert.throws(() => quotePricing(quote, { status: 'Quoted' }));
  assert.throws(() => quotePricing(quote, { status: 'Confirmed', unitPrices: [1] }));
  for (const price of [-1, '5', 0.001, Infinity]) assert.throws(() => quotePricing(quote, { unitPrices: [price] }));
  assert.equal(quotePricing(quote, { status: 'Quoted', unitPrices: [10.1], deliveryCharge: 0.2 }).total, 30.5);
  assert.equal(quotePricing(quote, { status: 'Closed' }).total, null);
});
test('spelling suggestions handle Urdu, Roman Urdu and transpositions without silently changing queries', () => {
  const products = [{ name: 'Wheat seed', crops: ['Wheat'], activeIngredient: 'Imidacloprid', searchAliases: ['گندم'] }];
  assert.ok(searchSuggestions('whaet', products).includes('wheat'));
  assert.ok(searchSuggestions('گنمد', products).includes('گندم'));
  assert.ok(searchSuggestions('gandm', products).some(value => ['gandam', 'gandum'].includes(value)));
  assert.ok(searchSuggestions('imidacloprd', products).includes('imidacloprid'));
  assert.deepEqual(searchSuggestions('03001234567', products), []);
  const filter = buildProductQuery({ search: 'wheat', attention: 'missing-details' }).filter;
  assert.ok(filter.$or); assert.equal(filter.$and.length, 1);
  assert.equal(getCacheControl('/api/quotes'), 'no-store');
  assert.equal(getCacheControl('/api/products/admin/list'), 'no-store');
});
