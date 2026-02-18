const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const orderRoutes = require('./orders');
const proposalRoutes = require('./proposals');
const notificationRoutes = require('./notifications');
const serviceRoutes = require('./services');
const geocodingRoutes = require('./geocoding');
const chatRoutes = require('./chat');

// API routes
router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/proposals', proposalRoutes);
router.use('/notifications', notificationRoutes);
router.use('/services', serviceRoutes);
router.use('/geocoding', geocodingRoutes);
router.use('/chat', chatRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString()
    });
});

// Legacy routes for compatibility (matching Laravel routes)
router.post('/register', authRoutes);
router.post('/login', authRoutes);

// Direct routes for compatibility
const authController = require('../controllers/AuthController');
const { authenticateToken } = require('../middlewares/auth');
const { fcmTokenValidation } = require('../utils/validation');

router.get('/me', authenticateToken, authController.me);
router.get('/user', authenticateToken, authController.me); // Laravel compatibility
router.post('/logout', authenticateToken, authController.logout); // Direct logout route
router.post('/fcm-token', authenticateToken, fcmTokenValidation, authController.saveFcmToken); // Direct FCM token route
router.put('/profile', authenticateToken, authController.updateProfile); // Direct profile route
router.put('/profile-type', authenticateToken, authController.updateProfileType); // Direct profile type route

module.exports = router;