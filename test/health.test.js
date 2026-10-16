import assert from 'node:assert/strict';
import { get } from 'node:http';
import test from 'node:test';
import app from '../src/app.js';
import mongoose from 'mongoose';

test('health endpoint reports database readiness and disables caching', async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const { statusCode, headers, payload } = await new Promise((resolve, reject) => {
      get(`http://127.0.0.1:${port}/api/health`, { agent: false }, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          payload: JSON.parse(body),
        }));
      }).on('error', reject);
    });
    const ready = mongoose.connection.readyState === 1;

    assert.equal(statusCode, ready ? 200 : 503);
    assert.equal(payload.database, ready ? 'connected' : 'disconnected');
    assert.equal(headers['cache-control'], 'no-store');
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
