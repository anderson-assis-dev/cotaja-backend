const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/TrackingController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/map-token', trackingController.getMapToken);
router.get('/directions', trackingController.getDirections);

module.exports = router;
