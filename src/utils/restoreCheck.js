import 'dotenv/config';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { verifyBackup, restoreAndVerify, validateRestoreTarget } from './backupVerification.js';
if (!process.argv[2]) throw new Error('Provide the completed backup directory');
const directory = path.resolve(process.argv[2]);
await verifyBackup(directory);
const name = process.env.RESTORE_DATABASE_NAME;
validateRestoreTarget(name);
if (!process.env.RESTORE_MONGODB_URI) throw new Error('RESTORE_MONGODB_URI must explicitly identify the isolated recovery server');
const client = new MongoClient(process.env.RESTORE_MONGODB_URI);
try {
  await client.connect();
  const counts = await restoreAndVerify(directory, client.db(name));
  console.log(JSON.stringify({ verified: true, database: name, collections: counts, note: 'The recovery copy is retained for inspection. No existing database was modified.' }, null, 2));
} finally { await client.close(); }
