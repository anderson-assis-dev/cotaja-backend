const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');
require('dotenv').config();

const { testConnection } = require('./config/database');
const routes = require('./routes');

const app = express();

// Security middleware
app.use(helmet());

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (for test pages)
app.use('/public', express.static('public'));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

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