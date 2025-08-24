// server.js (LOCAL DEV ONLY)
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

/**
 * For local testing:
 * - Add the ports you actually use (Live Server, Vite, Next dev, etc.)
 * - file:// origins cannot be whitelisted; serve your HTML via a local server.
 */
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5501'
  ],
  methods: ['GET','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Your API routes
app.use('/api', require('./routes/formRoute'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Local API running at http://localhost:${PORT}`);
});
