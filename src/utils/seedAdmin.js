import '../config/environment.js';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import { validateEnvironment } from '../config/environment.js';

try {
  const { mongoUri } = validateEnvironment();
  const { ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME } = process.env;
  if (![ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME].every(value => value?.trim())) {
    throw new Error('Set ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_FULL_NAME before running seed:admin.');
  }
  if (ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
  await mongoose.connect(mongoUri);
  const username = ADMIN_USERNAME.trim().toLowerCase();
  const email = ADMIN_EMAIL.trim().toLowerCase();
  if (await Admin.exists({ $or: [{ username }, { email }] })) {
    throw new Error('An admin with this username or email already exists. No changes were made.');
  }
  await Admin.create({ username, email, password: ADMIN_PASSWORD, fullName: ADMIN_FULL_NAME.trim(), role: 'superadmin' });
  console.log('Superadmin created successfully.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
