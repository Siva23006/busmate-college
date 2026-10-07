const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1); // correct client IPs behind Render/Railway/Nginx

app.use(helmet());
app.use(cors({
  // Mobile apps send no Origin header, so they are allowed; browsers must be in CORS_ORIGINS.
  origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.isProd ? 'combined' : 'dev'));
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));

app.get('/', (_req, res) => res.json({ name: 'BusMate College API', docs: '/api/health' }));
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
