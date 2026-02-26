const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
    try {
        const token = extractTokenFromHeader(req.headers.authorization);
        const decoded = verifyToken(token);

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        const AUTH_MESSAGES = ['Token inválido', 'Token não fornecido', 'Formato de token inválido'];
        const isAuthError = AUTH_MESSAGES.includes(error.message);
        if (isAuthError) {
            return res.status(401).json({
                success: false,
                message: error.message || 'Token inválido'
            });
        }
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }

        if (!roles.includes(req.user.profile_type)) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado'
            });
        }

        next();
    };
};

const requireClient = requireRole(['client']);
const requireProvider = requireRole(['provider']);

module.exports = {
    authenticateToken,
    requireRole,
    requireClient,
    requireProvider
};