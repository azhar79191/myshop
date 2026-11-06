import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import app from '../src/app.js';
import WhatsAppReply from '../src/models/WhatsAppReply.js';

test('WhatsApp webhook verifies subscription, rejects forged events and deduplicates signed jobs by message ID', async () => {
  const env = {
    WHATSAPP_APP_SECRET: 'test-secret',
    WHATSAPP_ACCESS_TOKEN: 'test',
    WHATSAPP_PHONE_NUMBER_ID: '123',
    WHATSAPP_VERIFY_TOKEN: 'verify-test',
    WHATSAPP_GRAPH_VERSION: 'v26.0',
  };
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  const oldUpdate = WhatsAppReply.updateOne;
  const jobs = new Map();
  WhatsAppReply.updateOne = async (filter, update, options) => {
    assert.equal(options.upsert, true);
    jobs.set(filter.messageId, update.$setOnInsert);
  };
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/whatsapp/webhook`;
  try {
    const verify = await fetch(
      url + '?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=12345',
    );
    assert.equal(verify.status, 200);
    assert.equal(await verify.text(), '12345');
    assert.equal(
      (await fetch(url + '?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345')).status,
      403,
    );
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: '123' },
                messages: [
                  {
                    id: 'wamid.test',
                    from: '923001234567',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const signature =
      'sha256=' + createHmac('sha256', env.WHATSAPP_APP_SECRET).update(body).digest('hex');
    assert.equal(
      (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }))
        .status,
      401,
    );
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
            body,
          })
        ).status,
        200,
      );
    assert.equal(jobs.size, 1);
  } finally {
    WhatsAppReply.updateOne = oldUpdate;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
