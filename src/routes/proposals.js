const express = require('express');
const router = express.Router();
const proposalController = require('../controllers/ProposalController');
const { authenticateToken } = require('../middlewares/auth');
const {
    createProposalValidation,
    updateProposalValidation
} = require('../utils/validation');

router.use(authenticateToken);

router.get('/', proposalController.index);
router.post('/', createProposalValidation, proposalController.store);
router.get('/:id', proposalController.show);
router.put('/:id', updateProposalValidation, proposalController.update);
router.post('/:id/accept', proposalController.accept);
router.post('/:id/reject', proposalController.reject);
router.post('/:id/withdraw', proposalController.withdraw);

module.exports = router;