import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import router, { validAudio } from '../src/routes/voiceRoutes.js';
import { VoiceEnquiry } from '../src/models/VoiceEnquiry.js';

test('audio validation rejects spoofed types and accepts supported container signatures', () => {
  assert.equal(validAudio(null), false);
  assert.equal(
    validAudio({ mimetype: 'audio/webm', buffer: Buffer.from('<html>not audio</html>') }),
    false,
  );
  for (const mimetype of ['audio/mpeg', 'audio/wav'])
    assert.equal(validAudio({ mimetype, buffer: Buffer.from('<html>not audio</html>') }), false);
  for (const [mimetype, buffer] of [
    ['audio/webm', Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(12)])],
    ['audio/mpeg', Buffer.from('ID31234567890123')],
    ['audio/mpeg', Buffer.from([0xff, 0xfb, 0x90, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    ['audio/wav', Buffer.from('RIFF0000WAVEdata')],
    ['audio/ogg', Buffer.from('OggS123456789012')],
    ['audio/mp4', Buffer.from('0000ftyp12345678')],
  ])
    assert.equal(validAudio({ mimetype, buffer }), true);
});

test('voice endpoints keep inbox private and validate public submissions', async () => {
  const app = express();
  app.use(express.json());
  app.use('/voice', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/voice`;
  const original = VoiceEnquiry.create;
  try {
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base + '/000000000000000000000001/audio')).status, 401);
    assert.equal((await fetch(base + '/prompts/welcome', { method: 'PUT' })).status, 401);
    const invalid = new FormData();
    invalid.set('phone', 'invalid');
    invalid.set('category', 'crop');
    assert.equal((await fetch(base, { method: 'POST', body: invalid })).status, 400);
    let saved;
    VoiceEnquiry.create = async (value) => {
      saved = value;
      return { id: 'test-id' };
    };
    const data = new FormData();
    data.set('phone', '03001234567');
    data.set('category', 'crop');
    data.set(
      'audio',
      new Blob([Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(20)])], {
        type: 'audio/webm',
      }),
      'voice.webm',
    );
    const response = await fetch(base, { method: 'POST', body: data });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(saved.phone, '03001234567');
    assert.equal(saved.audio.mime, 'audio/webm');
    const tooLarge = new FormData();
    tooLarge.set(
      'audio',
      new Blob([Buffer.alloc(3 * 1024 * 1024 + 1)], { type: 'audio/webm' }),
      'voice.webm',
    );
    assert.equal((await fetch(base, { method: 'POST', body: tooLarge })).status, 400);
  } finally {
    VoiceEnquiry.create = original;
    await new Promise((resolve) => server.close(resolve));
  }
});
