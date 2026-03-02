const express = require('express');
const router = express.Router();
const adController = require('../controllers/AdController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/packages', adController.getPackages);
router.post('/purchase', adController.purchasePackage);
router.get('/purchases', adController.getMyPurchases);
router.get('/credits', adController.getAdCredits);
router.post('/schedule', adController.scheduleAd);
router.get('/my-ads', adController.getMyAds);
router.post('/:id/cancel', adController.cancelAd);

module.exports = router;
