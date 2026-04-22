const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth');
const subscriptionController = require('../controllers/SubscriptionController');

router.get('/status', authenticateToken, subscriptionController.status);
router.post('/subscribe', authenticateToken, subscriptionController.subscribe);
router.post('/cancel', authenticateToken, subscriptionController.cancel);

module.exports = router;
