const router = require('express').Router();
const ctrl = require('../controllers/smsController');

// POST /api/send-sms  (Create + Auto-SMS)
router.post('/send-sms', ctrl.sendSms);

// GET /api/messages   (List for admin)
router.get('/messages', ctrl.getAllMessages);

// DELETE /api/messages/:id  (Admin delete)
router.delete('/messages/:id', ctrl.deleteMessage);

module.exports = router;
