import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BSON } from 'mongodb';
import {
  backupManifest,
  verifyBackup,
  restoreAndVerify,
  validateRestoreTarget,
} from '../src/utils/backupVerification.js';
const removeFixture = async (directory) => {
  const root = await realpath(os.tmpdir()),
    target = await realpath(directory);
  if (!target.startsWith(root + path.sep) || !path.basename(target).startsWith('bsc-backup-test-'))
    throw new Error('Unexpected fixture cleanup path');
  await rm(target, { recursive: true, force: true });
};
const fixture = async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'bsc-backup-test-'));
  const records = [
    {
      _id: new BSON.ObjectId('507f1f77bcf86cd799439011'),
      date: new Date('2026-11-04T10:00:00Z'),
      amount: BSON.Decimal128.fromString('12.50'),
      big: BSON.Long.fromString('9007199254740993'),
    },
  ];
  await writeFile(
    path.join(directory, 'quotes.jsonl'),
    records.map((value) => BSON.EJSON.stringify(value, { relaxed: false })).join('\n') + '\n',
  );
  await writeFile(
    path.join(directory, 'quotes.indexes.json'),
    JSON.stringify([
      { name: '_id_', key: { _id: 1 } },
      { name: 'status_1', key: { status: 1 }, unique: true },
    ]),
  );
  await writeFile(
    path.join(directory, 'COMPLETE.json'),
    JSON.stringify(await backupManifest(directory, ['quotes'])),
  );
  return { directory, records };
};
const fakeDatabase = (options = {}) => {
  const rows = new Map(),
    indexes = new Map();
  return {
    databaseName: options.name || 'restore_check_fixture',
    listCollections() {
      return {
        toArray: async () =>
          options.nonEmpty ? [{ name: 'existing' }] : [...rows.keys()].map((name) => ({ name })),
      };
    },
    async createCollection(name) {
      rows.set(name, []);
    },
    collection(name) {
      return {
        async insertMany(batch) {
          rows.set(name, [...(rows.get(name) || []), ...batch]);
        },
        async createIndexes(values) {
          indexes.set(name, values);
        },
        async indexes() {
          return [
            { name: '_id_', key: { _id: 1 } },
            ...(indexes.get(name) || []).map((index) =>
              options.badIndex ? { ...index, unique: false } : index,
            ),
          ];
        },
        async *find() {
          for (const row of rows.get(name) || [])
            yield options.corrupt ? { ...row, unexpected: 'changed' } : row;
        },
      };
    },
  };
};
test('backup verification checks content hashes and recovery preserves BSON records and indexes', async () => {
  const { directory } = await fixture();
  try {
    const checked = await verifyBackup(directory);
    assert.deepEqual(checked.counts, { quotes: 1 });
    assert.deepEqual(await restoreAndVerify(directory, fakeDatabase()), { quotes: 1 });
    await assert.rejects(
      restoreAndVerify(directory, fakeDatabase({ corrupt: true })),
      /verification failed/,
    );
    await assert.rejects(
      restoreAndVerify(directory, fakeDatabase({ badIndex: true })),
      /index verification failed/,
    );
    await assert.rejects(
      restoreAndVerify(directory, fakeDatabase({ nonEmpty: true })),
      /must be empty/,
    );
    await assert.rejects(
      restoreAndVerify(directory, fakeDatabase({ name: 'production' })),
      /restore_check/,
    );
    assert.throws(() => validateRestoreTarget('live-shop'));
  } finally {
    await removeFixture(directory);
  }
});
test('corrupt or path-traversing backup manifests are rejected before restoration', async () => {
  const { directory } = await fixture();
  try {
    const manifest = JSON.parse(await readFile(path.join(directory, 'COMPLETE.json'), 'utf8'));
    manifest.files[0].path = '../outside.jsonl';
    await writeFile(path.join(directory, 'COMPLETE.json'), JSON.stringify(manifest));
    await assert.rejects(verifyBackup(directory), /Unsafe/);
    await writeFile(
      path.join(directory, 'COMPLETE.json'),
      JSON.stringify(await backupManifest(directory, ['quotes'])),
    );
    await writeFile(path.join(directory, 'quotes.jsonl'), '{}\n');
    await assert.rejects(verifyBackup(directory), /integrity check failed/);
  } finally {
    await removeFixture(directory);
  }
});
