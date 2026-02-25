const express = require('express');
const router = express.Router();
const geocodingController = require('../controllers/GeocodingController');
const { authenticateToken } = require('../middlewares/auth');

// All geocoding routes require authentication
router.use(authenticateToken);

// Get MapKit JS token for frontend WebView
router.get('/token', geocodingController.getMapKitToken);

// Reverse geocode: lat/lng → endereço
router.get('/reverse', geocodingController.reverseGeocode);

// Forward geocode: endereço → lat/lng
router.get('/forward', geocodingController.forwardGeocode);

// Buscar endereços (autocomplete)
router.get('/search', geocodingController.search);

// Consultar CEP → endereço (ViaCEP)
router.get('/cep/:cep', geocodingController.lookupCep);

module.exports = router;
