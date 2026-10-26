import assert from 'node:assert/strict';
import test from 'node:test';
import { createRateLimiter } from '../src/middleware/rateLimitMiddleware.js';

test('rate limits isolate clients, reset after expiry, and send retry information', () => {
  let timestamp = 1000;
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => timestamp });
  const invoke = ip => {
    const result = { statusCode: 200, headers: {}, passed: false };
    const response = { set: (name, value) => { result.headers[name] = value; }, status: code => { result.statusCode = code; return response; }, json: body => { result.body = body; } };
    limiter({ ip }, response, () => { result.passed = true; });
    return result;
  };
  assert.equal(invoke('a').passed, true);
  assert.equal(invoke('a').passed, true);
  const blocked = invoke('a');
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers['Retry-After'], '1');
  assert.equal(blocked.headers['Cache-Control'], 'no-store');
  assert.equal(invoke('b').passed, true);
  timestamp += 1000;
  assert.equal(invoke('a').passed, true);
});
