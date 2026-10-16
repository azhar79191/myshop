import assert from 'node:assert/strict';
import test from 'node:test';
import { getPagination } from '../src/utils/pagination.js';

test('uses the requested default page size', () => {
  assert.deepEqual(getPagination(undefined, undefined, 12), {
    page: 1,
    limit: 12,
    skip: 0,
  });
});

test('parses page values and caps page size', () => {
  assert.deepEqual(getPagination('3', '100'), {
    page: 3,
    limit: 50,
    skip: 100,
  });
});

test('falls back for invalid pagination values', () => {
  assert.deepEqual(getPagination('not-a-page', '0', 20), {
    page: 1,
    limit: 20,
    skip: 0,
  });
});

test('keeps skip within the safe integer range', () => {
  const pagination = getPagination(String(Number.MAX_SAFE_INTEGER), '50');

  assert.ok(Number.isSafeInteger(pagination.skip));
  assert.ok(pagination.skip >= 0);
});
