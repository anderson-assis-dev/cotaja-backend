const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/ReceiptController');

// Conferencia publica: quem recebe o comprovante confere sem ter conta.
router.get('/:codigo', receiptController.porCodigo);

module.exports = router;
