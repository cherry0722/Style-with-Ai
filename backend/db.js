const mongoose = require('mongoose');

const URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB || 'style_with_ai';

if (!URI) {
  console.error('[DB] MONGO_URI not set. Add it to your .env');
  process.exit(1);
}

async function connectDB() {
  try {
    await mongoose.connect(URI, { dbName: DB_NAME, autoIndex: true });
    console.log(`[DB] Connected to MongoDB db=${DB_NAME}`);
  } catch (err) {
    console.error('[DB] Mongo connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
