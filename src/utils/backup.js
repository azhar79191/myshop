import { backupManifest } from './backupVerification.js';
import 'dotenv/config';
import { MongoClient, BSON } from 'mongodb';
import { mkdir, writeFile, cp, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import path from 'node:path';
import { MEDIA_UPLOAD_DIR } from '../config/media.js';
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
const destination = path.resolve(process.argv[2] || path.join('backups', new Date().toISOString().replace(/[:.]/g, '-')));
await mkdir(path.dirname(destination), { recursive: true });
await mkdir(destination);
const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect(); const db = client.db();
  const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).filter(collection => !collection.name.startsWith('system.'));
  for (const { name } of collections) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) throw new Error('Unsupported collection name');
    const collection = db.collection(name);
    await writeFile(path.join(destination, `${name}.indexes.json`), BSON.EJSON.stringify(await collection.indexes()), { flag: 'wx' });
    const stream = createWriteStream(path.join(destination, `${name}.jsonl`), { flags: 'wx' });
    const errors = new Promise((_, reject) => stream.on('error', reject));
    await Promise.race([errors, (async () => { for await (const doc of collection.find({}, { promoteLongs: false, promoteValues: false })) { if (!stream.write(BSON.EJSON.stringify(doc, { relaxed: false }) + '\n')) await once(stream, 'drain'); } stream.end(); await once(stream, 'finish'); })()]);
  }
  try { await access(MEDIA_UPLOAD_DIR); await cp(MEDIA_UPLOAD_DIR, path.join(destination, 'media'), { recursive: true, errorOnExist: true, force: false }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(path.join(destination, 'COMPLETE.json'), JSON.stringify(await backupManifest(destination, collections.map(collection => collection.name)), null, 2), { flag: 'wx' });
  console.log('Backup complete:', destination);
} finally { await client.close(); }
