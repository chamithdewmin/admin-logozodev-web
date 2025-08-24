// server.js (LOCAL DEV ONLY)
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET','POST','DELETE','OPTIONS']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', require('./routes/formRoute'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Local API on http://localhost:${PORT}`));
