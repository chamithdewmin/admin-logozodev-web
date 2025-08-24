// server/controllers/smsController.js
"use strict";

const https = require("https");
const querystring = require("querystring");
const db = require("../config/db");

/**
 * Build the thank-you SMS text.
 */
function buildThanksSms(fullName) {
  return `Hi ${fullName}, thanks for contacting LogozoDev. We’ll reach you soon.\n— LogozoDev Team`;
}

/**
 * Normalize Sri Lankan numbers into 94XXXXXXXXX when possible.
 * Accepts: 0771234567, +94771234567, 94771234567, etc.
 */
function normalizeSriLankaNumber(raw) {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return null;

  // 077xxxxxxx -> 9477xxxxxxx
  if (digits.length === 10 && digits.startsWith("0")) {
    return "94" + digits.slice(1);
  }
  // +94xxxxxxxxx or 94xxxxxxxxx
  if (digits.length === 11 && digits.startsWith("94")) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith("094")) {
    return digits.slice(1);
  }

  // Fallback: return digits (provider may still accept)
  return digits;
}

/**
 * Call SMSlenz API. Returns a Promise<{ statusCode, body }>.
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
      timeout: 10000, // 10s safety timeout
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () =>
        resolve({ statusCode: res.statusCode || 0, body: data || "" })
      );
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("SMS request timed out"));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * POST /api/send-sms
 * Saves the contact in DB and attempts to send a thank-you SMS.
 */
exports.sendSms = async (req, res) => {
  try {
    const { first_name, last_name, email, number, subject, message } = req.body || {};

    // Basic validation
    if (!first_name || !last_name || !email || !number || !message) {
      return res.status(400).json({ ok: false, message: "Missing required fields" });
    }

    const fullName = `${first_name} ${last_name}`.trim();
    const phoneNormalized = normalizeSriLankaNumber(number);
    const smsMessage = buildThanksSms(fullName);

    // Use a single connection for better control (esp. on serverless)
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // IMPORTANT: using contact_table (your chosen name)
      const [result] = await conn.execute(
        `INSERT INTO contact_table
          (first_name, last_name, email, phone, subject, message)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          first_name,
          last_name,
          email,
          phoneNormalized || number,
          subject || null,
          message,
        ]
      );

      // Try to send SMS, but don't fail the whole request if SMS fails
      let smsResponse = null;
      try {
        smsResponse = await sendSmsThroughSmslenz({
          user_id: process.env.SMS_USER_ID,
          api_key: process.env.SMS_API_KEY,
          sender_id: process.env.SMS_SENDER_ID,
          contact: phoneNormalized || number,
          message: smsMessage,
        });
      } catch (smsErr) {
        // Log but continue
        console.error("SMS error:", smsErr?.message || smsErr);
      }

      await conn.commit();

      return res.status(200).json({
        ok: true,
        id: result.insertId,
        sms: smsResponse ? smsResponse.body : null,
      });
    } catch (err) {
      await conn.rollback();
      console.error("DB error (insert/commit):", err);
      return res.status(500).json({ ok: false, error: err.message });
    } finally {
      conn.release();
    }
  } catch (outerErr) {
    console.error("sendSms outer error:", outerErr);
    return res.status(500).json({ ok: false, error: outerErr.message });
  }
};

/**
 * GET /api/messages
 * Returns all contacts ordered by created_at desc.
 */
exports.getAllMessages = async (_req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM contact_table ORDER BY created_at DESC"
    );
    return res.json(rows);
  } catch (err) {
    console.error("getAllMessages error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

/**
 * DELETE /api/messages/:id
 * Deletes one message.
 */
exports.deleteMessage = async (req, res) => {
  try {
    const id = req.params.id;
    const [result] = await db.execute("DELETE FROM contact_table WHERE id = ?", [id]);
    if (!result.affectedRows) {
      return res.status(404).json({ ok: false, message: "Not found" });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("deleteMessage error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
