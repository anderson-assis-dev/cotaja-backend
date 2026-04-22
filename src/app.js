const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/database');
const routes = require('./routes');

const app = express();

const { webhook } = require('./controllers/SubscriptionController');
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), webhook);

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));

app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Muitas requisições, tente novamente mais tarde.'
    }
});
app.use('/api', limiter);

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

app.use('/public', express.static(path.join(__dirname, '..', 'public')));

const uploadsDir = path.join(__dirname, '..', 'uploads');
console.log('📁 Serving uploads from:', uploadsDir);
app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
        res.set('Access-Control-Allow-Origin', '*');
        if (filePath.endsWith('.mp4')) res.set('Content-Type', 'video/mp4');
        else if (filePath.endsWith('.mov')) res.set('Content-Type', 'video/quicktime');
        else if (filePath.endsWith('.webm')) res.set('Content-Type', 'video/webm');
    }
}));

app.use('/api', routes);

app.use('/', routes);

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Cotaja API - Node.js Version',
        version: '1.0.0',
        documentation: '/api/health',
        test_pages: {
            push_notifications: '/public/test-push.html'
        }
    });
});

app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Rota não encontrada'
    });
});

app.use((error, req, res, next) => {
    console.error('Erro na aplicação:', error);

    if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            message: 'Arquivo muito grande'
        });
    }

    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({
            success: false,
            message: 'JSON inválido'
        });
    }

    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Erro interno do servidor',
        ...(process.env.APP_ENV === 'development' && { stack: error.stack })
    });
});

testConnection();

module.exports = app;