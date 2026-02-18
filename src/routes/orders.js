const express = require('express');
const router = express.Router();
const orderController = require('../controllers/OrderController');
const fileUploadService = require('../services/FileUploadService');
const { authenticateToken } = require('../middlewares/auth');
const {
    createOrderValidation,
    updateOrderValidation
} = require('../utils/validation');

// All routes require authentication
router.use(authenticateToken);

// Middleware simplificado para upload (usa pasta temporária)
const multer = require('multer');
const upload = multer({
    dest: 'uploads/temp/',
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 10
    },
    fileFilter: (req, file, cb) => {
        console.log('📎 Recebendo arquivo:', file.originalname, file.mimetype);
        cb(null, true);
    }
});

// Order routes
router.get('/', orderController.index);
router.post('/', (req, res, next) => {
    console.log('📥 POST /orders recebido');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Content-Length:', req.headers['content-length']);
    next();
}, (req, res, next) => {
    // Custom error handler para multer
    const multerMiddleware = upload.array('attachments', 10);
    multerMiddleware(req, res, (err) => {
        if (err) {
            console.error('❌ Erro no multer:', err);
            return res.status(400).json({
                success: false,
                message: 'Erro ao processar arquivos: ' + err.message
            });
        }
        console.log('✅ Multer processou. Arquivos:', req.files?.length || 0);
        console.log('Body fields:', Object.keys(req.body));
        next();
    });
}, createOrderValidation, orderController.store);
router.get('/available', orderController.available);
router.get('/recent', orderController.recent);
router.get('/stats', orderController.stats);
router.get('/:id', orderController.show);
router.put('/:id', (req, res, next) => {
    console.log('📥 PUT /orders/:id recebido');
    console.log('Content-Type:', req.headers['content-type']);
    next();
}, (req, res, next) => {
    // Custom error handler para multer
    const multerMiddleware = upload.array('attachments', 10);
    multerMiddleware(req, res, (err) => {
        if (err) {
            console.error('❌ Erro no multer:', err);
            return res.status(400).json({
                success: false,
                message: 'Erro ao processar arquivos: ' + err.message
            });
        }
        console.log('✅ Multer processou. Arquivos:', req.files?.length || 0);
        console.log('Body fields:', Object.keys(req.body));
        next();
    });
}, updateOrderValidation, orderController.update);
router.delete('/:id', orderController.destroy);
router.post('/:id/start-auction', orderController.startAuction);
router.post('/:id/cancel', orderController.cancel);
router.post('/:id/schedule', orderController.schedule);
router.post('/:id/confirm-schedule', orderController.confirmSchedule);

module.exports = router;