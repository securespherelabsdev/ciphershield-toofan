'use strict';

/*
 * CipherShield — Express entry point
 *
 * Middleware registration order is a privacy guarantee.
 * anonymize() MUST be the first middleware registered.
 * Do not move, remove, or add anything before it.
 */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const { anonymize, requireSanitized } = require('./middleware/anonymize');
const submitRouter = require('./routes/submit');
const statusRouter = require('./routes/status');
const agencyRouter = require('./routes/agency');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

// ── Step 1: Anonymize — must be first ────────────────────────────────────────
app.use(anonymize);

// ── Step 2: Security headers ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'"],
      imgSrc:     ["'self'", 'data:'],
      fontSrc:    ["'self'"],
      connectSrc: ["'self'"],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
}));

// ── Step 3: CORS — agency API restricted to APP_BASE_URL only ────────────────
const agencyCors = cors({
  origin: BASE_URL,
  methods: ['GET', 'POST', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
});

// Public submission API: same-origin only (served from same domain)
const publicCors = cors({
  origin: BASE_URL,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
});

// ── Step 4: Body parsing ──────────────────────────────────────────────────────
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

// ── Step 5: Verify sanitized flag on all API routes ──────────────────────────
app.use('/api', requireSanitized);

// ── Step 6: Rate limiting on public submission endpoints ─────────────────────
// Keyed on a hashed session value, not on IP (which has been deleted)
const submissionLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '5', 10),
  keyGenerator: () => 'global', // no IP available — use a single global bucket
  // For production, consider a sliding-window Redis store for per-session limiting
  // without re-introducing identifiers.
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please wait before submitting again.' },
  skip: (req) => req.path.startsWith('/api/agency'), // agency routes are authenticated
});

app.use('/api/submit', submissionLimiter);
app.use('/api/status', submissionLimiter);

// ── Step 7: Routes ────────────────────────────────────────────────────────────
app.use('/api/submit', publicCors, submitRouter);
app.use('/api/status', publicCors, statusRouter);
app.use('/api/agency', agencyCors, agencyRouter);

// ── Health check (non-sensitive) ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  // Never expose error details or stack traces to clients
  console.error('[server] Unhandled error:', err.message);
  res.status(500).json({ error: 'An internal error occurred.' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.info(`[server] CipherShield backend listening on 127.0.0.1:${PORT}`);
});

// Prevent DB/async errors from killing the process — log and continue
process.on('unhandledRejection', (err) => {
  console.error('[server] Unhandled promise rejection:', err?.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err?.message || err);
});

module.exports = app;
