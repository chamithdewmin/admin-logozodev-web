// /api/index.js  --> Vercel Serverless entry
const express = require('express');
const cors = require('cors');

// In local dev you might use .env; on Vercel use Project Settings -> Environment Variables
if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch {}
}

const app = express();

app.use(cors({
  origin: [
    'https://logozodev.com',
    'https://www.logozodev.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// health
app.get('/api/health', (_req, res) => res.json({ ok: true, t: Date.now() }));

// your routes (controllers use contact_table already)
app.use('/api', require('../routes/formRoute'));

// Export Express app as a Vercel handler (NO app.listen here!)
module.exports = app;
module.exports.handler = (req, res) => app(req, res);
