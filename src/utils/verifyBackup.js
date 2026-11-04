import path from 'node:path';
import { verifyBackup } from './backupVerification.js';
if (!process.argv[2]) throw new Error('Provide the completed backup directory');
const result = await verifyBackup(path.resolve(process.argv[2]));
console.log(JSON.stringify({ verified: true, collections: result.counts }, null, 2));
