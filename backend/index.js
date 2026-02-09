const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./db');
const aiService = require('./services/aiServiceClient');
const requestIdMiddleware = require('./middleware/requestId');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Warm Python service on startup and periodically (best-effort)
function warmPythonService() {
  aiService.healthCheck()
    .then((data) => {
      if (data?.ok) console.log('[API] Python service warm');
    })
    .catch(() => {});
}
warmPythonService();
setInterval(warmPythonService, 10 * 60 * 1000);

app.set('trust proxy', 1);

app.use(requestIdMiddleware);
app.use(express.json());

const isProd = process.env.NODE_ENV === 'production';
const raw = (process.env.DEV_CORS_ORIGINS || '').trim();
const devOrigins = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
const defaultDevOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5001', 'http://127.0.0.1:5001'];
const allowedOrigins = devOrigins.length ? devOrigins : (isProd ? [] : defaultDevOrigins);
const corsOptions = {
  origin: allowedOrigins.length
    ? (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) cb(null, true);
        else cb(null, false);
      }
    : false,
  credentials: false,
};
app.use(cors(corsOptions));

app.use(morgan('dev'));

connectDB();

// GET /api/health — Phase 1: service name + ISO8601 time
app.get('/api/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'node-api',
    time: new Date().toISOString(),
  });
});

const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

const userRoutes = require('./routes/user');
app.use('/api', userRoutes);

const wardrobeRoutes = require('./routes/wardrobe');
app.use('/api/wardrobe', wardrobeRoutes);

const uploadRoutes = require('./routes/upload');
app.use('/api/upload', uploadRoutes);

const agentRoutes = require('./routes/agent');
app.use('/api/ai', agentRoutes);

const plannerRoutes = require('./routes/planner');
app.use('/api/planner', plannerRoutes);

const outfitsRoutes = require('./routes/outfits');
app.use('/api/outfits', outfitsRoutes);

const weatherRoutes = require('./routes/weather');
app.use('/api/weather', weatherRoutes);

const homeRoutes = require('./routes/home');
app.use('/api/home', homeRoutes);

if (process.env.NODE_ENV !== 'production') {
  const devRoutes = require('./routes/dev');
  app.use('/api/dev', devRoutes);
  const debugRoutes = require('./routes/debug');
  app.use('/api/debug', debugRoutes);
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 404 — safe JSON with requestId
app.use((req, res) => {
  const requestId = req.requestId || 'unknown';
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Not found', requestId },
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || process.env.NODE_PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API] Node server running on :${PORT}`);
});
