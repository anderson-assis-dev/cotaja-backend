const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/NotificationController');
const pushController = require('../controllers/PushNotificationController');
const { authenticateToken } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticateToken);

// Notification routes
router.get('/', notificationController.index);
router.get('/unread-count', notificationController.unreadCount);
router.put('/:id/read', notificationController.markAsRead);
router.put('/mark-all-read', notificationController.markAllAsRead);

// Push notification routes
router.post('/push/send', pushController.send);
router.post('/push/bulk', pushController.sendBulk);
router.post('/push/user', pushController.sendToUser);
router.post('/push/test', pushController.test);
router.get('/push/status', pushController.status);

module.exports = router;