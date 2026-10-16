import assert from 'node:assert/strict';
import test from 'node:test';
import { getCacheControl } from '../src/middleware/cachePolicyMiddleware.js';

test('keeps admin and dynamic settings responses private', () => {
  assert.equal(getCacheControl('/api/contact', 'GET', true), 'no-store');
  assert.equal(getCacheControl('/api/testimonials', 'GET', true), 'no-store');
  assert.equal(getCacheControl('/api/site-settings', 'GET'), 'no-store');
});

test('sets consistent caching for public catalog and content routes', () => {
  assert.equal(
    getCacheControl('/api/products/categories/all'),
    'public, max-age=300, s-maxage=900, stale-while-revalidate=1800'
  );
  assert.equal(
    getCacheControl('/api/gallery'),
    'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600'
  );
});

test('does not cache mutations or unclassified routes', () => {
  assert.equal(getCacheControl('/api/products', 'PUT'), 'no-store');
  assert.equal(getCacheControl('/api/unclassified'), 'no-store');
});
