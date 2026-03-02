const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const orderRoutes = require('./orders');
const proposalRoutes = require('./proposals');
const notificationRoutes = require('./notifications');
const serviceRoutes = require('./services');
const providerRoutes = require('./providers');
const geocodingRoutes = require('./geocoding');
const chatRoutes = require('./chat');
const walletRoutes = require('./wallet');
const adRoutes = require('./ads');

router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/proposals', proposalRoutes);
router.use('/notifications', notificationRoutes);
router.use('/services', serviceRoutes);
router.use('/providers', providerRoutes);
router.use('/geocoding', geocodingRoutes);
router.use('/chat', chatRoutes);
router.use('/wallet', walletRoutes);
router.use('/ads', adRoutes);

router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString()
    });
});

router.post('/register', authRoutes);
router.post('/login', authRoutes);

const authController = require('../controllers/AuthController');
const { authenticateToken } = require('../middlewares/auth');
const { fcmTokenValidation } = require('../utils/validation');

router.get('/me', authenticateToken, authController.me);
router.get('/user', authenticateToken, authController.me);
router.post('/logout', authenticateToken, authController.logout);
router.post('/fcm-token', authenticateToken, fcmTokenValidation, authController.saveFcmToken);
router.put('/profile', authenticateToken, authController.updateProfile);
router.put('/profile-type', authenticateToken, authController.updateProfileType);

module.exports = router;