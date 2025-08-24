// /api/index.js  --> Vercel Serverless entry
const express = require('express');
const cors = require('cors');

// Load .env only in local dev; on Vercel use Project Settings -> Environment Variables
if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch {}
}

const app = express();

// CORS (frontend is on Hostinger; backend is on Vercel)
const corsOptions = {
  origin: [
    'https://logozodev.com',
    'https://www.logozodev.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5501'
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // handle preflight

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check -> reachable at /api/health
app.get('/health', (_req, res) => {
  res.json({ ok: true, t: Date.now() });
});

// IMPORTANT: do NOT prefix with /api here; Vercel already does it.
// Your routes will be available at /api/<whatever-you-define>
app.use('/', require('../routes/formRoute'));

// Export the Express app (no app.listen on Vercel)
module.exports = app;
