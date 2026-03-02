const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/ServiceController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/', serviceController.index);
router.get('/available', serviceController.available);
router.post('/', serviceController.create);
router.get('/my-services', serviceController.myServices);
router.get('/provider/:providerId', serviceController.providerServices);
router.get('/:id', serviceController.show);
router.put('/:id', serviceController.update);
router.delete('/:id', serviceController.delete);

module.exports = router;