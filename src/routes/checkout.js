const express = require('express');
const router = express.Router();
const PublicCheckoutController = require('../controllers/PublicCheckoutController');

router.post('/premium', PublicCheckoutController.premiumCheckout);
router.post('/premium/confirm', PublicCheckoutController.confirmPremium);

module.exports = router;
