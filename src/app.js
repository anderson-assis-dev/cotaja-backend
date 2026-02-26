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

// Security middleware — relax policies for media/uploads
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,          // allow inline data-URIs & media
    crossOriginEmbedderPolicy: false,      // allow cross-origin media in WebView
}));

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Muitas requisições, tente novamente mais tarde.'
    }
});
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Serve static files (for test pages)
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// Serve uploaded files (use absolute path so PM2 can find them)
const uploadsDir = path.join(__dirname, '..', 'uploads');
console.log('📁 Serving uploads from:', uploadsDir);
app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
        // Allow cross-origin access for media files
        res.set('Access-Control-Allow-Origin', '*');
        // Set correct content types for media
        if (filePath.endsWith('.mp4')) res.set('Content-Type', 'video/mp4');
        else if (filePath.endsWith('.mov')) res.set('Content-Type', 'video/quicktime');
        else if (filePath.endsWith('.webm')) res.set('Content-Type', 'video/webm');
    }
}));

// API routes
app.use('/api', routes);

// Legacy compatibility routes (for Laravel API routes)
app.use('/', routes);

// Welcome route
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

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Rota não encontrada'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Erro na aplicação:', error);

    // Handle file upload errors
    if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            message: 'Arquivo muito grande'
        });
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({
            success: false,
            message: 'JSON inválido'
        });
    }

    // Default error response
    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Erro interno do servidor',
        ...(process.env.APP_ENV === 'development' && { stack: error.stack })
    });
});

// Test database connection on startup
testConnection();

module.exports = app;