const express = require('express');
const router = express.Router();
const WalletController = require('../controllers/WalletController');
const { authenticateToken } = require('../middlewares/auth');

router.post('/', authenticateToken, WalletController.createWallet);
router.get('/', authenticateToken, WalletController.getWallet);
router.post('/setup-intent', authenticateToken, WalletController.createSetupIntent);
router.delete('/cards/:payment_method_id', authenticateToken, WalletController.removeCard);

module.exports = router;
