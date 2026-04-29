const express = require('express');
const router = express.Router();
const AffiliateController = require('../controllers/AffiliateController');
const { authenticateToken } = require('../middlewares/auth');

// rotas públicas
router.post('/apply', AffiliateController.apply);
router.get('/check/:code', AffiliateController.checkCode);

// rotas autenticadas
router.get('/me', authenticateToken, AffiliateController.getMe);
router.get('/me/conversions', authenticateToken, AffiliateController.getMyConversions);

// rota interna (chamada pelo sistema ao detectar eventos)
router.post('/conversion', AffiliateController.registerConversion);

// admin
router.get('/', authenticateToken, AffiliateController.listAll);
router.put('/:id/status', authenticateToken, AffiliateController.updateStatus);

module.exports = router;
