const router = require('express').Router();
const ctrl = require('../controllers/smsController');

router.post('/send-sms', ctrl.sendSms);
router.get('/messages', ctrl.getAllMessages);
router.delete('/messages/:id', ctrl.deleteMessage);

module.exports = router;
