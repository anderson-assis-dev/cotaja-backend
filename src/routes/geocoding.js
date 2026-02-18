const express = require('express');
const router = express.Router();
const geocodingController = require('../controllers/GeocodingController');
const { authenticateToken } = require('../middlewares/auth');

// All geocoding routes require authentication
router.use(authenticateToken);

// Get MapKit JS token for frontend WebView
router.get('/token', geocodingController.getMapKitToken);

// Reverse geocode: lat/lng → address
router.get('/reverse', geocodingController.reverseGeocode);

// Forward geocode: address → lat/lng
router.get('/forward', geocodingController.forwardGeocode);

// Search addresses
router.get('/search', geocodingController.search);

module.exports = router;
