// controllers/smsController.js
"use strict";

const https = require("https");
const querystring = require("querystring");
const db = require("../config/db"); // expected to be a mysql2/promise pool

/* ------------------------- helpers ------------------------- */

/** Build the thank-you SMS text. Keep it short for 1 segment. */
function buildThanksSms(fullName) {
  const name = (fullName || "").trim() || "there";
  return `Hi ${name}, thanks for contacting LogozoDev. We’ll reach you soon. — LogozoDev`;
}

/**
 * Normalize Sri Lankan numbers to 94XXXXXXXXX when possible.
 * Accepts: 0771234567, +94771234567, 94771234567, 094771234567, etc.
 * Returns null if nothing usable is present.
 */
function normalizeSriLankaNumber(raw) {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return null;

  // 077xxxxxxx -> 9477xxxxxxx
  if (digits.length === 10 && digits.startsWith("0")) return "94" + digits.slice(1);

  // +94xxxxxxxxx or 94xxxxxxxxx
  if (digits.length === 11 && digits.startsWith("94")) return digits;

  // 094xxxxxxxxx
  if (digits.length === 12 && digits.startsWith("094")) return digits.slice(1);

  // fallback (provider might still accept)
  return digits;
}

/** Basic email check (lightweight). */
function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || "");
}

/** Trim and collapse strings. */
function clean(v, max = 500) {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Call SMSlenz API. Returns a Promise<{ statusCode, body }>.
 * Does NOT throw on non-200; only throws on network/timeout errors.
 */
function sendSmsThroughSmslenz({ user_id, api_key, sender_id, contact, message }) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      user_id,
      api_key,
      sender_id,
      contact,
      message,
    });

    const options = {
      hostname: "smslenz.lk",
      path: "/api/send-sms",
      method: "POST",
      timeout: 10000, // 10s
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ statusCode: res.statusCode || 0, body: data || "" }));
    });

    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("SMS request timed out")));

    req.write(postData);
    req.end();
  });
}

/* ------------------------- controllers ------------------------- */

/**
 * POST /api/send-sms
 * Validates input, saves into `contact_table`, and attempts to send a thank-you SMS.
 * Responds 200 even if SMS fails (but includes sms info or null).
 */
exports.sendSms = async (req, res) => {
  try {
    // sanitize inputs
    const first_name = clean(req.body?.first_name, 100);
    const last_name  = clean(req.body?.last_name, 100);
    const email      = clean(req.body?.email, 200);
    const numberRaw  = clean(req.body?.number, 32);
    const subject    = clean(req.body?.subject, 200);
    const message    = clean(req.body?.message, 2000);

    if (!first_name || !last_name || !isEmail(email) || !numberRaw || !message) {
      return res.status(400).json({ ok: false, message: "Missing or invalid fields" });
    }

    const fullName = `${first_name} ${last_name}`.trim();
    const phoneNormalized = normalizeSriLankaNumber(numberRaw) || numberRaw;
    const thanksSms = buildThanksSms(fullName);

    // DB transaction (important for serverless)
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Make sure your table exists with fields: id PK AI, first_name, last_name, email, phone, subject, message, created_at DEFAULT CURRENT_TIMESTAMP
      const [result] = await conn.execute(
        `INSERT INTO contact_table
          (first_name, last_name, email, phone, subject, message)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [first_name, last_name, email, phoneNormalized, subject || null, message]
      );

      // Try SMS (only if env present)
      let smsResult = null;
      if (process.env.SMS_USER_ID && process.env.SMS_API_KEY && process.env.SMS_SENDER_ID) {
        try {
          smsResult = await sendSmsThroughSmslenz({
            user_id: process.env.SMS_USER_ID,
            api_key: process.env.SMS_API_KEY,
            sender_id: process.env.SMS_SENDER_ID,
            contact: phoneNormalized,
            message: thanksSms,
          });
        } catch (smsErr) {
          // Do not fail the whole request
          console.error("SMS error:", smsErr?.message || smsErr);
        }
      } else {
        console.warn("SMS env vars missing; skipping SMS send.");
      }

      await conn.commit();

      return res.status(200).json({
        ok: true,
        id: result.insertId,
        sms: smsResult ? { statusCode: smsResult.statusCode, body: smsResult.body } : null,
      });
    } catch (err) {
      await conn.rollback();
      console.error("DB error (insert/commit):", err);
      return res.status(500).json({ ok: false, error: "Database error" });
    } finally {
      conn.release();
    }
  } catch (outerErr) {
    console.error("sendSms outer error:", outerErr);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

/**
 * GET /api/messages
 * Returns all contacts ordered by created_at DESC.
 */
exports.getAllMessages = async (_req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM contact_table ORDER BY created_at DESC"
    );
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("getAllMessages error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

/**
 * DELETE /api/messages/:id
 * Deletes one contact row by id.
 */
exports.deleteMessage = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "Invalid id" });
    }

    const [result] = await db.execute("DELETE FROM contact_table WHERE id = ?", [id]);
    if (!result.affectedRows) {
      return res.status(404).json({ ok: false, message: "Not found" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("deleteMessage error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};
