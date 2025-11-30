require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./db');

const app = express();
app.use(express.json());

const isProd = process.env.NODE_ENV === 'production';
const raw = process.env.DEV_CORS_ORIGINS || '';
const devOrigins = raw.split(',').map((s) => s.trim()).filter(Boolean);
const corsOptions = isProd
  ? { origin: devOrigins.length ? devOrigins : false }
  : { origin: devOrigins.length ? devOrigins : '*' };
app.use(cors(corsOptions));

app.use(morgan('dev'));

connectDB();

app.get("/api/health", (req, res) =>
  res.status(200).json({ ok: true, ts: Date.now() })
);

const authRoutes = require("./routes/auth");
app.use("/api", authRoutes);

const userRoutes = require("./routes/user");
app.use("/api", userRoutes);

const wardrobeRoutes = require("./routes/wardrobe");
app.use("/api/wardrobe", wardrobeRoutes);

const uploadRoutes = require("./routes/upload");
app.use("/api/upload", uploadRoutes);

const agentRoutes = require("./routes/agent");
app.use("/api/ai", agentRoutes);

// Static file serving for uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 404 handler - must be last
app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('💥 Unhandled error:', err);
    if (err?.stack) console.error(err.stack);
  }
  const status = err.status || err.statusCode || 500;
  return res.status(status).json({ message: err.message || 'Server error' });
});

const PORT = process.env.NODE_PORT || 5001;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`[API] Node server running on :${PORT}`)
);