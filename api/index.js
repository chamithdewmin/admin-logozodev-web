// api/index.js
const express = require('express');
const cors = require('cors');

if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch {}
}

const app = express();

app.use(cors({
  origin: [
    'https://logozodev.com',
    'https://www.logozodev.com',
    'https://admin-logozodev-web.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5501'  // your local file server
  ],
  methods: ['GET','POST','DELETE','OPTIONS'],
  credentials: false
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// health check
app.get('/api/health', (_req, res) => res.json({ ok: true, t: Date.now() }));

// mount your routes (they add /send-sms, /messages, etc. under /api)
app.use('/api', require('../routes/formRoute'));

// Vercel expects a function handler. Express app is a compatible function:
module.exports = (req, res) => app(req, res);
