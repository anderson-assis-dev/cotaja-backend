const express = require('express');
const router = express.Router();
const messageController = require('../controllers/MessageController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

// Messages for a specific order
router.get('/:orderId/messages', messageController.index);
router.post('/:orderId/messages', messageController.store);
router.get('/:orderId/messages/unread', messageController.unreadCount);

module.exports = router;
