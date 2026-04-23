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
    // Log prominently but do NOT exit — the HTTP server is already bound and
    // /api/health must stay responsive. DB-dependent routes will return 500s
    // until Mongoose reconnects on its own (built-in retry behaviour).
    console.error('[DB] Mongo connection error — server continues without DB:', err.message);
  }
}

module.exports = connectDB;
