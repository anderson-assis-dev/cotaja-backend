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

router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.get('/activate/:token', authController.activate.bind(authController));
router.post('/resend-activation', authController.resendActivation.bind(authController));
router.post('/verify-activation', authController.verifyActivation.bind(authController));

router.post('/logout', authenticateToken, authController.logout);
router.get('/me', authenticateToken, authController.me);
router.put('/profile', authenticateToken, updateProfileValidation, authController.updateProfile);
router.put('/profile-type', authenticateToken, updateProfileTypeValidation, authController.updateProfileType);
router.post('/fcm-token', authenticateToken, fcmTokenValidation, authController.saveFcmToken);
router.put('/avatar', authenticateToken, authController.updateAvatar);
router.post('/request-otp', authenticateToken, authController.requestOtp.bind(authController));
router.post('/change-password', authenticateToken, authController.changePasswordWithOtp.bind(authController));
router.get('/security-code', authenticateToken, authController.getSecurityCode.bind(authController));
router.put('/security-code', authenticateToken, authController.updateSecurityCode.bind(authController));
router.post('/verify-security-code', authenticateToken, authController.verifySecurityCode.bind(authController));
router.delete('/account', authenticateToken, authController.deleteAccount.bind(authController));

module.exports = router;