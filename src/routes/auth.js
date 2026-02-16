const express = require('express');
const router = express.Router();
const authController = require('../controllers/AuthController');
const { authenticateToken } = require('../middlewares/auth');
const {
    registerValidation,
    loginValidation,
    updateProfileValidation,
    updateProfileTypeValidation,
    fcmTokenValidation
} = require('../utils/validation');

// Public routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.get('/activate/:token', authController.activate.bind(authController));

// Protected routes
router.post('/logout', authenticateToken, authController.logout);
router.get('/me', authenticateToken, authController.me);
router.put('/profile', authenticateToken, updateProfileValidation, authController.updateProfile);
router.put('/profile-type', authenticateToken, updateProfileTypeValidation, authController.updateProfileType);
router.post('/fcm-token', authenticateToken, fcmTokenValidation, authController.saveFcmToken);
router.put('/avatar', authenticateToken, authController.updateAvatar);

module.exports = router;