const express = require('express');
const router = express.Router();
const geocodingController = require('../controllers/GeocodingController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/token', geocodingController.getMapKitToken);

router.get('/reverse', geocodingController.reverseGeocode);

router.get('/forward', geocodingController.forwardGeocode);

router.get('/search', geocodingController.search);

router.get('/cep/:cep', geocodingController.lookupCep);

module.exports = router;
