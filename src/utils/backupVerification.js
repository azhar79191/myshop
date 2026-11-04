import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { BSON } from 'mongodb';
const collectionName = (name) =>
  typeof name === 'string' && /^[a-zA-Z0-9_.-]+$/.test(name) && !name.startsWith('system.');
function safePath(directory, relative) {
  if (
    typeof relative !== 'string' ||
    !relative ||
    relative.includes('\\') ||
    relative.split('/').some((part) => !part || part === '.' || part === '..' || part.includes(':'))
  )
    throw new Error('Unsafe backup file path');
  const base = path.resolve(directory),
    target = path.resolve(base, ...relative.split('/'));
  if (!target.startsWith(base + path.sep)) throw new Error('Backup file escapes its directory');
  return target;
}
async function fileDigest(file) {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  return { sha256: hash.digest('hex'), bytes };
}
export async function backupManifest(directory, collections) {
  const files = [];
  const scan = async (relative = '') => {
    for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
      const name = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isSymbolicLink()) throw new Error('Backup cannot contain symbolic links');
      if (entry.isDirectory()) await scan(name);
      else if (entry.isFile() && name !== 'COMPLETE.json')
        files.push({ path: name, ...(await fileDigest(safePath(directory, name))) });
    }
  };
  await scan();
  return {
    version: 2,
    completedAt: new Date().toISOString(),
    collections,
    files,
    note: 'Logical snapshot. Keep writes paused during export. Cloud asset URLs are references, not a cloud asset backup.',
  };
}
export async function* backupDocuments(directory, name) {
  if (!collectionName(name)) throw new Error('Invalid collection name');
  const lines = createInterface({
    input: createReadStream(safePath(directory, `${name}.jsonl`)),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const document = BSON.EJSON.parse(line, { relaxed: false });
    if (
      !document ||
      typeof document !== 'object' ||
      Array.isArray(document) ||
      !Object.hasOwn(document, '_id')
    )
      throw new Error('Invalid backup document');
    yield document;
  }
}
export async function verifyBackup(directory) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'COMPLETE.json'), 'utf8'));
  if (
    manifest.version !== 2 ||
    !Array.isArray(manifest.collections) ||
    !manifest.collections.every(collectionName) ||
    new Set(manifest.collections).size !== manifest.collections.length ||
    !Array.isArray(manifest.files)
  )
    throw new Error('A complete version 2 backup manifest is required');
  const names = new Set();
  for (const file of manifest.files) {
    const target = safePath(directory, file.path);
    let current = path.resolve(directory);
    for (const segment of file.path.split('/')) {
      current = path.join(current, segment);
      if ((await lstat(current)).isSymbolicLink())
        throw new Error('Backup symbolic links are not allowed');
    }
    if (!(await lstat(target)).isFile() || names.has(file.path))
      throw new Error('Invalid backup file');
    names.add(file.path);
    const actual = await fileDigest(target);
    if (actual.sha256 !== file.sha256 || actual.bytes !== file.bytes)
      throw new Error(`Backup integrity check failed: ${file.path}`);
  }
  const counts = {};
  for (const name of manifest.collections) {
    for (const suffix of ['jsonl', 'indexes.json'])
      if (!names.has(`${name}.${suffix}`)) throw new Error('Backup collection files are missing');
    const indexes = BSON.EJSON.parse(
      await readFile(safePath(directory, `${name}.indexes.json`), 'utf8'),
    );
    if (
      !Array.isArray(indexes) ||
      indexes.some(
        (index) =>
          !index || typeof index.name !== 'string' || !index.key || typeof index.key !== 'object',
      )
    )
      throw new Error('Invalid backup indexes');
    let count = 0;
    for await (const _document of backupDocuments(directory, name)) count++;
    counts[name] = count;
  }
  return { manifest, counts };
}
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const documentHash = (document) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(BSON.EJSON.serialize(document, { relaxed: false }))))
    .digest('hex');
export function validateRestoreTarget(name) {
  if (typeof name !== 'string' || !/^restore_check_[a-zA-Z0-9_]{1,48}$/.test(name))
    throw new Error('Restore checks require a database named restore_check_<name>');
}
export async function restoreAndVerify(directory, db) {
  validateRestoreTarget(db.databaseName);
  const checked = await verifyBackup(directory);
  if ((await db.listCollections({}, { nameOnly: true }).toArray()).length)
    throw new Error('Restore target must be empty; no existing data will be replaced');
  const verified = {};
  for (const name of checked.manifest.collections) {
    const collection = db.collection(name),
      expected = [];
    let batch = [];
    for await (const document of backupDocuments(directory, name)) {
      expected.push(documentHash(document));
      batch.push(document);
      if (batch.length === 500) {
        await collection.insertMany(batch);
        batch = [];
      }
    }
    if (batch.length) await collection.insertMany(batch);
    if (!expected.length) await db.createCollection(name);
    const indexes = BSON.EJSON.parse(
      await readFile(safePath(directory, `${name}.indexes.json`), 'utf8'),
    );
    const allowed = [
      'name',
      'unique',
      'sparse',
      'expireAfterSeconds',
      'partialFilterExpression',
      'collation',
      'weights',
      'default_language',
      'language_override',
      'hidden',
      'wildcardProjection',
    ];
    const restoreIndexes = indexes
      .filter((index) => index.name !== '_id_')
      .map((index) => ({
        key: index.key,
        ...Object.fromEntries(
          allowed.filter((key) => index[key] !== undefined).map((key) => [key, index[key]]),
        ),
      }));
    if (restoreIndexes.length) await collection.createIndexes(restoreIndexes);
    const actual = [];
    for await (const document of collection.find({}, { promoteLongs: false, promoteValues: false }))
      actual.push(documentHash(document));
    if (expected.sort().join('\n') !== actual.sort().join('\n'))
      throw new Error(`Restored collection verification failed: ${name}`);
    const actualIndexes = await collection.indexes();
    if (
      restoreIndexes.some(
        (index) =>
          !actualIndexes.some((actual) => {
            if (
              actual.name !== index.name ||
              JSON.stringify(actual.key) !== JSON.stringify(index.key)
            )
              return false;
            for (const flag of ['unique', 'sparse', 'hidden'])
              if (Boolean(index[flag]) !== Boolean(actual[flag])) return false;
            if (
              index.expireAfterSeconds !== undefined &&
              Number(index.expireAfterSeconds) !== Number(actual.expireAfterSeconds)
            )
              return false;
            for (const field of [
              'partialFilterExpression',
              'weights',
              'default_language',
              'language_override',
              'wildcardProjection',
            ])
              if (
                index[field] !== undefined &&
                JSON.stringify(canonical(index[field])) !== JSON.stringify(canonical(actual[field]))
              )
                return false;
            if (
              index.collation &&
              Object.entries(index.collation).some(
                ([key, value]) => JSON.stringify(value) !== JSON.stringify(actual.collation?.[key]),
              )
            )
              return false;
            return true;
          }),
      )
    )
      throw new Error(`Restored index verification failed: ${name}`);
    verified[name] = actual.length;
  }
  return verified;
}
