const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/RatingController');
const quoteController = require('../controllers/ProviderQuoteController');
const ProfileView = require('../models/ProfileView');
const { authenticateToken, requireClient } = require('../middlewares/auth');
const multer = require('multer');
const path = require('node:path');

const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp/'),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => cb(null, true),
});

router.use(authenticateToken);

router.get('/my-viewers', async (req, res) => {
  try {
    const user = req.user;
    if (!user.isProvider()) {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }
    const data = await ProfileView.getStats(user.id, user.is_premium === 1);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao buscar visualizações do perfil:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

router.post('/:providerId/view', async (req, res) => {
  try {
    const { providerId } = req.params;
    const viewerId = req.user?.id || null;
    await ProfileView.record(providerId, viewerId);
    return res.json({ success: true });
  } catch (error) {
    console.error('Erro ao registrar visualização de perfil:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

router.post(
  '/:providerId/ratings',
  (req, res, next) => {
    const m = upload.array('attachments', 10);
    m(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: 'Erro ao processar arquivos: ' + err.message });
      }
      next();
    });
  },
  requireClient,
  ratingController.create
);

router.get('/:providerId/ratings', ratingController.index);
router.post('/:providerId/request-quote', requireClient, quoteController.requestQuote);

module.exports = router;
