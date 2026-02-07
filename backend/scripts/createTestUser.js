/**
 * One-time script: create test user for local/dev.
 * Run from repo root: node backend/scripts/createTestUser.js
 * Or from backend/: node scripts/createTestUser.js
 * Loads root .env so MONGO_URI is set.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../models/user');

const TEST_EMAIL = 'testuser1@example.com';
const TEST_USER = {
  username: 'testuser1',
  email: TEST_EMAIL,
  password: 'TestPassword123!',
};

async function main() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB || 'style_with_ai';

  if (!uri) {
    console.error('[createTestUser] MONGO_URI not set. Set it in root .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { dbName, autoIndex: true });
  } catch (err) {
    console.error('[createTestUser] MongoDB connection failed:', err.message);
    process.exit(1);
  }

  try {
    const existing = await User.findOne({ email: TEST_EMAIL }).lean();
    if (existing) {
      console.log('[createTestUser] User already exists:', TEST_EMAIL);
      await mongoose.disconnect();
      process.exit(0);
    }

    const user = new User(TEST_USER);
    await user.save();
    console.log('[createTestUser] Created user:', TEST_EMAIL);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[createTestUser] Error:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

main();
