const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,           // e.g., mysql.hostinger.com (NO http://)
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  // If your host requires SSL, uncomment below. If not, remove ssl.
  // ssl: { rejectUnauthorized: false }
});

module.exports = pool;
