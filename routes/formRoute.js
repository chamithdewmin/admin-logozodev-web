// routes/formRoute.js
const router = require('express').Router();
const ctrl = require('../controllers/smsController');

// Will be served at /api/send-sms (because of the Vercel rewrite + index mounting)
router.post('/api/send-sms', ctrl.sendSms);

// Admin list messages: GET /api/messages
router.get('/api/messages', ctrl.getAllMessages);

// Admin delete: DELETE /api/messages/:id
router.delete('/api/messages/:id', ctrl.deleteMessage);

module.exports = router;
