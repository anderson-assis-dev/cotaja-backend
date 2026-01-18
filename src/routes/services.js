const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/ServiceController');
const { authenticateToken } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticateToken);

// Service routes
router.get('/', serviceController.index);
router.post('/', serviceController.create);
router.get('/my-services', serviceController.myServices);
router.get('/:id', serviceController.show);
router.put('/:id', serviceController.update);
router.delete('/:id', serviceController.delete);

module.exports = router;