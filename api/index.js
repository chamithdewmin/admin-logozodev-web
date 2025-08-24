// api/index.js
const express = require('express');
const cors = require('cors');

if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch {}
}

const app = express();

/**
 * CORS: allow your Hostinger site + localhost for testing.
 * Replace EXAMPLE domains with your real ones if needed.
 */
const allowed = [
  'https://logozodev.com',
  'https://www.logozodev.com',
  // Hostinger preview or custom URL you use:
  'https://auth-db2027.hstgr.io',
  'http://127.0.0.1:5501',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, cb) => {
    // allow same-origin / curl / server-side and listed hosts
    if (!origin || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked: ' + origin));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  credentials: false
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// simple health check
app.get('/api/health', (_req, res) => res.json({ ok: true, t: Date.now() }));

// Mount your routes AT ROOT so final paths are /api/send-sms, /api/messages, ...
app.use('/', require('../routes/formRoute'));

// Export for Vercel - NO app.listen here.
module.exports = app;
module.exports.handler = (req, res) => app(req, res);
